# Catalogue des sources B2B françaises — GrowthOS

Version : 27 novembre 2026  
Objet : inventaire à transmettre à un agent de développement pour étudier les connecteurs de découverte, identification et enrichissement d'entreprises françaises.

## Consignes à l'agent

- **Aucune priorité d'intégration n'est imposée.** Évaluer librement faisabilité, valeur, couverture, qualité, coûts, quotas, licences et maintenance, puis proposer l'ordre pertinent.
- Distinguer découverte de prospects, identification légale, enrichissement de coordonnées, données sectorielles et signaux commerciaux.
- Vérifier pour **chaque** source la disponibilité actuelle, l'URL, l'API officielle, les conditions de réutilisation, les limitations et les frais éventuels avant intégration.
- « Site accessible » ne veut **pas** dire « scraping ou réutilisation autorisés ». Ne pas contourner restrictions d'accès, CAPTCHA ou limites contractuelles.
- Toute fiche enrichie doit conserver les sources, les URL de preuve, les dates de consultation, et un niveau de confiance par champ.
- Rapprocher les données par SIRET/SIREN lorsque possible, sinon par combinaison **nom normalisé + ville + adresse + activité**. Ne jamais associer une fiche sur la seule ressemblance du nom.
- Ne pas inventer de données. Marquer les champs absents comme inconnus ; contrôler les doublons avant import et proposer une fusion non destructive.
- Les mentions d'accès ci-dessous sont **indicatives**, pas une confirmation d'autorisation API ou d'extraction.

## 1. Référentiels officiels, administrations et open data

| Source | Site | Informations utiles | Type d'accès à contrôler |
|---|---|---|---|
| INSEE Sirene | https://www.insee.fr/fr/information/3591226 | SIREN, SIRET, statut, établissements, APE, effectifs | API et fichiers ouverts |
| Annuaire des Entreprises | https://annuaire-entreprises.data.gouv.fr | Identité, adresses, établissements, données légales | Recherche et API |
| API Recherche d'Entreprises | https://recherche-entreprises.api.gouv.fr/docs/ | Recherche par nom, territoire, activité et identifiants | API ouverte |
| data.gouv.fr | https://www.data.gouv.fr | Jeux de données publics variés | Open data, licences par jeu |
| INPI Data | https://data.inpi.fr | Documents et données d'entreprises | Consultation et services de données |
| Registre national des entreprises (RNE) | https://registre-national-entreprises.inpi.fr | Immatriculations, mandataires, formalités | Accès selon services |
| Infogreffe | https://www.infogreffe.fr | RCS, actes, bilans, dirigeants | Gratuit/payant |
| BODACC | https://www.bodacc.fr | Créations, ventes, procédures collectives | Données ouvertes/API |
| BOAMP | https://www.boamp.fr | Marchés publics, appels d'offres, attributions | API ouverte |
| PLACE | https://www.marches-publics.gouv.fr | Marchés publics de l'État | Consultation publique |
| API Entreprise | https://entreprise.api.gouv.fr | Attestations et données administratives | **Accès réglementé, non libre pour la prospection** |
| CCI — Annuaire des Entreprises de France | https://www.aef.cci.fr | Entreprises par territoire et activité | Recherche / offres commerciales |
| CCI France | https://www.cci.fr | Annuaires, services et réseaux régionaux | Variable par CCI |
| Chambres de métiers et de l'artisanat | https://www.artisanat.fr | Réseaux et artisans | Variable |
| Base Adresse Nationale | https://adresse.data.gouv.fr | Normalisation et géocodage d'adresses | Open data / API |
| Annuaire des associations | https://www.journal-officiel.gouv.fr | Associations et annonces légales | Consultation / données ouvertes |
| Répertoire national des associations | https://www.data.gouv.fr | Identifiants et associations | Jeu de données ouvert |
| Données essentielles de la commande publique | https://www.data.gouv.fr | Acheteurs, titulaires et montants publics | Jeux de données ouverts |

## 2. Bases généralistes d'entreprises et prospection

