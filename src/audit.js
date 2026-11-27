import {mkdir,appendFile,stat,rename,rm} from 'node:fs/promises';
import {dirname} from 'node:path';
export class Audit{
 constructor(file,{maxBytes=5*1024*1024,maxPending=1000,onError=()=>{}}={}){Object.assign(this,{file,maxBytes,maxPending,onError,pending:0,dropped:0,errors:0,queue:Promise.resolve()});}
 async init(){await mkdir(dirname(this.file),{recursive:true,mode:0o700});}
 record({kind,flags=[],action}){
  if(this.pending>=this.maxPending){this.dropped++;return Promise.resolve(false);}
  this.pending++;
  const line=JSON.stringify({time:new Date().toISOString(),kind,flags,action})+'\n';
  const next=this.queue.then(async()=>{const size=await stat(this.file).then(s=>s.size).catch(e=>{if(e.code==='ENOENT')return 0;throw e;});if(size&&size+Buffer.byteLength(line)>this.maxBytes){await rm(this.file+'.1',{force:true});await rename(this.file,this.file+'.1');}await appendFile(this.file,line,{mode:0o600});return true;}).catch(e=>{this.errors++;this.onError(e);return false;}).finally(()=>this.pending--);
  this.queue=next;return next;
 }
 flush(){return this.queue;}
}
