import {mkdir,rm,readFile,writeFile,rename} from 'node:fs/promises';
import {readPappers} from './pappers.mjs';
import {readers,societeSearchCards,pageEvidence,mapsDetailEvidence} from './readers.mjs';
import {join} from 'node:path';
import {randomUUID,randomBytes,createHash,createCipheriv,createDecipheriv} from 'node:crypto';
import {scope,searchUrl,sourceNavigation,sourceResource,publicRequest,actionInput,AUTOMATIC} from './protocol.mjs';

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
        if(request.isNavigationRequest() && !request.frame().parentFrame() && !sourceNavigation(identity.source,url))return route.abort();
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
      const cursor=input.cursor&&input.cursor.source===p.source?structuredClone(input.cursor):null;
      if(p.source==='pappers'){
        if(!input.resume||!sourceNavigation(p.source,p.page.url()))await p.page.goto(searchUrl(p.source,input.query||'',input.area||''),{waitUntil:'domcontentloaded',timeout:25000});
        await p.page.locator('h1').first().waitFor({state:'visible',timeout:10000}).catch(()=>{});
        const read=await p.page.evaluate(readPappers);
        return read.results?.length?{status:'completed',results:read.results,drafts:[]}:{status:'awaiting_user',results:[],drafts:[],message:'Pappers : '+(read.error||'Vérifiez la page publique puis reprenez.')};
      }
      if(p.source==='societe_com'){
        if(!input.resume||!sourceNavigation(p.source,p.page.url()))await p.page.goto(searchUrl(p.source,input.query||'',input.area||''),{waitUntil:'domcontentloaded',timeout:25000});
        await pause(1200);return await this.societe(p,input);
      }
      if(['google_maps','pagesjaunes'].includes(p.source))return await this.collectDirectory(p,input,cursor);
      return await this.searchPage(p,input,cursor);
    }finally{this.busy=false;this.touch();}
  }
  async searchPage(p,input,previous){
    const cursor=previous||{source:p.source,pages:[],next:searchUrl(p.source,input.query||'',input.area||'')};
    const url=cursor.next;
    if(!url||!sourceNavigation(p.source,url))throw new BrowserError(400,'Suite de recherche invalide.');
    if(!input.resume||!previous?.awaitingUser||!sourceNavigation(p.source,p.page.url()))await p.page.goto(url,{waitUntil:'domcontentloaded',timeout:25000});
    await pause(1200);
    await p.page.locator(p.source==='bing'?'#b_results,#b_context':'#search,#rso,#rhs').first().waitFor({state:'attached',timeout:8000}).catch(()=>{});
    let read=await p.page.evaluate(readers.general);
    let evidence=await p.page.evaluate(pageEvidence);
    // Search pages can display their shell before the organic links finish loading.
    // Retry a visible result once before requiring human intervention; never
    // bypass a consent form or security challenge.
    if(!read.results?.length&&!read.drafts?.length&&!evidence.references.length&&!evidence.empty&&!evidence.challenge&&!evidence.consent){
      await p.page.locator(p.source==='bing'?'#b_results .b_algo h2 a':'#search a:has(h3),#rso a:has(h3)').first()
        .waitFor({state:'visible',timeout:4500}).catch(()=>{});
      read=await p.page.evaluate(readers.general);
      evidence=await p.page.evaluate(pageEvidence);
    }
    if(!read.results?.length&&!read.drafts?.length&&(!evidence.references.length&&!evidence.empty || evidence.challenge || evidence.consent))return {status:'awaiting_user',results:[],drafts:[],cursor:{...cursor,awaitingUser:true},message:evidence.challenge?'La source demande un contrôle de sécurité. Effectuez-le dans le navigateur puis reprenez.':evidence.consent?'La source demande votre consentement dans le navigateur.':'La page n’a pas fourni de résultats lisibles. Vérifiez son chargement puis reprenez.'};
    cursor.awaitingUser=false;cursor.pages.push(p.page.url());
    const next=await p.page.locator(p.source==='bing'?'a.sb_pagN,a[rel="next"]':'a#pnnext,a[rel="next"]').evaluateAll(nodes=>nodes.map(n=>n.href));
    cursor.next=next.find(value=>sourceNavigation(p.source,value)&&!cursor.pages.includes(value))||null;
    return {status:'completed',results:read.results||[],drafts:read.drafts||[],references:evidence.references,cursor,hasMore:!!cursor.next,message:evidence.references.length&&!read.results?.length?'Résultats Web consultés : '+evidence.references.length+' liens repérés, aucun nouveau champ confirmé.':evidence.empty?'Aucun résultat pour cette recherche.':undefined};
  }
  async collectDirectory(p,input,previous){
    const initial=searchUrl(p.source,input.query||'',input.area||'');
    const isDetail=url=>p.source==='pagesjaunes'?/^https:\/\/(?:www\.)?pagesjaunes\.fr\/pros\/\d+/.test(url):new URL(url).pathname.startsWith('/maps/place/');
    if(!previous&&input.resume&&sourceNavigation(p.source,p.page.url())&&isDetail(p.page.url())){
      const read=await this.readDirectoryProfile(p);
      return read?{status:'completed',results:read.results,drafts:read.drafts,hasMore:false}:{status:'awaiting_user',results:[],drafts:[],message:'Vérifiez cette fiche dans le navigateur avant de reprendre.'};
    }
    const cursor=previous||{source:p.source,phase:'scan',pending:[],visited:[],pages:[],next:initial};
    const results=[],drafts=[],batch=Math.max(1,Math.min(Number(input.limit)||25,p.source==='pagesjaunes'?10:25));
    if(cursor.phase==='scan'){
      const url=cursor.next||initial;
      if(!sourceNavigation(p.source,url))throw new BrowserError(400,'Page de recherche invalide.');
      const current=p.page.url();
      const keepMap=p.source==='google_maps'&&sourceNavigation(p.source,current)&&new URL(current).pathname.startsWith('/maps/search')&&cursor.scanning===true;
      if(!keepMap)await p.page.goto(url,{waitUntil:'domcontentloaded',timeout:25000});
      await pause(900);
      if(isDetail(p.page.url())||(p.source==='google_maps'&&await p.page.locator('[role="main"] h1.DUwDvf').count())){
        const read=await this.readDirectoryProfile(p);
        return read?{status:'completed',results:read.results,drafts:read.drafts,hasMore:false}:{status:'awaiting_user',results,drafts,cursor,message:'La fiche nécessite une vérification dans le navigateur.'};
      }
      if(p.source==='google_maps'){
        await p.page.locator('a[href*="/maps/place/"]').first().waitFor({state:'attached',timeout:10000}).catch(()=>{});
        const seen=new Set([...cursor.visited,...cursor.pending]);let stalls=0,ended=false;
        const began=Date.now();
        while(Date.now()-began<25000){
          const before=seen.size;
          for(const value of await p.page.locator('a[href*="/maps/place/"]').evaluateAll(nodes=>nodes.map(n=>n.href))){
            if(sourceNavigation(p.source,value)&&!seen.has(value)){seen.add(value);cursor.pending.push(value);}
          }
          const feed=p.page.locator('[role="feed"]').first();
          const endText=await feed.innerText().catch(()=> '');
          if(/(?:arriv[ée].*fin de la liste|reached the end of the list)/i.test(endText)){ended=true;break;}
          const scrolled=await feed.evaluate(node=>{const old=node.scrollTop;node.scrollTop=node.scrollHeight;return node.scrollTop!==old;}).catch(()=>false);
          stalls=seen.size===before&&!scrolled?stalls+1:0;
          if(stalls>=3){ended=true;break;}
          await pause(650);
        }
        if(!seen.size)return {status:'awaiting_user',results,drafts,cursor,message:'La recherche Maps nécessite une vérification dans le navigateur.'};
        cursor.scanning=!ended;
        if(!ended)return {status:'completed',results,drafts,cursor,hasMore:true,message:cursor.pending.length+' fiches repérées. Parcours de la liste en cours.'};
        cursor.next=null;cursor.phase='read';
      }else{
        await p.page.locator('a[href*="/pros/"]').first().waitFor({state:'attached',timeout:8000}).catch(()=>{});
        const links=await p.page.locator('a[href*="/pros/"]').evaluateAll(nodes=>nodes.map(n=>n.href));
        for(const value of links)if(sourceNavigation(p.source,value)&&isDetail(value)&&!cursor.pending.includes(value)&&!cursor.visited.includes(value))cursor.pending.push(value);
        if(!cursor.pending.length){
          const evidence=await p.page.evaluate(pageEvidence);
          return {status:evidence.empty&&!evidence.challenge?'completed':'awaiting_user',results,drafts,cursor,message:evidence.challenge?'PagesJaunes bloque la collecte par un contrôle de sécurité Cloudflare. Ouvrez le navigateur pour effectuer le contrôle, puis reprenez. Les autres sources continuent.':'Aucune fiche PagesJaunes lisible. Vérifiez la recherche ou la demande de connexion dans le navigateur.'};
        }
        cursor.pages.push(url);
        const choices=await p.page.locator('a[rel="next"],a[aria-label*="suivant" i],a[title*="suivant" i],.pagination a,#pagination a,a#pagination-next,nav[aria-label*="pagination" i] a').evaluateAll(nodes=>nodes.map(n=>({href:n.href,label:[n.innerText,n.getAttribute('aria-label'),n.title,n.id,n.className,n.rel].join(' ')})));
        const valid=choices.filter(n=>sourceNavigation(p.source,n.href)&&!cursor.pages.includes(n.href));
        const currentPage=Number(new URL(url).searchParams.get('page')||1);
        cursor.next=valid.find(n=>/suivant|next/i.test(n.label))?.href||valid.map(n=>({href:n.href,page:Number(new URL(n.href).searchParams.get('page')||n.label.trim())})).filter(n=>n.page>currentPage).sort((a,b)=>a.page-b.page)[0]?.href||null;
        cursor.phase='read';
      }
    }
    for(let index=0;index<batch&&cursor.pending.length;index++){
      const url=cursor.pending[0];
      if(!sourceNavigation(p.source,url)||!isDetail(url))throw new BrowserError(400,'Fiche de source invalide.');
      try{
        if(p.page.url()!==url)await p.page.goto(url,{waitUntil:'domcontentloaded',timeout:18000});
        await pause(700);
        const read=await this.readDirectoryProfile(p);
        if(!read) return {status:'awaiting_user',results,drafts,cursor,hasMore:true,message:'Une fiche demande une vérification. Les résultats déjà lus sont conservés ; ouvrez le navigateur puis reprenez.'};
        results.push(...read.results);drafts.push(...read.drafts);
      }catch{return {status:'awaiting_user',results,drafts,cursor,hasMore:true,message:'Lecture interrompue. Les résultats déjà lus sont conservés. Vérifiez la page puis reprenez.'};}
      cursor.pending.shift();cursor.visited.push(url);
    }
    if(!cursor.pending.length&&cursor.next)cursor.phase='scan';
    return {status:'completed',results,drafts,cursor,hasMore:!!cursor.pending.length||!!cursor.next,
      message:cursor.visited.length+' fiches parcourues'+(cursor.pending.length||cursor.next?' · collecte en cours.':' · fin des résultats accessibles.')};
  }
  async readDirectoryProfile(p){
    if(p.source==='pagesjaunes'){
      await p.page.locator('main h1,[role="main"] h1,h1').first().waitFor({timeout:5000}).catch(()=>{});
      const profile=await p.page.evaluate(readers.pagesjaunesProfile);
      if(!profile.name||!profile.address||!profile.codePostal)return null;
      const ape=String(profile.legal||'').match(/(?:APE|NAF)[^0-9]{0,20}(\d{2}\.\d{2}[A-Z])/i)?.[1];
      return {results:[{source:'pagesjaunes',company:profile.name,address:profile.address,codePostal:profile.codePostal,city:profile.city,
        phone:profile.phone,email:profile.email,website:profile.website,siret:profile.siret,apeCode:ape||null,sourceUrl:profile.sourceUrl,pagesjaunesProfile:profile}],drafts:[]};
    }
    const read=await p.page.evaluate(readers.general);
    const evidence=await p.page.evaluate(mapsDetailEvidence);
    if(evidence)for(const item of read.results||[])if(item.company===evidence.title&&item.address===evidence.address)item.mapsDetail=evidence;
    return read.results?.length||read.drafts?.length?{results:read.results||[],drafts:read.drafts||[]}:null;
  }
  async societe(p,input){
    if(!/^https:\/\/(?:www\.)?societe\.com\/societe\//.test(p.page.url())){
      await p.page.locator('a[href*="/societe/"]').first().waitFor({state:'attached',timeout:10000}).catch(()=>{});
      const cards=await p.page.evaluate(societeSearchCards);
      const known=String(input.target?.siret||input.target?.siren||'').slice(0,9);
      const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
      const city=normalize(input.target?.city||input.area);
      const candidates=cards.filter(card=>{
        if(!sourceNavigation('societe_com',card.url)||!/\/societe\/[a-z0-9-]+-\d{9}\.html\/?$/i.test(new URL(card.url).pathname))return false;
        if(known)return new URL(card.url).pathname.replace(/\/$/,'').endsWith('-'+known+'.html');
        return normalize(card.label)===normalize(input.target?.company||input.query)&&(!city||normalize(card.location.replace(/^\d{5}\s*/,''))===city);
      });
      const links=[...new Set(candidates.map(card=>{const u=new URL(card.url);u.hash='';u.search='';return u.href;}))];
      if(links.length!==1)return {ok:true,status:'awaiting_user',message:links.length?'Plusieurs sociétés de même nom et ville correspondent. Vérifiez l’établissement avant de reprendre.':'Aucune correspondance fiable dans les résultats par nom et ville. Aucune fiche non concordante ouverte.',results:[],drafts:[]};
      await p.page.goto(links[0],{waitUntil:'domcontentloaded',timeout:25000});await pause(1200);
    }
    await p.page.locator('h1').first().waitFor({state:'visible',timeout:10000}).catch(()=>{});
    const read=await p.page.evaluate(readers.societe_com);
    if(read.error||!read.results?.length)return {ok:true,status:'awaiting_user',message:'La fiche est incomplète ou demande une intervention. Vérifiez-la dans le navigateur puis reprenez.',results:[],drafts:[]};
    return {ok:true,status:'completed',results:read.results.slice(0,1),drafts:[]};
  }
}
