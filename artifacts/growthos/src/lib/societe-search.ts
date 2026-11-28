export function societeSearchUrl(query: string): string {
  return (
    "https://www.societe.com/recherche?q=" +
    encodeURIComponent(query.trim()) +
    "&ftStatus=0"
  );
}
export function googleSocieteSearchUrl(query: string): string {
  return (
    "https://www.google.com/search?q=" +
    encodeURIComponent("site:societe.com " + query.trim())
  );
}
export function preferredCompanyQuery(prospect: {
  company?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  city?: string | null;
}): string {
  return [
    prospect.company?.trim() ||
      [prospect.firstName, prospect.lastName].filter(Boolean).join(" "),
    prospect.city,
  ]
    .filter(Boolean)
    .join(" ");
}
