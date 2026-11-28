# Catalogue étendu des sources d'e-réputation B2C — France

**Version : 27 novembre 2026**  
**Destinataire : agent de développement du projet SaaS d'e-réputation**  
**Périmètre :** marques, commerces, établissements, produits, services, dirigeants publics, avis, conversations, recherche web et réponses des moteurs IA. Les plateformes internationales sont incluses lorsqu'elles couvrent les consommateurs français.

## Instructions à l'agent

- Ce document est un **inventaire de sources candidates**, pas un ordre d'exécution. **L'agent choisit seul les priorités d'intégration**, à partir de l'utilité, des coûts, licences, APIs, faisabilité et stabilité.
- Vérifier individuellement site, existence d'une surface publique de mentions/avis, documentation d'API, conditions contractuelles, accès propriétaire ou tiers, quotas, frais, conservation des données et RGPD.
- Ne pas confondre **plateformes où des consommateurs publient des mentions** et **logiciels concurrents qui agrègent ces plateformes**.
- Ne jamais présenter un accès web public comme une permission de scraping ; respecter les accès authentifiés, limites, robots, contrats et données personnelles.
- Séparer le suivi de **ses propres comptes/établissements avec autorisation** de la **veille publique sur une marque tierce**. Les fonctionnalités disponibles diffèrent souvent radicalement.
- Lier chaque mention à sa marque/son lieu/son produit avec vérification de l'identité ; éviter les homonymes, fausses attributions et doublons.
- Stocker provenance, URL canonique, identifiant externe, date, langue, extrait autorisé, note, type, auteur si licite, évolution, réponse, statut, confiance et horodatage de collecte. Respecter minimisation, effacement et conservation.
- Différencier constat (avis négatif, article, plainte) et interprétation (sentiment IA, suspicion de faux avis). Ne jamais affirmer une fraude sur un simple score.
- Identifier séparément les sources de **sentiment, part de voix, SEO, visibilité IA, GEO**, qui n'ont pas nécessairement de vrais avis clients.
- Ne pas fabriquer de mentions, commentaires, avis, notes ou résultats. Lorsqu'une source n'est pas accessible, enregistrer l'échec et sa raison.

**Légende d'accès :** `API propriétaire` = généralement pour le compte ou établissement administré ; `API publique/partenaire` = accès selon documentation et contrat ; `consultation` = ne présume aucun droit d'extraction ; `flux` = RSS/Atom/sitemap lorsque proposé ; `contribution` = un signal publié par des tiers, pas forcément un avis vérifié.

## 1. Avis généralistes et réputation locale

| Source | Site | Signaux à suivre | Accès à expertiser |
|---|---|---|---|
| Google Maps / Fiches d'établissement Google | https://www.google.com/maps | Notes, avis, réponses, photos, fiches | API propriétaire / Maps Platform |
| Google Business Profile | https://www.google.com/business | Avis et réponses des fiches gérées | API propriétaire autorisée |
| Apple Plans / Apple Business Connect | https://maps.apple.com | Fiches locales, informations et éventuels signaux | Propriétaire/consultation |
| Bing Maps / Bing Places | https://www.bing.com/maps | Présence locale, données établissement | Propriétaire/consultation |
| PagesJaunes | https://www.pagesjaunes.fr | Avis, réponses, coordonnées, photos | Consultation/accord |
| Yelp France | https://www.yelp.fr | Avis locaux, notes, photos | API/contrat selon usage |
| Trustpilot | https://fr.trustpilot.com | Avis entreprises, notes, réponses | API/contrat |
| Avis Vérifiés (Skeepers) | https://www.avis-verifies.com | Avis boutique et produit | Contrat propriétaire |
| Société des Avis Garantis | https://www.societe-des-avis-garantis.fr | Avis marchands et produits | Contrat propriétaire |
| Trusted Shops | https://www.trustedshops.fr | Avis marchands et produits | Contrat propriétaire |
| Custplace | https://fr.custplace.com | Avis et réclamations publiques | Contrat/consultation |
| Guest Suite | https://www.guest-suite.com | Avis clients et collecte multicanale | Logiciel agrégateur, pas source native unique |
| eKomi | https://www.ekomi.fr | Avis clients | Contrat propriétaire |
| Bazaarvoice | https://www.bazaarvoice.com | Notes et avis produits de distributeurs | Partenariat/contrat |
| Yotpo | https://www.yotpo.com | Avis produits et témoignages | Contrat propriétaire |
| Judge.me | https://judge.me | Avis e-commerce | Contrat propriétaire |
| Loox | https://loox.app | Avis photo/vidéo e-commerce | Contrat propriétaire |
| Feefo | https://www.feefo.com | Avis marques et produits | Contrat |
| Sitejabber | https://www.sitejabber.com | Avis de sites et commerces | Consultation/contrat |
| Reviews.io | https://www.reviews.io | Avis clients et produits | API/contrat |
| Mappy | https://fr.mappy.com | Présence locale et fiches | Consultation/accord |
| Justacoté | https://www.justacote.com | Avis et recommandations locaux | Consultation |
| Petit Futé | https://www.petitfute.com | Avis, commentaires, recommandations | Consultation |
| Cylex | https://www.cylex-locale.fr | Fiches et éventuels avis | Consultation |
| 118000 | https://www.118000.fr | Fiches et signaux de réputation | Consultation |
| Hoodspot | https://hoodspot.fr | Fiches établissement et signaux locaux | Consultation |
| Foursquare | https://foursquare.com | Lieux, recommandations et signaux | API/contrat |

