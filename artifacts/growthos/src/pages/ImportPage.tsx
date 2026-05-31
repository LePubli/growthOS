import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, X, Download, Users, ChevronRight, Loader2 } from 'lucide-react';
import apiClient from '@/lib/api-client';

interface ParsedRow {
  firstName: string; lastName: string; email: string;
  company: string; phone: string; linkedin: string; status: string;
  _valid: boolean; _errors: string[];
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
  const map: Record<string, string[]> = {
    firstName: ['prénom', 'prenom', 'firstname', 'first_name', 'first name', 'nom_prénom'],
    lastName: ['nom', 'lastname', 'last_name', 'last name'],
    email: ['email', 'mail', 'e-mail', 'courriel'],
    company: ['entreprise', 'société', 'company', 'organization', 'org', 'societe'],
    phone: ['téléphone', 'telephone', 'phone', 'tel', 'mobile'],
    linkedin: ['linkedin', 'profil linkedin', 'linkedin url'],
    status: ['statut', 'status', 'étape'],
  };
  const colMap: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(map)) {
    for (let i = 0; i < headers.length; i++) {
      if (aliases.includes(headers[i])) { colMap[field] = i; break; }
    }
  }
  return lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
    const get = (field: string) => colMap[field] !== undefined ? cols[colMap[field]] || '' : '';
    const email = get('email');
    const errors: string[] = [];
    if (!email || !email.includes('@')) errors.push('Email invalide');
    if (!get('firstName') && !get('lastName') && !get('company')) errors.push('Nom ou entreprise requis');
    return {
      firstName: get('firstName'), lastName: get('lastName'), email,
      company: get('company'), phone: get('phone'), linkedin: get('linkedin'),
      status: get('status') || 'lead', _valid: errors.length === 0, _errors: errors,
    };
  }).filter(r => r.email || r.company || r.firstName);
}

const SAMPLE_CSV = `Prénom,Nom,Email,Entreprise,Téléphone,LinkedIn,Statut
Sophie,Martin,sophie.martin@techcorp.fr,TechCorp,+33 6 12 34 56 78,linkedin.com/in/sophie-martin,qualified
Emma,Leroy,emma.leroy@startupx.io,StartupX,+33 6 23 45 67 89,,lead
Paul,Dupont,paul.dupont@bigsales.fr,BigSales SAS,+33 6 34 56 78 90,linkedin.com/in/paul-dupont,proposal
Camille,Bernard,camille.bernard@datainc.com,DataInc,,linkedin.com/in/camille-bernard,lead
Luc,Moreau,luc.moreau@growthco.fr,GrowthCo,+33 6 56 78 90 12,,won`;

