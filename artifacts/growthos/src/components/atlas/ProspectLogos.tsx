import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Building2 } from 'lucide-react';
import { publicCompanyLogoCandidates } from '@/lib/prospect-logo';

type SourceIdentity = { label: string; favicon: string; color: string; monogram: string };
const SOURCES: Record<string, SourceIdentity> = {
  annuaire: { label: 'Annuaire des Entreprises', favicon: 'https://annuaire-entreprises.data.gouv.fr/favicon.ico', color: '#1652a8', monogram: 'FR' },
  insee: { label: 'INSEE', favicon: 'https://www.insee.fr/favicon.ico', color: '#195daa', monogram: 'IN' },
  societe_com: { label: 'Societe.com', favicon: 'https://www.societe.com/favicon.ico', color: '#264b81', monogram: 'SC' },
  pappers: { label: 'Pappers', favicon: 'https://www.pappers.fr/favicon.ico', color: '#2244ad', monogram: 'P' },
  pagesjaunes: { label: 'PagesJaunes', favicon: 'https://www.pagesjaunes.fr/favicon.ico', color: '#bd7b05', monogram: 'PJ' },
  google: { label: 'Google', favicon: 'https://www.google.com/favicon.ico', color: '#4285f4', monogram: 'G' },
  google_maps: { label: 'Google Maps', favicon: 'https://www.google.com/favicon.ico', color: '#4285f4', monogram: 'G' },
  linkedin: { label: 'LinkedIn', favicon: 'https://www.linkedin.com/favicon.ico', color: '#0a66c2', monogram: 'in' },
  bing: { label: 'Bing', favicon: 'https://www.bing.com/favicon.ico', color: '#008b83', monogram: 'b' },
  facebook: { label: 'Facebook', favicon: 'https://www.facebook.com/favicon.ico', color: '#1877f2', monogram: 'f' },
  instagram: { label: 'Instagram', favicon: 'https://www.instagram.com/favicon.ico', color: '#c13584', monogram: 'ig' },
  tiktok: { label: 'TikTok', favicon: 'https://www.tiktok.com/favicon.ico', color: '#242635', monogram: '♪' },
};

export function SourceLogo({ source, size = 'md' }: { source: string; size?: 'sm' | 'md' | 'lg' }) {
  const aliases: Record<string,string> = {
    'annuaire-entreprises':'annuaire', 'annuaire_entreprises':'annuaire',
    'societe.com':'societe_com', 'societe':'societe_com', 'pages_jaunes':'pagesjaunes',
    'google_search':'google', 'google_maps':'google_maps', 'maps':'google_maps',
  };
  const key = source.trim().toLocaleLowerCase('fr-FR');
  const data = SOURCES[aliases[key] || key] || { label: source, favicon: '', color: '#547091', monogram: 'S' };
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [source]);
  return <span className={'atlas-source-logo atlas-source-logo--' + size}
    style={{ '--atlas-source-color': data.color } as CSSProperties} title={data.label} aria-hidden="true">
    {!failed && data.favicon ? <img src={data.favicon} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      : <span>{data.monogram}</span>}
  </span>;
}

function initials(value: string): string {
  const parts = value.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? (parts[0][0] + parts[1][0]).toLocaleUpperCase('fr-FR')
    : (parts[0] || '?').slice(0, 2).toLocaleUpperCase('fr-FR');
}

export function CompanyLogo({ name, website, logoUrl, size = 'md' }: {
  name: string; website?: string | null; logoUrl?: string | null; size?: 'sm' | 'md' | 'lg';
}) {
  const candidates = publicCompanyLogoCandidates(website, logoUrl);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => setAttempt(0), [website, logoUrl]);
  return <span className={'atlas-entity-logo atlas-entity-logo--' + size} title={name} aria-hidden="true">
    {candidates[attempt] ? <img src={candidates[attempt]} alt="" loading="lazy" referrerPolicy="no-referrer"
      onError={() => setAttempt(previous => previous + 1)} />
      : name.trim() ? <span>{initials(name)}</span> : <Building2 size={20} />}
  </span>;
}
