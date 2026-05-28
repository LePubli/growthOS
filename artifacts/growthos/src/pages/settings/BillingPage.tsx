import { CreditCard, CheckCircle, Crown } from 'lucide-react';

const PLANS = [
  { id:'starter', name:'Starter', price:49, desc:'Pour les freelances et petites équipes', features:['500 prospects/mois','3 séquences actives','2 utilisateurs','Support email'], current:false },
  { id:'pro', name:'Pro', price:149, desc:'Pour les équipes commerciales', features:['5 000 prospects/mois','Séquences illimitées','10 utilisateurs','Plugins premium','Support prioritaire'], current:true },
  { id:'enterprise', name:'Enterprise', price:499, desc:'Pour les grandes organisations', features:['Prospects illimités','API complète','Utilisateurs illimités','SSO/SAML','Account manager dédié'], current:false },
];

export default function BillingPage() {
  return (
    <div className="min-h-screen p-6" style={{background:'var(--body-bg)'}}>
      <h1 style={{fontSize:22,fontWeight:700,color:'var(--text-primary)',marginBottom:4}}>Facturation</h1>
      <p style={{fontSize:14,color:'var(--text-muted)',marginBottom:24}}>Gérez votre abonnement et vos informations de paiement</p>

      <div style={{borderRadius:16,padding:24,marginBottom:24,background:'var(--color-primary)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <p style={{color:'rgba(255,255,255,.7)',fontSize:13,margin:'0 0 4px'}}>Plan actuel</p>
          <h2 style={{fontSize:22,fontWeight:700,color:'#fff',margin:'0 0 4px'}}>Pro · 149€/mois</h2>
          <p style={{color:'rgba(255,255,255,.7)',fontSize:13,margin:0}}>Renouvellement le 1er juin 2026</p>
        </div>
        <Crown size={48} color="rgba(255,255,255,.4)"/>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginBottom:24}}>
        {PLANS.map(plan=>(
          <div key={plan.id} style={{borderRadius:16,border:`2px solid ${plan.current?'var(--color-primary)':'var(--card-border)'}`,background:'var(--card-bg)',padding:20,boxShadow:plan.current?'0 4px 20px rgba(0,0,0,.08)':'none'}}>
            {plan.current&&<div style={{fontSize:11,background:'var(--color-primary)',color:'#fff',padding:'2px 10px',borderRadius:9999,display:'inline-block',marginBottom:10,fontWeight:600}}>Plan actuel</div>}
            <h3 style={{fontWeight:700,fontSize:18,color:'var(--text-primary)',margin:'0 0 4px'}}>{plan.name}</h3>
            <div style={{fontSize:28,fontWeight:700,color:'var(--text-primary)',margin:'4px 0'}}>
              {plan.price}€<span style={{fontSize:14,fontWeight:400,color:'var(--text-muted)'}}>/mois</span>
            </div>
            <p style={{fontSize:12,color:'var(--text-muted)',margin:'0 0 16px'}}>{plan.desc}</p>
            <ul style={{listStyle:'none',padding:0,margin:'0 0 20px',display:'flex',flexDirection:'column',gap:8}}>
              {plan.features.map(f=>(
                <li key={f} style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:'var(--text-secondary)'}}>
                  <CheckCircle size={14} color="var(--color-primary)"/>{f}
                </li>
              ))}
            </ul>
            <button style={{width:'100%',padding:'10px',borderRadius:10,border:`1px solid ${plan.current?'var(--color-primary)':'var(--card-border)'}`,background:plan.current?'var(--color-primary-light)':'transparent',color:plan.current?'var(--color-primary)':'var(--text-secondary)',fontSize:14,fontWeight:600,cursor:'pointer'}}>
              {plan.current?'Plan actuel':'Passer à ce plan'}
            </button>
          </div>
        ))}
      </div>

      <div style={{borderRadius:16,border:'1px solid var(--card-border)',background:'var(--card-bg)',padding:20}}>
        <h2 style={{fontWeight:600,fontSize:15,color:'var(--text-primary)',marginBottom:16}}>Moyen de paiement</h2>
        <div style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',borderRadius:12,border:'1px solid var(--card-border)',background:'var(--body-bg)'}}>
          <CreditCard size={20} color="var(--text-secondary)"/>
          <div style={{flex:1}}>
            <div style={{fontWeight:600,fontSize:14,color:'var(--text-primary)'}}>Visa •••• 4242</div>
            <div style={{fontSize:12,color:'var(--text-muted)'}}>Expire 12/2027</div>
          </div>
          <button style={{padding:'6px 14px',borderRadius:8,border:'1px solid var(--card-border)',background:'var(--card-bg)',color:'var(--text-secondary)',fontSize:13,cursor:'pointer'}}>Modifier</button>
        </div>
      </div>
    </div>
  );
}