export default function ImportPage() {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; errors: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      setRows(parsed);
      setStep('preview');
    };
    reader.readAsText(file, 'utf-8');
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const doImport = async () => {
    const valid = rows.filter(r => r._valid);
    setImporting(true); setStep('importing');
    let success = 0; let errors = 0;
    for (const row of valid) {
      try {
        await apiClient.post('/prospects', {
          firstName: row.firstName, lastName: row.lastName, email: row.email,
          company_name: row.company, phone: row.phone, linkedin_url: row.linkedin, status: row.status || 'lead',
        });
        success++;
      } catch { errors++; }
    }
    setImportResult({ success, errors });
    setImporting(false); setStep('done');
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'exemple_import_prospects.csv';
    a.click();
  };

  const reset = () => { setStep('upload'); setRows([]); setImportResult(null); };

  const validCount = rows.filter(r => r._valid).length;
  const errorCount = rows.filter(r => !r._valid).length;

  return (
    <div className="min-h-screen p-4 sm:p-6" style={{ background: 'var(--body-bg)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Import CSV</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Importez vos prospects depuis Excel ou un fichier CSV</p>
        </div>
        <button onClick={downloadSample} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <Download size={14} />Exemple CSV
        </button>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2 mb-6">
        {[{ id: 'upload', label: '1. Fichier' }, { id: 'preview', label: '2. Aperçu' }, { id: 'done', label: '3. Import' }].map((s, i) => {
          const active = s.id === step || (s.id === 'preview' && step === 'importing') || (s.id === 'done' && step === 'done');
          const done = (s.id === 'upload' && step !== 'upload') || (s.id === 'preview' && (step === 'importing' || step === 'done'));
          return (
            <div key={s.id} className="flex items-center gap-2">
              {i > 0 && <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium" style={{ background: active ? 'var(--color-primary)' : done ? '#ECFDF5' : 'var(--card-bg)', color: active ? '#fff' : done ? '#059669' : 'var(--text-muted)', border: '1px solid var(--card-border)' }}>
                {done && <CheckCircle size={13} />}{s.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Upload step */}
      {step === 'upload' && (
        <div>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            style={{ border: `2px dashed ${dragOver ? 'var(--color-primary)' : 'var(--card-border)'}`, borderRadius: 20, padding: '48px 24px', textAlign: 'center', cursor: 'pointer', background: dragOver ? 'var(--color-primary-light)' : 'var(--card-bg)', transition: 'all 0.15s', marginBottom: 24 }}>
            <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && processFile(e.target.files[0])} />
            <div style={{ width: 64, height: 64, borderRadius: 16, background: dragOver ? 'var(--color-primary)' : 'var(--body-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Upload size={28} color={dragOver ? '#fff' : 'var(--color-primary)'} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Déposez votre fichier ici</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>ou cliquez pour sélectionner un fichier CSV ou Excel (.csv, .txt)</p>
            <span style={{ display: 'inline-block', padding: '8px 20px', borderRadius: 10, background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 600 }}>Choisir un fichier</span>
          </div>

          {/* Instructions */}
          <div className="rounded-2xl border p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <h3 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Format attendu</h3>
            <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>Le fichier CSV doit contenir au minimum une colonne Email ou Entreprise. Les colonnes reconnues :</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { col: 'Prénom / firstname', ex: 'Sophie' },
                { col: 'Nom / lastname', ex: 'Martin' },
                { col: 'Email *', ex: 'sophie@acme.fr' },
                { col: 'Entreprise / company', ex: 'Acme SAS' },
                { col: 'Téléphone / phone', ex: '+33 6 12 34 56 78' },
                { col: 'LinkedIn', ex: 'linkedin.com/in/...' },
              ].map((f, i) => (
                <div key={i} style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--body-bg)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{f.col}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f.ex}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Preview step */}
      {step === 'preview' && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm" style={{ background: '#ECFDF5', color: '#059669' }}>
              <CheckCircle size={14} />{validCount} valides
            </div>
            {errorCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm" style={{ background: '#FEF2F2', color: '#DC2626' }}>
                <AlertCircle size={14} />{errorCount} avec erreurs
              </div>
            )}
            <button onClick={reset} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <X size={13} />Changer le fichier
            </button>
          </div>

          {/* Preview table */}
          <div className="rounded-2xl border overflow-hidden mb-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--body-bg)' }}>
                    {['', 'Prénom', 'Nom', 'Email', 'Entreprise', 'Téléphone', 'Statut'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--card-border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--card-border)', background: row._valid ? 'transparent' : '#FEF2F2' }}>
                      <td style={{ padding: '8px 14px' }}>
                        {row._valid
                          ? <CheckCircle size={14} color="#059669" />
                          : <span title={row._errors.join(', ')}><AlertCircle size={14} color="#DC2626" /></span>}
                      </td>
                      {['firstName', 'lastName', 'email', 'company', 'phone', 'status'].map(k => (
                        <td key={k} style={{ padding: '8px 14px', fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{(row as any)[k] || '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 50 && (
                <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', borderTop: '1px solid var(--card-border)' }}>
                  + {rows.length - 50} lignes supplémentaires
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={reset} className="px-5 py-2.5 rounded-xl text-sm font-medium" style={{ border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              Annuler
            </button>
            <button onClick={doImport} disabled={validCount === 0}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: 'var(--color-primary)', border: 'none', cursor: validCount === 0 ? 'not-allowed' : 'pointer', opacity: validCount === 0 ? 0.5 : 1 }}>
              <Users size={15} />Importer {validCount} prospect{validCount > 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}

      {/* Importing step */}
      {step === 'importing' && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 size={48} className="animate-spin mb-6" style={{ color: 'var(--color-primary)' }} />
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Import en cours…</h2>
          <p style={{ color: 'var(--text-muted)' }}>Création de {validCount} prospects dans GrowthOS</p>
        </div>
      )}

      {/* Done step */}
      {step === 'done' && importResult && (
        <div className="max-w-md mx-auto text-center py-12">
          <div style={{ width: 80, height: 80, borderRadius: 20, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <CheckCircle size={40} color="#059669" />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Import terminé !</h2>
          <div className="flex gap-4 justify-center mb-6">
            <div style={{ padding: '12px 24px', borderRadius: 14, background: '#ECFDF5' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#059669' }}>{importResult.success}</div>
              <div style={{ fontSize: 13, color: '#059669' }}>Importés</div>
            </div>
            {importResult.errors > 0 && (
              <div style={{ padding: '12px 24px', borderRadius: 14, background: '#FEF2F2' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#DC2626' }}>{importResult.errors}</div>
                <div style={{ fontSize: 13, color: '#DC2626' }}>Erreurs</div>
              </div>
            )}
          </div>
          <div className="flex gap-3 justify-center">
            <button onClick={reset} style={{ padding: '10px 20px', borderRadius: 12, border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer' }}>
              Nouvel import
            </button>
            <a href="/prospects" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 12, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
              <Users size={14} />Voir les prospects
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