| Source | Site | Informations utiles | Type d'accès à contrôler |
|---|---|---|---|
| PagesJaunes | https://www.pagesjaunes.fr | Contacts, établissements, activités, horaires | Site/accord commercial |
| Google Maps | https://www.google.com/maps | Établissements, coordonnées, avis, horaires | Google Maps Platform et conditions strictes |
| Google Search | https://www.google.fr | Sites officiels, mentions publiques | Recherche / solutions autorisées |
| Bing Search | https://www.bing.com | Recherche de sites et mentions d'entreprises | Recherche / offre autorisée |
| Bing Maps | https://www.bing.com/maps | Entreprises locales | Services selon conditions |
| Société.com | https://www.societe.com | Dossiers légaux, dirigeants, comptes | Site / contrat |
| Pappers | https://www.pappers.fr | Données légales, comptes, dirigeants | API / offres |
| Verif | https://www.verif.com | Société, finances, bilan | Site / contrat |
| Manageo | https://www.manageo.fr | Données commerciales et financières | Offres commerciales |
| Kompass | https://fr.kompass.com | B2B, fabricants, fournisseurs, segmentation | Offres commerciales |
| Europages | https://www.europages.fr | Fournisseurs, fabricants, distributeurs | Plateforme commerciale |
| Societeinfo | https://societeinfo.com | Données et contacts d'entreprises | API / contrat |
| Corporama | https://corporama.com | Prospection et contacts | Contrat |
| Pharow | https://www.pharow.com | Segmentation et données B2B | Contrat |
| Nomination | https://www.nomination.fr | Dirigeants et décideurs | Contrat |
| Sparklane | https://www.sparklane.fr | Signaux d'affaires et prospection | Contrat |
| Ellisphere | https://www.ellisphere.com | Risque et informations financières | Contrat |
| Altares | https://www.altares.com | Données financières et commerciales | Contrat |
| Creditsafe | https://www.creditsafe.com/fr/fr.html | Solvabilité et données entreprises | Contrat/API selon offre |
| LinkedIn | https://www.linkedin.com | Sociétés, pages, employés | Accès plateforme restreint |
| LinkedIn Sales Navigator | https://business.linkedin.com/sales-solutions | Ciblage de comptes et décideurs | Abonnement, restrictions |
| Apollo | https://www.apollo.io | Contacts professionnels | Abonnement/API selon offre |
| Kaspr | https://www.kaspr.io | Coordonnées professionnelles | Abonnement |
| Dropcontact | https://www.dropcontact.com | Enrichissement d'emails et contacts | API commerciale |
| Hunter | https://hunter.io | Domaines et emails professionnels | API commerciale |
| Lusha | https://www.lusha.com | Contacts B2B | Abonnement |
| Cognism | https://www.cognism.com | Contacts B2B | Contrat |
| RocketReach | https://rocketreach.co | Coordonnées professionnelles | Abonnement |
| Annuaire Entreprises France (privé) | https://annuaire-entreprises-france.fr | Établissements classés par secteurs | Site, droits à vérifier |
| Réseau Actif | https://reseauactif.fr/annuaire/ | Entreprises locales multi-secteurs | Site, droits à vérifier |

## 3. BTP, travaux et artisans

| Source | Site | Informations utiles |
|---|---|---|
| QUALIBAT | https://www.qualibat.com/annuaire-entreprises-qualifiees | Qualification métiers et RGE |
| CAPEB | https://www.capeb.fr | Artisans du bâtiment |
| Artisans du Bâtiment | https://www.artisans-du-batiment.com | Artisans adhérents CAPEB |
| FFB | https://www.ffbatiment.fr | Fédérations et entreprises du bâtiment |
| FNTP | https://www.fntp.fr | Travaux publics |
| France Rénov' RGE | https://france-renov.gouv.fr/annuaire-rge/recherche | Entreprises RGE par travaux/territoire |
| Qualit'EnR | https://www.qualit-enr.org/annuaire/ | Énergies renouvelables et RGE |
| Qualifelec | https://www.qualifelec.fr | Installateurs électriques qualifiés |
| OPQIBI | https://www.opqibi.com | Bureaux d'études et ingénierie |
| Certibat | https://www.certibat.fr | Certification bâtiment |
| Batiment.eu | https://batiment.eu | Répertoire de professionnels du BTP |
| Batiproduits | https://www.batiproduits.com | Fabricants/fournisseurs matériaux |
| Batiactu | https://www.batiactu.com | Sociétés, projets et actualités BTP |
| Batiweb | https://www.batiweb.com | Professionnels et fournisseurs |
| Obat | https://www.obat.fr | Artisans du bâtiment |
| Travaux.com | https://www.travaux.com | Artisans par spécialité et localité |
| Habitatpresto | https://www.habitatpresto.com | Artisans et travaux |
| Houzz France | https://www.houzz.fr | Architecture et rénovation |
| Archiliste | https://www.archiliste.fr | Architectes |
| Ordre des architectes | https://www.architectes.org | Professionnels inscrits |
| Construction21 | https://www.construction21.org/france/ | Acteurs du bâtiment durable |

