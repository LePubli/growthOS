import { useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight, CheckCircle2, AlertTriangle, XCircle, Globe2, Loader2, ShieldCheck, Search, Clock3, Sparkles } from 'lucide-react';
import apiClient from '@/lib/api-client';

type Check = { label:string; status:'ok'|'warning'|'error'; detail:string };
type Report = { url:string; checkedAt:string; httpStatus:number; serverResponseMs:number; title:string; checks:Check[]; limitations:string };

export default function SiteAuditPage() {
  const [url, setUrl] = useState(()=>new URLSearchParams(window.location.search).get('website')||'');
  const [report,setReport] = useState<Report|null>(null);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const [aiPlan,setAiPlan] = useState('');
  const [aiBusy,setAiBusy] = useState(false);
  const [aiError,setAiError] = useState('');

  const analyze = async (event:React.FormEvent) => {
    event.preventDefault(); if (!url.trim()) return;
    setLoading(true);setError('');setReport(null);setAiPlan('');setAiError('');
    try { setReport(await apiClient.post('/seo-audit/check',{url})); }
    catch (e) {setError(e instanceof Error?e.message:'Analyse impossible');}
    finally {setLoading(false);}
  };
  const ok=report?.checks.filter(c=>c.status==='ok').length||0;
  const warning=report?.checks.filter(c=>c.status==='warning').length||0;
  const bad=report?.checks.filter(c=>c.status==='error').length||0;
  const icons={ ok:CheckCircle2,warning:AlertTriangle,error:XCircle };
  const colors={ok:'text-emerald-600 bg-emerald-50 border-emerald-200',warning:'text-amber-700 bg-amber-50 border-amber-200',error:'text-red-700 bg-red-50 border-red-200'};

  const recommend = async () => {
    if (!report) return;
    setAiBusy(true);setAiError('');setAiPlan('');
    const observations=JSON.stringify({url:report.url,checks:report.checks}).slice(0,1250);
    try {
      const answer=await apiClient.post('/assistant/chat',{
        message:`Prépare un plan de correction SEO B2B, par priorité, à partir UNIQUEMENT de ces observations HTML : ${observations}. Ne suppose pas de vitesse mobile, de trafic ni de positions Google. Identifie les vérifications manquantes.`,
      }) as {answer:string};
      setAiPlan(answer.answer);
    } catch (e) {setAiError(e instanceof Error?e.message:'Aucune réponse IA reçue');}
    finally {setAiBusy(false);}
  };

  return <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8 text-slate-800">
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-100 text-violet-800 text-xs font-semibold mb-3"><ShieldCheck size={14}/> Analyse de site · données réelles</div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Diagnostic web & SEO</h1>
          <p className="text-sm text-slate-500 mt-2">Contrôle technique rapide pour identifier les premiers points à améliorer chez un prospect.</p>
        </div>
        <Link href="/prospects" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-violet-400">Voir mon CRM <ArrowRight size={15}/></Link>
      </header>

      <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 sm:p-7">
        <div className="flex gap-3 items-start mb-5"><div className="p-3 rounded-xl bg-violet-50 text-violet-700"><Globe2 size={23}/></div><div><h2 className="font-bold text-lg">Quel site analyser ?</h2><p className="text-sm text-slate-500">Indiquez son adresse HTTPS. Aucun scan intensif, seulement la page d'accueil fournie.</p></div></div>
        <form onSubmit={analyze} className="flex flex-col sm:flex-row gap-3">
          <label className="sr-only" htmlFor="site-url">Adresse du site</label>
          <input id="site-url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://exemple.fr" required maxLength={500} className="flex-1 min-w-0 rounded-xl border border-slate-200 px-4 py-3 text-sm bg-white outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"/>
          <button type="submit" disabled={loading} className="inline-flex justify-center items-center gap-2 bg-violet-700 hover:bg-violet-800 disabled:opacity-60 text-white font-semibold rounded-xl px-6 py-3 text-sm">{loading?<Loader2 size={17} className="animate-spin"/>:<Search size={17}/>} {loading?'Analyse en cours…':'Analyser'}</button>
        </form>
        <p className="mt-3 text-xs text-slate-400">Limite de sécurité : 6 analyses/heure et 8 secondes par site. L'analyse ne contacte pas d'API payante.</p>
        {error&&<p role="alert" className="rounded-xl bg-red-50 text-red-700 border border-red-200 px-4 py-3 text-sm mt-4">{error}</p>}
      </section>

      {report && <section className="space-y-4" aria-live="polite">
        <div className="flex flex-wrap gap-3 items-center justify-between"><div><h2 className="text-xl font-bold">Résultats pour {report.url}</h2><p className="text-xs text-slate-500 mt-1">{new Date(report.checkedAt).toLocaleString('fr-FR')} · HTML initial uniquement</p></div><span className="inline-flex gap-2 items-center bg-white border border-slate-200 px-3 py-2 rounded-lg text-sm"><Clock3 size={15}/>{report.serverResponseMs} ms de réponse réseau</span></div>
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {[{label:'Contrôles OK',value:ok,style:'text-emerald-700 bg-emerald-50'},{label:'À améliorer',value:warning,style:'text-amber-800 bg-amber-50'},{label:'Problèmes',value:bad,style:'text-red-700 bg-red-50'}].map(s=><div key={s.label} className={`rounded-xl p-4 sm:p-5 ${s.style}`}><div className="text-3xl font-bold">{s.value}</div><div className="text-xs sm:text-sm mt-1 font-medium">{s.label}</div></div>)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{report.checks.map(c=>{const Icon=icons[c.status];return <article key={c.label} className={`border rounded-xl p-4 bg-white ${colors[c.status].split(' ').filter(s=>s.startsWith('border')).join(' ')}`}><div className="flex gap-3"><Icon size={19} className={colors[c.status].split(' ')[0]}/><div className="min-w-0"><h3 className="font-semibold text-sm">{c.label}</h3><p className="text-sm text-slate-500 mt-1 break-words">{c.detail}</p></div></div></article>;})}</div>
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5 sm:p-6 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><h3 className="font-semibold text-violet-950 flex gap-2 items-center"><Sparkles size={18}/> Plan d'amélioration assisté par IA</h3><p className="text-xs text-violet-800 mt-1">Facultatif et facturé selon votre fournisseur OpenAI, Claude ou DeepSeek. Aucune modification de site effectuée.</p></div><button onClick={recommend} disabled={aiBusy} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-700 text-white text-sm font-semibold disabled:opacity-60">{aiBusy?<Loader2 className="animate-spin" size={16}/>:<Sparkles size={16}/>} {aiBusy?'Génération…':'Générer les conseils IA'}</button></div>
          {aiError&&<p role="alert" className="text-red-700 text-sm bg-red-50 border border-red-200 p-3 rounded-lg">{aiError}. Configurez une clé et un fournisseur dans Clés API Providers.</p>}
          {aiPlan&&<div className="whitespace-pre-wrap text-sm leading-7 bg-white border border-violet-100 rounded-xl p-5 text-slate-800" aria-live="polite">{aiPlan}</div>}
        </div>
        <aside className="bg-slate-900 text-slate-100 p-5 rounded-2xl flex gap-3 items-start"><ShieldCheck size={20} className="text-violet-300 flex-shrink-0"/><div><h3 className="font-semibold text-sm">Ce que ce diagnostic mesure réellement</h3><p className="text-slate-300 text-sm mt-1">{report.limitations} Ces constats ne sont pas des preuves de mauvaise performance mobile ou de faible positionnement Google.</p></div></aside>
      </section>}
    </div>
  </main>;
}
