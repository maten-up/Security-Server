import {createHash} from 'node:crypto';
export const FLOOD_FLAGS=new Set(['message-flood','duplicate-spam','mention-flood']);
export function windowPush(old,now,ms,max){return [...old.filter(t=>t>now-ms&&t<=now),now].slice(-max);}
export function fingerprint(text){const n=text.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g,'').toLowerCase().replace(/\s+/g,' ').trim();return n?createHash('sha256').update(n).digest('hex'):'';}
export function assess(i){
 const flags=new Set();
 if(i.count>=i.limit)flags.add('message-flood');
 if(i.repeat>=i.repeatLimit)flags.add('duplicate-spam');
 if(i.mentions>=i.mentionLimit||i.everyone)flags.add('mention-flood');
 const links=i.text.match(/https?:\/\/[^\s<>]+|(?:\b(?:www\.)?discord\.gg\/|\b(?:www\.)?(?:discord\.com|discordapp\.com)\/invite\/)[^\s<>]+/gi)||[];
 for(const raw of links.slice(0,100)){try{
   const u=new URL(/^https?:\/\//i.test(raw)?raw:'https://'+raw),h=u.hostname.toLowerCase().replace(/\.$/,'');
   const invite=['discord.gg','www.discord.gg'].includes(h)||(['discord.com','www.discord.com','discordapp.com','www.discordapp.com'].includes(h)&&/^\/invite\//i.test(u.pathname));
   if(i.blockInvite&&invite)flags.add('external-invite');
   if(i.blockedHosts.some(d=>h===d||h.endsWith('.'+d)))flags.add('blocked-domain');
 }catch{}}
 return [...flags];
}
export class Tracker{
 constructor(capacity=10000){this.capacity=capacity;this.users=new Map();this.joins=[];}
 observe(id,text,now){let item=this.users.get(id);if(!item){if(this.users.size>=this.capacity)return null;item={times:[],hashes:[],last:now,alert:-Infinity,timeout:-Infinity};this.users.set(id,item);}item.last=now;item.times=windowPush(item.times,now,10000,30);item.hashes=item.hashes.filter(x=>x.time>now-30000&&x.time<=now);const hash=fingerprint(text);if(hash)item.hashes.push({hash,time:now});item.hashes=item.hashes.slice(-100);return {item,count:item.times.length,repeat:hash?item.hashes.filter(x=>x.hash===hash).length:0};}
 join(now){this.joins=windowPush(this.joins,now,15000,100);return this.joins.length;}
 sweep(now){for(const [id,v] of this.users)if(now-v.last>60000)this.users.delete(id);}
}
export class Budget{constructor(limit,ms){this.limit=limit;this.ms=ms;this.times=[];}take(now){this.times=this.times.filter(t=>t>now-this.ms&&t<=now);if(this.times.length>=this.limit)return false;this.times.push(now);return true;}}
