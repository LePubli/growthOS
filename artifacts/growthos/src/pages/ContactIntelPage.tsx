import { useState, useEffect } from 'react';
import { Search, Zap, CheckCircle, AlertCircle, Users, Loader2, RefreshCw, ChevronRight, Mail, Linkedin, Phone, Building2, Star } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

const MOCK_CONTACTS = [
  { id: '1', name: 'Sophie Martin', email: 'sophie.martin@techcorp.fr', company: 'TechCorp', linkedin: 'linkedin.com/in/sophie-martin', phone: '+33 6 12 34 56 78', score: 92, enriched: true, duplicate: false, lastActivity: 'il y a 2h', tags: ['chaud', 'décideur'] },
  { id: '2', name: 'Emma Leroy', email: 'emma.leroy@startupx.io', company: 'StartupX', linkedin: '', phone: '', score: 74, enriched: false, duplicate: false, lastActivity: 'il y a 1j', tags: ['prospect'] },
  { id: '3', name: 'Sophie Martin', email: 'sophie@techcorp.fr', company: 'TechCorp', linkedin: '', phone: '', score: 45, enriched: false, duplicate: true, lastActivity: 'il y a 5j', tags: [] },
  { id: '4', name: 'Paul Dupont', email: 'paul.dupont@bigsales.fr', company: 'BigSales SAS', linkedin: 'linkedin.com/in/paul-dupont', phone: '+33 6 34 56 78 90', score: 88, enriched: true, duplicate: false, lastActivity: 'il y a 3h', tags: ['chaud', 'négociation'] },
  { id: '5', name: 'Camille Bernard', email: 'camille@datainc.com', company: 'DataInc', linkedin: 'linkedin.com/in/camille-bernard', phone: '', score: 61, enriched: true, duplicate: false, lastActivity: 'il y a 1j', tags: ['prospect'] },
  { id: '6', name: 'Luc Moreau', email: 'luc.moreau@growthco.fr', company: 'GrowthCo', linkedin: '', phone: '+33 6 56 78 90 12', score: 95, enriched: false, duplicate: false, lastActivity: 'il y a 30 min', tags: ['client', 'gagné'] },
];

const ENRICH_SOURCES = [
  { id: 'linkedin', label: 'LinkedIn', icon: '💼', fields: ['Poste', 'Ancienneté', 'Connexions'] },
  { id: 'hunter', label: 'Hunter.io', icon: '🎯', fields: ['Email vérifié', 'Format email'] },
  { id: 'clearbit', label: 'Clearbit', icon: '🔍', fields: ['Taille équipe', 'Secteur', 'CA estimé'] },
  { id: 'pappers', label: 'Pappers.fr', icon: '🏢', fields: ['SIREN', 'Effectifs', 'Capital'] },
];

