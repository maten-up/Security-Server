import {Client,GatewayIntentBits,PermissionFlagsBits,Events,SlashCommandBuilder,EmbedBuilder,MessageFlags,ChannelType} from 'discord.js';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {configFrom} from './src/config.js';
import {assess,Tracker,Budget,FLOOD_FLAGS} from './src/policy.js';
import {Audit} from './src/audit.js';
const cfg=configFrom(process.env);
const file=fileURLToPath(new URL('./data/events.jsonl',import.meta.url)),reportScript=fileURLToPath(new URL('./python/report.py',import.meta.url));
const fail=(label,e)=>console.error(label,String(e?.code||e?.name||'error'));
const audit=new Audit(file,{onError:e=>fail('Audit',e)});await audit.init();
const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent],allowedMentions:{parse:[]}});
const tracker=new Tracker(),alerts=new Budget(4,10000),deletes=new Budget(30,10000),timeouts=new Budget(8,10000);
let ready=false,raidUntil=0,reportRunning=false,stopping=false,overflow=0,suppressed=0;
const actions={observed:0,deleted:0,timeouts:0,failed:0};
function exempt(m){return !m||m.id===m.guild.ownerId||m.permissions.has(PermissionFlagsBits.ManageMessages)||m.permissions.has(PermissionFlagsBits.ModerateMembers)||m.roles.cache.some(r=>cfg.exempt.has(r.id));}
async function logChannel(guild){const c=await guild.channels.fetch(cfg.logId).catch(()=>null);return c?.type===ChannelType.GuildText&&c.permissionsFor(guild.roles.everyone)?.has(PermissionFlagsBits.ViewChannel)===false&&guild.members.me&&c.permissionsFor(guild.members.me)?.has([PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.EmbedLinks])?c:null;}
async function alert(guild,event,memberId){
 await audit.record(event);if(!alerts.take(Date.now())){suppressed++;return;}
 const channel=await logChannel(guild);if(!channel){suppressed++;return;}
 const embed=new EmbedBuilder().setColor(0xd97706).setTitle('Security-Server | '+event.kind).addFields({name:'Indicators',value:event.flags.join(', ')||'None'},{name:'Action',value:event.action}).setTimestamp();
 if(memberId)embed.addFields({name:'Member ID',value:memberId});
 await channel.send({embeds:[embed],allowedMentions:{parse:[]}}).catch(e=>{suppressed++;fail('Alert',e);});
}
async function scan(m,edited=false){
 if(!ready||stopping||m.guildId!==cfg.guildId||m.author?.bot||m.webhookId||exempt(m.member)||typeof m.content!=='string')return;
 const now=Date.now();const result=edited?{item:tracker.users.get(m.author.id),count:0,repeat:0}:tracker.observe(m.author.id,m.content,now);if(!result)overflow++;
 const flags=assess({...cfg,count:result?.count||0,repeat:result?.repeat||0,mentions:m.mentions.users.size+m.mentions.roles.size,everyone:m.mentions.everyone,text:m.content});if(!flags.length)return;
 const item=result?.item;let action='observed';actions.observed++;
 if(cfg.mode==='enforce'){
  if(m.deletable&&deletes.take(now)){try{await m.delete();actions.deleted++;action='deleted';}catch(e){actions.failed++;action='delete-failed';fail('Delete',e);}}else action='delete-skipped';
  if(item&&flags.some(f=>FLOOD_FLAGS.has(f))&&m.member?.moderatable&&now-item.timeout>=60000&&timeouts.take(now)){item.timeout=now;try{await m.member.timeout(cfg.timeoutSeconds*1000,'Security-Server: '+flags.join(', '));actions.timeouts++;action+='+timeout';}catch(e){actions.failed++;action+='+timeout-failed';fail('Timeout',e);}}
 }
 if(!item||now-item.alert>=10000){if(item)item.alert=now;await alert(m.guild,{kind:edited?'message-edit-risk':'message-risk',flags,action},m.author.id);}
}
const commands=[['security-status','View security mode, raid indicator and counters'],['security-report','Get a private Python incident report'],['security-check','Check permissions and logging']].map(([n,d])=>new SlashCommandBuilder().setName(n).setDescription(d).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild));
const safe=(label,fn)=>(...args)=>{void Promise.resolve().then(()=>fn(...args)).catch(e=>fail(label,e));};
client.once(Events.ClientReady,safe('Startup',async c=>{try{const guild=await c.guilds.fetch(cfg.guildId);if(!await logChannel(guild)){console.error('Configure a private moderator text channel with send/embed permissions.');throw Error('Invalid log channel');}const existing=await guild.commands.fetch();for(const command of commands){const old=existing.find(x=>x.name===command.name);if(old)await guild.commands.edit(old.id,command.toJSON());else await guild.commands.create(command.toJSON());}ready=true;console.log('Security-Server 1.1.0 ready ('+cfg.mode+')');}catch(e){fail('Startup',e);client.destroy();process.exitCode=1;}}));
client.on(Events.MessageCreate,safe('Message',m=>scan(m)));
client.on(Events.MessageUpdate,safe('Edit',async(old,m)=>{if(!m.partial&&typeof m.content==='string'&&old.content!==m.content)await scan(m,true);}));
client.on(Events.GuildMemberAdd,safe('Join',async m=>{if(!ready||stopping||m.guild.id!==cfg.guildId||m.user.bot)return;const now=Date.now();if(tracker.join(now)>=cfg.joinLimit&&now>=raidUntil){raidUntil=now+60000;await alert(m.guild,{kind:'join-surge',flags:['raid-indicator'],action:'alert-only'});}if(now-m.user.createdTimestamp<86400000)await alert(m.guild,{kind:'new-account',flags:['account-under-24h'],action:'alert-only'},m.id);}));
function pythonReport(){return new Promise((resolve,reject)=>{const env={...process.env};delete env.DISCORD_TOKEN;const p=spawn(cfg.python,[reportScript,file],{shell:false,windowsHide:true,stdio:['ignore','pipe','ignore'],env});let output='',done=false;const finish=(err,v)=>{if(done)return;done=true;clearTimeout(timer);err?reject(err):resolve(v);};const timer=setTimeout(()=>{p.kill();finish(Error('Report timeout'));},8000);p.stdout.on('data',b=>{output+=b.toString();if(output.length>16000){p.kill();finish(Error('Report too large'));}});p.on('error',e=>finish(e));p.on('close',code=>finish(code===0?null:Error('Report failed'),output));});}
client.on(Events.InteractionCreate,safe('Interaction',async i=>{
 if(!i.isChatInputCommand()||i.guildId!==cfg.guildId||!commands.some(c=>c.name===i.commandName))return;
 const reply=content=>i.reply({content,flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}});
 if(!i.memberPermissions?.has(PermissionFlagsBits.ManageGuild))return reply('Manage Server required.');if(!ready||stopping)return reply('Security service not ready.');
 if(i.commandName==='security-status')return reply(['Mode: '+cfg.mode,'Raid indicator: '+(Date.now()<raidUntil?'active':'normal'),'Flagged messages: '+actions.observed,'Deleted: '+actions.deleted+' | Timeouts: '+actions.timeouts+' | Failed: '+actions.failed,'Tracker overflow: '+overflow+' | Alerts suppressed: '+suppressed+' | Audit dropped/errors: '+audit.dropped+'/'+audit.errors].join('\n'));
 if(i.commandName==='security-check'){await i.deferReply({flags:MessageFlags.Ephemeral});const p=i.guild.members.me?.permissions;return i.editReply({content:['Private log channel: '+(await logChannel(i.guild)?'OK':'FAIL'),'Manage Messages (guild): '+Boolean(p?.has(PermissionFlagsBits.ManageMessages)),'Moderate Members (guild): '+Boolean(p?.has(PermissionFlagsBits.ModerateMembers)),'Administrator: '+Boolean(p?.has(PermissionFlagsBits.Administrator))+' (should be false)','Check channel overrides and role hierarchy.'].join('\n'),allowedMentions:{parse:[]}});}
 if(reportRunning)return reply('Report already running.');reportRunning=true;try{await i.deferReply({flags:MessageFlags.Ephemeral});await audit.flush();await i.editReply({content:(await pythonReport()).slice(0,1900),allowedMentions:{parse:[]}});}catch(e){fail('Report',e);if(i.deferred)await i.editReply('Report unavailable. Check Python setup.').catch(()=>{});}finally{reportRunning=false;}
}));
const sweep=setInterval(()=>tracker.sweep(Date.now()),30000);sweep.unref();client.on(Events.Error,e=>fail('Discord',e));
for(const sig of ['SIGINT','SIGTERM'])process.once(sig,()=>{stopping=true;clearInterval(sweep);client.destroy();void audit.flush().then(()=>{process.exitCode=0;});});
await client.login(cfg.token);