## 2. Réseaux sociaux et communautés visuelles

| Source | Site | Signaux à suivre | Accès à expertiser |
|---|---|---|---|
| Facebook Pages | https://www.facebook.com | Commentaires, recommandations, mentions, réactions | Meta API pour actifs autorisés ; tiers limité |
| Facebook Groups | https://www.facebook.com/groups | Discussions et plaintes | Accès très restreint ; respect des groupes |
| Instagram | https://www.instagram.com | Publications, commentaires, tags, mentions, Reels | Instagram Graph API et limites |
| Threads | https://www.threads.net | Publications, réponses, mentions | API et couverture à vérifier |
| TikTok | https://www.tiktok.com | Vidéos, commentaires, marques, hashtags | API/recherche autorisée selon éligibilité |
| YouTube | https://www.youtube.com | Vidéos, titres, descriptions, commentaires | YouTube Data API sous quotas |
| YouTube Shorts | https://www.youtube.com/shorts | Vidéos courtes et commentaires | YouTube Data API |
| X (Twitter) | https://x.com | Mentions, conversations, réponses, hashtags | API commerciale/restreinte |
| LinkedIn | https://www.linkedin.com | Commentaires et réputation employeur/marque | API à accès restreint |
| Snapchat | https://www.snapchat.com | Contenus publics et mentions | APIs selon produits, accès limité |
| Pinterest | https://www.pinterest.fr | Épingles, descriptions et reprises de marque | API selon autorisations |
| Twitch | https://www.twitch.tv | Chats, clips, streams et mentions | Helix API / EventSub et conditions |
| Discord | https://discord.com | Messages dans serveurs ayant autorisé le bot | Bot autorisé uniquement |
| Telegram | https://telegram.org | Canaux/groupes accessibles et autorisés | Bot/API avec limites et consentement |
| WhatsApp Business | https://www.whatsapp.com/business | Messages clients **adressés à l'entreprise** | API propriétaire, privé, consentement |
| Messenger | https://www.messenger.com | Messages privés de la page | Meta API propriétaire |
| Reddit | https://www.reddit.com | Posts et commentaires publics | API, conditions commerciales |
| Mastodon | https://joinmastodon.org | Posts publics, hashtags | APIs propres aux instances |
| Bluesky | https://bsky.app | Posts publics et réponses | API/flux |
| Dailymotion | https://www.dailymotion.com | Vidéos et mentions | API/contrat à vérifier |
| Vimeo | https://vimeo.com | Vidéos et descriptions | API |
| BeReal | https://bereal.com | Mentions (couverture publique limitée) | Accès non présumé |

## 3. Forums, communautés et sites de questions-réponses