## 4. Industrie, fabrication et sous-traitance

| Source | Site | Informations utiles |
|---|---|---|
| DirectIndustry | https://www.directindustry.fr | Fournisseurs et fabricants industriels |
| L'Usine Nouvelle | https://www.usinenouvelle.com | Industriels, sites et actualités |
| Industrie Explorer | https://www.industrie-explorer.com | Données d'établissements industriels |
| France Industrie | https://www.franceindustrie.org | Fédérations industrielles |
| La French Fab | https://www.lafrenchfab.fr | Industriels de l'écosystème |
| CETIM | https://www.cetim.fr | Mécanique et sous-traitance |
| UIMM | https://uimm.fr | Métallurgie |
| France Chimie | https://www.francechimie.fr | Industrie chimique |
| FIM | https://www.fim.net | Industries mécaniques |
| France Clusters | https://franceclusters.fr | Clusters et entreprises adhérentes |
| Nuclear Valley | https://www.nuclearvalley.com | Filière nucléaire |
| Aerospace Valley | https://www.aerospace-valley.com | Aéronautique/spatial |
| GIFAS | https://www.gifas.fr | Aéronautique et défense |
| Minalogic | https://www.minalogic.com | Électronique et numérique industriel |

## 5. Transport et logistique

| Source | Site | Informations utiles |
|---|---|---|
| FNTR | https://www.fntr.fr | Transport routier |
| Union TLF | https://www.e-tlf.com | Transport et logistique |
| OTRE | https://www.otre.org | Transporteurs routiers |
| France Logistique | https://www.francelogistique.fr | Filière logistique |
| Supply Chain Magazine | https://www.supplychainmagazine.fr | Prestataires logistiques |
| FAQ Logistique | https://www.faq-logistique.com | Fournisseurs/prestataires |
| Transport Info | https://www.transportinfo.fr | Transport et entreprises |
| L'Officiel des transporteurs | https://www.officiel-des-transporteurs.com | Transporteurs et actualités |
| France Mobilités | https://www.francemobilites.fr | Acteurs de la mobilité |
| Transport.data.gouv.fr | https://transport.data.gouv.fr | Jeux de données de mobilité |
| Flotauto | https://www.flotauto.com | Flottes automobiles |
| B2PWeb | https://www.b2pweb.com | Transport et bourse de fret |

## 6. Immobilier

| Source | Site | Informations utiles |
|---|---|---|
| SeLoger | https://www.seloger.com | Agences immobilières |
| Logic-Immo | https://www.logic-immo.com | Agences/annonceurs |
| Bien'ici | https://www.bienici.com | Agences et promoteurs |
| Leboncoin Immobilier | https://www.leboncoin.fr | Professionnels de l'immobilier |
| FNAIM | https://www.fnaim.fr | Réseau d'agences |
| SNPI | https://www.snpi.fr | Professionnels immobiliers |
| UNIS | https://www.unis-immo.fr | Syndics et gestionnaires |
| Meilleurs Agents | https://www.meilleursagents.com | Agences |
| Belles Demeures | https://www.bellesdemeures.com | Agences spécialisées |
| Propriétés Le Figaro | https://proprietes.lefigaro.fr | Immobilier haut de gamme |
| Immo Matin | https://www.immomatin.com | Acteurs de l'immobilier |

## 7. Commerces, restauration, hôtellerie et tourisme

| Source | Site | Informations utiles |
|---|---|---|
| TripAdvisor | https://www.tripadvisor.fr | Hôtels, restaurants, avis |
| TheFork | https://www.thefork.fr | Restaurants |
| Petit Futé | https://www.petitfute.com | Établissements locaux |
| Guide Michelin | https://guide.michelin.com/fr/fr | Restaurants/hôtels |
| Gault & Millau | https://fr.gaultmillau.com | Restaurants |
| Booking | https://www.booking.com | Hébergements |
| Logis Hôtels | https://www.logishotels.com | Hôteliers |
| Atout France | https://www.atout-france.fr | Écosystème touristique |
| Registre Atout France | https://registre-operateurs-de-voyages.atout-france.fr | Opérateurs de voyages immatriculés |
| Gîtes de France | https://www.gites-de-france.com | Hébergements |
| Clévacances | https://www.clevacances.com | Hébergements |
| RestoConnection | https://www.restoconnection.fr | Restauration professionnelle |
| UMIH | https://www.umih.fr | Hôtellerie-restauration |
| GHR | https://www.ghr.fr | Hôtellerie et restauration |