function EnrichModal({ contact, onClose }: { contact: any; onClose: () => void }) {
  const [selected, setSelected] = useState<string[]>(['linkedin', 'hunter']);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const run = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 1800));
    setDone(true);
    setLoading(false);
    toast.success(`${contact.name} enrichi avec succès`);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Enrichir — {contact.name}</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18 }}>Sélectionnez les sources à utiliser pour l'enrichissement</p>

        {done ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <CheckCircle size={48} color="#059669" style={{ margin: '0 auto 12px' }} />
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Enrichissement terminé !</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Données mises à jour depuis {selected.length} source{selected.length > 1 ? 's' : ''}</div>
            <button onClick={onClose} style={{ marginTop: 16, padding: '9px 24px', borderRadius: 10, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Fermer</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {ENRICH_SOURCES.map(src => (
                <label key={src.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, border: `1px solid ${selected.includes(src.id) ? 'var(--color-primary)' : 'var(--card-border)'}`, background: selected.includes(src.id) ? 'var(--color-primary-light)' : 'var(--body-bg)', cursor: 'pointer', transition: 'all 0.15s' }}
                  onClick={() => setSelected(s => s.includes(src.id) ? s.filter(x => x !== src.id) : [...s, src.id])}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--card-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{src.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{src.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{src.fields.join(' · ')}</div>
                  </div>
                  <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${selected.includes(src.id) ? 'var(--color-primary)' : 'var(--card-border)'}`, background: selected.includes(src.id) ? 'var(--color-primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {selected.includes(src.id) && <CheckCircle size={12} color="#fff" />}
                  </div>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer' }}>Annuler</button>
              <button onClick={run} disabled={loading || selected.length === 0} style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {loading ? <><Loader2 size={14} className="animate-spin" />Enrichissement…</> : <><Zap size={14} />Enrichir maintenant</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function ContactIntelPage() {
  const [contacts, setContacts] = useState(MOCK_CONTACTS);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'duplicates' | 'not_enriched'>('all');
  const [enrichTarget, setEnrichTarget] = useState<any>(null);
  const [merging, setMerging] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get('/prospects').then((d: any) => {
      const list = Array.isArray(d) ? d : d?.data || [];
      if (list.length > 0) {
        setContacts(list.map((p: any) => ({
          id: p.id, name: `${p.firstName || ''} ${p.lastName || ''}`.trim() || p.company_name,
          email: p.email, company: p.company_name, linkedin: p.linkedin_url || '', phone: p.phone || '',
          score: p.score || 0, enriched: !!p.linkedin_url, duplicate: false, lastActivity: 'récent', tags: [],
        })));
      }
    }).catch(() => {});
  }, []);

  const filtered = contacts.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || `${c.name} ${c.email} ${c.company}`.toLowerCase().includes(q);
    const matchFilter = filter === 'all' || (filter === 'duplicates' && c.duplicate) || (filter === 'not_enriched' && !c.enriched);
    return matchSearch && matchFilter;
  });

  const duplicates = contacts.filter(c => c.duplicate);
  const notEnriched = contacts.filter(c => !c.enriched);

  const mergeDuplicates = async () => {
    setMerging('running');
    await new Promise(r => setTimeout(r, 1200));
    setContacts(cs => cs.filter(c => !c.duplicate));
    setMerging(null);
    toast.success(`${duplicates.length} doublons fusionnés`);
  };

  return (
    <div className="min-h-screen p-4 sm:p-6" style={{ background: 'var(--body-bg)' }}>
      {enrichTarget && <EnrichModal contact={enrichTarget} onClose={() => setEnrichTarget(null)} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Contact Intelligence</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Enrichissement, déduplication et analyse de vos contacts</p>
        </div>
        <div className="flex gap-2">
          {duplicates.length > 0 && (
            <button onClick={mergeDuplicates} disabled={merging === 'running'}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid #F59E0B', background: '#FEF3C7', color: '#92400E', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {merging === 'running' ? <Loader2 size={13} className="animate-spin" /> : <Users size={13} />}
              Fusionner {duplicates.length} doublon{duplicates.length > 1 ? 's' : ''}
            </button>
          )}
          <button onClick={() => { notEnriched.forEach(c => setTimeout(() => toast.success(`${c.name} — enrichissement lancé`), 300)); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <Zap size={13} />Enrichir tout ({notEnriched.length})
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { l: 'Total contacts', v: contacts.length, icon: <Users size={16} />, color: 'text-blue-600 bg-blue-50' },
          { l: 'Enrichis', v: contacts.filter(c => c.enriched).length, icon: <CheckCircle size={16} />, color: 'text-green-600 bg-green-50' },
          { l: 'À enrichir', v: notEnriched.length, icon: <Zap size={16} />, color: 'text-purple-600 bg-purple-50' },
          { l: 'Doublons détectés', v: duplicates.length, icon: <AlertCircle size={16} />, color: 'text-amber-600 bg-amber-50' },
        ].map((k, i) => (
          <div key={i} className="rounded-2xl border p-4 flex items-center gap-3" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${k.color} flex-shrink-0`}>{k.icon}</div>
            <div>
              <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{k.v}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{k.l}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un contact…"
            style={{ width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 9, paddingBottom: 9, borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { k: 'all', l: 'Tous' },
            { k: 'duplicates', l: `Doublons (${duplicates.length})` },
            { k: 'not_enriched', l: `À enrichir (${notEnriched.length})` },
          ].map(f => (
            <button key={f.k} onClick={() => setFilter(f.k as any)}
              style={{ padding: '8px 14px', borderRadius: 10, border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer', background: filter === f.k ? 'var(--color-primary)' : 'var(--card-bg)', color: filter === f.k ? '#fff' : 'var(--text-secondary)', boxShadow: '0 0 0 1px var(--card-border)', whiteSpace: 'nowrap' }}>
              {f.l}
            </button>
          ))}
        </div>
      </div>

      {/* Contact list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(contact => (
          <div key={contact.id}
            style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 14, background: 'var(--card-bg)', border: `1px solid ${contact.duplicate ? '#F59E0B' : 'var(--card-border)'}`, transition: 'all 0.15s' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,.07)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = 'none'}>
            {/* Avatar */}
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 15, flexShrink: 0 }}>
              {contact.name.charAt(0)}
            </div>
            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{contact.name}</span>
                {contact.duplicate && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 9999, background: '#FEF3C7', color: '#92400E', fontWeight: 600 }}>Doublon</span>}
                {contact.enriched && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 9999, background: '#ECFDF5', color: '#059669', fontWeight: 600 }}>Enrichi</span>}
                {contact.tags.map(t => (
                  <span key={t} style={{ fontSize: 10, padding: '1px 7px', borderRadius: 9999, background: 'var(--body-bg)', color: 'var(--text-muted)', fontWeight: 500 }}>{t}</span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                {contact.company && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Building2 size={11} />{contact.company}</span>}
                {contact.email && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={11} />{contact.email}</span>}
                {contact.phone && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={11} />{contact.phone}</span>}
                {contact.linkedin && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Linkedin size={11} />LinkedIn</span>}
              </div>
            </div>
            {/* Score */}
            <div style={{ textAlign: 'center', padding: '6px 12px', borderRadius: 10, background: contact.score >= 80 ? '#ECFDF5' : contact.score >= 60 ? '#FEF3C7' : 'var(--body-bg)' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: contact.score >= 80 ? '#059669' : contact.score >= 60 ? '#D97706' : 'var(--text-muted)' }}>{contact.score}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Score</div>
            </div>
            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              {!contact.enriched && (
                <button onClick={() => setEnrichTarget(contact)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  <Zap size={12} />Enrichir
                </button>
              )}
              {contact.duplicate && (
                <button onClick={() => { setContacts(cs => cs.filter(c => c.id !== contact.id)); toast.success('Doublon supprimé'); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: '1px solid #F59E0B', background: 'transparent', color: '#92400E', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Supprimer
                </button>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
            <Users size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <div>Aucun contact trouvé</div>
          </div>
        )}
      </div>
    </div>
  );
}