| Source | Site | Signaux |
|---|---|---|
| Reddit France et subreddits thématiques | https://www.reddit.com | Expériences clients, recommandations, critiques |
| Forum Que Choisir | https://forum.quechoisir.org | Litiges et retours consommateurs |
| UFC-Que Choisir | https://www.quechoisir.org | Enquêtes, alertes et publications |
| 60 Millions de consommateurs | https://www.60millions-mag.com | Tests, enquêtes et actualités |
| Comment Ça Marche | https://forums.commentcamarche.net | Retours logiciels, opérateurs, e-commerce |
| Doctissimo Forums | https://forum.doctissimo.fr | Expériences santé/bien-être, données sensibles |
| Jeuxvideo.com Forums | https://www.jeuxvideo.com/forums.htm | Discussions de produits et marques |
| Hardware.fr Forums | https://forum.hardware.fr | Avis tech et services |
| Dealabs | https://www.dealabs.com | Commentaires sur offres, commerçants et produits |
| ChocoBonPlan | https://www.chocobonplan.com | Bons plans et commentaires gaming |
| ForumConstruire | https://www.forumconstruire.com | Constructeurs, artisans et travaux |
| Futura Forums | https://forums.futura-sciences.com | Avis techniques et problèmes produits |
| Les Numériques | https://www.lesnumeriques.com | Tests et commentaires produits |
| Trustpilot Discussions (avis) | https://fr.trustpilot.com | Réclamations et réponses publiques |
| Quora | https://fr.quora.com | Questions/réponses et recommandations |
| Stack Overflow | https://stackoverflow.com | Réputation d'outils développeurs et SaaS |
| GitHub Issues/Discussions | https://github.com | Bugs et plaintes logiciels publiés |
| Product Hunt | https://www.producthunt.com | Avis et discussions produits numériques |
| G2 | https://www.g2.com | Avis logiciels, plutôt B2B mais utilisateurs finaux |
| Capterra | https://www.capterra.fr | Avis logiciels |
| TrustRadius | https://www.trustradius.com | Avis logiciels |

## 4. E-commerce, marketplaces et avis produits

| Source | Site | Signaux |
|---|---|---|
| Amazon France | https://www.amazon.fr | Notes produits, commentaires, questions |
| Fnac | https://www.fnac.com | Avis et notes produits |
| Darty | https://www.darty.com | Avis produits et service |
| Cdiscount | https://www.cdiscount.com | Notes produits et marchands |
| Rakuten France | https://fr.shopping.rakuten.com | Avis marchands et produits |
| Leboncoin | https://www.leboncoin.fr | Évaluations vendeurs, annonces et retours |
| eBay France | https://www.ebay.fr | Évaluations de vendeurs |
| Etsy France | https://www.etsy.com/fr | Avis boutiques et articles |
| AliExpress | https://fr.aliexpress.com | Avis produits et vendeurs |
| Temu | https://www.temu.com | Avis produits et vendeurs |
| ManoMano | https://www.manomano.fr | Produits et vendeurs bricolage |
| Leroy Merlin | https://www.leroymerlin.fr | Avis produits et vendeurs |
| Castorama | https://www.castorama.fr | Avis produits |
| Brico Dépôt | https://www.bricodepot.fr | Avis produits |
| Boulanger | https://www.boulanger.com | Avis produits |
| Carrefour | https://www.carrefour.fr | Avis produits et services |
| Auchan | https://www.auchan.fr | Avis produits |
| E.Leclerc | https://www.e.leclerc | Retours produits et magasins |
| Decathlon | https://www.decathlon.fr | Avis produits |
| Intersport | https://www.intersport.fr | Avis produits |
| Sephora | https://www.sephora.fr | Avis cosmétiques |
| Nocibé | https://www.nocibe.fr | Avis cosmétiques |
| Marionnaud | https://www.marionnaud.fr | Avis cosmétiques |
| La Redoute | https://www.laredoute.fr | Avis produits et vendeurs |
| Veepee | https://www.veepee.fr | Réputation e-commerce, signaux publics limités |
| Zalando | https://www.zalando.fr | Avis et évaluations produits |
| Back Market | https://www.backmarket.fr | Avis reconditionné et vendeurs |
| CertiDeal | https://www.certideal.com | Avis produits et service |
| LDLC | https://www.ldlc.com | Avis matériel informatique |
| Materiel.net | https://www.materiel.net | Avis matériel informatique |
| Rue du Commerce | https://www.rueducommerce.fr | Avis et vendeurs |
| Idealo France | https://www.idealo.fr | Avis/prix et commerçants selon fiches |
| Google Shopping | https://shopping.google.com | Notes marchands et produits |

## 5. Voyages, hébergement, restauration et loisirs

