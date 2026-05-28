import { useState } from 'react';
import { useLocation } from 'wouter';
import { User, Save, Loader2, Camera, Mail, Phone, Globe, Building2, ArrowLeft, CheckCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';

export default function ProfilePage() {
  const [, navigate] = useLocation();
  const { user } = useAuthStore();
  const [form, setForm] = useState({ firstName:user?.firstName||'', lastName:user?.lastName||'', email:user?.email||'', phone:'', company:'', website:'', bio:'' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const set = (k:string,v:string) => setForm(f=>({...f,[k]:v}));

  const save = async () => {
    setSaving(true);
    await new Promise(r=>setTimeout(r,800));
    setSaving(false); setSaved(true); setTimeout(()=>setSaved(false),3000);
  };

  const InputField = ({label,k,type='text',placeholder=''}:{label:string;k:string;type?:string;placeholder?:string}) => (
    <div style={{marginBottom:16}}>
      <label style={{display:'block',fontSize:13,fontWeight:500,color:'var(--text-secondary)',marginBottom:6}}>{label}</label>
      <input type={type} value={(form as any)[k]} onChange={e=>set(k,e.target.value)} placeholder={placeholder}
        style={{width:'100%',padding:'10px 12px',border:'1px solid var(--card-border)',borderRadius:10,fontSize:14,background:'var(--body-bg)',color:'var(--text-primary)',outline:'none',boxSizing:'border-box'}}/>
    </div>
  );

  return (
    <div className="min-h-screen p-6" style={{background:'var(--body-bg)'}}>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:24}}>
        <button onClick={()=>navigate('/settings')} style={{padding:8,borderRadius:10,background:'var(--card-bg)',border:'1px solid var(--card-border)',cursor:'pointer',color:'var(--text-secondary)',display:'flex',alignItems:'center'}}>
          <ArrowLeft size={18}/>
        </button>
        <h1 style={{fontSize:22,fontWeight:700,color:'var(--text-primary)',margin:0}}>Profil</h1>
        {saved&&<span style={{display:'flex',alignItems:'center',gap:6,fontSize:13,color:'#059669'}}><CheckCircle size={14}/>Enregistré</span>}
      </div>

      <div style={{maxWidth:560}}>
        <div style={{borderRadius:16,border:'1px solid var(--card-border)',background:'var(--card-bg)',padding:24,marginBottom:16}}>
          <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:24}}>
            <div style={{width:72,height:72,borderRadius:16,background:'var(--color-primary)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:28,position:'relative',flexShrink:0}}>
              {form.firstName?.[0]?.toUpperCase()||user?.email?.[0]?.toUpperCase()||'U'}
              <button style={{position:'absolute',bottom:0,right:0,width:22,height:22,borderRadius:'50%',background:'var(--color-primary-dark)',border:'2px solid var(--card-bg)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
                <Camera size={10} color="#fff"/>
              </button>
            </div>
            <div>
              <div style={{fontWeight:600,fontSize:16,color:'var(--text-primary)'}}>{form.firstName} {form.lastName}</div>
              <div style={{fontSize:13,color:'var(--text-muted)'}}>{form.email}</div>
            </div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <InputField label="Prénom" k="firstName" placeholder="Jean"/>
            <InputField label="Nom" k="lastName" placeholder="Dupont"/>
          </div>
          <InputField label="Email" k="email" type="email" placeholder="jean@acme.fr"/>
          <InputField label="Téléphone" k="phone" placeholder="+33 6 12 34 56 78"/>
          <InputField label="Entreprise" k="company" placeholder="Acme SAS"/>
          <InputField label="Site web" k="website" placeholder="https://acme.fr"/>
          <div style={{marginBottom:16}}>
            <label style={{display:'block',fontSize:13,fontWeight:500,color:'var(--text-secondary)',marginBottom:6}}>Bio</label>
            <textarea value={form.bio} onChange={e=>set('bio',e.target.value)} rows={3} placeholder="Décrivez-vous en quelques mots..."
              style={{width:'100%',padding:'10px 12px',border:'1px solid var(--card-border)',borderRadius:10,fontSize:14,background:'var(--body-bg)',color:'var(--text-primary)',outline:'none',resize:'vertical',boxSizing:'border-box'}}/>
          </div>

          <button onClick={save} disabled={saving}
            style={{display:'flex',alignItems:'center',gap:8,padding:'10px 20px',borderRadius:10,border:'none',background:'var(--color-primary)',color:'#fff',fontSize:14,fontWeight:600,cursor:saving?'not-allowed':'pointer',opacity:saving?0.7:1}}>
            {saving?<><Loader2 size={14} className="animate-spin"/>Enregistrement...</>:<><Save size={14}/>Sauvegarder</>}
          </button>
        </div>
      </div>
    </div>
  );
}
