import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Loader2, X } from 'lucide-react';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string, coords?: { lat: number; lng: number }) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
  label?: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  placeholder = 'Ex: 12 Rue de la Paix, Paris…',
  className = '',
  style,
  inputStyle,
  label,
}: AddressAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Sync external value changes
  useEffect(() => {
    setQuery(value);
    setSelected(!!value);
  }, [value]);

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 3) { setResults([]); setOpen(false); return; }
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&countrycodes=fr,be,ch,lu,de,es,it,gb&addressdetails=0`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'GrowthOS-CRM/1.0' },
        signal: abortRef.current.signal,
      });
      const data = await res.json() as NominatimResult[];
      setResults(data);
      setOpen(data.length > 0);
    } catch (e: any) {
      if (e.name !== 'AbortError') setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setSelected(false);
    onChange(val); // propagate raw text immediately
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 400);
  };

  const handleSelect = (r: NominatimResult) => {
    // Shorten display: take first 2 parts (street + city)
    const parts = r.display_name.split(', ');
    const short = parts.slice(0, Math.min(3, parts.length)).join(', ');
    setQuery(short);
    setSelected(true);
    setOpen(false);
    setResults([]);
    onChange(short, { lat: parseFloat(r.lat), lng: parseFloat(r.lon) });
  };

  const handleClear = () => {
    setQuery('');
    setSelected(false);
    setResults([]);
    setOpen(false);
    onChange('');
  };

  return (
    <div ref={containerRef} className={className} style={{ position: 'relative', ...style }}>
      {label && <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>}
      <div style={{ position: 'relative' }}>
        <MapPin
          size={13}
          style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: selected ? '#059669' : '#9CA3AF', flexShrink: 0, pointerEvents: 'none' }}
        />
        <input
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          placeholder={placeholder}
          autoComplete="off"
          style={{
            width: '100%',
            paddingLeft: 30,
            paddingRight: query ? 56 : 10,
            paddingTop: 8,
            paddingBottom: 8,
            border: '1px solid #E5E7EB',
            borderRadius: 12,
            fontSize: 13,
            outline: 'none',
            boxSizing: 'border-box',
            background: selected ? '#F0FDF4' : '#fff',
            borderColor: selected ? '#86EFAC' : '#E5E7EB',
            transition: 'border-color 0.15s, background 0.15s',
            ...inputStyle,
          }}
          className="focus:ring-2 focus:ring-teal-500"
        />
        <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 4 }}>
          {loading && <Loader2 size={12} style={{ color: '#9CA3AF', animation: 'spin 1s linear infinite' }} />}
          {query && (
            <button type="button" onClick={handleClear}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', color: '#9CA3AF', lineHeight: 1 }}>
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 9999,
          background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB',
          boxShadow: '0 8px 24px rgba(0,0,0,.12)', overflow: 'hidden',
        }}>
          {results.map(r => {
            const parts = r.display_name.split(', ');
            const main = parts.slice(0, 2).join(', ');
            const sub = parts.slice(2, 4).join(', ');
            return (
              <button
                key={r.place_id}
                type="button"
                onClick={() => handleSelect(r)}
                style={{ width: '100%', textAlign: 'left', padding: '9px 12px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 8, borderBottom: '1px solid #F3F4F6' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <MapPin size={13} style={{ color: '#6B7280', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', lineHeight: 1.3 }}>{main}</div>
                  {sub && <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>{sub}</div>}
                </div>
              </button>
            );
          })}
          <div style={{ padding: '5px 12px', fontSize: 10, color: '#9CA3AF', textAlign: 'right' }}>
            via OpenStreetMap · Nominatim
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