| Source | Site | Signaux |
|---|---|---|
| Tripadvisor | https://www.tripadvisor.fr | Avis restaurants, hôtels, loisirs |
| Booking.com | https://www.booking.com | Avis hébergements |
| Airbnb | https://www.airbnb.fr | Avis hôtes et logements |
| Expedia | https://www.expedia.fr | Avis hôtels et séjours |
| Hotels.com | https://fr.hotels.com | Avis hôtels |
| Agoda | https://www.agoda.com | Avis hébergements |
| Google Hotels | https://www.google.com/travel/hotels | Notes et évaluations hôtels |
| Trivago | https://www.trivago.fr | Agrégation d'avis hôtels |
| TheFork | https://www.thefork.fr | Avis restaurants |
| Guide Michelin | https://guide.michelin.com/fr/fr | Critiques et recommandations éditoriales |
| Gault & Millau | https://fr.gaultmillau.com | Critiques restauration |
| Petit Futé | https://www.petitfute.com | Avis et guides |
| Yelp | https://www.yelp.fr | Restaurants et services locaux |
| Deliveroo | https://deliveroo.fr | Notes restaurants et retours selon accès |
| Uber Eats | https://www.ubereats.com/fr | Notes restaurants et livraison |
| Just Eat | https://www.just-eat.fr | Notes restauration selon couverture |
| Too Good To Go | https://www.toogoodtogo.com/fr | Notes/retours des paniers selon accès |
| GetYourGuide | https://www.getyourguide.fr | Avis activités et visites |
| Viator | https://www.viator.com/fr-FR | Avis excursions |
| Civitatis | https://www.civitatis.com/fr | Avis activités |
| Trainline | https://www.thetrainline.com/fr | Réputation services de transport |
| BlaBlaCar | https://www.blablacar.fr | Avis conducteurs et covoiturage |
| SNCF Connect | https://www.sncf-connect.com | Réputation du service, avis tiers surtout |
| FlixBus | https://www.flixbus.fr | Réputation du service, avis tiers surtout |
| Camping France | https://www.campingfrance.com | Avis campings |
| Camping2Be | https://www.camping2be.com | Avis campings |
| Gîtes de France | https://www.gites-de-france.com | Avis hébergements |

## 6. Santé, beauté, services à la personne et immobilier

| Source | Site | Signaux et précautions |
|---|---|---|
| Doctolib | https://www.doctolib.fr | Fiches praticiens ; ne pas supposer avis ouverts |
| Maiia | https://www.maiia.com | Fiches praticiens ; données santé sensibles |
| PagesJaunes Santé | https://www.pagesjaunes.fr | Avis publics et fiches professionnels |
| Resalib | https://www.resalib.fr | Avis de praticiens bien-être |
| Médoucine | https://www.medoucine.com | Avis thérapeutes complémentaires |
| Planity | https://www.planity.com | Avis salons beauté et coiffure |
| Treatwell | https://www.treatwell.fr | Avis beauté |
| Kiute | https://www.kiute.fr | Avis beauté et coiffure |
| Fresha | https://www.fresha.com | Avis beauté |
| StarOfService | https://www.starofservice.com | Avis prestataires locaux |
| Travaux.com | https://www.travaux.com | Avis artisans |
| Habitatpresto | https://www.habitatpresto.com | Avis travaux |
| Houzz | https://www.houzz.fr | Avis architectes et décorateurs |
| SeLoger | https://www.seloger.com | Réputation agences surtout à recouper |
| Meilleurs Agents | https://www.meilleursagents.com | Avis et profils d'agences |
| Immodvisor | https://www.immodvisor.com | Avis immobilier |
| Opinion System | https://www.opinionsystem.fr | Avis immobilier |
| Garantme | https://garantme.fr | Réputation de service, avis externes |
| PAP | https://www.pap.fr | Discussions et réputation immobilière |

## 7. Automobile, mobilité, télécoms, finance et assurance

