import { useState } from 'react';
import { CreditCard, CheckCircle, Crown, TrendingUp, Users, Mail, Zap, AlertCircle, ChevronRight, Download, X } from 'lucide-react';
import { toast } from 'sonner';

const PLANS = [
  {
    id:'starter', name:'Starter', price:49, desc:'Pour les freelances et petites équipes',
    features:['500 prospects/mois','3 séquences actives','2 utilisateurs','Plugins de base','Support email'],
    limits:{ prospects:500, sequences:3, users:2 }, current:false,
  },
  {
    id:'pro', name:'Pro', price:149, desc:'Pour les équipes commerciales',
    features:['5 000 prospects/mois','Séquences illimitées','10 utilisateurs','Tous les plugins','Support prioritaire','Export CSV'],
    limits:{ prospects:5000, sequences:-1, users:10 }, current:true,
  },
  {
    id:'enterprise', name:'Enterprise', price:499, desc:'Pour les grandes organisations',
    features:['Prospects illimités','API complète','Utilisateurs illimités','SSO/SAML','Account manager dédié','SLA 99.9%'],
    limits:{ prospects:-1, sequences:-1, users:-1 }, current:false,
  },
];

const USAGE = {
  prospects: { used:3247, limit:5000, label:'Prospects' },
  sequences: { used:6, limit:-1, label:'Séquences actives' },
  users: { used:3, limit:10, label:'Utilisateurs' },
  emails: { used:18420, limit:50000, label:'Emails envoyés' },
};

const INVOICES = [
  { id:'INV-2026-05', date:'01 Mai 2026', amount:'149,00 €', status:'Payée', plan:'Pro' },
  { id:'INV-2026-04', date:'01 Avr 2026', amount:'149,00 €', status:'Payée', plan:'Pro' },
  { id:'INV-2026-03', date:'01 Mar 2026', amount:'149,00 €', status:'Payée', plan:'Pro' },
  { id:'INV-2026-02', date:'01 Fév 2026', amount:'49,00 €',  status:'Payée', plan:'Starter' },
  { id:'INV-2026-01', date:'01 Jan 2026', amount:'49,00 €',  status:'Payée', plan:'Starter' },
];

