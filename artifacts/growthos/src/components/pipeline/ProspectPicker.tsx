import { useEffect, useId, useState } from 'react';
import { Search, Loader2, Check } from 'lucide-react';
import apiClient from '@/lib/api-client';

export interface ProspectOption {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  email?: string | null;
  status?: string;
}

export function prospectLabel(prospect: ProspectOption): string {
  const name = [prospect.firstName, prospect.lastName].filter(Boolean).join(' ').trim();
  return [name || prospect.company || prospect.email || 'Prospect', name && prospect.company ? prospect.company : '']
    .filter(Boolean).join(' · ');
}

export function ProspectPicker({
  value,
  onChange,
  initialLabel,
  disabled = false,
}: {
  value: string | null;
  onChange: (id: string | null, prospect: ProspectOption | null) => void;
  initialLabel?: string;
  disabled?: boolean;
}) {
  const listId = useId();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ProspectOption | null>(null);
  const [results, setResults] = useState<ProspectOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!value) {
      setSelected(null);
      return;
    }
    if (selected?.id === value) return;
    let active = true;
    apiClient.get<ProspectOption>(`/prospects/${value}`)
      .then(prospect => { if (active) setSelected(prospect); })
      .catch(() => { if (active) setSelected(null); });
    return () => { active = false; };
  }, [value]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(false);
      apiClient.get<{ data: ProspectOption[] }>('/prospects', { params: { search: query.trim(), limit: 20 } })
        .then(response => { if (active) setResults(response.data || []); })
        .catch(() => { if (active) { setResults([]); setError(true); } })
        .finally(() => { if (active) setLoading(false); });
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [open, query]);

  return (
    <div style={{ position: 'relative' }} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <div style={{ position: 'relative' }}>
        <Search size={15} style={{ position: 'absolute', top: 12, left: 11, color: 'var(--text-muted)' }} />
        <input
          role="combobox"
          aria-label="Rechercher et sélectionner un prospect"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          disabled={disabled}
          placeholder="Rechercher un nom, une entreprise ou un email…"
          value={open ? query : selected ? prospectLabel(selected) : value ? (initialLabel || 'Chargement du prospect…') : ''}
          onFocus={() => { setQuery(''); setOpen(true); }}
          onChange={event => {
            setQuery(event.target.value);
            setOpen(true);
            if (value) onChange(null, null);
          }}
          style={{ width: '100%', padding: '10px 12px 10px 34px', border: '1px solid var(--card-border)', borderRadius: 10, boxSizing: 'border-box', fontSize: 13, background: 'var(--body-bg)', color: 'var(--text-primary)', outline: 'none' }}
        />
      </div>
      {open && (
        <div id={listId} role="listbox" aria-label="Prospects" style={{
          position: 'absolute', zIndex: 80, top: 'calc(100% + 4px)', left: 0, right: 0,
          maxHeight: 230, overflowY: 'auto', border: '1px solid var(--card-border)',
          borderRadius: 10, background: 'var(--card-bg)', boxShadow: '0 10px 28px rgba(0,0,0,.14)',
        }}>
          {loading && <div style={{ padding: 12, fontSize: 12, color: 'var(--text-muted)' }}><Loader2 size={13} className="animate-spin" style={{ display: 'inline', marginRight: 6 }} />Recherche…</div>}
          {!loading && error && <div style={{ padding: 12, fontSize: 12, color: '#DC2626' }}>Impossible de charger les prospects. Réessayez.</div>}
          {!loading && !error && results.length === 0 && <div style={{ padding: 12, fontSize: 12, color: 'var(--text-muted)' }}>Aucun prospect trouvé. Créez-le d'abord dans Prospects.</div>}
          {!loading && !error && results.map(prospect => (
            <button key={prospect.id} type="button" role="option" aria-selected={value === prospect.id}
              onMouseDown={event => event.preventDefault()}
              onClick={() => {
                setSelected(prospect);
                onChange(prospect.id, prospect);
                setOpen(false);
                setQuery('');
              }}
              style={{ width: '100%', border: 'none', borderBottom: '1px solid var(--card-border)', background: value === prospect.id ? 'var(--body-bg)' : 'var(--card-bg)', color: 'var(--text-primary)', padding: '10px 12px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <span>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>{prospectLabel(prospect)}</span>
                {prospect.email && <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{prospect.email}</span>}
              </span>
              {value === prospect.id && <Check size={15} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