| Source | Site | Signaux |
|---|---|---|
| La Centrale | https://www.lacentrale.fr | Avis concessions et automobiles selon fiches |
| Auto Plus | https://www.autoplus.fr | Essais et commentaires automobiles |
| Caradisiac | https://www.caradisiac.com | Avis propriétaires, forums et essais |
| Forum-Auto | https://forum-auto.caradisiac.com | Retours garages, modèles et marques |
| Oscaro | https://www.oscaro.com | Avis pièces et services |
| Norauto | https://www.norauto.fr | Avis produits et centres |
| Feu Vert | https://www.feuvert.fr | Avis produits et centres |
| Allopneus | https://www.allopneus.com | Avis pneus et montage |
| Vroomly | https://www.vroomly.com | Avis garages |
| idGarages | https://www.idgarages.com | Avis garages |
| Selectra | https://selectra.info | Avis opérateurs et fournisseurs d'énergie |
| Ariase | https://www.ariase.com | Avis télécoms et comparatifs |
| ZoneADSL | https://www.zoneadsl.com | Retours opérateurs et couverture |
| MonPetitForfait | https://www.monpetitforfait.com | Avis/commentaires opérateurs |
| MoneyVox | https://www.moneyvox.fr | Forums banques et assurances |
| LesFurets | https://www.lesfurets.com | Comparaison et retours assurances |
| LeLynx | https://www.lelynx.fr | Comparaison et retours |
| Opinion Assurances | https://www.opinion-assurances.fr | Avis assureurs |
| Banque-info | https://www.banque-info.com | Avis/ressources financières, à vérifier |

## 8. Emploi, réputation employeur et formation

| Source | Site | Signaux |
|---|---|---|
| Glassdoor | https://www.glassdoor.fr | Avis salariés et candidats |
| Indeed | https://fr.indeed.com | Avis employeurs et entretiens |
| ChooseMyCompany | https://choosemycompany.com | Avis collaborateurs, étudiants et candidats |
| Welcome to the Jungle | https://www.welcometothejungle.com/fr | Présence employeur et contenus |
| JobTeaser | https://www.jobteaser.com/fr | Entreprises et retours étudiants |
| GoWork | https://gowork.fr | Discussions et avis entreprises |
| Figaro Emploi | https://emploi.lefigaro.fr | Réputation recrutement, contenus |
| L'Étudiant | https://www.letudiant.fr | Avis formations et écoles |
| Diplomeo | https://diplomeo.com | Avis établissements/formation |
| Studyrama | https://www.studyrama.com | Écoles, classements et commentaires |
| Mon Avis Formation | https://www.monavisformation.fr | Avis formations, couverture à vérifier |

## 9. Presse, médias, blogs et actualités

| Source | Site | Signal à surveiller |
|---|---|---|
| Google Actualités | https://news.google.com | Articles citant une marque |
| Bing News | https://www.bing.com/news | Articles et reprises |
| Google Search | https://www.google.fr | Résultats de recherche et snippets |
| Bing Search | https://www.bing.com | SERP et réputation de marque |
| Qwant | https://www.qwant.com | Résultats de recherche français |
| Brave Search | https://search.brave.com | Résultats indépendants |
| DuckDuckGo | https://duckduckgo.com | Résultats de recherche |
| Le Monde | https://www.lemonde.fr | Articles, enquêtes |
| Le Figaro | https://www.lefigaro.fr | Articles, enquêtes |
| Libération | https://www.liberation.fr | Articles |
| Les Échos | https://www.lesechos.fr | Actualités économiques |
| La Tribune | https://www.latribune.fr | Actualités économiques |
| Franceinfo | https://www.franceinfo.fr | Articles et reportages |
| France 24 | https://www.france24.com/fr | Actualités et vidéos |
| BFMTV | https://www.bfmtv.com | Articles, émissions |
| TF1 Info | https://www.tf1info.fr | Articles et reportages |
| RTL | https://www.rtl.fr | Actualités |
| Europe 1 | https://www.europe1.fr | Actualités |
| Ouest-France | https://www.ouest-france.fr | Réputation locale et nationale |
| La Voix du Nord | https://www.lavoixdunord.fr | Hauts-de-France |
| Nord Éclair | https://www.nordeclair.fr | Presse locale |
| 20 Minutes | https://www.20minutes.fr | Actualités et commentaires selon pages |
| Actu.fr | https://actu.fr | Très nombreux titres locaux |
| La Dépêche | https://www.ladepeche.fr | Occitanie |
| Sud Ouest | https://www.sudouest.fr | Nouvelle-Aquitaine |
| Le Parisien | https://www.leparisien.fr | Île-de-France et national |
| La Provence | https://www.laprovence.com | Provence |
| Le Télégramme | https://www.letelegramme.fr | Bretagne |
| L'Est Républicain | https://www.estrepublicain.fr | Est de la France |
| DNA | https://www.dna.fr | Alsace |
| Le Progrès | https://www.leprogres.fr | Rhône et alentours |
| Mediapart | https://www.mediapart.fr | Enquêtes et articles |
| Rue89 | https://www.rue89.com | Enquêtes/réputations locales selon éditions |
| Presse-citron | https://www.presse-citron.net | Tech et marques |
| Numerama | https://www.numerama.com | Tech et services |
| Frandroid | https://www.frandroid.com | Marques et produits tech |
| Les Numériques | https://www.lesnumeriques.com | Tests, avis et produits |
| Blog du Modérateur | https://www.blogdumoderateur.com | Plateformes et marques numériques |
| Google Alerts | https://www.google.com/alerts | Alertes web, pas base de données autonome |
| Talkwalker Alerts | https://www.talkwalker.com/alerts | Alertes web, intermédiaire |
| GDELT | https://www.gdeltproject.org | Corpus mondial d'actualités et signaux |
| Event Registry | https://eventregistry.org | Agrégation d'actualités, API commerciale |
| RSS des éditeurs | URLs RSS propres à chaque média | Articles et dates, si flux présent |

