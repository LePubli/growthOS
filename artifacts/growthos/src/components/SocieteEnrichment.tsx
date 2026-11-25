import { CompanyDetailsView } from './ProspectCompanyProfile';
import { useState } from 'react';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';
import { getLocalCaptures, type LocalCompany } from '@/lib/pagesjaunes-device';

type Prospect = {
  id: string; company?: string | null; siren?: string | null; siret?: string | null;
  city?: string | null; phone?: string | null; email?:string|null; website?: string | null;
  address?: string | null; postalCode?: string | null; apeCode?: string | null; nafLabel?: string | null;
};
const comparison = [
  ['SIREN', 'siren'], ['SIRET', 'siret'], ['Adresse', 'address'], ['Code postal', 'codePostal'],
  ['Ville', 'city'], ['Téléphone', 'phone'], ['Email','email'], ['Site web', 'website'], ['Code APE', 'apeCode'],
  ['Activité', 'nafLabel'],
] as const;

export function SocieteEnrichment({ prospect, onSaved }: { prospect: Prospect; onSaved: () => void }) {
  const [captures, setCaptures] = useState<LocalCompany[]>([]);
  const [selected, setSelected] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [result, setResult] = useState('');
  const methods = [
    { label: 'SIRET', value: prospect.siret }, { label: 'SIREN', value: prospect.siren },
    { label: 'Nom et ville', value: [prospect.company, prospect.city].filter(Boolean).join(' ') },
    { label: 'Adresse · Bing vers Societe.com', value: prospect.address, inverse: true },
    { label: 'Téléphone · Bing vers Societe.com', value: prospect.phone, inverse: true },
    { label: 'Domaine · Bing vers Societe.com', value: domain(prospect.website), inverse: true },
  ].filter(method => method.value);
  const capture = captures.find(item => item.id === selected);
  const load = async () => {
    setBusy(true); setError(''); setResult(''); setConfirmed(false); setSelected('');
    try { setCaptures((await getLocalCaptures()).filter(item => item.source === 'societe_com')); setLoaded(true); }
    catch (e: any) { setError(e.message || 'La lecture du connecteur a échoué.'); }
    finally { setBusy(false); }
  };
  return <section className="rounded-2xl border p-5 my-4" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
    <h2 className="font-semibold">Societe.com · recherche et enrichissement</h2>
    <p className="text-sm my-2">Recherchez la société avec une donnée de cette fiche. Vérifiez son établissement,
      puis capturez la fiche Societe.com dans l’extension Chrome et revenez ici.</p>
    <div className="flex flex-wrap gap-2">
      {methods.map(method => <a key={method.label} className="text-sm underline text-teal-700" target="_blank" rel="noreferrer"
        href={method.inverse ? 'https://www.bing.com/search?q=' + encodeURIComponent('site:societe.com/societe/ "' + method.value + '"')
          : 'https://www.societe.com/cgi-bin/search?champs=' + encodeURIComponent(method.value!)}>{method.label}</a>)}
    </div>
    <button type="button" className="border rounded-lg px-3 py-2 mt-3 text-sm" disabled={busy} onClick={() => void load()}>
      {busy ? 'Traitement…' : 'Charger les fiches Societe.com du connecteur'}
    </button>
    {error && <p role="alert" className="text-red-700 text-sm mt-2">{error}</p>}
    {result && <p role="status" className="text-sm mt-2">{result}</p>}
    {loaded && !captures.length && <p className="text-sm mt-2">Aucune fiche Societe.com dans le connecteur. Ouvrez la fiche trouvée puis utilisez « Capturer la fiche » dans l’extension.</p>}
    {!!captures.length && <label className="block text-sm mt-3">Fiche à comparer
      <select className="block border rounded-lg p-2 w-full" value={selected} disabled={busy}
        onChange={event => { setSelected(event.target.value); setConfirmed(false); setResult(''); }}>
        <option value="">Choisir une fiche</option>
        {captures.map(item => <option key={item.id} value={item.id}>{item.company} · {item.codePostal} · {item.city}</option>)}
      </select>
    </label>}
    {capture && <div className="mt-3">
      <a className="text-sm underline text-teal-700" href={capture.sourceUrl || undefined} target="_blank" rel="noreferrer">Vérifier la page de {capture.company}</a>
      <div className="overflow-x-auto"><table className="text-sm w-full my-3 text-left">
        <thead><tr><th>Champ</th><th>Prospect actuel</th><th>Societe.com</th></tr></thead>
        <tbody>{comparison.map(([label, key]) => {
          const current = key === 'codePostal' ? prospect.postalCode : prospect[key];
          const incoming = key === 'siren' ? capture.siret?.slice(0, 9) || capture.sourceUrl?.match(/-(\d{9})\.html/)?.[1] : capture[key];
          return <tr key={key}><th className="py-1 font-normal">{label}</th><td>{current || '—'}</td><td>{incoming || '—'}</td></tr>;
        })}</tbody>
      </table></div>
      {capture.companyDetails && <details className="my-3"><summary>Autres informations capturées sur Societe.com</summary><CompanyDetailsView details={capture.companyDetails}/></details>}
      <p className="text-xs">Les champs vides seront complétés. Les valeurs différentes seront proposées dans les désaccords de la fiche.</p>
      <label className="flex gap-2 text-sm my-3"><input type="checkbox" checked={confirmed} disabled={busy}
        onChange={event => setConfirmed(event.target.checked)} />Je confirme que cette société et cet établissement correspondent au prospect.</label>
      <button type="button" className="rounded-lg bg-teal-700 text-white px-3 py-2 text-sm disabled:opacity-50"
        disabled={!confirmed || busy} onClick={async () => {
          setBusy(true); setError(''); setResult('');
          try {
            const response = await apiClient.post<{ enriched: boolean; conflicts: number }>(`/sourcing/device/prospects/${prospect.id}/societe-enrich`, { capture, confirmed: true });
            setConfirmed(false);
            setResult(response.enriched ? `Fiche enrichie · ${response.conflicts} désaccord(s) à vérifier.` : `Données examinées · ${response.conflicts} désaccord(s) à vérifier.`);
            onSaved(); toast.success('Informations Societe.com examinées.');
          } catch (e: any) { setError(e.message || 'L’enrichissement a échoué.'); }
          finally { setBusy(false); }
        }}>Confirmer l’enrichissement de ce prospect</button>
    </div>}
  </section>;
}

function domain(value?: string | null): string | null {
  try { return new URL(value || '').hostname.replace(/^www\./, ''); }
  catch { return null; }
}