## 8. Santé et médico-social

| Source | Site | Informations utiles |
|---|---|---|
| Annuaire Santé | https://annuaire.esante.gouv.fr | RPPS, FINESS, structures et spécialités |
| FINESS | https://finess.esante.gouv.fr | Établissements sanitaires et sociaux |
| Annuaire santé Ameli | https://annuairesante.ameli.fr | Professionnels et établissements |
| Doctolib | https://www.doctolib.fr | Cabinets et praticiens |
| Maiia | https://www.maiia.com | Praticiens et structures |
| Ordre des médecins | https://www.conseil-national.medecin.fr | Médecins inscrits |
| Ordre des pharmaciens | https://www.ordre.pharmacien.fr | Pharmaciens |
| Ordre des infirmiers | https://www.ordre-infirmiers.fr | Infirmiers |
| Ordre des chirurgiens-dentistes | https://www.ordre-chirurgiens-dentistes.fr | Dentistes |
| FHF | https://www.fhf.fr | Hôpitaux |
| FEHAP | https://www.fehap.fr | Santé et médico-social privé solidaire |
| SYNERPA | https://www.synerpa.fr | EHPAD et structures privées |

## 9. Agriculture, agroalimentaire et environnement

| Source | Site | Informations utiles |
|---|---|---|
| Annuaire Agence Bio | https://annuaire.agencebio.org | Agriculteurs, transformateurs, distributeurs ; API publique |
| Chambres d'agriculture | https://chambres-agriculture.fr | Organisations et exploitations |
| La France Agricole | https://www.lafranceagricole.fr | Secteur agricole |
| Terre-net | https://www.terre-net.fr | Agriculteurs/fournisseurs |
| Agriaffaires | https://www.agriaffaires.com | Vendeurs de matériel |
| Agriconomie | https://www.agriconomie.com | Fournisseurs agricoles |
| Vignerons Indépendants | https://www.vigneron-independant.com | Domaines viticoles |
| Interbev | https://www.interbev.fr | Filières élevage/viande |
| La Coopération Agricole | https://www.lacooperationagricole.coop | Coopératives |
| ANIA | https://www.ania.net | Industrie agroalimentaire |
| Actu-Environnement | https://www.actu-environnement.com | Entreprises environnementales |
| Pollutec | https://www.pollutec.com | Exposants et fournisseurs environnement |

## 10. Services, numérique, formation et recrutement

| Source | Site | Informations utiles |
|---|---|---|
| Malt | https://www.malt.fr | Freelances et agences |
| Sortlist | https://www.sortlist.fr | Agences marketing et communication |
| La Fabrique du Net | https://www.lafabriquedunet.fr | Agences et prestataires numériques |
| Clutch | https://clutch.co | Agences et services informatiques |
| France Num | https://www.francenum.gouv.fr | Activateurs numériques |
| Numeum | https://numeum.fr | Entreprises du numérique |
| French Tech | https://lafrenchtech.gouv.fr | Écosystème startup |
| France Digitale | https://francedigitale.org | Startups et investisseurs |
| Welcome to the Jungle | https://www.welcometothejungle.com/fr | Entreprises employeuses |
| France Travail | https://www.francetravail.fr | Employeurs et offres |
| HelloWork | https://www.hellowork.com | Employeurs et offres |
| APEC | https://www.apec.fr | Entreprises recrutant des cadres |
| OPCO Atlas | https://www.opco-atlas.fr | Branches et organismes liés |
| Centre Inffo | https://www.centre-inffo.fr | Formation professionnelle |
| Mon Compte Formation | https://www.moncompteformation.gouv.fr | Organismes et offres de formation |
| France Compétences | https://www.francecompetences.fr | Organismes et certifications |

## 11. Réseaux sociaux, annuaires locaux et cartographie