## 10. Publications officielles, signalements et justice

Ces sources contiennent des faits ou décisions, **pas des notes d'avis consommateurs**. Ne pas qualifier automatiquement une publication de condamnation, faute ou fraude.

| Source | Site | Signal |
|---|---|---|
| RappelConso | https://rappel.conso.gouv.fr | Rappels de produits, fabricants et distributeurs |
| DGCCRF | https://www.economie.gouv.fr/dgccrf | Sanctions publiées, enquêtes, alertes |
| SignalConso | https://signal.conso.gouv.fr | Plateforme de signalement ; plaintes individuelles non publiques |
| Légifrance | https://www.legifrance.gouv.fr | Textes et décisions publiées |
| Judilibre (Cour de cassation) | https://www.courdecassation.fr | Jurisprudence publique et données ouvertes |
| Conseil d'État | https://www.conseil-etat.fr | Décisions publiques |
| CNIL | https://www.cnil.fr | Sanctions et communiqués |
| Autorité de la concurrence | https://www.autoritedelaconcurrence.fr | Décisions et sanctions |
| AMF | https://www.amf-france.org | Alertes et décisions financières |
| ACPR | https://acpr.banque-france.fr | Sanctions bancaires et assurances |
| ANSM | https://ansm.sante.fr | Alertes de sécurité des produits de santé |
| Santé publique France | https://www.santepubliquefrance.fr | Alertes et publications |
| Service-Public | https://www.service-public.fr | Informations publiques, contexte réglementaire |
| BODACC | https://www.bodacc.fr | Événements légaux d'entreprises |
| INPI | https://data.inpi.fr | Identité légale, marques et sociétés |

## 11. Avis logiciels, applications, jeux et culture

| Source | Site | Signaux |
|---|---|---|
| Apple App Store | https://apps.apple.com/fr | Notes, avis et classements applications |
| Google Play | https://play.google.com/store | Notes et avis applications |
| Microsoft Store | https://apps.microsoft.com | Avis applications |
| Steam | https://store.steampowered.com | Avis jeux et discussions |
| Epic Games Store | https://store.epicgames.com | Notes/évaluations jeux selon fonctions |
| Metacritic | https://www.metacritic.com | Critiques presse et utilisateurs |
| OpenCritic | https://opencritic.com | Agrégation de critiques de jeux |
| SensCritique | https://www.senscritique.com | Avis films, séries, livres, jeux |
| Allociné | https://www.allocine.fr | Critiques films, séries et cinémas |
| Letterboxd | https://letterboxd.com | Avis cinéphiles |
| IMDb | https://www.imdb.com | Critiques films et séries |
| Babelio | https://www.babelio.com | Critiques livres et éditeurs |
| Goodreads | https://www.goodreads.com | Critiques livres |
| Booknode | https://booknode.com | Critiques livres |
| Tripadvisor Attractions | https://www.tripadvisor.fr | Avis lieux culturels et attractions |

## 12. Comparateurs, associations et intermédiaires de confiance

