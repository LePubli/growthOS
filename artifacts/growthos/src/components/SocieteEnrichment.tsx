import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CompanyDetailsView } from "./ProspectCompanyProfile";
import { useState } from "react";
import {
  societeSearchUrl,
  googleSocieteSearchUrl,
  preferredCompanyQuery,
} from "@/lib/societe-search";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import { getLocalCaptures, type LocalCompany } from "@/lib/pagesjaunes-device";

type Prospect = {
  firstName?: string | null;
  lastName?: string | null;
  sourceDetails?: Record<string, any>;
  id: string;
  company?: string | null;
  siren?: string | null;
  siret?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  postalCode?: string | null;
  apeCode?: string | null;
  nafLabel?: string | null;
};
const comparison = [
  ["SIREN", "siren"],
  ["SIRET", "siret"],
  ["Adresse", "address"],
  ["Code postal", "codePostal"],
  ["Ville", "city"],
  ["Téléphone", "phone"],
  ["Email", "email"],
  ["Site web", "website"],
  ["Code APE", "apeCode"],
  ["Activité", "nafLabel"],
] as const;

export function SocieteEnrichment({
  prospect,
  onSaved,
}: {
  prospect: Prospect;
  onSaved: () => void;
}) {
  const [captures, setCaptures] = useState<LocalCompany[]>([]);
  const [selected, setSelected] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [result, setResult] = useState("");
  const [query, setQuery] = useState(() => preferredCompanyQuery(prospect));
  const directors: string[] =
    prospect.sourceDetails?.societe_com?.companyDetails?.managers || [];
  const methods = [
    { label: "SIRET", value: prospect.siret },
    { label: "SIREN", value: prospect.siren },
  ].filter((method) => method.value);
  const capture = captures.find((item) => item.id === selected);
  const load = async () => {
    setBusy(true);
    setError("");
    setResult("");
    setConfirmed(false);
    setSelected("");
    try {
      setCaptures(
        (await getLocalCaptures()).filter(
          (item) => item.source === "societe_com",
        ),
      );
      setLoaded(true);
    } catch (e: any) {
      setError(e.message || "La lecture du connecteur a échoué.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-4">
      <p className="text-sm">
        Ouvrez le résultat correspondant à l’entreprise, capturez sa fiche avec
        l’extension Chrome, puis chargez-la ici pour comparer les informations.
      </p>
      <label className="block text-sm font-medium">
        Nom de l’entreprise ou du dirigeant et ville
        <input
          className="block w-full border rounded-lg p-3 mt-1"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ex. Atelier Dupont Roubaix"
        />
      </label>
      {!!directors.length && (
        <div className="flex flex-wrap gap-2 text-sm">
          {directors.map((name) => (
            <button
              key={name}
              type="button"
              className="border rounded-lg px-3 py-2"
              onClick={() =>
                setQuery([name, prospect.city].filter(Boolean).join(" "))
              }
            >
              {name}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {query.trim() && (
          <>
            <a
              className="rounded-lg bg-teal-700 text-white px-4 py-2 text-sm"
              target="_blank"
              rel="noreferrer"
              href={googleSocieteSearchUrl(query)}
            >
              Rechercher le nom sur Google
            </a>
            <a
              className="border rounded-lg px-4 py-2 text-sm"
              target="_blank"
              rel="noreferrer"
              href={societeSearchUrl(query)}
            >
              Rechercher sur Societe.com
            </a>
          </>
        )}
      </div>
      {!!methods.length && (
        <div className="flex flex-wrap gap-2 text-sm items-center">
          <span>Identifiant de l’établissement</span>
          {methods.map((method) => (
            <a
              key={method.label}
              className="border rounded-lg px-3 py-2 text-teal-700"
              target="_blank"
              rel="noreferrer"
              href={societeSearchUrl(method.value!)}
            >
              {method.label} · {method.value}
            </a>
          ))}
        </div>
      )}
      {prospect.address && (
        <details className="text-sm">
          <summary>Recherche complémentaire par adresse</summary>
          <a
            className="block underline text-teal-700 mt-2"
            target="_blank"
            rel="noreferrer"
            href={googleSocieteSearchUrl(
              [prospect.company, prospect.address, prospect.city]
                .filter(Boolean)
                .join(" "),
            )}
          >
            Rechercher cette entreprise à son adresse
          </a>
        </details>
      )}
      <hr />
      <button
        type="button"
        className="border rounded-lg px-3 py-2 mt-3 text-sm"
        disabled={busy}
        onClick={() => void load()}
      >
        {busy ? "Traitement…" : "Charger les fiches Societe.com du connecteur"}
      </button>
      {error && (
        <p role="alert" className="text-red-700 text-sm mt-2">
          {error}
        </p>
      )}
      {result && (
        <p role="status" className="text-sm mt-2">
          {result}
        </p>
      )}
      {loaded && !captures.length && (
        <p className="text-sm mt-2">
          Aucune fiche Societe.com dans le connecteur. Ouvrez la fiche trouvée
          puis utilisez « Capturer la fiche » dans l’extension.
        </p>
      )}
      {!!captures.length && (
        <label className="block text-sm mt-3">
          Fiche à comparer
          <select
            className="block border rounded-lg p-2 w-full"
            value={selected}
            disabled={busy}
            onChange={(event) => {
              setSelected(event.target.value);
              setConfirmed(false);
              setResult("");
            }}
          >
            <option value="">Choisir une fiche</option>
            {captures.map((item) => (
              <option key={item.id} value={item.id}>
                {item.company} · {item.codePostal} · {item.city}
              </option>
            ))}
          </select>
        </label>
      )}
      {capture && (
        <div className="mt-3">
          <a
            className="text-sm underline text-teal-700"
            href={capture.sourceUrl || undefined}
            target="_blank"
            rel="noreferrer"
          >
            Vérifier la page de {capture.company}
          </a>
          <div className="overflow-x-auto">
            <table className="text-sm w-full my-3 text-left">
              <thead>
                <tr>
                  <th>Champ</th>
                  <th>Prospect actuel</th>
                  <th>Societe.com</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map(([label, key]) => {
                  const current =
                    key === "codePostal" ? prospect.postalCode : prospect[key];
                  const incoming =
                    key === "siren"
                      ? capture.siret?.slice(0, 9) ||
                        capture.sourceUrl?.match(/-(\d{9})\.html/)?.[1]
                      : capture[key];
                  return (
                    <tr key={key}>
                      <th className="py-1 font-normal">{label}</th>
                      <td>{current || "—"}</td>
                      <td>{incoming || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {capture.companyDetails && (
            <details className="my-3">
              <summary>Autres informations capturées sur Societe.com</summary>
              <CompanyDetailsView details={capture.companyDetails} />
            </details>
          )}
          <p className="text-xs">
            Les champs vides seront complétés. Les valeurs différentes seront
            proposées dans les désaccords de la fiche.
          </p>
          <label className="flex gap-2 text-sm my-3">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={busy}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            Je confirme que cette société et cet établissement correspondent au
            prospect.
          </label>
          <button
            type="button"
            className="rounded-lg bg-teal-700 text-white px-3 py-2 text-sm disabled:opacity-50"
            disabled={!confirmed || busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              setResult("");
              try {
                const response = await apiClient.post<{
                  enriched: boolean;
                  conflicts: number;
                }>(`/sourcing/device/prospects/${prospect.id}/societe-enrich`, {
                  capture,
                  confirmed: true,
                });
                setConfirmed(false);
                setResult(
                  response.enriched
                    ? `Fiche enrichie · ${response.conflicts} désaccord(s) à vérifier.`
                    : `Données examinées · ${response.conflicts} désaccord(s) à vérifier.`,
                );
                onSaved();
                toast.success("Informations Societe.com examinées.");
              } catch (e: any) {
                setError(e.message || "L’enrichissement a échoué.");
              } finally {
                setBusy(false);
              }
            }}
          >
            Confirmer l’enrichissement de ce prospect
          </button>
        </div>
      )}
    </section>
  );
}

export function SocieteEnrichmentDialog({
  prospect,
  onSaved,
  open,
  onOpenChange,
}: {
  prospect: Prospect;
  onSaved: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl max-h-[90vh] overflow-y-auto"
        style={{
          background: "var(--card-bg, #fff)",
          color: "var(--text-primary, #1f2937)",
          borderColor: "var(--card-border, #e5e7eb)",
        }}
      >
        <DialogTitle>Enrichir via Societe.com</DialogTitle>
        <DialogDescription>
          Recherchez par nom ou identifiant, puis comparez la fiche avant de
          confirmer.
        </DialogDescription>
        <SocieteEnrichment prospect={prospect} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  );
}
