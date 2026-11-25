/** URLs of company profiles captured by the local connector. No network calls. */
export const PROFESSIONAL_SOURCES = [
  { id: "linkedin", label: "LinkedIn", domain: "linkedin.com/company/" },
  { id: "bing", label: "Bing", domain: "bing.com" },
  { id: "facebook", label: "Facebook Pages", domain: "facebook.com" },
  {
    id: "instagram",
    label: "Instagram professionnel",
    domain: "instagram.com",
  },
  { id: "tiktok", label: "TikTok professionnel", domain: "tiktok.com/@" },
] as const;
export type ProfessionalSource = (typeof PROFESSIONAL_SOURCES)[number]["id"];

export function professionalSourceUrl(
  source: unknown,
  value: unknown,
): string | null {
  if (typeof value !== "string" || value.length > 500) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port)
      return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    let match: RegExpMatchArray | null;
    switch (source) {
      case "linkedin":
        match = url.pathname.match(
          /^\/company\/([a-z0-9_-]+)(?:\/about)?\/?$/i,
        );
        return host === "linkedin.com" && match
          ? "https://www.linkedin.com/company/" + match[1].toLowerCase() + "/"
          : null;
      case "facebook":
        match = url.pathname.match(/^\/([a-z0-9.\-]+)\/?$/i);
        return host === "facebook.com" &&
          match &&
          !/^(?:home\.php|profile\.php|permalink\.php|photo\.php|story\.php|sharer\.php|groups|events|watch|marketplace|login|share|search|reels?|stories|gaming|people|pages|plugins)$/i.test(
            match[1],
          )
          ? "https://www.facebook.com/" + match[1].toLowerCase() + "/"
          : null;
      case "instagram":
        match = url.pathname.match(/^\/([a-z0-9._]+)\/?$/i);
        return host === "instagram.com" &&
          match &&
          !/^(?:p|reels?|stories|accounts|explore|direct|about|developer|legal)$/i.test(
            match[1],
          )
          ? "https://www.instagram.com/" + match[1].toLowerCase() + "/"
          : null;
      case "tiktok":
        match = url.pathname.match(
          /^\/@([a-z0-9_](?:[a-z0-9_.]{0,22}[a-z0-9_])?)\/?$/i,
        );
        return host === "tiktok.com" && match
          ? "https://www.tiktok.com/@" + match[1].toLowerCase() + "/"
          : null;
      case "bing":
        if (host !== "bing.com") return null;
        url.hash = "";
        return url.href;
      default:
        return null;
    }
  } catch {
    return null;
  }
}