| Source | Site | Informations utiles |
|---|---|---|
| Facebook | https://www.facebook.com | Pages d'entreprises, coordonnées, liens |
| Instagram | https://www.instagram.com | Comptes d'entreprises, sites |
| TikTok | https://www.tiktok.com | Comptes professionnels |
| Yelp | https://www.yelp.fr | Commerces, avis, coordonnées |
| Mappy | https://fr.mappy.com | Entreprises locales |
| Apple Plans | https://maps.apple.com | Établissements locaux |
| OpenStreetMap | https://www.openstreetmap.org | Points d'intérêt et commerces ; licence ODbL |
| HERE | https://www.here.com | Données cartographiques et lieux |
| Hoodspot | https://hoodspot.fr | Entreprises locales |
| Justacoté | https://www.justacote.com | Commerces et avis |
| Cylex France | https://www.cylex-locale.fr | Annuaire de professionnels |
| Gralon | https://www.gralon.net | Sites et établissements |
| 118000 | https://www.118000.fr | Coordonnées téléphoniques |
| 118712 | https://www.118712.fr | Annuaire téléphonique |
| Réseau Actif | https://reseauactif.fr/annuaire/ | Entreprises et artisans locaux |

## Modèle attendu pour la fiche technique de chaque connecteur

1. `source_id`, nom, URL, catégorie, couverture géographique, secteurs.
2. Méthode d'accès **vérifiée** : API documentée, open data, export autorisé, partenariat commercial, consultation manuelle ou non intégrable.
3. Authentification, coût, quotas, limites, droits de stockage et de redistribution, fréquence de mise à jour.
4. Champs réellement disponibles : SIREN/SIRET, nom légal, enseigne, adresse, commune/CP, NAF/APE, effectifs, site, email, téléphone, horaires, avis, dirigeants, certifications, réseaux sociaux.
5. Stratégie de rapprochement et score de confiance (aucune correspondance forcée).
6. Gestion des erreurs, statut d'enrichissement, provenance par champ, déduplication et tests automatisés.
7. Évaluation autonome par l'agent de la faisabilité et de l'ordre d'intégration, **sans priorité prédéfinie par ce fichier**.

## Références documentaires de départ

- INSEE Sirene : https://www.insee.fr/fr/information/3591226
- API Recherche d'Entreprises : https://recherche-entreprises.api.gouv.fr/docs/
- Sources de l'Annuaire des Entreprises : https://annuaire-entreprises.data.gouv.fr/donnees/sources
- API BOAMP : https://www.data.gouv.fr/dataservices/api-bulletin-officiel-des-annonces-des-marches-publics-boamp
- Annuaire Santé : https://esante.gouv.fr/produits-services/annuaire-sante
- Annuaire Bio : https://annuaire.agencebio.org

## 12. Annuaires et réseaux territoriaux

Les CCI régionales donnent parfois accès à des **fichiers spécifiques** qui ne sont pas des sources juridiquement indépendantes d'AEF. Ne pas les compter comme de nouvelles entreprises sans dédoublonnage.

