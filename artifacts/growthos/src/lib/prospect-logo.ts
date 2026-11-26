/** Logos chargés depuis le domaine public déclaré par l'entreprise.
 * Pas de requête serveur, de service tiers de recherche de logos, ni d'URL locale/intranet. */
export function publicCompanyOrigin(website: unknown): string | null {
  if (typeof website !== 'string' || !website.trim()) return null;
  const value = website.trim();
  if (!/^https?:\/\//i.test(value) && /[:\\\s]/.test(value)) return null;
  try {
    const parsed = new URL(/^https?:\/\//i.test(value) ? value : 'https://' + value);
    const host = parsed.hostname.toLowerCase();
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.port ||
        !host.includes('.') || host.startsWith('.') || host.endsWith('.') || host === 'localhost' ||
        /\.(?:local|localhost|internal|test|invalid|example)$/.test(host) ||
        /^\d+(?:\.\d+){3}$/.test(host) || host.includes(':')) return null;
    return 'https://' + host;
  } catch { return null; }
}

export function publicCompanyLogoCandidates(website: unknown, explicitLogoUrl?: unknown): string[] {
  const origin = publicCompanyOrigin(website);
  if (!origin) return [];
  const candidates: string[] = [];
  if (typeof explicitLogoUrl === 'string' && explicitLogoUrl.trim()) {
    try {
      const logo = new URL(explicitLogoUrl.trim(), origin);
      if (logo.protocol === 'https:' && !logo.username && !logo.password && !logo.port &&
          logo.hostname.toLowerCase() === new URL(origin).hostname.toLowerCase()) candidates.push(logo.href);
    } catch { /* Source invalide : retour au favicon du site. */ }
  }
  return [...new Set([...candidates, origin + '/favicon.ico', origin + '/apple-touch-icon.png'])];
}
