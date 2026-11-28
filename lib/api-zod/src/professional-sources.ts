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

/** A website can link a person as well as a company. This does not turn a
 * personal profile into the company's LinkedIn URL, or prove a manager role. */
export function publicSocialReference(value:unknown):{source:string;kind:'person'|'company'|'profile';url:string;nameHint?:string}|null{
  if(typeof value!=='string'||value.length>500)return null;
  try{
    const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port)return null;
    const host=u.hostname.toLowerCase().replace(/^www\./,'');
    if(host==='linkedin.com'||/^[a-z]{2}\.linkedin\.com$/.test(host)){
      const person=u.pathname.match(/^\/in\/([a-z0-9_%\-]+)\/?$/i);
      if(person){const slug=decodeURIComponent(person[1]);const words=slug.split('-').filter(Boolean);while(words.length&&/\d/.test(words[words.length-1]))words.pop();
        const nameHint=words.length>=2&&words.length<=5&&words.every(w=>/^[a-zÀ-ÿ]{2,30}$/i.test(w))?words.map(w=>w[0].toUpperCase()+w.slice(1)).join(' '):undefined;
        return {source:'linkedin',kind:'person',url:'https://www.linkedin.com/in/'+person[1].toLowerCase()+'/',...(nameHint?{nameHint}:{})};}
      u.hostname='www.linkedin.com';const company=professionalSourceUrl('linkedin',u.href);return company?{source:'linkedin',kind:'company',url:company}:null;
    }
    // Facebook uses /people/name/id for business pages too. The URL alone
    // does not establish whether this is a person or a company.
    if(host==='facebook.com'){
      const people=u.pathname.match(/^\/people\/([a-z0-9.%_-]+)\/(\d{5,30})\/?$/i);
      if(people)return {source:'facebook',kind:'profile',url:'https://www.facebook.com/people/'+people[1].toLowerCase()+'/'+people[2]+'/'};
      if(u.pathname==='/profile.php'&&/^\d{5,30}$/.test(u.searchParams.get('id')||''))return {source:'facebook',kind:'profile',url:'https://www.facebook.com/profile.php?id='+u.searchParams.get('id')};
    }
    for(const source of ['facebook','instagram','tiktok']){const url=professionalSourceUrl(source,u.href);if(url)return {source,kind:'company',url};}
    return null;
  }catch{return null;}
}

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
