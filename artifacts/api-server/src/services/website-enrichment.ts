import {recordDiagnosticEvent} from '../lib/diagnostics';
import {prospectBusinessNames} from '@workspace/api-zod';
import {db,prospectsTable} from '@workspace/db';
import {and,eq,sql} from 'drizzle-orm';
import {collectSite,siteUrl,siteHost} from './website-contact-data';
import {mergeProspectCapture} from '../routes/v1/sourcing';
import {addressIdentity,normalizedIdentity} from '../lib/enrichment-identity';
export async function websiteEnrichmentStep(job:any,initial:any){
  const label=job.steps.website.label;
  if(!initial.website)return {label,status:'skipped',message:'Aucun site web renseigné sur le prospect.'};
  const testUrl=process.env.GROWTHOS_SMOKE_TEST==='true'?process.env.WEBSITE_TEST_URL:undefined;
  const snapshot=await collectSite(initial.website,testUrl?{load:async(url)=>{const endpoint=new URL(testUrl);endpoint.searchParams.set('url',url.href);const r=await fetch(endpoint);if(!r.ok)throw Error('Site de test indisponible.');return {url:url.href,html:await r.text()};},mail:async()=>({status:'mx',detail:'Serveur de réception déclaré. Existence de la boîte non confirmée.'})}:{});
  return db.transaction(async tx=>{
    const lease=await tx.execute(sql`SELECT status,lease FROM prospect_enrichment_jobs WHERE id=${job.id} AND tenant_id=${job.tenant_id} FOR UPDATE`);if(lease.rows[0]?.status!=='running'||lease.rows[0]?.lease!==job.lease)throw Error('Tâche interrompue.');
    const [p]=await tx.select().from(prospectsTable).where(and(eq(prospectsTable.id,job.prospect_id),eq(prospectsTable.tenantId,job.tenant_id))).for('update');
    if(!p||p.website!==initial.website)return {label,status:'needs_review',message:'Le site du prospect a changé pendant la lecture. Relancez l’enrichissement.'};
    const siren=p.siren||p.siret?.slice(0,9),ids=[...snapshot.sirens,...snapshot.sirets.map(v=>v.slice(0,9))];
    const conflict=!!(siren&&ids.length&&!ids.includes(siren));
    const phone=(v:any)=>String(v||'').replace(/\D/g,'').replace(/^33/,'0');
    const name=normalizedIdentity(p.company),nameMatch=name.length>=4&&snapshot.pages.some(page=>normalizedIdentity(page.heading).includes(name));
    const publisherMatch=snapshot.publishers.some(v=>[p.company,prospectBusinessNames(p).legalName].some(name=>name&&normalizedIdentity(name)===normalizedIdentity(v.name)));
    const publishedPhoneMatch=!!p.phone&&snapshot.phones.some(value=>phone(value.phone)===phone(p.phone));
    const contactMatch=publishedPhoneMatch&&(nameMatch||publisherMatch||snapshot.publishers.length>0&&ids.length>0);
    const address=addressIdentity(p.address),addressMatch=nameMatch&&address.length>=12&&addressIdentity(snapshot.text).includes(address);
    const exactSite=!!(p.siret&&snapshot.sirets.includes(p.siret)),legalMatch=!!(siren&&ids.includes(siren));
    const confirmed=!conflict&&(exactSite||legalMatch||contactMatch||addressMatch);
    const candidates=snapshot.emails.filter(e=>e.check?.status!=='no_mail'&&!/^(dpo|privacy|rgpd|abuse|noreply|no-reply)@/.test(e.email)&&(e.email.split('@')[1]===siteHost(siteUrl(p.website!))||confirmed&&/^(gmail\.com|outlook\.(com|fr)|hotmail\.(com|fr)|yahoo\.fr|orange\.fr|wanadoo\.fr|free\.fr|sfr\.fr|live\.fr)$/.test(e.email.split('@')[1])));
    const email=[...candidates].sort((a,b)=>Number(/^(?:contact|info|bonjour|service-client)[.@]/.test(b.email))-Number(/^(?:contact|info|bonjour|service-client)[.@]/.test(a.email))||a.email.localeCompare(b.email))[0];
    const physicalMatch=exactSite||contactMatch||addressMatch;
    const tel=physicalMatch?(snapshot.phones.find(v=>phone(v.phone)===phone(p.phone))||snapshot.phones[0]):null;
    const selectedSiret=exactSite?p.siret:null;
    const selectedSiren=legalMatch?siren:null;
    const street=physicalMatch?(snapshot.addresses.find(v=>addressIdentity(v.address)===address)||snapshot.addresses[0]):null,postalCode=street?.address.match(/\b\d{5}\b/)?.[0],city=postalCode?street!.address.slice(street!.address.indexOf(postalCode)+5).trim():null;
    const linkedin=snapshot.socials.filter((v:any)=>v.source==='linkedin');
    const {text,...publicData}=snapshot;
    const sourceDetails={website:{snapshot:{...publicData,identity:conflict?'contradictory':confirmed?'matched':'site_already_linked',confidence:confirmed?'identity_cross_checked':'published_on_linked_site',selection:{state:conflict?'blocked':confirmed?'matched':'linked_site',reason:conflict?'LEGAL_IDENTITY_CONFLICT':confirmed?'IDENTITY_CROSS_CHECKED':'IDENTITY_NOT_YET_CONFIRMED'}},capturedAt:new Date().toISOString(),sourceUrl:snapshot.url}};
    const merged=await mergeProspectCapture(p,{id:'website_'+job.id,source:'website',company:p.company||snapshot.pages[0]?.heading||'Entreprise',capturedAt:Date.now(),sourceUrl:snapshot.url,sourceDetails,
      ...(!conflict?{email:email?.email,phone:tel?.phone,address:street?.address,codePostal:postalCode,city,siret:selectedSiret,siren:selectedSiren,linkedinUrl:linkedin.length===1?linkedin[0].url:null,fieldEvidence:{address:street?.sourceUrl,postalCode:street?.sourceUrl,city:street?.sourceUrl,email:email?.sourceUrl,phone:tel?.sourceUrl,linkedinUrl:linkedin[0]?.sourceUrl}}:{})},false,job.tenant_id,tx,job.created_by);
    void recordDiagnosticEvent({tenantId:job.tenant_id,userId:job.created_by,level:conflict?'warn':'info',component:'website-enrichment',code:conflict?'WEBSITE_IDENTITY_CONFLICT':'WEBSITE_CONTACTS_READ',message:'Lecture des contacts et de l’éditeur du site terminée',source:'website',prospectId:job.prospect_id,jobId:job.id,details:{pagesRead:snapshot.pages.length,coordinateCounts:[snapshot.emails.length,snapshot.phones.length,snapshot.addresses.length],publisherCount:snapshot.publishers.length,legalIdentifierCount:ids.length,matched:confirmed,selectionReason:conflict?'LEGAL_IDENTITY_CONFLICT':confirmed?'IDENTITY_CROSS_CHECKED':'IDENTITY_NOT_YET_CONFIRMED',filledFields:merged.filled.length,conflicts:merged.conflicts}});
    return {label,status:conflict?'needs_review':snapshot.emails.length||snapshot.phones.length||snapshot.socials.length?'completed':'empty',filled:merged.filled,conflicts:merged.conflicts,legalCandidates:!siren&&ids.length>0,message:conflict?'Le site publie un identifiant différent. Données conservées pour vérification, aucune coordonnée appliquée.':snapshot.pages.length+' page(s) lue(s) · '+snapshot.emails.length+' email(s) publié(s) · '+snapshot.socials.length+' lien(s) social(aux). Les hypothèses d’email restent non confirmées.'};
  });
}