| Source | Site | Signaux |
|---|---|---|
| UFC-Que Choisir | https://www.quechoisir.org | Tests, dossiers, actions de consommateurs |
| 60 Millions de consommateurs | https://www.60millions-mag.com | Tests, alertes, articles |
| INC | https://www.inc-conso.fr | Informations et enquêtes consommateurs |
| CEC France | https://www.europe-consommateurs.eu | Alertes transfrontalières |
| Test Achats | https://www.test-achats.be | Avis et tests belges francophones |
| Les Numériques | https://www.lesnumeriques.com | Tests et classements |
| Capital | https://www.capital.fr | Enquêtes entreprises et marques |
| Challenges | https://www.challenges.fr | Réputation des marques et entreprises |
| Selectra | https://selectra.info | Avis énergie et télécoms |
| Idealo | https://www.idealo.fr | Marchands et produits |
| Kelkoo | https://www.kelkoo.fr | Comparaison marchands/produits |
| LeDénicheur | https://ledenicheur.fr | Produits et marchands |
| ShopMania | https://www.shopmania.fr | Marchands et produits |

## 13. SEO, visibilité de marque et moteurs d'IA générative

Ces systèmes constituent un **canal de perception** à mesurer avec des tests reproductibles, non une API de collecte d'avis.

| Source/canal | Site | Signal |
|---|---|---|
| Google Search | https://www.google.fr | SERP de marque, Knowledge Panel, suggestions |
| Bing | https://www.bing.com | SERP, résultats de marque |
| Google Images | https://images.google.com | Photos associées à la marque |
| Google Videos | https://www.google.com | Vidéos indexées sur une marque |
| Google Trends | https://trends.google.fr | Intérêt de recherche, comparaisons |
| Google Search Console | https://search.google.com/search-console | Performance du domaine **possédé** |
| Bing Webmaster Tools | https://www.bing.com/webmasters | Performance du domaine possédé |
| ChatGPT | https://chatgpt.com | Présence, citations, tonalité des réponses IA selon protocole |
| Perplexity | https://www.perplexity.ai | Réponses IA et sources citées |
| Google Gemini | https://gemini.google.com | Réponses et visibilité marque |
| Google AI Overviews | https://www.google.com | Mentions dans résultats enrichis selon disponibilité |
| Microsoft Copilot | https://copilot.microsoft.com | Recommandations et citations IA |
| Claude | https://claude.ai | Mentions dans les réponses IA |
| Mistral Le Chat | https://chat.mistral.ai | Mentions dans les réponses IA |
| DeepSeek Chat | https://chat.deepseek.com | Mentions dans les réponses IA |
| Qwant | https://www.qwant.com | Visibilité moteur francophone |
| Brave Search | https://search.brave.com | Visibilité et citations web |
| Wikidata | https://www.wikidata.org | Entité et données structurées |
| Wikipédia | https://fr.wikipedia.org | Page de marque et références publiques |
| Crunchbase | https://www.crunchbase.com | Fiche entreprise et notoriété startup |
| Similarweb | https://www.similarweb.com | Visibilité et comparaisons web |
| Semrush | https://www.semrush.com | Suivi SEO/mentions via abonnement |
| Ahrefs | https://ahrefs.com | Liens et mentions web via abonnement |
| Sistrix | https://www.sistrix.fr | Visibilité SEO |

## 14. Plateformes professionnelles utiles comme partenaires, pas comme sources brutes

| Service | Site | Rôle possible |
|---|---|---|
| Brandwatch | https://www.brandwatch.com | Social listening et données sous licence |
| Talkwalker | https://www.talkwalker.com | Social listening et veille |
| Mention | https://mention.com | Veille web/social |
| Meltwater | https://www.meltwater.com | Presse et réseaux sociaux |
| Digimind | https://www.digimind.com | Veille et intelligence sociale |
| Hootsuite | https://www.hootsuite.com | Gestion des comptes sociaux |
| Sprout Social | https://sproutsocial.com | Réseaux sociaux et écoute |
| Agorapulse | https://www.agorapulse.com/fr | Gestion commentaires/comptes |
| Buffer | https://buffer.com | Gestion comptes sociaux |
| Birdeye | https://birdeye.com | Gestion avis et réputation |
| Yext | https://www.yext.com | Listings, avis et réputation |
| Partoo | https://www.partoo.co | Présence locale et avis |
| Guest Suite | https://www.guest-suite.com | Gestion avis locale |
| Custplace | https://fr.custplace.com | Collecte et centralisation avis |
| ReviewTrackers | https://www.reviewtrackers.com | Monitoring avis multicanal |
| Reputation | https://reputation.com | Gestion réputation |
| LocalClarity | https://www.localclarity.com | Gestion réputation locale |
| Apify | https://apify.com | Plateforme d'automatisation : vérifier légalité de chaque acteur |

