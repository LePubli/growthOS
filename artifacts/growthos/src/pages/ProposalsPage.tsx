import { useState } from 'react';
import { FileText, Plus, Download, Send, Eye, X, Copy, CheckCircle, DollarSign, Building2, Calendar } from 'lucide-react';
import { toast } from 'sonner';

interface ProposalLine {
  id: string;
  desc: string;
  qty: number;
  unit: number;
}

interface Proposal {
  id: string;
  title: string;
  client: string;
  company: string;
  email: string;
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected';
  amount: number;
  createdAt: string;
  expiresAt: string;
  lines: ProposalLine[];
  intro: string;
  terms: string;
}

const STATUS_CFG = {
  draft:    { l: 'Brouillon', c: '#6B7280', bg: '#F3F4F6' },
  sent:     { l: 'Envoyée',   c: '#2563EB', bg: '#EFF6FF' },
  viewed:   { l: 'Consultée', c: '#D97706', bg: '#FEF3C7' },
  accepted: { l: 'Acceptée',  c: '#059669', bg: '#ECFDF5' },
  rejected: { l: 'Refusée',   c: '#DC2626', bg: '#FEF2F2' },
};

const MOCK: Proposal[] = [
  { id: '1', title: 'Offre GrowthOS Pro — TechCorp', client: 'Sophie Martin', company: 'TechCorp', email: 'sophie@techcorp.fr', status: 'viewed', amount: 12500, createdAt: '2026-05-20', expiresAt: '2026-06-20', intro: 'Suite à notre échange du 20 mai, nous avons le plaisir de vous présenter notre proposition commerciale pour l\'implémentation de GrowthOS au sein de TechCorp.', terms: 'Paiement à 30 jours. Abonnement annuel. Renouvellement tacite sauf résiliation sous 30 jours.', lines: [{ id: '1', desc: 'Licence GrowthOS Pro (12 mois)', qty: 5, unit: 1800 }, { id: '2', desc: 'Onboarding & formation équipe', qty: 1, unit: 2500 }] },
  { id: '2', title: 'Proposal Enterprise — AlphaTech', client: 'Marie Dubois', company: 'AlphaTech', email: 'marie@alphatech.io', status: 'sent', amount: 22000, createdAt: '2026-05-28', expiresAt: '2026-06-28', intro: 'Proposition pour le déploiement Enterprise GrowthOS sur vos 20 équipes commerciales.', terms: 'Paiement à 60 jours. SLA 99.9%. Support dédié inclus.', lines: [{ id: '1', desc: 'Licence GrowthOS Enterprise (12 mois)', qty: 20, unit: 900 }, { id: '2', desc: 'Intégration CRM custom', qty: 1, unit: 4000 }] },
  { id: '3', title: 'Devis Formation — BigSales', client: 'Paul Dupont', company: 'BigSales SAS', email: 'paul@bigsales.fr', status: 'accepted', amount: 8200, createdAt: '2026-05-15', expiresAt: '2026-06-15', intro: 'Proposition pour la formation commerciale de votre équipe de 8 personnes.', terms: 'Acompte 50% à la signature, solde à la livraison.', lines: [{ id: '1', desc: 'Formation GrowthOS (2 jours)', qty: 8, unit: 850 }, { id: '2', desc: 'Support post-formation (3 mois)', qty: 1, unit: 1400 }] },
];

