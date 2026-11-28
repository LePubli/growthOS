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
  let requestSource=null;
  try{
    let raw='';for await(const chunk of req){raw+=chunk.toString('utf8');if(Buffer.byteLength(raw)>(req.url==='/collect'?4*1024*1024:24000))return json(res,413,{error:'Requête trop volumineuse'});}
    const input=JSON.parse(raw);
    if(SOURCES.includes(input?.source))requestSource=input.source;
    const value=await service[operations[req.url]](input);json(res,200,value);
  }catch(error){
    // Do not log request bodies, screenshots, typed text, credentials or cookies.
    const status=error instanceof BrowserError||error?.status===400?error.status:error instanceof SyntaxError?400:502;
    // Keep a correlation key in DockPanel logs without exposing account/session data.
    const diagnosticId=String(req.headers['x-diagnostic-id']||'');
    // Playwright exceptions may embed selectors or page text. Never persist their
    // raw message: classify technical symptoms, preserve exact BrowserError only.
    const rawReason=String(error?.message||'');
    const networkCode=rawReason.match(/net::ERR_[A-Z_]+/);
    const safeReason=error instanceof BrowserError?rawReason.slice(0,200)
      :networkCode?`Navigation réseau : ${networkCode[0]}`
      :/timeout|timed out/i.test(rawReason)?'Délai de réponse Chromium dépassé'
      :/target closed|page closed|context.*closed/i.test(rawReason)?'Onglet ou session du navigateur fermé'
      :error instanceof SyntaxError?'Requête JSON invalide'
      :'Erreur interne du moteur de navigation (voir type et code)';
    console.error(JSON.stringify({at:new Date().toISOString(),component:'cloud-worker',operation:operations[req.url],source:requestSource,
      diagnosticId:/^[0-9a-f-]{36}$/i.test(diagnosticId)?diagnosticId:null,status,
      errorType:error?.name||'Error',errorCode:typeof error?.code==='string'?error.code.slice(0,70):null,reason:safeReason}));
    const workerCode=/timeout|timed out/i.test(rawReason)?'BROWSER_TIMEOUT':/target closed|page closed|context.*closed/i.test(rawReason)?'BROWSER_SESSION_CLOSED':networkCode?'BROWSER_NETWORK':status===423?'BROWSER_BUSY':'BROWSER_ENGINE_FAILURE';
    json(res,status,{error:status===502?'Le navigateur n’a pas pu effectuer cette opération. Réessayez ou ouvrez sa session.':String(error.message).slice(0,240),diagnostic:{code:workerCode,networkCode:networkCode?.[0]||null}});
  }
});
server.listen(Number(process.env.PORT||3200),'0.0.0.0');
process.on('SIGTERM',()=>{server.close();void service.close().finally(()=>process.exit(0));});
