import { useEffect, useState, useRef } from "react";
import apiClient from "@/lib/api-client";
import type { CompanyDetails } from "@/lib/pagesjaunes-device";

type Snapshot = {
  sourceUrl: string;
  sourceUpdatedAt: string | null;
  fields: Record<string, string | null>;
  managers: string[];
  financials: string[];
  establishments: {
    siret: string;
    address: string | null;
    status: string | null;
    activity: string | null;
  }[];
};
type Monitoring = {
  lastSync?:{appliedAt:string;fields:string[];sourceUrl:string}|null;
  enabled: boolean;
  intervalHours: number;
  checkedAt: string | null;
  nextCheckAt: string | null;
  error: string | null;
  snapshot: Snapshot | null;
  changes: {
    id: string;
    detectedAt: string;
    sourceUrl: string;
    changes: Record<string, { before: unknown; after: unknown }>;
  }[];
};
type Props = {
  onUpdated?:()=>void|Promise<void>;
  prospect: {
    id: string;
    siren?: string | null;
    siret?: string | null;
    sourceDetails?: Record<string, any>;
  };
};
const date = (value?: string | null) =>
  value ? new Date(value).toLocaleString("fr-FR") : "Jamais vérifié";
function readable(value: unknown): string {
  if (value === null || value === undefined) return "Non communiqué";
  if (Array.isArray(value)) return value.map(readable).join(" · ");
  return String(value);
}
export function CompanyDetailsView({ details }: { details: CompanyDetails }) {
  return (
    <div className="space-y-3 text-sm">
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Object.entries(details.fields).map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-gray-500">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {!!details.managers.length && (
        <div>
          <h4 className="font-medium">Dirigeants</h4>
          {details.managers.map((name) => (
            <p key={name}>{name}</p>
          ))}
        </div>
      )}
      {!!details.managerContacts?.length && (
        <div className="space-y-2">
          {details.managerContacts.map((contact, index) => (
            <div key={index} className="border rounded-lg p-2">
              <p className="font-medium">
                {contact.name}
                {contact.role ? " · " + contact.role : ""}
              </p>
              {contact.phone && <p>{contact.phone}</p>}
              {contact.email && <p>{contact.email}</p>}
              {!contact.phone && !contact.email && (
                <p className="text-xs">
                  Coordonnées directes non publiées sur la fiche capturée.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      {!!details.establishments.length && (
        <div>
          <h4 className="font-medium">Établissements relevés</h4>
          {details.establishments.map((site) => (
            <p key={site.siret}>
              {site.siret} · {site.address || "Adresse non communiquée"}
            </p>
          ))}
        </div>
      )}
      {!!details.links.length && (
        <div>
          <h4 className="font-medium">Documents et annonces sur Societe.com</h4>
          {details.links.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="block underline text-teal-700"
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
export function ProspectCompanyProfile({ prospect,onUpdated }: Props) {
  const [data, setData] = useState<Monitoring | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const identifiable = Boolean(prospect.siren || prospect.siret);
  const lastApplied=useRef(''),updated=useRef(onUpdated);updated.current=onUpdated;
  useEffect(()=>{
    const applied=data?.lastSync?.appliedAt;
    if(applied && applied!==lastApplied.current){lastApplied.current=applied;void updated.current?.();}
  },[data?.lastSync?.appliedAt]);
  useEffect(()=>{
    if(!data?.enabled)return;
    const timer=window.setInterval(()=>{
      void apiClient.get<Monitoring>(`/prospects/${prospect.id}/monitoring`).then(setData).catch(()=>undefined);
    },60000);
    return()=>window.clearInterval(timer);
  },[prospect.id,data?.enabled]);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    const operation = identifiable
      ? apiClient.post<Monitoring>(`/prospects/${prospect.id}/verify-company`, {
          force: false,
        })
      : apiClient.get<Monitoring>(`/prospects/${prospect.id}/monitoring`);
    operation
      .then((result) => {
        if (current) setData(result);
      })
      .catch((e) => {
        if (current)
          setError(e.message || "Le statut n’a pas pu être vérifié.");
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [prospect.id, prospect.siren, prospect.siret]);
  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      setData(
        await apiClient.post<Monitoring>(
          `/prospects/${prospect.id}/verify-company`,
          { force: true },
        ),
      );
    } catch (e: any) {
      setError(e.message || "Le statut n’a pas pu être vérifié.");
    } finally {
      setLoading(false);
    }
  };
  const configure = async (enabled: boolean, intervalHours: number) => {
    setLoading(true);
    setError("");
    try {
      setData(
        await apiClient.patch<Monitoring>(
          `/prospects/${prospect.id}/monitoring`,
          { enabled, intervalHours },
        ),
      );
    } catch (e: any) {
      setError(e.message || "La veille n’a pas pu être enregistrée.");
    } finally {
      setLoading(false);
    }
  };
  const snapshot = data?.snapshot;
  const issue = error || data?.error;
  const legalStatus = snapshot?.fields["État de l’entreprise"];
  const establishmentStatus = snapshot?.fields["État de l’établissement"];
  const profile = prospect.sourceDetails?.societe_com as
    | {
        companyDetails?: CompanyDetails;
        sourceUrl?: string;
        capturedAt?: number;
        history?: { capturedAt?: number; companyDetails: CompanyDetails }[];
      }
    | undefined;
  const contacts = profile?.companyDetails?.managerContacts || [];
  const names = [
    ...new Set([
      ...(profile?.companyDetails?.managers || []),
      ...(snapshot?.managers || []),
    ]),
  ];
  return (
    <section
      className="rounded-2xl border p-5 space-y-4"
      style={{
        background: "var(--card-bg)",
        borderColor: "var(--card-border)",
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">
          Statut de l’entreprise et surveillance
        </h2>
        <button
          type="button"
          className="text-sm border rounded-xl px-3 py-2 disabled:opacity-50"
          disabled={loading || !identifiable}
          onClick={() => void refresh()}
        >
          {loading ? "Vérification…" : "Vérifier maintenant"}
        </button>
      </div>
      <div className="flex flex-wrap gap-3 text-sm">
        <span
          className={`rounded-lg px-3 py-2 ${issue ? "bg-gray-100 text-gray-700" : legalStatus === "Active" ? "bg-green-50 text-green-800" : legalStatus === "Cessée" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-800"}`}
        >
          {issue ? "Dernier statut connu · " : "Entreprise · "}
          {legalStatus || "Non vérifié"}
        </span>
        {prospect.siret && (
          <span
            className={`rounded-lg px-3 py-2 ${establishmentStatus === "Fermé" ? "bg-red-50 text-red-800" : "bg-gray-50 text-gray-700"}`}
          >
            Établissement · {establishmentStatus || "Non vérifié"}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500">
        Dernier contrôle · {date(data?.checkedAt)}. Contrôle à l’ouverture de la
        fiche, avec réutilisation du dernier résultat pendant une minute.
      </p>
      {data?.lastSync && <p role="status" className="rounded-lg bg-teal-50 text-teal-900 p-3 text-sm">
        Mise à jour automatique · {date(data.lastSync.appliedAt)} : {data.lastSync.fields.join(', ')}.
        {' '}Les anciennes et nouvelles valeurs sont conservées dans les activités de cette fiche.
      </p>}
      {issue && (
        <p role="alert" className="text-sm text-amber-800">
          {issue}
        </p>
      )}
      {!identifiable && (
        <p className="text-sm">
          Renseignez un SIREN ou SIRET vérifié pour contrôler le statut et
          activer la veille.
        </p>
      )}
      {snapshot && (
        <p className="text-xs">
          <a
            href={snapshot.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="underline text-teal-700"
          >
            Source · Annuaire des Entreprises
          </a>
          {snapshot.sourceUpdatedAt && (
            <> · mise à jour de la source {date(snapshot.sourceUpdatedAt)}</>
          )}
        </p>
      )}
      <div className="border-t pt-3 space-y-2 text-sm">
        <h3 className="font-semibold">Dirigeants et contacts professionnels</h3>
        {contacts.map((contact, index) => (
          <div key={index} className="rounded-lg border p-3 space-y-1">
            <p className="font-medium">
              {contact.name}
              {contact.role ? " · " + contact.role : ""}
            </p>
            {contact.phone && (
              <p>
                <a href={"tel:" + contact.phone.replace(/[^+0-9]/g, "")}>
                  {contact.phone}
                </a>
              </p>
            )}
            {contact.email && (
              <p>
                <a href={"mailto:" + contact.email}>{contact.email}</a>
              </p>
            )}
            {contact.profileUrl && (
              <a
                className="underline text-teal-700"
                href={contact.profileUrl}
                target="_blank"
                rel="noreferrer"
              >
                Fiche du dirigeant sur Societe.com
              </a>
            )}
            {!contact.phone && !contact.email && (
              <p className="text-xs text-gray-500">
                Coordonnées directes non publiées sur la fiche capturée.
              </p>
            )}
          </div>
        ))}
        {names
          .filter(
            (name) =>
              !contacts.some(
                (contact) =>
                  name === contact.name ||
                  name.startsWith(contact.name + " · "),
              ),
          )
          .map((name) => (
            <p key={name}>{name}</p>
          ))}
        {!contacts.length && !names.length && (
          <p>
            Nom du dirigeant non relevé. Capturez la fiche Societe.com détaillée
            puis confirmez l’enrichissement.
          </p>
        )}
        {profile?.sourceUrl && (
          <p className="text-xs">
            <a
              className="underline text-teal-700"
              href={profile.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Source Societe.com
            </a>{" "}
            · capture du{" "}
            {date(
              profile.capturedAt
                ? new Date(profile.capturedAt).toISOString()
                : null,
            )}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm border-t pt-3">
        <label className="flex gap-2">
          <input
            type="checkbox"
            checked={data?.enabled ?? false}
            disabled={loading || !identifiable || !data}
            onChange={(e) =>
              void configure(e.target.checked, data?.intervalHours || 24)
            }
          />
          Surveiller et mettre à jour les données officielles de ce prospect
        </label>
        <select
          aria-label="Fréquence de surveillance"
          disabled={loading || !identifiable || !data}
          value={data?.intervalHours || 24}
          onChange={(e) =>
            void configure(data?.enabled ?? false, Number(e.target.value))
          }
          className="border rounded-lg p-2"
        >
          <option value={24}>Chaque jour</option>
          <option value={72}>Tous les 3 jours</option>
          <option value={168}>Chaque semaine</option>
        </select>
      </div>
      {data?.enabled && (
        <p className="text-xs text-gray-500">
          Prochain contrôle automatique · {date(data.nextCheckAt)}. Les
          changements sont signalés dans les notifications GrowthOS.
        </p>
      )}
      {snapshot && (
        <details>
          <summary className="cursor-pointer font-medium text-sm">
            Identité légale et données économiques officielles
          </summary>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 text-sm">
            {Object.entries(snapshot.fields).map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-gray-500">{label}</dt>
                <dd>{value || "Non communiqué par la source"}</dd>
              </div>
            ))}
          </dl>
          {!!snapshot.managers.length && (
            <div className="mt-3 text-sm">
              <h3 className="font-medium">Dirigeants</h3>
              {snapshot.managers.map((person) => (
                <p key={person}>{person}</p>
              ))}
            </div>
          )}
          {!!snapshot.financials.length && (
            <div className="mt-3 text-sm">
              <h3 className="font-medium">Finances publiées</h3>
              {snapshot.financials.map((finance) => (
                <p key={finance}>{finance}</p>
              ))}
            </div>
          )}
          {!!snapshot.establishments.length && (
            <div className="mt-3 text-sm">
              <h3 className="font-medium">
                Établissements retournés par la source
              </h3>
              {snapshot.establishments.map((site) => (
                <p key={site.siret}>
                  {site.siret} · {site.status || "Statut non communiqué"} ·{" "}
                  {site.address || "Adresse non communiquée"}
                </p>
              ))}
            </div>
          )}
        </details>
      )}
      {profile?.companyDetails && (
        <details>
          <summary className="cursor-pointer font-medium text-sm">
            Informations détaillées capturées sur Societe.com
          </summary>
          <p className="text-xs my-2">
            Capture du{" "}
            {date(
              profile.capturedAt
                ? new Date(profile.capturedAt).toISOString()
                : null,
            )}{" "}
            ·{" "}
            <a
              className="underline"
              href={profile.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Consulter la fiche source
            </a>
          </p>
          <CompanyDetailsView details={profile.companyDetails} />
          {!!profile.history?.length && (
            <details className="mt-3">
              <summary>Captures précédentes ({profile.history.length})</summary>
              {profile.history.map((version, index) => (
                <div key={index} className="border-t py-3">
                  <p className="text-xs mb-2">
                    {date(
                      version.capturedAt
                        ? new Date(version.capturedAt).toISOString()
                        : null,
                    )}
                  </p>
                  <CompanyDetailsView details={version.companyDetails} />
                </div>
              ))}
            </details>
          )}
        </details>
      )}
      <details>
        <summary className="cursor-pointer font-medium text-sm">
          Historique des changements ({data?.changes.length || 0})
        </summary>
        {!data?.changes.length && (
          <p className="text-sm mt-2">
            Aucun changement détecté depuis la première vérification.
          </p>
        )}
        {data?.changes.map((event) => (
          <div key={event.id} className="mt-3 border-t pt-3 text-sm">
            <p className="font-medium">{date(event.detectedAt)}</p>
            {Object.entries(event.changes).map(([field, change]) => (
              <p key={field}>
                {field} · {readable(change.before)} → {readable(change.after)}
              </p>
            ))}
            <a
              href={event.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs underline"
            >
              Source du changement
            </a>
          </div>
        ))}
      </details>
    </section>
  );
}