| Source | Site | Couverture et valeur |
|---|---|---|
| CCI Hauts-de-France | https://hautsdefrance.cci.fr | Entreprises et filières Hauts-de-France |
| CCI Business Hauts-de-France | https://hautsdefrance.ccibusiness.fr | Cartographies fournisseurs et filières |
| CCI Grand Lille | https://grand-lille.cci.fr | Métropole de Lille |
| CCI Bretagne | https://www.bretagne.cci.fr | Fichiers régionaux d'entreprises |
| CCI Normandie | https://www.normandie.cci.fr | Entreprises normandes |
| CCI Grand Est | https://www.grandest.cci.fr | Réseaux et entreprises du Grand Est |
| CCI Paris Île-de-France | https://www.entreprises.cci-paris-idf.fr | Services et répertoires franciliens |
| CCI Auvergne-Rhône-Alpes | https://www.auvergne-rhone-alpes.cci.fr | Fichiers et annuaires régionaux |
| CCI Lyon Métropole | https://www.lyon-metropole.cci.fr | Entreprises métropolitaines |
| CCI Nouvelle-Aquitaine | https://www.nouvelle-aquitaine.cci.fr | Entreprises régionales |
| CCI Occitanie | https://www.occitanie.cci.fr | Filières et entreprises d'Occitanie |
| CCI Pays de la Loire | https://www.paysdelaloire.cci.fr | Entreprises ligériennes |
| CCI Provence-Alpes-Côte d'Azur | https://www.paca.cci.fr | Entreprises du Sud-Est |
| CCI Bourgogne-Franche-Comté | https://www.bourgognefranchecomte.cci.fr | Entreprises et filières régionales |
| CCI Centre-Val de Loire | https://www.centre.cci.fr | Réseaux territoriaux |
| CCI Corse | https://www.cci.corsica | Entreprises corses |
| CCI Réunion | https://www.reunion.cci.fr | Entreprises réunionnaises |
| CCI Guadeloupe | https://www.guadeloupe.cci.fr | Entreprises guadeloupéennes |
| CCI Martinique | https://www.martinique.cci.fr | Entreprises martiniquaises |
| CCI Guyane | https://www.guyane.cci.fr | Entreprises guyanaises |
| CCI Mayotte | https://www.mayotte.cci.fr | Entreprises mahoraises |
| MEL — Métropole Européenne de Lille | https://www.lillemetropole.fr | Économie et zones d'activités |
| Métropole de Lyon | https://www.grandlyon.com | Activités et implantation d'entreprises |
| Bordeaux Métropole | https://www.bordeaux-metropole.fr | Réseaux économiques locaux |
| Nantes Métropole | https://metropole.nantes.fr | Tissu économique local |
| Aix-Marseille-Provence | https://ampmetropole.fr | Territoires et zones d'activités |
| Toulouse Métropole | https://metropole.toulouse.fr | Économie et entreprises |
| Strasbourg Eurométropole | https://www.strasbourg.eu | Tissu économique local |
| France Clusters | https://franceclusters.fr | Identification de pôles et adhérents |
| AFPC — pôles de compétitivité | https://www.afpc.eu | Pôles et écosystèmes sectoriels |
| French Tech Lille | https://www.lafrenchtech-lille.com | Startups locales |
| Euratechnologies | https://www.euratechnologies.com | Startups incubées et écosystème |
| EuraMaterials | https://euramaterials.eu | Matériaux, textiles, industrie |
| Euralogistic | https://www.euralogistic.com | Logistique Hauts-de-France |
| Plaine Images | https://www.plaine-images.fr | Industries créatives et médias |
| Réseau Entreprendre | https://www.reseau-entreprendre.org | Lauréats et entreprises accompagnées |
| Initiative France | https://www.initiative-france.fr | Entreprises financées localement |
| Bpifrance Le Hub | https://lehub.bpifrance.fr | Startups et écosystèmes d'innovation |

## 13. Fédérations, syndicats et ordres professionnels complémentaires

**Attention :** un site de fédération n'offre pas nécessairement la liste de ses adhérents ; l'agent doit vérifier l'existence effective d'un répertoire avant toute proposition de connecteur.

| Source | Site | Filière cible |
|---|---|---|
| MEDEF | https://www.medef.com | Fédérations professionnelles et réseaux patronaux |
| CPME | https://www.cpme.fr | PME et fédérations |
| U2P | https://u2p-france.fr | Entreprises de proximité |
| Fédération des entreprises de propreté (FEP) | https://www.federation-proprete.com | Nettoyage et facility management |
| GES | https://ges-securite-privee.org | Entreprises de sécurité privée |
| Fédération française de la sécurité privée | https://www.ffsp.fr | Sécurité privée |
| Fédération des services énergie environnement (FEDENE) | https://www.fedene.fr | Énergie et services techniques |
| Fédération des ascenseurs | https://www.ascenseurs.fr | Ascenseurs et maintenance |
| FICIME | https://www.ficime.com | Équipements industriels et machines |
| FIEEC | https://www.fieec.fr | Électrique, électronique, numérique |
| SERCE | https://www.serce.fr | Génie électrique et énergétique |
| SYNTEC | https://www.syntec.fr | Ingénierie, conseil, numérique |
| Syntec Ingénierie | https://www.syntec-ingenierie.fr | Bureaux d'études et ingénierie |
| Cinov | https://www.cinov.fr | Conseil, ingénierie, numérique |
| Fédération des industries du béton | https://www.fib.org | Fabricants béton |
| France Bois Forêt | https://franceboisforet.fr | Filière forêt-bois |
| Fibois France | https://fibois-france.fr | Interprofessions bois régionales |
| France Plastiques | https://www.polyvia.fr | Plasturgie et composites |
| FHER | https://www.fher.org/qui-sommes-nous/annuaire-adherents/ | Fabricants hygiène et entretien ; annuaire identifié |
| FEBEA | https://www.febea.fr | Cosmétique |
| LEEM | https://www.leem.org | Industrie du médicament |
| SNITEM | https://www.snitem.fr | Technologies médicales |
| FEVAD | https://www.fevad.com | E-commerce et vente à distance |
| Fédération du commerce et de la distribution | https://www.fcd.fr | Enseignes et distributeurs |
| Confédération des buralistes | https://www.buralistes.fr | Débits de tabac |
| Conseil national des barreaux | https://www.cnb.avocat.fr | Avocats |
| Annuaire des avocats | https://www.avocat.fr | Cabinets et avocats |
| Conseil supérieur du notariat | https://www.notaires.fr | Études notariales |
| Ordre des experts-comptables | https://www.experts-comptables.org | Cabinets comptables |
| Ordre des géomètres-experts | https://www.geometre-expert.fr | Cabinets de géomètres |
| Conseil national de l'ordre des vétérinaires | https://www.veterinaire.fr | Vétérinaires et établissements |
| FFEPGV | https://ffepgv.fr | Associations et clubs sportifs |
| COSMED | https://www.cosmed.fr | Industrie cosmétique |
| Alliance 7 | https://www.alliance7.com | Industries alimentaires spécialisées |