function ProposalEditor({ proposal, onClose, onSave }: { proposal: Partial<Proposal>; onClose: () => void; onSave: (p: Proposal) => void }) {
  const [form, setForm] = useState<any>({ title: '', client: '', company: '', email: '', expiresAt: '', intro: 'Suite à notre échange, nous avons le plaisir de vous présenter notre proposition commerciale.', terms: 'Paiement à 30 jours. Abonnement annuel.', lines: [{ id: '1', desc: 'Licence GrowthOS Pro (12 mois)', qty: 1, unit: 1800 }], ...proposal });
  const setField = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const addLine = () => setField('lines', [...form.lines, { id: Date.now().toString(), desc: '', qty: 1, unit: 0 }]);
  const updateLine = (id: string, k: string, v: any) => setField('lines', form.lines.map((l: ProposalLine) => l.id === id ? { ...l, [k]: v } : l));
  const removeLine = (id: string) => setField('lines', form.lines.filter((l: ProposalLine) => l.id !== id));
  const total = form.lines.reduce((s: number, l: ProposalLine) => s + (l.qty * l.unit), 0);
  const save = () => {
    onSave({ ...form, id: form.id || Date.now().toString(), status: form.status || 'draft', amount: total, createdAt: form.createdAt || new Date().toISOString().split('T')[0] });
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 500, display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end' }}>
      <div style={{ width: '100%', maxWidth: 600, background: 'var(--card-bg)', display: 'flex', flexDirection: 'column', boxShadow: '-12px 0 40px rgba(0,0,0,.2)', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)', flexShrink: 0 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{form.id ? 'Modifier' : 'Nouvelle'} proposition</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18, flex: 1, overflowY: 'auto' }}>
          {/* Client info */}
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Client</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[{ l: 'Titre', k: 'title', col: '1/-1' }, { l: 'Contact', k: 'client' }, { l: 'Entreprise', k: 'company' }, { l: 'Email', k: 'email' }, { l: 'Date d\'expiration', k: 'expiresAt' }].map(f => (
                <div key={f.k} style={{ gridColumn: (f as any).col || 'auto' }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 4 }}>{f.l}</label>
                  <input value={form[f.k] || ''} onChange={e => setField(f.k, e.target.value)} type={f.k === 'expiresAt' ? 'date' : 'text'}
                    style={{ width: '100%', padding: '8px 11px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              ))}
            </div>
          </div>

          {/* Intro */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Introduction</label>
            <textarea value={form.intro} onChange={e => setField('intro', e.target.value)} rows={3}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
          </div>

          {/* Lines */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Lignes de devis</h3>
              <button onClick={addLine} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, border: '1px solid var(--color-primary)', background: 'transparent', color: 'var(--color-primary)', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                <Plus size={12} />Ajouter
              </button>
            </div>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 90px 80px 30px', gap: 8, marginBottom: 6, padding: '0 4px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              <span>Description</span><span>Qté</span><span>Prix unit.</span><span>Total</span><span />
            </div>
            {form.lines.map((l: ProposalLine) => (
              <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 90px 80px 30px', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                <input value={l.desc} onChange={e => updateLine(l.id, 'desc', e.target.value)} placeholder="Description du service"
                  style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 12, outline: 'none' }} />
                <input type="number" value={l.qty} onChange={e => updateLine(l.id, 'qty', parseInt(e.target.value) || 1)}
                  style={{ padding: '7px 8px', borderRadius: 7, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 12, outline: 'none' }} />
                <input type="number" value={l.unit} onChange={e => updateLine(l.id, 'unit', parseInt(e.target.value) || 0)}
                  style={{ padding: '7px 8px', borderRadius: 7, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 12, outline: 'none' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary)', textAlign: 'right', paddingRight: 4 }}>{(l.qty * l.unit).toLocaleString()}€</span>
                <button onClick={() => removeLine(l.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', display: 'flex' }}><X size={14} /></button>
              </div>
            ))}
            {/* Total */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 0 4px', borderTop: '1px solid var(--card-border)' }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-primary)' }}>Total : {total.toLocaleString()}€ HT</span>
            </div>
          </div>

          {/* Terms */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Conditions</label>
            <textarea value={form.terms} onChange={e => setField('terms', e.target.value)} rows={2}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--card-border)', display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer' }}>Annuler</button>
          <button onClick={save} style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Sauvegarder</button>
        </div>
      </div>
    </div>
  );
}

function generatePDFContent(p: Proposal): string {
  const total = p.lines.reduce((s, l) => s + l.qty * l.unit, 0);
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${p.title}</title>
<style>
  body{font-family:-apple-system,sans-serif;max-width:700px;margin:40px auto;padding:40px;color:#1a1a2e}
  h1{font-size:26px;font-weight:800;margin-bottom:4px}
  .badge{display:inline-block;padding:3px 12px;border-radius:999px;font-size:12px;font-weight:700}
  table{width:100%;border-collapse:collapse;margin:16px 0}
  th{background:#f8fafc;padding:10px 14px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#64748b}
  td{padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:14px}
  .total{font-size:20px;font-weight:800;color:#0d9488;text-align:right;padding:16px 0;border-top:2px solid #0d9488}
  .footer{margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8}
</style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:32px">
    <div>
      <div style="width:40px;height:40px;background:#0d9488;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:18px;margin-bottom:8px">G</div>
      <h1>${p.title}</h1>
      <p style="color:#64748b;margin:4px 0">Créée le ${p.createdAt} · Valable jusqu'au ${p.expiresAt}</p>
    </div>
    <div style="text-align:right">
      <div style="font-size:12px;color:#64748b;margin-bottom:4px">À l'attention de</div>
      <div style="font-size:16px;font-weight:700">${p.client}</div>
      <div style="font-size:14px;color:#64748b">${p.company}</div>
      <div style="font-size:13px;color:#0d9488">${p.email}</div>
    </div>
  </div>
  <p style="font-size:14px;line-height:1.8;color:#334155;background:#f8fafc;padding:16px;border-radius:10px;border-left:4px solid #0d9488">${p.intro}</p>
  <table>
    <thead><tr><th>Prestation</th><th>Qté</th><th>Prix unitaire</th><th>Total HT</th></tr></thead>
    <tbody>
      ${p.lines.map(l => `<tr><td>${l.desc}</td><td>${l.qty}</td><td>${l.unit.toLocaleString()}€</td><td style="font-weight:700">${(l.qty*l.unit).toLocaleString()}€</td></tr>`).join('')}
    </tbody>
  </table>
  <div class="total">Total HT : ${total.toLocaleString()}€</div>
  <p style="font-size:13px;color:#64748b;margin-top:8px">TVA non applicable selon l'article 293B du CGI (à adapter si TVA applicable)</p>
  <div style="margin-top:24px;padding:16px;border:1px solid #e2e8f0;border-radius:10px">
    <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;margin-bottom:6px">Conditions générales</div>
    <div style="font-size:13px;color:#64748b">${p.terms}</div>
  </div>
  <div class="footer"><p>GrowthOS — Proposition commerciale générée automatiquement · growthos.fr</p></div>
</body>
</html>`;
}

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>(MOCK);
  const [editing, setEditing] = useState<Partial<Proposal> | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Tous');
  const [preview, setPreview] = useState<Proposal | null>(null);

  const filtered = proposals.filter(p => {
    const q = search.toLowerCase();
    const matchQ = !q || `${p.title} ${p.client} ${p.company}`.toLowerCase().includes(q);
    const matchS = statusFilter === 'Tous' || p.status === statusFilter;
    return matchQ && matchS;
  });

  const saveProposal = (p: Proposal) => {
    setProposals(ps => ps.some(x => x.id === p.id) ? ps.map(x => x.id === p.id ? p : x) : [...ps, p]);
    toast.success('Proposition sauvegardée');
  };

  const exportPDF = (p: Proposal) => {
    const html = generatePDFContent(p);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${p.title.replace(/[^a-z0-9]/gi, '_')}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Proposition exportée (HTML → ouvrez dans le navigateur puis Imprimer → PDF)');
  };

  const sendProposal = (p: Proposal) => {
    setProposals(ps => ps.map(x => x.id === p.id ? { ...x, status: 'sent' } : x));
    toast.success(`Proposition envoyée à ${p.email}`);
  };

  const totalAccepted = proposals.filter(p => p.status === 'accepted').reduce((s, p) => s + p.amount, 0);
  const totalPipeline = proposals.filter(p => ['sent', 'viewed'].includes(p.status)).reduce((s, p) => s + p.amount, 0);

  return (
    <div className="min-h-screen p-4 sm:p-6" style={{ background: 'var(--body-bg)' }}>
      {editing && <ProposalEditor proposal={editing} onClose={() => setEditing(null)} onSave={saveProposal} />}

      {/* Preview modal */}
      {preview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setPreview(null)}>
          <div style={{ background: 'var(--card-bg)', borderRadius: 20, width: '100%', maxWidth: 740, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--card-border)' }}>
              <h3 style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', margin: 0 }}>Aperçu — {preview.title}</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => exportPDF(preview)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}><Download size={13} />Exporter</button>
                <button onClick={() => setPreview(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
              </div>
            </div>
            <iframe srcDoc={generatePDFContent(preview)} style={{ flex: 1, border: 'none', minHeight: 0 }} title="Aperçu proposition" />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Propositions Commerciales</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{proposals.length} propositions · génération PDF intégrée</p>
        </div>
        <button onClick={() => setEditing({})} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 12, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <Plus size={14} />Nouvelle proposition
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { l: 'Propositions', v: proposals.length, icon: <FileText size={16} />, c: 'text-blue-600 bg-blue-50' },
          { l: 'En cours', v: proposals.filter(p => ['sent','viewed'].includes(p.status)).length, icon: <Send size={16} />, c: 'text-purple-600 bg-purple-50' },
          { l: 'Pipeline (€)', v: `${(totalPipeline/1000).toFixed(0)}k€`, icon: <DollarSign size={16} />, c: 'text-amber-600 bg-amber-50' },
          { l: 'CA signé', v: `${(totalAccepted/1000).toFixed(0)}k€`, icon: <CheckCircle size={16} />, c: 'text-green-600 bg-green-50' },
        ].map((k, i) => (
          <div key={i} className="rounded-2xl border p-4 flex items-center gap-3" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${k.c} flex-shrink-0`}>{k.icon}</div>
            <div>
              <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{k.v}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{k.l}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <FileText size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher une proposition..."
            style={{ width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 9, paddingBottom: 9, borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['Tous', ...Object.keys(STATUS_CFG)].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              style={{ padding: '7px 14px', borderRadius: 9, border: `1px solid ${statusFilter === s ? 'var(--color-primary)' : 'var(--card-border)'}`, background: statusFilter === s ? `var(--color-primary)15` : 'var(--card-bg)', color: statusFilter === s ? 'var(--color-primary)' : 'var(--text-secondary)', fontSize: 12, fontWeight: statusFilter === s ? 700 : 400, cursor: 'pointer' }}>
              {s === 'Tous' ? 'Toutes' : STATUS_CFG[s as keyof typeof STATUS_CFG]?.l}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(p => {
          const st = STATUS_CFG[p.status];
          return (
            <div key={p.id} style={{ background: 'var(--card-bg)', borderRadius: 16, border: '1px solid var(--card-border)', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', transition: 'all 0.1s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,.07)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = 'none'}>
              {/* Icon */}
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `${st.c}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: st.c }}>
                <FileText size={18} />
              </div>
              {/* Info */}
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>{p.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Building2 size={11} />{p.company}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={11} />Expire {p.expiresAt}</span>
                </div>
              </div>
              {/* Amount */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-primary)' }}>{p.amount.toLocaleString()}€</div>
                <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 9999, background: st.bg, color: st.c, fontWeight: 700 }}>{st.l}</span>
              </div>
              {/* Actions */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => setPreview(p)} title="Aperçu" style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}><Eye size={14} /></button>
                <button onClick={() => exportPDF(p)} title="Exporter HTML/PDF" style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}><Download size={14} /></button>
                <button onClick={() => sendProposal(p)} title="Envoyer" style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--color-primary)', background: `var(--color-primary)15`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}><Send size={14} /></button>
                <button onClick={() => setEditing(p)} title="Modifier" style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--body-bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}><FileText size={14} /></button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
            <FileText size={40} style={{ margin: '0 auto 12px', opacity: 0.2 }} />
            <div style={{ fontSize: 14 }}>Aucune proposition trouvée</div>
            <button onClick={() => setEditing({})} style={{ marginTop: 12, padding: '8px 16px', borderRadius: 10, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 13, cursor: 'pointer' }}>Créer la première</button>
          </div>
        )}
      </div>
    </div>
  );
}
