/** Source-specific technical explanations; hypotheses are explicitly labeled. */
export function diagnoseSourceIssue(input: { source?: string | null; status?: string; httpStatus?: number | null; reason?: string | null }) {
  const reason = (input.reason || '').toLowerCase();
  const status = input.httpStatus;
  const source = input.source || 'source';
  if (status === 429 || /too many requests|rate.limit|quota|limite de (débit|requêtes)/i.test(reason))
    return { causeCode: 'SOURCE_RATE_LIMIT', certainty: 'observed', cause: `La source ${source} limite actuellement les requêtes.`, action: 'Attendre la période de réinitialisation, diminuer la fréquence et relancer seulement les fiches nécessaires.' };
  if (/cloudflare|captcha|challenge|vérification humaine|contrôle de sécurité/i.test(reason))
    return { causeCode: 'SOURCE_SECURITY_CHALLENGE', certainty: 'observed', cause: `Un contrôle de sécurité bloque la lecture automatisée de ${source}.`, action: 'Ouvrir la session du navigateur, effectuer manuellement la vérification autorisée, puis reprendre la collecte.' };
  if (status === 401 || status === 403 || /accès refusé|forbidden|unauthorized|autorisation manquante|non autorisé/i.test(reason))
    return { causeCode: 'SOURCE_ACCESS_DENIED', certainty: 'likely', cause: `La source ${source} a refusé l'accès à cette opération.`, action: 'Vérifier les droits de la session, la configuration de la connexion et la disponibilité de la page publique ; ne pas contourner les protections.' };
  if (status === 408 || status === 504 || /timeout|timed out|aborted|délai|trop lent/i.test(reason))
    return { causeCode: 'SOURCE_TIMEOUT', certainty: 'likely', cause: `La source ${source} n'a pas répondu dans le délai prévu.`, action: 'Contrôler les temps de réponse et la connectivité, puis relancer après un délai.' };
  if (/fetch failed|enotfound|econnrefused|eai_again|dns|network error|réseau indisponible/i.test(reason))
    return { causeCode: 'SOURCE_NETWORK', certainty: 'likely', cause: `La connexion réseau vers ${source} ou le navigateur cloud a échoué.`, action: 'Vérifier le réseau du serveur, la résolution DNS, la disponibilité du conteneur et la configuration CLOUD_BROWSER_URL.' };
  if (/réponse navigateur invalide|invalid.*response|invalid json|contenu inattendu/i.test(reason))
    return { causeCode: 'SOURCE_INVALID_RESPONSE', certainty: 'observed', cause: `La réponse de ${source} ne correspond pas au format attendu par le collecteur.`, action: 'Examiner la version du collecteur et le format public de la page source ; corriger le lecteur avant de reprendre.' };
  if (/non configuré|non configurée|doit être configuré|clé.*absente|api.*manquante|access.*not configured/i.test(reason))
    return { causeCode: 'SOURCE_UNCONFIGURED', certainty: 'observed', cause: `L'accès direct à ${source} n'est pas configuré.`, action: 'Configurer la connexion autorisée ou utiliser la source publique alternative ; ce statut n’est pas une panne du prospect.' };
  if ((status !== null && status !== undefined && status >= 500) || /indisponible|unavailable|browser.*failed|navigateur.*erreur/i.test(reason))
    return { causeCode: 'SOURCE_UNAVAILABLE', certainty: 'likely', cause: `Le service ${source} ou son navigateur de collecte est momentanément indisponible.`, action: 'Consulter les logs du conteneur navigateur avec l’identifiant de tâche, vérifier son état, puis relancer.' };
  if (/aucun site web renseigné|site web absent/i.test(reason))
    return { causeCode: 'SOURCE_WEBSITE_MISSING', certainty: 'observed', cause: 'Aucune adresse de site web n’est renseignée sur ce prospect.', action: 'Renseigner un site web confirmé avant de lancer la lecture de ses contacts et mentions légales.' };
  if (/un siren confirmé est nécessaire|un siret confirmé est nécessaire|identifiant.*nécessaire/i.test(reason))
    return { causeCode: 'SOURCE_IDENTITY_REQUIRED', certainty: 'observed', cause: `Un identifiant légal vérifié est nécessaire avant de rattacher les données de ${source}.`, action: 'Vérifier le SIREN ou SIRET de l’établissement dans l’Annuaire officiel, puis reprendre la source.' };
  if (input.status === 'empty')
    return { causeCode: 'SOURCE_EMPTY', certainty: 'observed', cause: `Aucune nouvelle donnée n'a été confirmée auprès de ${source} ; ce statut n’est pas nécessairement une panne.`, action: 'Vérifier la recherche et les données déjà connues ; ne pas ajouter d’information non confirmée.' };
  if (/pas fourni de résultats lisibles|aucune fiche lisible|aucun résultat visible|page.*sans résultat lisible/i.test(reason))
    return { causeCode: 'SOURCE_UNREADABLE_RESULTS', certainty: 'observed', cause: `Le collecteur ${source} n’a trouvé aucun résultat lisible sur la page affichée. La cause sous-jacente (chargement, structure ou absence de résultats) reste à confirmer.`, action: 'Ouvrir la page dans le navigateur cloud ; vérifier le chargement, les résultats visibles et l’adaptation du lecteur à la structure actuelle.' };
  if (/ouvrez une fiche entreprise.*publique|sélectionnez une fiche|ouvrez la bonne fiche/i.test(reason))
    return { causeCode: 'SOURCE_MANUAL_SELECTION', certainty: 'observed', cause: `La source ${source} attend l’ouverture d’une fiche précise avant de pouvoir en lire les données.`, action: 'Ouvrir la fiche publique du bon établissement dans la session, puis reprendre sa lecture.' };
  if (/le navigateur n.a pas pu effectuer cette opération/i.test(reason))
    return { causeCode: 'SOURCE_WORKER_FAILURE', certainty: 'unknown', cause: 'Le moteur de navigation a échoué sans transmettre le motif technique détaillé à cette ancienne tâche.', action: 'Relancer une seule tâche avec le nouveau diagnostic et retrouver son identifiant dans les logs du worker Docker.' };
  if (input.status === 'awaiting_user' && !/siren|siret|identité|rapprochement|contradictoire|correspondance/i.test(reason))
    return { causeCode: 'SOURCE_AWAITING_USER', certainty: 'unknown', cause: 'Le navigateur attend une intervention humaine ; le motif exact est à confirmer.', action: 'Ouvrir la session associée à cette tâche et consulter l’écran ou les logs du worker.' };
  if (/siren|siret|identité|rapprochement|contradictoire|établissement|pas certain|aucun.*unique|correspondance fiable|non concordante|vérifi/i.test(reason) || input.status === 'needs_review')
    return { causeCode: 'SOURCE_IDENTITY_REVIEW', certainty: 'likely', cause: 'La correspondance entre la fiche collectée et le bon établissement n’est pas suffisamment certaine.', action: 'Vérifier manuellement SIREN/SIRET, raison sociale, ville et adresse avant d’appliquer une donnée.' };
  if (input.status === 'empty' || /aucun résultat|aucune correspondance|aucune donnée|page vide/i.test(reason))
    return { causeCode: 'SOURCE_EMPTY', certainty: 'observed', cause: `Aucune donnée exploitable n'a été confirmée auprès de ${source}.`, action: 'Vérifier le libellé recherché et la zone ; essayer une autre source, sans inventer les champs absents.' };
  return { causeCode: 'SOURCE_UNCLASSIFIED', certainty: 'unknown', cause: `La source ${source} a retourné une anomalie dont la cause n'est pas encore identifiée.`, action: 'Ouvrir le détail technique et recouper l’identifiant de tâche avec les logs Docker du worker.' };
}
