import { useState } from 'react';
import { Check, Loader2, Palette, CheckCircle, AlertCircle } from 'lucide-react';
import { useTheme } from '@/providers/theme-provider';

const BUILT_IN_THEMES = [
  { id:'odoo-default', name:'GrowthOS (Odoo)', isDark:false, desc:"Inspiré d'Odoo Community — mauve professionnel", preview:{ sidebar:'#2C3E50', primary:'#875A7B', body:'#F5F5F5' } },
  { id:'teal', name:'Teal Pro', isDark:false, desc:'Élégant, épuré — bleu-vert moderne', preview:{ sidebar:'#1E293B', primary:'#0D9488', body:'#F8FAFC' } },
  { id:'dark', name:'Dark Mode', isDark:true, desc:'Mode sombre élégant pour travailler tard', preview:{ sidebar:'#0F172A', primary:'#14B8A6', body:'#1E293B' } },
  { id:'light', name:'Light Minimal', isDark:false, desc:'Minimaliste, clair, neutre', preview:{ sidebar:'#F8FAFC', primary:'#6366F1', body:'#FFFFFF' } },
  { id:'forest', name:'Forest Green', isDark:false, desc:'Nature et sérénité — vert intense', preview:{ sidebar:'#064E3B', primary:'#10B981', body:'#F0FDF4' } },
  { id:'sunset', name:'Sunset Orange', isDark:false, desc:'Dynamique et chaleureux', preview:{ sidebar:'#431407', primary:'#F97316', body:'#FFF7ED' } },
  { id:'dark-pro', name:'Dark Pro', isDark:true, desc:'Violet profond — pour les créatifs', preview:{ sidebar:'#0F0F1A', primary:'#6366F1', body:'#13131F' } },
];

export default function ThemesPage() {
  const { theme: currentTheme, setTheme } = useTheme();
  const [applying, setApplying] = useState<string|null>(null);
  const [toast, setToast] = useState<{msg:string;type:'success'|'error'}|null>(null);

  const showToast = (msg:string, type:'success'|'error'='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  const handleApply = async (themeId:string) => {
    setApplying(themeId);
    try {
      await setTheme(themeId);
      showToast(`Thème "${BUILT_IN_THEMES.find(t=>t.id===themeId)?.name}" appliqué ✓`);
    } catch { showToast('Erreur lors du changement de thème','error'); }
    finally { setApplying(null); }
  };

  return (
    <div className="min-h-screen p-6" style={{background:'var(--body-bg)'}}>
      {toast && <div className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${toast.type==='success'?'bg-teal-600 text-white':'bg-red-500 text-white'}`}>
        {toast.type==='success'?<CheckCircle className="w-4 h-4"/>:<AlertCircle className="w-4 h-4"/>}{toast.msg}
      </div>}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{color:'var(--text-primary)'}}>Thèmes</h1>
          <p className="text-sm" style={{color:'var(--text-muted)'}}>
            Thème actuel : <strong style={{color:'var(--color-primary)'}}>{BUILT_IN_THEMES.find(t=>t.id===currentTheme?.id)?.name||currentTheme?.name||'Odoo'}</strong>
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm" style={{background:'var(--card-bg)',border:'1px solid var(--card-border)',color:'var(--text-secondary)'}}>
          <Palette className="w-4 h-4"/>Appliqué instantanément
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {BUILT_IN_THEMES.map(theme=>{
          const isActive = currentTheme?.id === theme.id;
          const isApplying = applying === theme.id;
          return (
            <div key={theme.id} className="rounded-2xl overflow-hidden cursor-pointer transition-all hover:-translate-y-1 hover:shadow-xl"
              style={{border:`2px solid ${isActive?'var(--color-primary)':'var(--card-border)'}`}}>
              <div className="h-32 relative overflow-hidden" style={{background:theme.preview.body}}>
                <div className="absolute left-0 top-0 bottom-0 w-10" style={{background:theme.preview.sidebar}}/>
                <div className="ml-12 p-3 space-y-2">
                  <div className="h-2 rounded-full w-3/4" style={{background:theme.preview.primary,opacity:0.8}}/>
                  <div className="h-1.5 rounded-full w-full bg-gray-200 opacity-60"/>
                  <div className="h-1.5 rounded-full w-5/6 bg-gray-200 opacity-60"/>
                  <div className="flex gap-1.5 mt-2">
                    <div className="h-6 w-12 rounded-lg" style={{background:theme.preview.primary}}/>
                    <div className="h-6 w-16 rounded-lg bg-gray-200 opacity-60"/>
                  </div>
                </div>
                {isActive && <div className="absolute inset-0 flex items-center justify-center" style={{background:'rgba(0,0,0,0.3)'}}>
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                    <Check className="w-5 h-5" style={{color:theme.preview.primary}}/>
                  </div>
                </div>}
              </div>
              <div className="p-3" style={{background:'var(--card-bg)'}}>
                <div className="flex items-center justify-between mb-0.5">
                  <h3 className="font-semibold text-sm" style={{color:'var(--text-primary)'}}>{theme.name}</h3>
                  <div className="flex items-center gap-1">
                    {theme.isDark&&<span className="text-xs px-1.5 py-0.5 rounded" style={{background:'var(--card-border)',color:'var(--text-muted)'}}>🌙</span>}
                    {isActive&&<span className="text-xs font-bold" style={{color:'var(--color-primary)'}}>Actif</span>}
                  </div>
                </div>
                <p className="text-xs mb-3" style={{color:'var(--text-muted)'}}>{theme.desc}</p>
                <button onClick={()=>handleApply(theme.id)} disabled={isActive||isApplying}
                  className="w-full py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
                  style={isActive?{background:'var(--color-primary-light)',color:'var(--color-primary)',cursor:'default'}:{background:'var(--color-primary)',color:'#fff'}}>
                  {isApplying?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:isActive?<><Check className="w-3.5 h-3.5"/>Thème actif</>:<>Appliquer</>}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-2xl p-4 text-sm" style={{background:'var(--card-bg)',border:'1px solid var(--card-border)',color:'var(--text-secondary)'}}>
        <strong>Note :</strong> Le thème est sauvegardé localement et synchronisé avec votre compte. Il s'applique instantanément à toute l'interface sans rechargement.
      </div>
    </div>
  );
}
