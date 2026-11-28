import {
  professionalSourceUrl,
  publicSocialReference,
  type ProfessionalSource,
} from "../../../../lib/api-zod/src/professional-sources";

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : {};
export type ProspectSourceLink = {
  source: ProfessionalSource;
  url: string;
  origins: string[];
  capturedAt: string | null;
  current: boolean;
  kind: 'person' | 'company' | 'profile';
  proofUrls: string[];
};
export type SourceLinkedProspect = {
  linkedinUrl?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  sourceDetails?: unknown;
};
function date(value: unknown): string | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

/** Collected links retain their origins; they are not promoted to verified data. */
export function prospectSourceLinks(
  prospect: SourceLinkedProspect,
): ProspectSourceLink[] {
  const links = new Map<string, ProspectSourceLink>();
  const currentLinkedin = professionalSourceUrl(
    "linkedin",
    prospect.linkedinUrl,
  );
  const add = (
    source: unknown,
    value: unknown,
    origin: string,
    capturedAt?: unknown,
    proofUrl?: unknown,
  ) => {
    const reference = publicSocialReference(value);
    const social = reference?.source === source ? reference : null;
    const url = social?.url || professionalSourceUrl(source, value);
    if (!url) return;
    let proof: string | null = null;
    if(typeof proofUrl==='string')try{const u=new URL(proofUrl);if(['https:','http:'].includes(u.protocol)&&!u.username&&!u.password)proof=u.href;}catch{}
    const key = source + ":" + url;
    const existing = links.get(key);
    const captured = date(capturedAt);
    if (existing) {
      if (!existing.origins.includes(origin)) existing.origins.push(origin);
      if (proof && !existing.proofUrls.includes(proof)) existing.proofUrls.push(proof);
      if (captured && (!existing.capturedAt || captured > existing.capturedAt))
        existing.capturedAt = captured;
      return;
    }
    links.set(key, {
      source: source as ProfessionalSource,
      url,
      origins: [origin],
      capturedAt: captured,
      current: source === "linkedin" && url === currentLinkedin,
      kind: social?.kind || 'company',
      proofUrls: proof ? [proof] : [],
    });
  };
  add("linkedin", prospect.linkedinUrl, "Champ LinkedIn du CRM");
  for (const source of (prospect.source || "")
    .split(",")
    .map((source) => source.trim()))
    add(source, prospect.sourceUrl, "Fiche source du CRM");
  const details = record(prospect.sourceDetails);
  const crossSource = record(details.crossSource);
  const observations = Array.isArray(crossSource.observations)
    ? crossSource.observations
    : [];
  for (const value of observations) {
    const observation = record(value);
    if (typeof observation.source !== "string") continue;
    for (const source of observation.source
      .split(",")
      .map((source) => source.trim()))
      add(
        source,
        observation.sourceUrl,
        "Capture du connecteur",
        observation.capturedAt,
      );
  }
  const pagesjaunes = record(details.pagesjaunes);
  for (const [source, url] of Object.entries(record(pagesjaunes.socials)))
    add(source, url, "Relevé sur PagesJaunes", pagesjaunes.capturedAt);
  const website=record(details.website),snapshot=record(website.snapshot);
  if(snapshot.identity!=='contradictory'&&Array.isArray(snapshot.socials))for(const value of snapshot.socials){const link=record(value);add(link.source,link.url,'Publié sur le site du prospect',website.capturedAt,link.sourceUrl||website.sourceUrl);}
  return [...links.values()].sort(
    (a, b) =>
      Number(b.current) - Number(a.current) ||
      (b.capturedAt || "").localeCompare(a.capturedAt || ""),
  );
}
