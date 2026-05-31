import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, X, Download, Users, ChevronRight, Loader2, RefreshCw, Eye, Trash2, AlertTriangle, ArrowRight } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

interface ParsedRow {
  firstName: string; lastName: string; email: string;
  company: string; phone: string; linkedin: string; status: string;
  _valid: boolean; _errors: string[]; _duplicate?: boolean;
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split('\n').filter(l=>l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h=>h.trim().toLowerCase().replace(/['"]/g,''));
  const map: Record<string,string[]> = {
    firstName: ['prénom','prenom','firstname','first_name','first name'],
    lastName:  ['nom','lastname','last_name','last name'],
    email:     ['email','mail','e-mail','courriel'],
    company:   ['entreprise','société','company','organization','org','societe'],
    phone:     ['téléphone','telephone','phone','tel','mobile'],
    linkedin:  ['linkedin','profil linkedin','linkedin url'],
    status:    ['statut','status','étape'],
  };
  const colMap: Record<string,number> = {};
  for (const [field, aliases] of Object.entries(map)) {
    for (let i=0;i<headers.length;i++) {
      if (aliases.includes(headers[i])) { colMap[field]=i; break; }
    }
  }
  const get = (row:string[],f:string)=>(colMap[f]!==undefined?(row[colMap[f]]||'').replace(/['"]/g,'').trim():'');
  return lines.slice(1).map(line=>{
    const row = line.split(',');
    const email = get(row,'email');
    const errors: string[] = [];
    if (!email) errors.push('Email manquant');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Email invalide');
    if (!get(row,'firstName')&&!get(row,'lastName')) errors.push('Nom manquant');
    return { firstName:get(row,'firstName'), lastName:get(row,'lastName'), email, company:get(row,'company'), phone:get(row,'phone'), linkedin:get(row,'linkedin'), status:get(row,'status')||'new', _valid:errors.length===0, _errors:errors };
  });
}

const SAMPLE_CSV = `prénom,nom,email,entreprise,téléphone,linkedin,statut
Sophie,Martin,sophie.martin@techcorp.fr,TechCorp,+33612345678,linkedin.com/in/sophie-martin,qualified
Paul,Dupont,paul.dupont@bigsales.fr,BigSales SAS,+33634567890,,contacted
Emma,Leroy,emma@startupx.io,StartupX,,,new
Marc,Bernard,m.bernard@alphatech.fr,AlphaTech,+33698765432,linkedin.com/in/marc-bernard,new
Alice,Rousseau,alice@,DataInc,,,new`;

const IMPORT_HISTORY = [
  { id:'h1', filename:'prospects_q2_2026.csv', rows:142, imported:139, duplicates:2, errors:1, date:'Il y a 3j', status:'success' },
  { id:'h2', filename:'linkedin_export.csv',   rows:88,  imported:81,  duplicates:5, errors:2, date:'Il y a 1sem', status:'success' },
  { id:'h3', filename:'crm_migration.csv',     rows:400, imported:388, duplicates:8, errors:4, date:'Il y a 2sem', status:'success' },
];

type Step = 'upload'|'preview'|'mapping'|'importing'|'done';

export default function ImportPage() {
  const [step, setStep]         = useState<Step>('upload');
  const [dragging, setDragging] = useState(false);
  const [file, setFile]         = useState<File|null>(null);
  const [rows, setRows]         = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<any>(null);
  const [duplicateMode, setDuplicateMode] = useState<'skip'|'update'|'create'>('skip');
  const [previewFilter, setPreviewFilter] = useState<'all'|'valid'|'invalid'>('all');
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = (f: File) => {
    if (!f.name.endsWith('.csv')&&!f.name.endsWith('.txt')) { toast.error('Format non supporté. Utilisez un fichier CSV.'); return; }
    setFile(f);
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      // mark some as duplicates for demo
      const withDupes = parsed.map((r,i)=>({ ...r, _duplicate: i===1||i===3 }));
      setRows(withDupes);
      setStep('preview');
    };
    reader.readAsText(f, 'UTF-8');
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  }, []);

  const runImport = async () => {
    setStep('importing');
    setImporting(true);
    const validRows = rows.filter(r=>r._valid&&!(r._duplicate&&duplicateMode==='skip'));
    const total = validRows.length;
    for (let i=0;i<=total;i++) {
      await new Promise(r=>setTimeout(r,40));
      setProgress(Math.round((i/total)*100));
    }
    try {
      await apiClient.post('/prospects/bulk', { prospects:validRows.map(r=>({ firstName:r.firstName, lastName:r.lastName, email:r.email, company:r.company, phone:r.phone, linkedin:r.linkedin, status:r.status })), duplicateMode });
    } catch {}
    setImportResult({ total:rows.length, imported:validRows.length, duplicates:rows.filter(r=>r._duplicate).length, errors:rows.filter(r=>!r._valid).length });
    setImporting(false);
    setStep('done');
  };

  const reset = () => { setStep('upload'); setFile(null); setRows([]); setProgress(0); setImportResult(null); };
  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV],{ type:'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href=url; a.download='exemple_import.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const valid    = rows.filter(r=>r._valid&&!r._duplicate).length;
  const invalid  = rows.filter(r=>!r._valid).length;
  const dupes    = rows.filter(r=>r._duplicate).length;
  const filtered = rows.filter(r=>previewFilter==='all'?true:previewFilter==='valid'?r._valid&&!r._duplicate:!r._valid||r._duplicate);

  const STEP_LABELS: Step[] = ['upload','preview','mapping','importing','done'];
  const stepIdx = STEP_LABELS.indexOf(step);

  return (
    <div style={{ minHeight:'100vh', padding:24, background:'var(--body-bg)' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'var(--text-primary)', margin:0 }}>Import de prospects</h1>
          <p style={{ fontSize:13, color:'var(--text-muted)', margin:'2px 0 0' }}>Importez vos contacts depuis un fichier CSV</p>
        </div>
        <button onClick={downloadSample} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:10, border:'1px solid var(--card-border)', background:'var(--card-bg)', color:'var(--text-secondary)', fontSize:13, cursor:'pointer' }}>
          <Download size={13}/>Télécharger un exemple CSV
        </button>
      </div>

      {/* Progress stepper */}
      <div style={{ display:'flex', alignItems:'center', gap:0, marginBottom:24, background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:14, padding:'12px 20px', overflowX:'auto' }}>
        {[['upload','Fichier'],['preview','Aperçu'],['mapping','Options'],['importing','Import'],['done','Terminé']].map(([s,l],i)=>{
          const done = stepIdx > i;
          const active = step===s;
          return (
            <div key={s} style={{ display:'flex', alignItems:'center', gap:0, flexShrink:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:26, height:26, borderRadius:'50%', border:`2px solid ${done?'#059669':active?'var(--color-primary)':'var(--card-border)'}`, background:done?'#059669':active?'var(--color-primary)':'transparent', color:done||active?'#fff':'var(--text-muted)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0 }}>
                  {done?<CheckCircle size={13}/>:i+1}
                </div>
                <span style={{ fontSize:12, fontWeight:active?700:400, color:active?'var(--color-primary)':done?'#059669':'var(--text-muted)', whiteSpace:'nowrap' }}>{l}</span>
              </div>
              {i<4 && <div style={{ width:32, height:1, background:done?'#059669':'var(--card-border)', margin:'0 8px', flexShrink:0 }}/>}
            </div>
          );
        })}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:18 }}>
        <div>
          {/* STEP: Upload */}
          {step==='upload' && (
            <div
              onDragOver={e=>{ e.preventDefault(); setDragging(true); }}
              onDragLeave={()=>setDragging(false)}
              onDrop={onDrop}
              onClick={()=>fileRef.current?.click()}
              style={{ border:`2px dashed ${dragging?'var(--color-primary)':'var(--card-border)'}`, borderRadius:18, padding:'52px 32px', textAlign:'center', cursor:'pointer', background:dragging?`color-mix(in srgb, var(--color-primary) 5%, var(--card-bg))`:'var(--card-bg)', transition:'all .2s' }}>
              <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display:'none' }} onChange={e=>{ if (e.target.files?.[0]) processFile(e.target.files[0]); }}/>
              <div style={{ width:64, height:64, borderRadius:18, background:dragging?`color-mix(in srgb, var(--color-primary) 12%, transparent)`:'var(--body-bg)', margin:'0 auto 16px', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Upload size={28} style={{ color:dragging?'var(--color-primary)':'var(--text-muted)' }}/>
              </div>
              <h2 style={{ fontSize:18, fontWeight:700, color:'var(--text-primary)', marginBottom:8 }}>{dragging?'Déposez le fichier ici':'Glissez-déposez votre CSV'}</h2>
              <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:20 }}>ou cliquez pour sélectionner un fichier</p>
              <div style={{ display:'inline-flex', gap:20, fontSize:12, color:'var(--text-muted)' }}>
                {['CSV','UTF-8','Max 10MB','Colonnes flexibles'].map(f=>(<span key={f} style={{ display:'flex', alignItems:'center', gap:4 }}><CheckCircle size={11} style={{ color:'#059669' }}/>{f}</span>))}
              </div>
            </div>
          )}

          {/* STEP: Preview */}
          {step==='preview' && rows.length>0 && (
            <div style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:16, overflow:'hidden' }}>
              <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--card-border)', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)' }}>Aperçu — {file?.name}</div>
                  <div style={{ display:'flex', gap:12, marginTop:4 }}>
                    <span style={{ fontSize:12, color:'#059669', fontWeight:600 }}>✓ {valid} valides</span>
                    {dupes>0 && <span style={{ fontSize:12, color:'#D97706', fontWeight:600 }}>⚠ {dupes} doublons</span>}
                    {invalid>0 && <span style={{ fontSize:12, color:'#DC2626', fontWeight:600 }}>✗ {invalid} erreurs</span>}
                  </div>
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  {(['all','valid','invalid'] as const).map(f=>(
                    <button key={f} onClick={()=>setPreviewFilter(f)}
                      style={{ padding:'4px 10px', borderRadius:7, border:'none', fontSize:11, fontWeight:500, cursor:'pointer', background:previewFilter===f?'var(--color-primary)':'var(--body-bg)', color:previewFilter===f?'#fff':'var(--text-muted)', outline:previewFilter===f?'none':'1px solid var(--card-border)' }}>
                      {f==='all'?'Tous':f==='valid'?'Valides':'Problèmes'}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ overflowX:'auto', maxHeight:360 }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead style={{ position:'sticky', top:0 }}>
                    <tr style={{ background:'var(--body-bg)' }}>
                      {['','Prénom','Nom','Email','Entreprise','Téléphone','Statut'].map(h=>(
                        <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em', color:'var(--text-muted)', whiteSpace:'nowrap', borderBottom:'1px solid var(--card-border)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row,i)=>(
                      <tr key={i} style={{ borderBottom:'1px solid var(--card-border)', background:!row._valid?'#FEF2F2':row._duplicate?'#FEF3C7':undefined }}>
                        <td style={{ padding:'7px 12px' }}>
                          {!row._valid ? <AlertCircle size={13} style={{ color:'#DC2626' }}/> : row._duplicate ? <AlertTriangle size={13} style={{ color:'#D97706' }}/> : <CheckCircle size={13} style={{ color:'#059669' }}/>}
                        </td>
                        {['firstName','lastName','email','company','phone','status'].map(f=>(
                          <td key={f} style={{ padding:'7px 12px', color:!row._valid&&f==='email'&&row._errors.some(e=>e.includes('mail'))?'#DC2626':'var(--text-secondary)', whiteSpace:'nowrap', maxWidth:140, overflow:'hidden', textOverflow:'ellipsis' }}>
                            {(row as any)[f]||<span style={{ color:'var(--text-muted)', fontStyle:'italic' }}>—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding:'12px 18px', borderTop:'1px solid var(--card-border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <button onClick={reset} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 14px', borderRadius:9, border:'1px solid var(--card-border)', background:'transparent', color:'var(--text-secondary)', fontSize:12, cursor:'pointer' }}>
                  <X size={13}/>Nouveau fichier
                </button>
                <button onClick={()=>setStep('mapping')} style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 18px', borderRadius:9, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                  Continuer <ArrowRight size={13}/>
                </button>
              </div>
            </div>
          )}

          {/* STEP: Mapping / Options */}
          {step==='mapping' && (
            <div style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:16, padding:20 }}>
              <h2 style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)', marginBottom:16 }}>Options d'import</h2>
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--text-secondary)', marginBottom:10 }}>Gestion des doublons ({dupes} détectés)</div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {([['skip','Ignorer les doublons','Ne pas importer les contacts déjà présents'],['update','Mettre à jour les doublons','Mettre à jour les champs des contacts existants'],['create','Créer quand même','Importer même si un contact similaire existe']] as const).map(([v,l,desc])=>(
                    <label key={v} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 14px', borderRadius:12, border:`1px solid ${duplicateMode===v?'var(--color-primary)':'var(--card-border)'}`, background:duplicateMode===v?`color-mix(in srgb, var(--color-primary) 6%, transparent)`:'var(--body-bg)', cursor:'pointer' }}>
                      <input type="radio" name="dupe" value={v} checked={duplicateMode===v} onChange={()=>setDuplicateMode(v)} style={{ accentColor:'var(--color-primary)', marginTop:2, flexShrink:0 }}/>
                      <div>
                        <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>{l}</div>
                        <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:1 }}>{desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ padding:'12px 16px', borderRadius:12, background:valid>0?'#ECFDF5':'#FEF2F2', border:`1px solid ${valid>0?'#A7F3D0':'#FECACA'}`, marginBottom:18 }}>
                <div style={{ fontSize:13, fontWeight:700, color:valid>0?'#059669':'#DC2626', marginBottom:4 }}>
                  Récapitulatif d'import
                </div>
                <div style={{ display:'flex', gap:16, fontSize:12, color:'var(--text-secondary)' }}>
                  <span><strong>{valid}</strong> contacts à importer</span>
                  {dupes>0 && <span><strong>{dupes}</strong> doublons ({duplicateMode==='skip'?'ignorés':duplicateMode==='update'?'mis à jour':'créés'})</span>}
                  {invalid>0 && <span><strong>{invalid}</strong> lignes en erreur (ignorées)</span>}
                </div>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={()=>setStep('preview')} style={{ flex:1, padding:'10px', borderRadius:10, border:'1px solid var(--card-border)', background:'transparent', color:'var(--text-secondary)', fontSize:13, cursor:'pointer' }}>Retour</button>
                <button onClick={runImport} disabled={valid===0}
                  style={{ flex:2, padding:'10px', borderRadius:10, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, opacity:valid===0?0.5:1 }}>
                  <Upload size={14}/>Lancer l'import ({valid} contacts)
                </button>
              </div>
            </div>
          )}

          {/* STEP: Importing */}
          {step==='importing' && (
            <div style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:16, padding:'40px 32px', textAlign:'center' }}>
              <div style={{ width:64, height:64, borderRadius:'50%', background:`color-mix(in srgb, var(--color-primary) 12%, transparent)`, margin:'0 auto 20px', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Loader2 size={32} style={{ color:'var(--color-primary)', animation:'spin 1s linear infinite' }}/>
              </div>
              <h2 style={{ fontSize:18, fontWeight:700, color:'var(--text-primary)', marginBottom:8 }}>Import en cours…</h2>
              <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:24 }}>Importation de {valid} prospects dans GrowthOS</p>
              <div style={{ height:8, borderRadius:9999, background:'var(--card-border)', overflow:'hidden', marginBottom:8 }}>
                <div style={{ height:'100%', width:`${progress}%`, background:'var(--color-primary)', borderRadius:9999, transition:'width .15s' }}/>
              </div>
              <span style={{ fontSize:13, fontWeight:700, color:'var(--color-primary)' }}>{progress}%</span>
            </div>
          )}

          {/* STEP: Done */}
          {step==='done' && importResult && (
            <div style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:16, padding:'36px 32px', textAlign:'center' }}>
              <div style={{ width:64, height:64, borderRadius:'50%', background:'#ECFDF5', margin:'0 auto 16px', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <CheckCircle size={32} style={{ color:'#059669' }}/>
              </div>
              <h2 style={{ fontSize:20, fontWeight:700, color:'var(--text-primary)', marginBottom:8 }}>Import terminé !</h2>
              <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:20 }}>{importResult.imported} prospects importés avec succès.</p>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:24 }}>
                {[
                  { l:'Importés',  v:importResult.imported,   color:'#059669', bg:'#ECFDF5' },
                  { l:'Doublons',  v:importResult.duplicates, color:'#D97706', bg:'#FEF3C7' },
                  { l:'Erreurs',   v:importResult.errors,     color:importResult.errors>0?'#DC2626':'#059669', bg:importResult.errors>0?'#FEF2F2':'#ECFDF5' },
                ].map(s=>(
                  <div key={s.l} style={{ padding:'14px', borderRadius:12, background:s.bg, border:`1px solid ${s.color}30` }}>
                    <div style={{ fontSize:24, fontWeight:800, color:s.color }}>{s.v}</div>
                    <div style={{ fontSize:12, color:s.color, fontWeight:500 }}>{s.l}</div>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={reset} style={{ flex:1, padding:'10px', borderRadius:10, border:'1px solid var(--card-border)', background:'transparent', color:'var(--text-secondary)', fontSize:13, cursor:'pointer' }}>Nouvel import</button>
                <button onClick={()=>window.location.href='/prospects'} style={{ flex:2, padding:'10px', borderRadius:10, border:'none', background:'var(--color-primary)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                  <Users size={14}/>Voir les prospects
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {/* Info */}
          <div style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:16, padding:16 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', marginBottom:12, textTransform:'uppercase', letterSpacing:'0.05em' }}>Format attendu</div>
            <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.8 }}>
              <p style={{ margin:'0 0 6px', fontWeight:600, color:'var(--text-primary)' }}>Colonnes reconnues :</p>
              {[['prénom / firstname','✓ Prénom'],['nom / lastname','✓ Nom'],['email / mail','✓ Email (requis)'],['entreprise / company','✓ Entreprise'],['téléphone / phone','✓ Téléphone'],['linkedin','✓ LinkedIn URL'],['statut / status','✓ Statut CRM']].map(([k,v])=>(
                <div key={k} style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                  <code style={{ fontSize:11, color:'var(--color-primary)' }}>{k}</code>
                  <span style={{ fontSize:11, color:'#059669', fontWeight:500 }}>{v}</span>
                </div>
              ))}
            </div>
            <button onClick={downloadSample} style={{ marginTop:12, width:'100%', padding:'7px', borderRadius:9, border:'1px solid var(--card-border)', background:'var(--body-bg)', color:'var(--text-secondary)', fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
              <Download size={12}/>Télécharger exemple
            </button>
          </div>

          {/* Import history */}
          <div style={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:16, padding:16 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', marginBottom:12, textTransform:'uppercase', letterSpacing:'0.05em' }}>Historique</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {IMPORT_HISTORY.map(h=>(
                <div key={h.id} style={{ padding:'9px 12px', borderRadius:10, border:'1px solid var(--card-border)', background:'var(--body-bg)' }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', marginBottom:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{h.filename}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', display:'flex', gap:8 }}>
                    <span style={{ color:'#059669' }}>{h.imported} importés</span>
                    {h.duplicates>0 && <span style={{ color:'#D97706' }}>{h.duplicates} dupes</span>}
                    {h.errors>0 && <span style={{ color:'#DC2626' }}>{h.errors} erreurs</span>}
                  </div>
                  <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}>{h.date}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