## 14. Salons professionnels et catalogues d'exposants

Les listes d'exposants sont **des sources événementielles**, parfois internationales et souvent temporaires. Qualifier les entreprises françaises et vérifier les droits de réutilisation.

| Événement | Site | Secteur |
|---|---|---|
| Batimat | https://www.batimat.com | BTP et matériaux |
| Intermat | https://paris.intermatconstruction.com | Construction et engins |
| Artibat | https://www.artibat.com | Bâtiment |
| Nordbat | https://www.nordbat.com | Bâtiment Hauts-de-France |
| Global Industrie | https://www.global-industrie.com | Industrie et sous-traitance |
| SEPEM Industries | https://www.sepem-industries.com | Industrie régionale |
| MIDEST | https://www.global-industrie.com | Sous-traitance industrielle (marque historique intégrée à Global Industrie) |
| SIAL Paris | https://www.sialparis.com | Agroalimentaire |
| CFIA Rennes | https://www.cfiaexpo.com | Fournisseurs agroalimentaires |
| Sirha Lyon | https://www.sirha-lyon.com | Hôtellerie-restauration |
| EquipHotel | https://www.equiphotel.com | Hôtellerie |
| SITL | https://www.sitl.eu | Transport et logistique |
| Supply Chain Event | https://www.supplychain-event.com | Supply chain et logiciels |
| Pollutec | https://www.pollutec.com | Environnement |
| EnerGaïa | https://www.energaia.fr | Énergies renouvelables |
| BePOSITIVE | https://www.bepositive-events.com | Énergie et bâtiment |
| Hyvolution | https://paris.hyvolution.com | Hydrogène |
| Equip Auto | https://www.equipauto.com | Automobile et équipementiers |
| Solutrans | https://www.solutrans.fr | Véhicules industriels |
| Autonomic | https://www.autonomic-expo.com | Handicap et accessibilité |
| SantExpo | https://www.santexpo.com | Santé et établissements |
| PharmagoraPlus | https://www.pharmagoraplus.com | Pharmacies |
| SIMI | https://www.salonsimi.com | Immobilier d'entreprise |
| RENT | https://www.rent.immo | Proptech et immobilier |
| MIPIM | https://www.mipim.com | Immobilier international, présence française |
| Première Vision | https://www.premierevision.com | Textile et mode |
| Maison&Objet | https://www.maison-objet.com | Décoration et mobilier |
| JEC World | https://www.jec-world.events | Matériaux composites |
| Eurosatory | https://www.eurosatory.com | Défense et sécurité |
| Milipol | https://www.milipol.com | Sécurité intérieure |
| VivaTech | https://vivatechnology.com | Startups et technologie |
| Big Data & AI Paris | https://www.bigdataparis.com | Logiciels, data et IA |
| Salon des Entrepreneurs / Go Entrepreneurs | https://www.go-entrepreneurs.com | PME et services professionnels |
| Salon International de l'Agriculture | https://www.salon-agriculture.com | Agriculture |
| SPACE | https://www.space.fr | Élevage |
| Sommet de l'Élevage | https://www.sommet-elevage.fr | Agriculture et élevage |
| Wine Paris | https://wineparis.com | Vins et spiritueux |
| Vinitech-Sifel | https://www.vinitech-sifel.com | Viticulture |