function UpgradeModal({ plan, onClose }: { plan:typeof PLANS[0]; onClose:()=>void }) {
  const [loading, setLoading] = useState(false);
  const confirm = async () => {
    setLoading(true);
    await new Promise(r=>setTimeout(r,1200));
    toast.success(`Passage au plan ${plan.name} effectué ! (simulation)`);
    setLoading(false);
    onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-lg font-bold text-gray-900">Passer au plan {plan.name}</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400"/></button>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 mb-4">
          <div className="text-2xl font-bold text-gray-900 mb-1">{plan.price}€<span className="text-sm font-normal text-gray-400">/mois</span></div>
          <ul className="space-y-1.5">
            {plan.features.slice(0,4).map(f=>(
              <li key={f} className="flex items-center gap-2 text-sm text-gray-600"><CheckCircle size={13} className="text-green-500"/>{f}</li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-gray-400 mb-4">Votre carte Visa •••• 4242 sera débitée. Annulable à tout moment.</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">Annuler</button>
          <button onClick={confirm} disabled={loading} className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
            {loading?'Traitement...':'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BillingPage() {
  const current = PLANS.find(p=>p.current)!;
  const [upgrading, setUpgrading] = useState<typeof PLANS[0]|null>(null);
  const renewDate = new Date(); renewDate.setDate(1); renewDate.setMonth(renewDate.getMonth()+1);
  const renewStr = renewDate.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});

  return (
    <div className="min-h-screen p-6" style={{background:'var(--body-bg)'}}>
      {upgrading && <UpgradeModal plan={upgrading} onClose={()=>setUpgrading(null)}/>}

      <h1 style={{fontSize:22,fontWeight:700,color:'var(--text-primary)',marginBottom:4}}>Facturation</h1>
      <p style={{fontSize:14,color:'var(--text-muted)',marginBottom:24}}>Gérez votre abonnement et vos informations de paiement</p>

      {/* Current plan banner */}
      <div style={{borderRadius:16,padding:24,marginBottom:20,background:'var(--color-primary)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <p style={{color:'rgba(255,255,255,.7)',fontSize:13,margin:'0 0 4px'}}>Plan actuel</p>
          <h2 style={{fontSize:22,fontWeight:700,color:'#fff',margin:'0 0 4px'}}>{current.name} · {current.price}€/mois</h2>
          <p style={{color:'rgba(255,255,255,.7)',fontSize:13,margin:0}}>Renouvellement le {renewStr}</p>
        </div>
        <Crown size={48} color="rgba(255,255,255,.35)"/>
      </div>

      {/* Usage meters */}
      <div style={{borderRadius:16,border:'1px solid var(--card-border)',background:'var(--card-bg)',padding:20,marginBottom:16}}>
        <h2 style={{fontWeight:600,fontSize:15,color:'var(--text-primary)',marginBottom:16}}>Utilisation ce mois</h2>
        <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:16}}>
          {Object.entries(USAGE).map(([key,u])=>{
            const pct = u.limit===-1?null:Math.min(100,Math.round(u.used/u.limit*100));
            const warn = pct!==null && pct>=80;
            const icons: Record<string,React.ReactNode> = {
              prospects:<Users size={15}/>, sequences:<Mail size={15}/>, users:<Users size={15}/>, emails:<Mail size={15}/>
            };
            return (
              <div key={key}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                  <div style={{display:'flex',alignItems:'center',gap:6,fontSize:13,fontWeight:500,color:'var(--text-secondary)'}}>{icons[key]||null}{u.label}</div>
                  <div style={{fontSize:12,color:warn?'#D97706':'var(--text-muted)',fontWeight:500}}>
                    {u.used.toLocaleString('fr-FR')}
                    {u.limit===-1?' / ∞':` / ${u.limit.toLocaleString('fr-FR')}`}
                  </div>
                </div>
                {pct!==null && (
                  <div style={{height:6,borderRadius:9999,background:'var(--body-bg)',overflow:'hidden'}}>
                    <div style={{height:'100%',borderRadius:9999,background:warn?'#F59E0B':'var(--color-primary)',width:`${pct}%`,transition:'width .4s'}}/>
                  </div>
                )}
                {u.limit===-1 && <div style={{height:6,borderRadius:9999,background:'#DCFCE7'}}/>}
                {warn && (
                  <div style={{display:'flex',alignItems:'center',gap:4,fontSize:11,color:'#D97706',marginTop:4}}>
                    <AlertCircle size={11}/>{pct}% utilisé — passez au plan supérieur
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Plans */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginBottom:20}}>
        {PLANS.map(plan=>(
          <div key={plan.id} style={{borderRadius:16,border:`2px solid ${plan.current?'var(--color-primary)':'var(--card-border)'}`,background:'var(--card-bg)',padding:20,boxShadow:plan.current?'0 4px 20px rgba(0,0,0,.08)':'none',position:'relative'}}>
            {plan.current && (
              <div style={{fontSize:11,background:'var(--color-primary)',color:'#fff',padding:'2px 10px',borderRadius:9999,display:'inline-block',marginBottom:10,fontWeight:600}}>Plan actuel</div>
            )}
            <h3 style={{fontWeight:700,fontSize:18,color:'var(--text-primary)',margin:'0 0 4px'}}>{plan.name}</h3>
            <div style={{fontSize:26,fontWeight:700,color:'var(--text-primary)',margin:'4px 0'}}>
              {plan.price}€<span style={{fontSize:13,fontWeight:400,color:'var(--text-muted)'}}>/mois</span>
            </div>
            <p style={{fontSize:12,color:'var(--text-muted)',margin:'0 0 14px'}}>{plan.desc}</p>
            <ul style={{listStyle:'none',padding:0,margin:'0 0 16px',display:'flex',flexDirection:'column',gap:6}}>
              {plan.features.map(f=>(
                <li key={f} style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:'var(--text-secondary)'}}>
                  <CheckCircle size={13} color="var(--color-primary)"/>{f}
                </li>
              ))}
            </ul>
            <button
              disabled={plan.current}
              onClick={()=>!plan.current&&setUpgrading(plan)}
              style={{width:'100%',padding:'9px',borderRadius:10,border:`1px solid ${plan.current?'var(--color-primary)':'var(--card-border)'}`,background:plan.current?'var(--color-primary-light)':'transparent',color:plan.current?'var(--color-primary)':'var(--text-secondary)',fontSize:13,fontWeight:600,cursor:plan.current?'default':'pointer',transition:'all .15s'}}>
              {plan.current?'Plan actuel':'Passer à ce plan →'}
            </button>
          </div>
        ))}
      </div>

      {/* Payment method */}
      <div style={{borderRadius:16,border:'1px solid var(--card-border)',background:'var(--card-bg)',padding:20,marginBottom:16}}>
        <h2 style={{fontWeight:600,fontSize:15,color:'var(--text-primary)',marginBottom:14}}>Moyen de paiement</h2>
        <div style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',borderRadius:12,border:'1px solid var(--card-border)',background:'var(--body-bg)'}}>
          <CreditCard size={20} color="var(--text-secondary)"/>
          <div style={{flex:1}}>
            <div style={{fontWeight:600,fontSize:14,color:'var(--text-primary)'}}>Visa •••• 4242</div>
            <div style={{fontSize:12,color:'var(--text-muted)'}}>Expire 12/2027</div>
          </div>
          <button onClick={()=>toast.info('Redirection vers le portail de paiement...')}
            style={{padding:'6px 14px',borderRadius:8,border:'1px solid var(--card-border)',background:'var(--card-bg)',color:'var(--text-secondary)',fontSize:13,cursor:'pointer'}}>
            Modifier
          </button>
        </div>
      </div>

      {/* Invoice history */}
      <div style={{borderRadius:16,border:'1px solid var(--card-border)',background:'var(--card-bg)',overflow:'hidden'}}>
        <div style={{padding:'12px 20px',borderBottom:'1px solid var(--card-border)',background:'var(--body-bg)'}}>
          <span style={{fontWeight:600,fontSize:13,color:'var(--text-secondary)',textTransform:'uppercase',letterSpacing:'0.05em'}}>Historique des factures</span>
        </div>
        {INVOICES.map(inv=>(
          <div key={inv.id} style={{display:'flex',alignItems:'center',gap:14,padding:'12px 20px',borderBottom:'1px solid var(--card-border)'}}>
            <div style={{width:32,height:32,borderRadius:8,background:'#F0FDF4',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <CheckCircle size={14} color="#22C55E"/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontWeight:500,fontSize:14,color:'var(--text-primary)'}}>{inv.id} — Plan {inv.plan}</div>
              <div style={{fontSize:12,color:'var(--text-muted)'}}>{inv.date}</div>
            </div>
            <span style={{fontWeight:700,fontSize:14,color:'var(--text-primary)'}}>{inv.amount}</span>
            <span style={{fontSize:12,padding:'3px 10px',borderRadius:9999,background:'#ECFDF5',color:'#059669',fontWeight:500}}>{inv.status}</span>
            <button onClick={()=>toast.info('Téléchargement de la facture...')}
              style={{padding:6,borderRadius:8,background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',display:'flex',alignItems:'center'}}>
              <Download size={14}/>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
