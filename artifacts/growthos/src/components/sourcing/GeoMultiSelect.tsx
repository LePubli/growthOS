import { useMemo, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import type { GeoOption } from '@/lib/france-geo';

type Props = { label: string; options: GeoOption[]; values: string[]; onChange: (values: string[]) => void; placeholder: string };

export default function GeoMultiSelect({ label, options, values, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = options.filter(item => values.includes(item.code));
  const matches = useMemo(() => options.filter(item =>
    `${item.code} ${item.label}`.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr')),
  ).slice(0, 110), [options, search]);

  function toggle(code: string) {
    onChange(values.includes(code) ? values.filter(v => v !== code) : [...values, code]);
  }

  return (
    <div className="relative">
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left rounded-xl border border-gray-200 bg-white text-sm focus-visible:outline focus-visible:outline-teal-600">
        <span className={values.length ? 'text-gray-800' : 'text-gray-400'}>{values.length ? `${values.length} sélectionné(s)` : placeholder}</span>
        <ChevronDown size={14} className="text-gray-500" />
      </button>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selected.map(option => <span key={option.code} className="inline-flex items-center gap-1 bg-teal-50 border border-teal-100 text-teal-800 rounded-lg px-2 py-1 text-xs">
            {option.label} <button type="button" onClick={() => toggle(option.code)} aria-label={`Retirer ${option.label}`}><X size={12}/></button>
          </span>)}
        </div>
      )}
      {open && (
        <div className="relative mt-2 rounded-xl border border-gray-200 shadow-lg bg-white max-h-52 flex flex-col z-20">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100"><Search size={14} className="text-gray-400"/>
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un nom ou code…" className="w-full outline-none text-sm" />
            <button type="button" onClick={() => setOpen(false)} aria-label="Fermer la liste"><X size={14}/></button>
          </div>
          <div className="overflow-y-auto" role="listbox" aria-multiselectable="true">
            {matches.map(item => <button key={item.code} type="button" role="option" aria-selected={values.includes(item.code)}
              onClick={() => toggle(item.code)} className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-teal-50 text-sm">
              <span className={`w-4 h-4 rounded border flex items-center justify-center ${values.includes(item.code) ? 'bg-teal-600 border-teal-600 text-white' : 'border-gray-300'}`}>
                {values.includes(item.code) && <Check size={11}/>}</span>
              <span>{item.label}</span><span className="text-xs text-gray-400 ml-auto">{item.code}</span>
            </button>)}
            {!matches.length && <p className="p-3 text-sm text-gray-500">Aucun résultat</p>}
          </div>
        </div>
      )}
    </div>
  );
}
