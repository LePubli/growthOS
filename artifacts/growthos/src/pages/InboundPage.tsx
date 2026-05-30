import { useState } from 'react';
import { Plus, Filter, TrendingUp, Users, Target, Globe, Code, Copy, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const MOCK_LEADS = [
  { id: '1', name: 'Claire Fontaine', email: 'c.fontaine@innovatech.fr', company: 'InnovaTech', source: 'Formulaire Contact', score: 82, createdAt: '2026-05-30T08:12:00' },
  { id: '2', name: 'Marc Lebeau', email: 'm.lebeau@stratexis.com', company: 'Stratexis', source: 'Landing Page', score: 65, createdAt: '2026-05-29T15:44:00' },
  { id: '3', name: 'Sophie Renard', email: 's.renard@digitalia.io', company: 'Digitalia', source: 'Chatbot', score: 91, createdAt: '2026-05-29T09:20:00' },
  { id: '4', name: 'Antoine Morel', email: 'a.morel@techbridge.fr', company: 'TechBridge', source: 'Formulaire Demo', score: 78, createdAt: '2026-05-28T14:05:00' },
  { id: '5', name: 'Lucie Bernard', email: 'l.bernard@axelab.eu', company: 'AxeLab', source: 'Landing Page', score: 54, createdAt: '2026-05-27T11:30:00' },
];

const SOURCES = ['Tous', 'Formulaire Contact', 'Landing Page', 'Chatbot', 'Formulaire Demo'];

const EMBED_CODE = `<!-- GrowthOS Lead Capture Form -->
<script src="https://cdn.growthos.io/capture.js" 
  data-token="YOUR_TOKEN"
  data-form="contact">
</script>`;

export default function InboundPage() {
  const [source, setSource] = useState('Tous');
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);

  const filtered = source === 'Tous' ? MOCK_LEADS : MOCK_LEADS.filter(l => l.source === source);
  const avgScore = Math.round(filtered.reduce((s, l) => s + l.score, 0) / (filtered.length || 1));

  const copy = () => {
    navigator.clipboard.writeText(EMBED_CODE);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
    toast.success('Code copié');
  };

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--body-bg)' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Inbound</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Leads entrants depuis vos formulaires et landing pages</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCode(!showCode)} className="flex items-center gap-2 px-4 py-2 border rounded-xl text-sm"
            style={{ borderColor: 'var(--card-border)', color: 'var(--text-secondary)', background: 'var(--card-bg)' }}>
            <Code size={14} />Intégrer un formulaire
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: 'var(--color-primary)' }}>
            <Plus size={14} />Nouvelle landing page
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { l: 'Leads ce mois', v: MOCK_LEADS.length, icon: <Users size={18} />, color: 'text-teal-600 bg-teal-50' },
          { l: 'Score moyen', v: `${avgScore}/100`, icon: <Target size={18} />, color: 'text-purple-600 bg-purple-50' },
          { l: 'Taux conversion', v: '18.4%', icon: <TrendingUp size={18} />, color: 'text-green-600 bg-green-50' },
          { l: 'Sources actives', v: 4, icon: <Globe size={18} />, color: 'text-blue-600 bg-blue-50' },
        ].map((m, i) => (
          <div key={i} className="rounded-2xl border p-4 flex items-center gap-3" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${m.color}`}>{m.icon}</div>
            <div>
              <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{m.v}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{m.l}</div>
            </div>
          </div>
        ))}
      </div>

      {showCode && (
        <div className="rounded-2xl border p-5 mb-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Code d'intégration</h2>
            <button onClick={copy} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border" style={{ borderColor: 'var(--card-border)', color: 'var(--text-secondary)' }}>
              {copied ? <CheckCircle size={12} className="text-green-500" /> : <Copy size={12} />}Copier
            </button>
          </div>
          <pre className="text-xs p-4 rounded-xl overflow-x-auto" style={{ background: 'var(--body-bg)', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
            {EMBED_CODE}
          </pre>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Collez ce code avant la balise &lt;/body&gt; de votre site. Remplacez YOUR_TOKEN par votre clé API.</p>
        </div>
      )}

      {/* Source filters */}
      <div className="flex gap-2 mb-5">
        {SOURCES.map(s => (
          <button key={s} onClick={() => setSource(s)}
            className="px-3 py-1.5 rounded-xl text-sm font-medium transition-all"
            style={source === s
              ? { background: 'var(--color-primary)', color: '#fff' }
              : { background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-muted)' }}>
            {s}
          </button>
        ))}
      </div>

      {/* Leads table */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
        <table className="w-full">
          <thead className="border-b" style={{ borderColor: 'var(--card-border)', background: 'var(--body-bg)' }}>
            <tr>
              {['Nom', 'Email', 'Entreprise', 'Source', 'Score', 'Date'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(lead => (
              <tr key={lead.id} className="border-b hover:opacity-80 transition-opacity" style={{ borderColor: 'var(--card-border)' }}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: 'var(--color-primary)' }}>{lead.name[0]}</div>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{lead.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-primary)' }}>{lead.email}</td>
                <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{lead.company}</td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'var(--body-bg)', color: 'var(--text-secondary)', border: '1px solid var(--card-border)' }}>{lead.source}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-16 rounded-full h-1.5" style={{ background: 'var(--body-bg)' }}>
                      <div className="h-1.5 rounded-full" style={{
                        width: `${lead.score}%`,
                        background: lead.score >= 80 ? '#059669' : lead.score >= 60 ? '#D97706' : '#6B7280',
                      }} />
                    </div>
                    <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{lead.score}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {new Date(lead.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