## 15. Bases administratives spécialisées et signaux B2B

| Source | Site | Données potentielles et remarques |
|---|---|---|
| Liste publique des organismes de formation (DGEFP) | https://www.data.gouv.fr/datasets/liste-publique-des-organismes-de-formation-l-6351-7-1-du-code-du-travail | Organismes, SIRET, adresse, Qualiopi ; données ouvertes |
| API QuiForme | https://www.data.gouv.fr/dataservices/api-quiforme | Habilitations d'établissements de formation ; vérifier éligibilité |
| Annuaire de l'éducation nationale | https://data.education.gouv.fr | Établissements scolaires et identifiants UAI |
| Base FINESS | https://finess.esante.gouv.fr | Établissements sanitaires et médico-sociaux |
| Liste établissements RGE (ADEME) | https://www.data.gouv.fr | Certifications RGE ; localiser le jeu officiel |
| Agence Bio API | https://annuaire.agencebio.org | Opérateurs certifiés bio ; API publique référencée |
| Registre des opérateurs de voyages Atout France | https://registre-operateurs-de-voyages.atout-france.fr | Agences et opérateurs agréés |
| Répertoire des métiers et qualifications | https://www.francecompetences.fr | Organismes et certifications ; accès à vérifier |
| Répertoire des installateurs IRVE Qualifelec | https://www.qualifelec.fr | Qualifications électriciens et bornes électriques |
| Registre des transporteurs | https://www.ecologie.gouv.fr | Licences et entreprises de transport ; trouver publication territoriale |
| Annuaire des diagnostiqueurs immobiliers certifiés | https://diagnostiqueurs.din.developpement-durable.gouv.fr | Diagnostiqueurs et certifications |
| Annuaire des entreprises de l'ESS | https://www.data.gouv.fr | Entreprises économie sociale et solidaire |
| Base des entreprises du patrimoine vivant | https://www.data.gouv.fr | Entreprises labellisées |
| Base des installations classées (ICPE) | https://www.georisques.gouv.fr | Sites industriels réglementés |
| Géorisques | https://www.georisques.gouv.fr | Installations, sites et risques |
| Géolocalisation des établissements Sirene | https://www.data.gouv.fr | Coordonnées géographiques par établissement |
| BALO | https://www.journal-officiel.gouv.fr | Annonces légales financières |
| Base de subventions publiques | https://www.data.gouv.fr | Associations et bénéficiaires ; jeux selon publication |
| API Marché de l'inclusion | https://lemarche.inclusion.beta.gouv.fr | Structures d'insertion ; accès à vérifier |
| Entreprises adaptées et ESAT | https://www.reseau-gesat.com | Prestataires inclusifs |
| Index égalité professionnelle | https://www.data.gouv.fr | Entreprises publiant l'index, signaux RH |

## 16. Méthodologie de couverture exhaustive progressive

1. Examiner chaque région, département, EPCI et grande ville pour les annuaires de CCI, zones industrielles, associations de commerçants, technopoles et parcs d'activités.
2. Parcourir les fédérations par code NAF et les organismes de qualification par métier : les index d'organisations ne sont pas nécessairement des annuaires de membres.
3. Relever les salons nationaux **et régionaux**, la disponibilité des annuaires d'exposants et la date d'édition.
4. Séparer les bases officielles originales des sites qui les republient : éviter de multiplier les doublons d'une même donnée Sirene.
5. Tenir un registre vivant des sources découvertes avec `statut_validation`, `date_verification`, `conditions_reutilisation`, `api_documentation`, `dernier_test`, `couverture`, `champs_constates` et `motif_refus`.
6. Ne jamais annoncer une couverture absolument exhaustive : le périmètre local et les sites privés évoluent sans cesse.

**Périmètre** : inventaire étendu de pistes, non prétendu exhaustif de tous les annuaires français ni vérification individuelle des droits de réutilisation. Certaines sources sont des fédérations, médias, moteurs, marketplaces ou réseaux pouvant donner accès à des entreprises, et non des bases extractibles directement.
