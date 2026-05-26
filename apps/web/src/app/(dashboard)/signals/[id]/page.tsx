'use client';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, TrendingUp, Building2, Calendar, ExternalLink, Zap, Star, CheckCircle } from 'lucide-react';

const MOCK_SIGNALS: Record<string,any> = {
  '1': { id:'1', type:'funding', company:'TechVision', title:'Levée de fonds Série A — 5M€', description:'TechVision vient d\'annoncer une levée de fonds de 5 millions d\'euros en Série A auprès du fonds Partech. L\'entreprise prévoit d\'utiliser ces fonds pour accélérer son développement commercial et recruter une équipe sales.', score:92, isRead:false, isStarred:false, url:'https://techcrunch.com', createdAt:'2026-05-26', tags:['Funding','Scale-up','Tech'], recommendations:['Contacter le nouveau VP Sales sous 48h','Préparer une offre Enterprise sur mesure','Mentionner leur croissance dans le premier email'] },
  '2': { id:'2', type:'hiring', company:'BigCorp', title:'Recrute 5 commerciaux B2B', description:'BigCorp est en recherche active de commerciaux B2B, ce qui indique une phase de scale commercial. C\'est le moment idéal pour proposer des outils de prospection automatisée.', score:78, isRead:true, isStarred:true, url:'https://linkedin.com', createdAt:'2026-05-25', tags:['Hiring','Sales','B2B'], recommendations:['Cible: Directeur Commercial ou CRO','Angle: Automatisez l\'onboarding de vos nouveaux commerciaux','Timing: Parfait pour un outil d\'aide à la prospection'] },
};

const TYPE_CONFIG: Record<string,{label:string;color:string;icon:string}> = {
  funding:   { label:'Financement', color:'bg-green-50 text-green-700', icon:'💰' },
  hiring:    { label:'Recrutement', color:'bg-blue-50 text-blue-700', icon:'👥' },
  news:      { label:'Actualité', color:'bg-purple-50 text-purple-700', icon:'📰' },
  technology:{ label:'Technologie', color:'bg-yellow-50 text-yellow-700', icon:'⚙️' },
  intent:    { label:'Intention d\'achat', color:'bg-red-50 text-red-700', icon:'🎯' },
};

export default function SignalDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const signal = MOCK_SIGNALS[String(id)] || MOCK_SIGNALS['1'];
  const type = TYPE_CONFIG[signal.type] || TYPE_CONFIG.news;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-200 rounded-xl"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{type.icon}</span>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{signal.title}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <Building2 className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500">{signal.company}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${type.color}`}>{type.label}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${signal.score>=80?'bg-green-50 text-green-600':'bg-amber-50 text-amber-600'}`}>Score {signal.score}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600"><Star className="w-4 h-4" />Favoris</button>
          <button className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium"><Zap className="w-4 h-4" />Agir maintenant</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-3">Détails du signal</h2>
            <p className="text-sm text-gray-700 leading-relaxed">{signal.description}</p>
            {signal.url && <a href={signal.url} target="_blank" className="inline-flex items-center gap-2 mt-4 text-sm text-teal-600 hover:text-teal-700"><ExternalLink className="w-4 h-4" />Voir la source originale</a>}
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-3">Tags</h2>
            <div className="flex flex-wrap gap-2">{signal.tags.map((t:string) => <span key={t} className="text-xs bg-teal-50 text-teal-700 px-3 py-1 rounded-full">{t}</span>)}</div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Recommandations IA</h3>
            <div className="space-y-3">
              {signal.recommendations.map((r:string,i:number) => (
                <div key={i} className="flex items-start gap-2 p-3 bg-teal-50 rounded-xl">
                  <CheckCircle className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-teal-800 leading-relaxed">{r}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Actions rapides</h3>
            <div className="space-y-2">
              {['📧 Envoyer un email personnalisé','👤 Créer un prospect','🎯 Ajouter à une séquence','📋 Créer un deal pipeline'].map((a,i) => (
                <button key={i} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-xl">{a}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
