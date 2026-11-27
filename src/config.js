import {domainToASCII} from 'node:url';
const snow=s=>/^\d{17,20}$/.test(s||'');
const list=s=>(s||'').split(',').map(x=>x.trim()).filter(Boolean);
export function configFrom(e){
  if(!e.DISCORD_TOKEN?.trim()||!snow(e.GUILD_ID)||!snow(e.LOG_CHANNEL_ID))throw Error('Set DISCORD_TOKEN, GUILD_ID and LOG_CHANNEL_ID');
  function int(k,d,min,max){const raw=e[k]||String(d),n=Number(raw);if(!/^\d+$/.test(raw)||!Number.isSafeInteger(n)||n<min||n>max)throw Error('Invalid '+k);return n;}
  const mode=e.MODE||'observe';if(!['observe','enforce'].includes(mode))throw Error('Invalid MODE');
  if(e.BLOCK_INVITES&&!['true','false'].includes(e.BLOCK_INVITES))throw Error('Invalid BLOCK_INVITES');
  const exempt=list(e.EXEMPT_ROLE_IDS);if(exempt.some(x=>!snow(x)))throw Error('Invalid EXEMPT_ROLE_IDS');
  const blockedHosts=list(e.BLOCKED_HOSTS).map(x=>domainToASCII(x.toLowerCase().replace(/\.$/,'')));
  if(blockedHosts.some(x=>!x||!x.includes('.')||x.length>253||x.split('.').some(y=>!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(y))))throw Error('BLOCKED_HOSTS requires bare hostnames');
  return {token:e.DISCORD_TOKEN.trim(),guildId:e.GUILD_ID,logId:e.LOG_CHANNEL_ID,mode,exempt:new Set(exempt),blockedHosts,blockInvite:e.BLOCK_INVITES==='true',limit:int('MESSAGE_LIMIT',6,3,30),repeatLimit:int('REPEAT_LIMIT',4,3,20),mentionLimit:int('MENTION_LIMIT',5,2,30),joinLimit:int('JOIN_LIMIT',8,3,100),timeoutSeconds:int('TIMEOUT_SECONDS',60,10,600),python:e.PYTHON_BIN||'python3'};
}
