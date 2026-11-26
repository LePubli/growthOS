import { Link } from "wouter";
import { ExternalLink, Globe } from "lucide-react";
import { PROFESSIONAL_SOURCES } from "../../../../lib/api-zod/src/professional-sources";
import {
  prospectSourceLinks,
  type SourceLinkedProspect,
} from "@/lib/prospect-source-links";
import { preferredCompanyQuery } from "@/lib/societe-search";

type Props = {
  prospect: SourceLinkedProspect & {
    id?: string;
    company?: string | null;
    city?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  };
};
export function ProspectProfessionalSources({ prospect }: Props) {
  const links = prospectSourceLinks(prospect);
  const hasName = Boolean(
    prospect.company?.trim() ||
    prospect.firstName?.trim() ||
    prospect.lastName?.trim(),
  );
  const query = hasName ? preferredCompanyQuery(prospect) : "";
  return (
    <section
      className="rounded-2xl border p-5 space-y-4"
      style={{
        background: "var(--card-bg)",
        borderColor: "var(--card-border)",
      }}
    >
      <h2 className="font-semibold flex items-center gap-2">
        <Globe size={17} className="text-teal-600" />
        Sources et réseaux professionnels
      </h2>
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        Retrouvez les pages collectées et leur provenance. Les coordonnées
        différentes restent dans les désaccords à vérifier.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PROFESSIONAL_SOURCES.map((source) => {
          const captured = links.filter((link) => link.source === source.id);
          const searchUrl =
            source.id === "bing"
              ? "https://www.bing.com/search?q=" + encodeURIComponent(query)
              : "https://www.google.com/search?q=" +
                encodeURIComponent("site:" + source.domain + " " + query);
          return (
            <div
              key={source.id}
              className="border rounded-xl p-3 space-y-2"
              style={{ borderColor: "var(--card-border)" }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-medium text-sm">{source.label}</h3>
                {query.trim() && (
                  <a
                    href={searchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs underline text-teal-700"
                  >
                    {source.id === "bing"
                      ? "Rechercher sur Bing"
                      : "Rechercher le nom sur Google"}
                  </a>
                )}
              </div>
              {!captured.length && (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Aucun lien collecté.
                </p>
              )}
              {captured.map((link) => (
                <div key={link.url} className="text-sm space-y-1">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-700 underline break-all inline-flex items-start gap-1"
                  >
                    <ExternalLink size={13} className="mt-1 shrink-0" />
                    {link.url}
                  </a>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {link.origins.join(" · ")}
                    {link.capturedAt && (
                      <>
                        {" "}
                        ·{" "}
                        <time dateTime={link.capturedAt}>
                          {new Date(link.capturedAt).toLocaleString("fr-FR")}
                        </time>
                      </>
                    )}
                  </p>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        LinkedIn, Facebook, Instagram et TikTok utilisent la saisie assistée du
        connecteur Chrome. Vérifiez la page de l’entreprise avant de confirmer
        ses informations.
      </p>
      <Link
        href={prospect.id?'/outils?mode=enrich&prospectId='+prospect.id:'/prospects/connecteur'}
        className="inline-block border rounded-lg px-3 py-2 text-sm font-medium text-teal-700"
      >
        {prospect.id?'Compléter ce prospect avec le connecteur':'Comparer et importer les captures du connecteur'}
      </Link>
    </section>
  );
}
