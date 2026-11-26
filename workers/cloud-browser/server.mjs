import {createServer} from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {chromium} from 'playwright-core';
import {BrowserService,BrowserError} from './service.mjs';
import {AUTOMATIC,SOURCES} from './protocol.mjs';

const token=process.env.CLOUD_BROWSER_TOKEN||'';
if(token.length<32)throw new Error('CLOUD_BROWSER_TOKEN doit contenir au moins 32 caractères.');
const service=new BrowserService({chromium,sessionKey:token,directory:process.env.BROWSER_PROFILE_DIR||'/data/profiles'});
const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
const server=createServer(async(req,res)=>{
  const given=Buffer.from(String(req.headers['x-worker-token']||'')),expected=Buffer.from(token);
  if(given.length!==expected.length||!timingSafeEqual(given,expected))return json(res,401,{error:'Accès refusé'});
  if(req.method==='GET'&&req.url==='/healthz')return json(res,200,{ok:true,sources:SOURCES,automatic:AUTOMATIC});
  const operations={'/open':'open','/view':'view','/action':'action','/erase':'erase','/collect':'collect','/stop':'stop'};
  if(req.method!=='POST'||!operations[req.url])return json(res,404,{error:'Action introuvable'});
  try{
    let raw='';for await(const chunk of req){raw+=chunk.toString('utf8');if(Buffer.byteLength(raw)>24000)return json(res,413,{error:'Requête trop volumineuse'});}
    const value=await service[operations[req.url]](JSON.parse(raw));json(res,200,value);
  }catch(error){
    // Do not log request bodies, screenshots, typed text, credentials or cookies.
    const status=error instanceof BrowserError||error?.status===400?error.status:error instanceof SyntaxError?400:502;
    json(res,status,{error:status===502?'Le navigateur n’a pas pu effectuer cette opération. Réessayez ou ouvrez sa session.':String(error.message).slice(0,240)});
  }
});
server.listen(Number(process.env.PORT||3200),'0.0.0.0');
process.on('SIGTERM',()=>{server.close();void service.close().finally(()=>process.exit(0));});
