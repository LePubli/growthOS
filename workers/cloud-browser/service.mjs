import {mkdir,rm,readFile,writeFile,rename} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID,randomBytes,createHash,createCipheriv,createDecipheriv} from 'node:crypto';
import {scope,searchUrl,sourceNavigation,sourceResource,publicRequest,actionInput,AUTOMATIC} from './protocol.mjs';

const readers={societe_com:readFileSync(new URL('../../extensions/growthos-pagesjaunes/societe.js',import.meta.url),'utf8'),
  general:readFileSync(new URL('../../extensions/growthos-pagesjaunes/capture.js',import.meta.url),'utf8')};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
export class BrowserError extends Error{constructor(status,message){super(message);this.status=status;}}
export class BrowserService{
  constructor({chromium,directory,sessionKey,requestAllowed=publicRequest,idleMs=300000}){
    this.chromium=chromium;this.directory=directory;this.requestAllowed=requestAllowed;this.idleMs=idleMs;this.current=null;this.busy=false;this.opening=null;
    this.sessionKey=sessionKey?createHash('sha256').update(sessionKey).digest():null;
  }
  async profile(input){
    const identity=scope(input),key=identity.tenantId+'/'+identity.profileId;
    if(this.current?.key===key&&!this.current.page.isClosed()){if(this.current.source!==identity.source)throw new BrowserError(409,'Source du profil incohérente');this.touch();return this.current;}
    if(this.busy || this.opening)throw new BrowserError(423,'Le navigateur exécute une autre tâche. Réessayez après sa fin.');
    this.opening=key;
    try{
      await this.close();
      const directory=join(this.directory,identity.tenantId,identity.profileId);
      await mkdir(directory,{recursive:true,mode:0o700});
      const context=await this.chromium.launchPersistentContext(directory,{headless:true,chromiumSandbox:false,
        viewport:{width:1280,height:800},locale:'fr-FR',timezoneId:'Europe/Paris',serviceWorkers:'block',acceptDownloads:false,
        args:['--disable-dev-shm-usage','--disable-background-networking']});
      if(this.sessionKey){
        try{
          const saved=JSON.parse(await readFile(join(directory,'growthos-session.enc'),'utf8'));
          const decipher=createDecipheriv('aes-256-gcm',this.sessionKey,Buffer.from(saved.iv,'base64'));
          decipher.setAAD(Buffer.from(key+'|'+identity.source));decipher.setAuthTag(Buffer.from(saved.tag,'base64'));
          const cookies=JSON.parse(Buffer.concat([decipher.update(Buffer.from(saved.data,'base64')),decipher.final()]).toString('utf8'));
          if(Array.isArray(cookies))await context.addCookies(cookies);
        }catch{/* Première connexion, déconnexion ou rotation de clé : aucune session n'est inventée. */}
      }
      await context.route('**/*',async route=>{
        const request=route.request(),url=request.url();
        if(url.startsWith('data:')||url.startsWith('blob:'))return route.abort();
        if(request.isNavigationRequest() && !sourceNavigation(identity.source,url))return route.abort();
        if(!sourceResource(identity.source,url)||!await this.requestAllowed(url))return route.abort();
        if(['media','font'].includes(request.resourceType()))return route.abort();
        return route.continue();
      });
      if(context.routeWebSocket)await context.routeWebSocket('**/*',socket=>socket.close());
      const page=context.pages()[0]||await context.newPage();
      page.on('dialog',dialog=>void dialog.dismiss());
      this.current={...identity,key,context,page,directory,controlId:randomUUID()};
      const entry=this.current;
      context.on('page',other=>{
        if(context.pages().length>3){void other.close();return;}
        void other.waitForLoadState('domcontentloaded',{timeout:20000}).then(()=>{
          if(this.current!==entry||!sourceNavigation(entry.source,other.url()))return other.close();
          const previous=entry.page;entry.page=other;
          other.on('dialog',dialog=>void dialog.dismiss());
          other.on('close',()=>{if(this.current===entry&&entry.page===other&&!previous.isClosed())entry.page=previous;});
        }).catch(()=>other.close().catch(()=>{}));
      });
      this.touch();return this.current;
    }finally{this.opening=null;}
  }
  touch(){clearTimeout(this.timer);this.timer=setTimeout(()=>{if(!this.busy)void this.close();else this.touch();},this.idleMs);this.timer.unref?.();}
  async close(){
    clearTimeout(this.timer);const old=this.current;this.current=null;
    if(old&&this.sessionKey){
      try{
        const cookies=(await old.context.cookies()).filter(cookie=>cookie.expires===-1);
        const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',this.sessionKey,iv);
        cipher.setAAD(Buffer.from(old.key+'|'+old.source));
        const data=Buffer.concat([cipher.update(JSON.stringify(cookies),'utf8'),cipher.final()]);
        const file=join(old.directory,'growthos-session.enc');
        await writeFile(file+'.tmp',JSON.stringify({iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')}),{mode:0o600});
        await rename(file+'.tmp',file);
      }catch{/* La fermeture du navigateur reste possible après un arrêt imprévu. */}
    }
    await old?.context.close().catch(()=>{});
  }
  async stop(input){
    const identity=scope(input);
    if(this.current?.key===identity.tenantId+'/'+identity.profileId)await this.close();
    return {ok:true};
  }
  async erase(input){
    const identity=scope(input);if(this.busy||this.opening)throw new BrowserError(423,'Attendez la fin de la tâche avant de déconnecter la session.');
    if(this.current?.key===identity.tenantId+'/'+identity.profileId)await this.close();
    await rm(join(this.directory,identity.tenantId,identity.profileId),{recursive:true,force:true});return {ok:true};
  }
  async open(input){
    if(this.busy)throw new BrowserError(423,'Une collecte est en cours.');
    const p=await this.profile(input);
    if(this.busy)throw new BrowserError(423,'Une collecte est en cours.');this.busy=true;
    try{
      p.controlId=randomUUID();
      if(input.keepPage!==true||!sourceNavigation(p.source,p.page.url()))await p.page.goto(searchUrl(p.source,input.query||'',input.area||'',input.login===true),{waitUntil:'domcontentloaded',timeout:25000});
      return {...await this.state(p),busy:false,controlId:p.controlId};
    }finally{this.busy=false;this.touch();}
  }
  async state(p){
    const url=p.page.url();
    return {ok:true,url:sourceNavigation(p.source,url)?url:null,title:(await p.page.title()).slice(0,200),source:p.source,busy:this.busy,
      authentication:'unverified',width:1280,height:800};
  }
  async view(input){
    const identity=scope(input),p=this.current;
    if(!p||p.key!==identity.tenantId+'/'+identity.profileId||p.source!==identity.source)throw new BrowserError(409,'Session fermée ou utilisée par un autre profil. Ouvrez-la à nouveau.');
    this.touch();const state=await this.state(p);
    if(!state.url)throw new BrowserError(409,'Ouvrez une page de la source.');
    const jpeg=await p.page.screenshot({type:'jpeg',quality:55,timeout:5000});
    if(jpeg.length>1500000)throw new BrowserError(413,'Vue trop volumineuse.');
    return {...state,image:'data:image/jpeg;base64,'+jpeg.toString('base64')};
  }
  async action(input){
    const event=actionInput(input);if(this.busy)throw new BrowserError(423,'La tâche pilote actuellement ce navigateur.');
    const p=await this.profile(input);
    if(this.busy)throw new BrowserError(423,'La tâche pilote actuellement ce navigateur.');
    if(input.controlId!==p.controlId)throw new BrowserError(409,'Le contrôle a été repris dans une autre vue. Rouvrez ce navigateur pour intervenir.');
    if(!sourceNavigation(p.source,p.page.url()))throw new BrowserError(409,'Ouvrez d’abord la source.');
    this.busy=true;
    try{
    if(event.type==='click')await p.page.mouse.click(event.x,event.y);
    if(event.type==='scroll')await p.page.mouse.wheel(0,event.deltaY);
    if(event.type==='text')await p.page.keyboard.insertText(event.text);
    if(event.type==='key')await p.page.keyboard.press(event.key);
    if(event.type==='back')await p.page.goBack({waitUntil:'domcontentloaded',timeout:15000}).catch(()=>{});
    return {ok:true};
    }finally{this.busy=false;this.touch();}
  }
  async collect(input){
    if(!AUTOMATIC.includes(input.source))throw new BrowserError(422,'La collecte automatique de cette source reste à développer.');
    if(this.busy)throw new BrowserError(423,'Le navigateur traite déjà une collecte.');
    const p=await this.profile(input);if(this.busy)throw new BrowserError(423,'Une autre opération est en cours.');this.busy=true;this.touch();
    try{
      if(input.resume!==true || !sourceNavigation(p.source,p.page.url())){
        await p.page.goto(searchUrl(p.source,input.query||'',input.area||''),{waitUntil:'domcontentloaded',timeout:25000});
      }
      await pause(1200);
      if(p.source==='societe_com')return await this.societe(p,input);
      const results=[],drafts=[];
      if(p.source==='google_maps'&&!p.page.url().includes('/maps/place/')){
        await p.page.locator('a[href*="/maps/place/"]').first().waitFor({state:'attached',timeout:10000}).catch(()=>{});
        const seen=new Set();let stalled=0;
        const limit=Math.min(Number(input.limit)||10,25);
        for(let pass=0;pass<10&&seen.size<limit&&stalled<3;pass++){
          const before=seen.size;
          for(const url of await p.page.locator('a[href*="/maps/place/"]').evaluateAll(nodes=>nodes.map(n=>n.href)))if(sourceNavigation(p.source,url))seen.add(url);
          stalled=seen.size===before?stalled+1:0;
          if(seen.size<limit){await p.page.locator('[role="feed"]').first().evaluate(node=>{node.scrollTop=node.scrollHeight;}).catch(()=>{});await pause(650);}
        }
        const links=[...seen].slice(0,limit);
        for(const url of links){
          try{await p.page.goto(url,{waitUntil:'domcontentloaded',timeout:18000});await pause(1000);const read=await p.page.evaluate(readers.general);results.push(...(read.results||[]));drafts.push(...(read.drafts||[]));}catch{}
        }
      }else{
        const read=await p.page.evaluate(readers.general);results.push(...(read.results||[]));drafts.push(...(read.drafts||[]));
      }
      if(!results.length&&!drafts.length)return {ok:true,status:'awaiting_user',message:'Aucune fiche locale lisible. Consultez le navigateur pour vérifier la page ou la connexion.',results:[],drafts:[]};
      return {ok:true,status:'completed',results:results.slice(0,25),drafts:drafts.slice(0,25)};
    }finally{this.busy=false;this.touch();}
  }
  async societe(p,input){
    if(!/^https:\/\/(?:www\.)?societe\.com\/societe\//.test(p.page.url())){
      await p.page.locator('a[href*="/societe/"]').first().waitFor({state:'attached',timeout:10000}).catch(()=>{});
      const all=[...new Set(await p.page.locator('a[href*="/societe/"]').evaluateAll(nodes=>nodes.map(n=>n.href)))];
      const known=String(input.target?.siret||input.target?.siren||'').slice(0,9);
      const links=all.filter(url=>sourceNavigation('societe_com',url)&&/\/societe\/[a-z0-9-]+-\d{9}\.html\/?$/i.test(new URL(url).pathname))
        .filter(url=>!known||new URL(url).pathname.replace(/\/$/,'').endsWith('-'+known+'.html'));
      if(links.length!==1)return {ok:true,status:'awaiting_user',message:links.length?'Plusieurs fiches correspondent. Ouvrez le bon établissement dans le navigateur puis reprenez.':'La recherche nécessite une vérification dans le navigateur intégré.',results:[],drafts:[]};
      await p.page.goto(links[0],{waitUntil:'domcontentloaded',timeout:25000});await pause(1200);
    }
    const read=await p.page.evaluate(readers.societe_com);
    if(read.error||!read.results?.length)return {ok:true,status:'awaiting_user',message:'La fiche est incomplète ou demande une intervention. Vérifiez-la dans le navigateur puis reprenez.',results:[],drafts:[]};
    return {ok:true,status:'completed',results:read.results.slice(0,1),drafts:[]};
  }
}