## 15. Sources territoriales françaises à explorer systématiquement

Ne pas fabriquer des milliers d'entrées locales : construire un inventaire **par commune, département, région et métier**, avec des URL réelles validées.

| Famille | Point d'entrée | Contenu |
|---|---|---|
| Presse quotidienne régionale | https://actu.fr | Marques et commerces cités localement |
| Presse locale Hauts-de-France | https://www.lavoixdunord.fr | Couverture Nord/Pas-de-Calais |
| Presse locale Lille/Roubaix | https://www.nordeclair.fr | Entreprises et faits locaux |
| PagesJaunes communes | https://www.pagesjaunes.fr | Avis d'établissements locaux |
| Google Maps par territoire | https://www.google.com/maps | Avis multi-établissements |
| Yelp par territoire | https://www.yelp.fr | Avis de proximité |
| Forums municipaux et associatifs publics | URL à identifier par territoire | Discussions et réputation locale |
| Magazines des collectivités | Sites officiels de chaque collectivité | Mentions éditoriales |
| Offices de tourisme | Portails propres à chaque destination | Prestataires et parfois commentaires |
| Associations de consommateurs régionales | https://www.quechoisir.org | Enquêtes, signalements publiés |
| Groupes sociaux publics locaux | Réseaux sociaux | Retours et recommandations : respecter accès |

## 16. Schéma de données normalisé recommandé

```json
{
  "source_id": "string",
  "source_type": "review|social|forum|news|marketplace|regulatory|search|ai_answer",
  "brand_id": "internal-brand-id",
  "entity_type": "brand|establishment|product|person|service",
  "external_entity_id": "optional-string",
  "external_item_id": "optional-string",
  "canonical_url": "https://example.com/item",
  "published_at": null,
  "observed_at": "ISO-8601",
  "content_excerpt": "only-if-permitted",
  "language": "fr",
  "rating_value": null,
  "rating_scale": null,
  "sentiment_label": "positive|neutral|negative|unknown",
  "sentiment_confidence": null,
  "topic_tags": [],
  "is_verified_purchase": null,
  "author_public_handle": null,
  "response_status": "unanswered|answered|not_applicable|unknown",
  "entity_match_confidence": null,
  "collection_method": "official_api|licensed_feed|authorized_export|manual|other",
  "access_permission": "owned_account|public_licensed|contract|unknown",
  "retention_policy_id": "string"
}
```

## 17. Tests de qualité à prévoir

1. Homonymie : distinguer deux marques identiques de villes différentes.
2. Multi-établissement : relier une agence précise à sa marque sans confondre les notes.
3. Déduplication : le même avis syndiqué sur plusieurs sites ne compte pas plusieurs fois sans signalement.
4. Modification/suppression : traiter avis édités, supprimés, archivés, droits d'effacement et obsolescence.
5. Sources ambiguës : ne pas interpréter une simple mention d'un nom comme un avis client.
6. Données sensibles : appliquer des protections renforcées pour santé, personnes, enfants et données personnelles.
7. Accès : distinguer comptes administrés et surveillance concurrentielle publique.
8. Réponse : ne publier aucune réponse automatiquement sans choix/autorisation explicite du client.
9. Sentiment : inclure négation, ironie, multilingue, notes sans texte et contexte.
10. IA/GEO : répéter les interrogations, journaliser les prompts, modèles, dates, pays, réponses et citations ; ne pas confondre sortie IA et fait avéré.

## 18. Documentation de départ

- Google Business Profile Reviews API : https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews
- Google Business Profile API Policies : https://developers.google.com/my-business/content/policies
- Trustpilot API : https://developers.trustpilot.com/
- Trustpilot Data Solutions : https://developers.trustpilot.com/data-solutions-get-started
- DGCCRF, avis en ligne : https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/avis-en-ligne-attention-aux-faux-commentaires
- France Num, avis clients : https://www.francenum.gouv.fr/guides-et-conseils/protection-contre-les-risques/gestion-de-la-reputation-de-lentreprise/les-avis

**Portée et limites :** catalogue étendu pour le marché français, non exhaustif de tout site ou groupe local. L'inscription d'une plateforme ne garantit ni API, ni accès légal, ni avis publics, ni couverture de toutes les marques. À faire valider par l'agent avant intégration. **Aucune priorité d'intégration imposée.**
