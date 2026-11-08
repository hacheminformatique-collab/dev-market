# React + Vite

## Vérification de publication sous la limite PHP de 30 secondes

La publication vérifie les HTML existants par lots de **25 pages maximum**
au lieu de parcourir plusieurs milliers de fichiers dans une seule requête
`static-publish.php`. Le registre et l'ensemble des fichiers sont vérifiés
avant la première écriture ; les contrôles de hash, les migrations et le
refus des fichiers corrompus restent actifs. La progression affiche le nombre
de fichiers examinés pendant cette préparation. Un registre modifié entre
deux lots interrompt la publication pour protéger les fichiers.

Les réponses PHP vides ou tronquées affichent maintenant l'opération et le
statut HTTP plutôt que `Unexpected end of JSON input`. Déployer ensemble
`api/static-publish.php` et les nouveaux assets de `dist/`, puis recharger
l'administration pour utiliser la vérification par lots. Le correctif
n'augmente pas `max_execution_time` et ne crée pas de tâche en arrière-plan.

## Correctif mémoire PHP des pages villes

Les écritures, migrations, sauvegardes et lectures des collections de pages
villes fonctionnent désormais par blocs, sans décoder ni réencoder toutes
les pages et les cinq snapshots en mémoire. Le format JSON existant et les
clés de stockage ne changent pas. Les sauvegardes conservent les cinq versions
les plus récentes ; les fichiers sont validés avant remplacement et écrits
atomiquement sous les mêmes verrous.

Ce correctif évite l'erreur `Allowed memory size of 268435456 bytes exhausted`
dans `city-page-storage.php`. Il est vérifié avec 3640 pages et un fichier de
cinq sauvegardes dépassant 256 Mo, sous `memory_limit=256M`, avec un pic PHP
inférieur à 32 Mo pour les opérations testées. Il n'augmente pas la limite
mémoire de l'hébergeur. Un champ individuel dépassant 16 Mo est refusé avec
une erreur explicite, sans écraser le stockage.

Déployer ensemble **`api/city-page-storage.php`**, **`api/storage.php`** et le
nouveau helper **`api/city-json-stream.php`** (également présents dans `dist/`).
Ne supprimer ni les collections `storage-data/paradise_city_pages*.json`,
ni les HTML publiés. La copie des sauvegardes reste proportionnelle à leur
taille sur disque ; ce changement ne crée aucun traitement en arrière-plan.

## Forfaits tout compris et suivi administratif

**Formules** permet de créer un forfait à prix global ou de convertir une
formule existante en cochant **Forfait à prix global**. Cocher **Menus**,
**Gâteaux** ou **Prestations** ajoute un écran de configuration pour choisir
les éléments autorisés de chaque catalogue. Une catégorie activée exige au
moins un élément disponible. Les anciennes formules non converties conservent
leur fonctionnement et leurs tarifs séparés.

**Calendrier > Grille tarifaire saison / jour** permet de renseigner les six
prix globaux TTC par formule : basse saison (décembre–mars), haute saison
(avril–novembre), dimanche–jeudi, vendredi et samedi. Zéro est accepté ; les
valeurs vides, négatives ou non finies sont refusées. Un nouveau forfait sans
tarif pour la date choisie ne peut pas être réservé. Retirer une formule de
la grille la masque seulement : ses tarifs et sa fiche sont conservés, et
elle peut être réaffichée.

Le client ne voit que les étapes activées et les choix autorisés. Les menus
gardent un choix par section (jusqu'à trois boissons), le gâteau un choix,
et les prestations plusieurs choix facultatifs. Tous ces choix sont
**inclus dans le forfait, sans supplément**, indépendamment des tarifs du
catalogue et du nombre d'invités. Le panier, le récapitulatif, le PDF, l'espace
client et la comptabilité utilisent le même calcul. Le prix, les inclusions
et la ventilation de TVA sont copiés dans le devis : modifier ultérieurement
une formule ou sa grille ne recalcule pas les devis enregistrés. Les promotions
journalières historiques de location sèche ne remplacent pas le prix d'un forfait.

Lorsqu'un forfait inclut de la restauration, renseigner explicitement la
**part du prix global soumise à TVA 10%**, en pourcentage ; le reste utilise
20%. Faire confirmer cette ventilation par votre comptable. Elle ne se déduit
pas des prix des catalogues et ne change pas le total TTC du forfait.

**Prospect** propose une note interne modifiable et une suppression confirmée.
La note reste privée et n'est pas envoyée au client. La suppression efface les
coordonnées de ce suivi et conserve un marqueur privé pour éviter qu'un ancien
formulaire ne le recrée ; elle ne supprime aucun devis associé. Les écritures
partagent le verrou du suivi et exigent une session administrateur avec CSRF.

**Mes Infos > Maintenance devis** suspend uniquement les nouvelles demandes,
indépendamment de la maintenance générale. Les formulaires autonomes et intégrés
affichent un message ; les API refusent aussi les étapes et l'enregistrement
d'un nouveau devis, même depuis un ancien onglet. Le site, les devis existants
et leur signature restent disponibles. Le formulaire attend la confirmation
serveur avant d'annoncer l'enregistrement d'un devis, sans mise en file d'attente
d'une demande refusée. Aucun cron ni traitement métier en arrière-plan n'est ajouté.

Déployer tout `dist/`, y compris la nouvelle API `quote-access.php`,
les API modifiées et les nouveaux assets. Préserver
les données métier et `storage-data/site-controls.json` lors du déploiement.

## Maintenance, adresse administrative et purge

**Mes Infos > Maintenance du site** ferme les pages publiques sauf l'accueil.
Les HTML existants ne sont ni effacés ni redirigés vers une page indexable :
les URL indisponibles répondent **503** avec `Retry-After`. Les assets nécessaires
à l'accueil et robots.txt restent servis. La connexion administrative, le
dashboard et les API d'une session administrative restent accessibles.
Les API publiques autres que les réglages de l'accueil sont bloquées.
Rouvrir le site avant de publier/vérifier les URL HTML publiques.

**Code PIN > Adresse privée de l'administration** choisit un chemin de 8 à
80 caractères (minuscules, chiffres, tirets), par exemple `/gestion-paradise`.
La connexion est à cette adresse et le dashboard à son suffixe `/dashboard`.
Les anciennes URL `/admin` et `/dashboard` répondent 404. Le chemin n'est pas
inséré dans les pages publiques ni dans robots.txt ; les pages administratives
ont un en-tête `X-Robots-Tag: noindex`. Notez votre nouvelle adresse avant de
la modifier. La discrétion d'une URL ne remplace pas l'authentification.

Le PIN est vérifié côté PHP, avec trois erreurs autorisées avant un blocage
de dix minutes par IP et une session HttpOnly/SameSite. Les réglages publics
ne renvoient plus le PIN. Les nouvelles opérations de maintenance, changement
d'adresse et purge exigent cette session ; reconnectez-vous après déploiement
si votre ancien onglet n'avait qu'une authentification locale.

**Back-up > Purge des données** propose une suppression par onglet et
**Tout purger**, avec saisie obligatoire de `PURGER`. Aucune purge réelle n'est
faite lors du déploiement. Exportez les deux sauvegardes (données métier et
pages/blog) avant de l'utiliser : il n'y a pas de sauvegarde automatique de
purge. Terminez la synchronisation et fermez les autres administrations pour
éviter de réenregistrer leurs copies anciennes. Utilisez de préférence la
maintenance pour éviter l'arrivée de nouvelles demandes pendant la purge.

- Clients & Devis : clients, documents, reçus, prospects et affectations.
- Calendrier : événements manuels, promotions/ajustements et affectations ;
  les devis restent enregistrés avec leur date mais ne réservent plus le
  calendrier. Une nouvelle signature/validation réactive leur réservation.
- Comptabilité : paiements et reçus ; les devis conservés sont exclus des
  calculs jusqu'à un nouveau paiement, une signature ou une validation.
- Staff, Stock, Matières premières, Formules, Menus, Gâteaux, Prestations :
  collections correspondantes ; Staff retire aussi les affectations.
- Pages salle de mariage : données, configuration, galerie, sauvegardes,
  HTML villes/départements, registre et annuaires, avec retrait du sitemap.
  Les anciennes adresses ne restent pas accessibles.
- Tout purger : toutes ces catégories, les autres types de pages villes et
  le blog avec ses sauvegardes. Mes Infos, le PIN administrateur, l'adresse administrative
  et l'état de maintenance sont conservés.

Les écritures sont atomiques et partagent les verrous existants du stockage
et de la publication. Une erreur de stockage ou de suppression est explicite ;
en cas d'erreur disque en cours d'opération, vérifier les données avant de
relancer (la purge n'est pas une transaction multi-fichiers).
Les collections vides sont enregistrées, pas simplement effacées, afin que
les anciens caches et les valeurs d'exemple ne les recréent pas au rechargement.

Le dashboard charge les composants d'onglet à la demande et seulement leurs
données nécessaires : cinq clés pour Clients & Devis au lieu de seize au
démarrage, sans second rafraîchissement complet immédiat. Les rafraîchissements
périodiques suivent l'onglet actif et conservent l'espacement réseau de 650 ms.
À la réouverture d'un onglet, les données âgées de plus de 30 secondes sont relues.
Back-up ne charge toutes les données métier que lors de leur export.

Déployer **tout `dist/`**, notamment `api/site-admin.php`, `site-controls.php`,
`site-guard.php`, `site-router.php`, `data-purge.php`, les API modifiées et
`.htaccess`. Préserver `storage-data/site-controls.json` et le fichier racine
`site-maintenance.flag` lors des déploiements suivants, comme les données métier.
Pour récupérer une adresse oubliée, lire `site-controls.json` directement sur
le serveur ; pour une désactivation manuelle, mettre `maintenance` à `false`
et supprimer uniquement le fichier `site-maintenance.flag`.

## Identifiants postaux et prospects

Toutes les pages villes utilisent désormais `ville-codepostal`, par exemple
`meaux-77100`. Les homonymes restent distincts : `villeroy-77410` (77) et
`villeroy-89100` (89). Les liens, canonical, sitemap, fichiers mariage et clés
de stockage suivent cette identité dans les six familles de pages.
Les anciennes sauvegardes restent importables : les clés sont normalisées
sans modifier leurs textes. Une copie déjà enregistrée sous une clé postale
est prioritaire sur la copie historique du même identifiant.

Après déploiement complet de `dist/`, lancer **Publier / actualiser les pages**.
La génération et la publication sauvegardent les collections à migrer, puis renomment leurs clés
côté serveur par lots de 250 correspondances, sans retransmettre les contenus.
Les anciens HTML absents d'une sauvegarde restaurée sont copiés à leur nouvelle
adresse en conservant leur contenu ; les fichiers historiques ne sont pas supprimés.
Les fichiers postaux existants restent protégés contre l'écrasement concurrent.
Le registre `wedding-city-aliases.json` et `api/city-redirect.php` redirigent
les anciennes adresses en HTTP 301 après publication. Préserver ce registre,
les HTML et les anciens assets lors des déploiements suivants.
Sans métadonnées permettant de distinguer un homonyme, une ancienne clé seule
désigne sa commune historique, c'est-à-dire la première occurrence du catalogue.
Un contenu déjà écrasé avant ce correctif ne peut être récupéré que depuis
une sauvegarde qui le contient.

Dans la sélection d'un département, **Pages non générée** choisit seulement
les villes sans contenu généré, sans changer les sélections des autres départements.
L'onglet **Prospect** liste uniquement les nouveaux suivis ayant validé les
coordonnées et l'événement (étapes 1 et 2), mais pas la formule (étape 3).
Un devis finalisé est exclu ; un retour arrière ne réintroduit pas une demande
plus avancée. Ces demandes peuvent être encore en cours, sans délai d'abandon
supposé. Les anciens journaux ne permettent pas de reconstruire les coordonnées.
`api/prospects.php` exige une session administrative et ne met pas les résultats en cache ;
les dossiers restent dans le stockage privé `storage-data/quote-followups/`.
La validation de l'étape 1 enregistre le parcours sans envoyer d'e-mail.
Après l'enregistrement de l'étape 2, un seul e-mail « Nouveau prospect » est
envoyé par parcours, même si le navigateur réessaie ou si les coordonnées
évoluent ; les notifications déjà prévues pour les étapes suivantes restent
inchangées.

Le formulaire intégré réinitialise sa couleur de texte pour éviter l'héritage
blanc des sections villes, notamment pour DJ. Utiliser **Publier / actualiser
les pages** pour fournir ce nouveau code aux HTML sauvegardés avec d'anciens assets.

## Notifications push administrateur

**Mes Infos > Notifications administrateur** permet d'activer les alertes sur
chaque appareil : nouveaux prospects, devis non signés, devis signés et,
facultativement, une visite par navigateur pseudonyme/jour. Les visites sont
désactivées par défaut. Sur iPhone, utiliser iOS 16.4 minimum et HTTPS, ouvrir
Mes Infos dans Safari après connexion, ajouter l'administration à l'écran
d'accueil, puis ouvrir cette icône et toucher **Activer**. L'autorisation iOS
est obligatoire. Les notifications peuvent arriver application fermée ; la
génération et la publication, elles, nécessitent toujours un onglet ouvert et
un écran actif. Aucun cron ni tâche de fond n'est installé.

Déployer tout `dist/`, y compris `api/push-runtime/vendor/`, les manifestes,
icônes, `admin-push-sw.js` et `.htaccess`. L'hébergement doit fournir PHP 8.2+
avec curl, openssl et mbstring, et autoriser les connexions HTTPS sortantes.
Composer n'est pas nécessaire sur l'hébergement. Préserver le dossier privé
`storage-data/admin-push/` (clés VAPID et abonnements) entre déploiements :
ses fichiers ne doivent jamais être accessibles publiquement. Dix appareils
maximum peuvent s'abonner. Les préférences restent actives après déconnexion,
mais ouvrir une notification exige toujours l'accès administrateur.

Les alertes ne contiennent aucune identité client. Les échecs d'envoi sont
journalisés sans bloquer le devis ; aucun renvoi automatique n'est effectué.
La réception réelle sur iPhone doit être vérifiée après déploiement en créant
un prospect avec l'application fermée. Les réglages Concentration, le réseau
ou la révocation des permissions peuvent retarder ou empêcher les alertes.
Voir `public/api/push-runtime/INSTALL.md` pour les prérequis et contrôles.

## Mesure d'audience et intégrations sociales

L'onglet **Statistiques**, sous **Mes Infos**, affiche les pages vues, une
estimation des navigateurs uniques par jour, les moyennes des 7, 30 et 90
derniers jours et les pages les plus consultées. Les mesures commencent après
le déploiement de cette version ; aucun trafic antérieur ne peut être recréé.
Un identifiant aléatoire du navigateur est renouvelé chaque jour ; le serveur
ne conserve que son empreinte datée, les totaux de pages et aucune adresse IP.
Les robots courants et les espaces client/staff ne sont pas comptés. Les
statistiques sont conservées au maximum 400 jours et la mesure peut être
désactivée dans **Politique de confidentialité**.

Les URL de publications/Reels Instagram et de vidéos TikTok publiques sont
affichées dans la présentation de la ville. Instagram utilise son embed officiel
direct, sans fausse barre de profil ni de boutons d'interaction simulés ; les
commandes J'aime/partage dépendent de ce que la plateforme expose dans son
lecteur intégré. Pour mettre à jour le rendu HTML déjà publié, déployer `dist/`,
puis choisir **Publier / actualiser les pages** dans l'onglet des pages
mariage : cette action remplace les fichiers statiques après confirmation.

## Protection contre les rafales LWS

Les écritures et les appels des lots de génération/publication passent par une
file commune : au moins 650 ms entre départs (moins de deux appels par seconde),
sans burst ni appels concurrents dans cette file. Les lectures nécessaires à
l'affichage public sont immédiates et n'attendent pas la file administrative.
`batchFetch` ou l'option `paced: true` inclut également les lectures de
vérification dans le rythme du lot. Sur HTTPS avec Web Locks, les onglets du même navigateur
partagent aussi le rythme et la suspension via le stockage local. Si Web Locks
est indisponible, utiliser un seul onglet d'administration (avertissement console).
Les lectures identiques de `api/storage.php` sont regroupées et conservées
5 secondes ; les écritures invalident ce cache, et les lectures de sécurité
avant génération restent fraîches.

Le rafraîchissement automatique attend au moins 30 secondes **après** la fin
du cycle précédent, uniquement dans un onglet visible. Les initialisations et
cycles simultanés sont regroupés. Un HTTP 429/509 suspend les appels en attente
pendant au moins une minute, sans nouvelle tentative automatique du même appel ;
le blocage de l'IP peut durer davantage et nécessiter le support LWS.

Cette limite concerne les requêtes contrôlées par JavaScript, pas les fichiers
CSS/JS/images/vidéos, navigations, autres navigateurs ou appareils partageant l'IP.
Elle ne garantit donc pas un plafond global par IP. Après déploiement complet de
`dist/`, fermer les anciens onglets, rouvrir une seule administration et attendre
la levée du blocage avant toute génération/publication. Conserver les anciens
assets nécessaires aux pages statiques et utiliser, si souhaité, **Mettre à jour
le modèle des pages** pour leur fournir également le nouveau code réseau.

L'accueil et les pages légales ne chargent que les réglages nécessaires ; les
données du dashboard ne sont plus chargées avant chaque page publique.
Leur présentation s'affiche sans attendre la lecture des réglages, actualisés
ensuite en arrière-plan.
Les pages HTML statiques affichent leur contenu immédiatement et hydratent
leurs interactions sans initialiser les seize clés de l'administration.
Le catalogue du devis est chargé à l'ouverture du formulaire intégré.

## Accès publics et estimation

L'en-tête, au-dessus de la vidéo, propose **DEMANDER UN DEVIS**, **ESPACE CLIENT**
et **ESPACE STAFF**, sur ordinateur et mobile. Les deux espaces ont une page
d'accès dédiée, avec le numéro de devis ou le matricule et le PIN existants.
Aucun lien vers l'administration/dashboard n'est affiché ; saisir `/admin`
ou `/dashboard` manuellement. Masquer les liens ne remplace pas l'authentification.
L'estimation de tarif des pages villes est placée avant les sections éditoriales.

## Génération automatique des pages mariage depuis les modèles

Les pages mariage sont générées **sans IA, sans clé API et sans coût d'API**.
La base `src/data/weddingSourceModels.json` contient exactement vingt modèles,
un par archive MHTML fournie dans `model.zip`, avec nom du fichier source,
empreinte SHA-256, nombre de substitutions et huit sections éditoriales complètes.
`src/data/weddingSourceLayouts.json` conserve leurs éléments et styles
éditoriaux : cartes, icônes, titres, listes et étapes de réservation, rendus
par React sans scripts issus des captures. Le vérificateur compare les vingt
layouts aux fichiers MHTML d'origine :
`python tools/import-wedding-layouts.py /chemin/model.zip --check`.
Les textes sauvegardés de version 2
retrouvent cette présentation à la republication ; les modifications compatibles
de paragraphes sont conservées. Une modification structurelle impossible à
rattacher au modèle est signalée avant toute écriture du lot, jamais remplacée
silencieusement par le texte d'origine.

Chaque génération choisit un modèle entier parmi les vingt et deux extraits
d'avis. Aucun paragraphe n'est mélangé ou réécrit et l'ordre source est conservé.
Les marqueurs `xxxx` et `yyyy` sont remplacés par la ville et son département.
Le marqueur historique `${businessName}` est résolu en `Le Paradise 77` ; les
autres mentions de l'établissement restent celles des fichiers fournis.
Le texte et la sélection
des avis sont sauvegardés avec la version du modèle et sa graine aléatoire :
ils ne changent pas lors d'une visite, d'une publication ou d'une restauration.
Une régénération volontaire peut choisir un autre modèle (ou le même).
Les sections transcrites sont : présentation, pourquoi choisir, prestations,
réservation, capacité, lieux, conseils et FAQ. Menus, champs de formulaire,
galerie, carte, actualités, blog et annuaire restent les composants interactifs
du site, pas des copies figées des widgets source. Pour ces nouveaux modèles,
les sections éditoriales intégrées ne sont pas ajoutées une seconde fois.
Les questions des FAQ conservent leur ordre source, avec accordéons accessibles
et réponses présentes dans le HTML initial. Les réponses absentes des captures
sont reprises du composant FAQ d'origine lorsqu'elles correspondent à la question,
sans inventer de nouveaux engagements commerciaux.

La capacité **jusqu'à 300 personnes**, le traiteur, le service, la décoration
et le DJ sont repris des exemples après accord du propriétaire. Les prestations
retenues restent à confirmer au devis. L'adresse réelle reste Nanteuil-lès-Meaux dans l'en-tête, l'accès et les données
structurées. Les modèles reprennent les formulations commerciales demandées.
Leurs distances, durées et descriptions locales restent celles des sources :
les vérifier avant publication ; la substitution seule ne les actualise pas.
L'avertissement visible demandé a été retiré, ainsi que la phrase de distance
calculée dans la section d'accès local. La carte conserve l'adresse réelle et
le lien vers un itinéraire actualisé.
Le champ historique « Mots clés SEO » reste compatible, mais ne modifie pas les
textes mariage contrôlés. Les anciens types de pages conservent leur modèle local.
Le blog et son automatisation ne sont pas modifiés par ce remplacement.

Les sept avis identifiés sont de courts extraits inchangés des captures fournies.
La capture sans auteur ni note n'est pas utilisée. Les noms affichés et les notes
sont conservés ; aucune date exacte n'est déduite des mentions « il y a un mois ».
Les avis sont présentés comme des avis Google sur Le Paradise, avec un lien vers
la fiche, sans leur attribuer une ville d'origine ni ajouter de note globale ou
de balisage de notation. Les mêmes avis peuvent apparaître sur plusieurs pages.

Dans **Pages salle de mariage > Sélection villes**, sélectionner les villes puis
utiliser **Générer depuis les modèles**. Le remplacement des pages existantes
demande confirmation ; une sauvegarde est créée avant génération. Chaque page
est enregistrée immédiatement sur le serveur. Si la lecture, la sauvegarde ou
l'écriture serveur échoue, un message explicite arrête le lot : les pages déjà
enregistrées sont conservées. Les villes non sélectionnées ne sont pas modifiées.

La génération envoie uniquement la ville courante à `api/city-page-storage.php`,
qui fusionne la page sous verrou avec le fichier JSON existant. La taille des
requêtes ne croît plus avec le nombre de villes. Les cinq dernières sauvegardes
sont créées côté serveur, sans renvoyer leurs snapshots depuis le navigateur.
Le format des fichiers et des restaurations reste compatible. Les appels
conservent l'espacement de 650 ms et l'arrêt sur limitation de l'hébergement.
Les erreurs affichent le statut HTTP et, si disponible, le détail PHP.
Déployer ce nouvel endpoint avec le front-end et `api/storage.php`, puis
recharger le dashboard. Le compte PHP doit pouvoir créer les verrous et fichiers
temporaires dans `storage-data/`. Les gros fichiers JSON sont toujours lus et
écrits côté serveur : vérifier aussi les quotas disque et mémoire PHP si une
erreur persiste. Ce changement ne modifie pas les fichiers HTML déjà publiés.

Après fusion, déployer tout `dist/`, puis générer et **republier les pages HTML**
pour afficher les nouveaux textes et avis. Les anciens textes ne sont jamais
réécrits automatiquement, y compris les témoignages éventuellement présents.
Après restauration, republier pour synchroniser les fichiers statiques.
L'ancien endpoint `api/openai-generate.php` renvoie désormais HTTP 410, afin
de désactiver aussi l'ancienne version lors d'un transfert par écrasement.
La variable `OPENAI_API_KEY` et le fichier privé OpenAI ne sont plus nécessaires
aux pages villes ; supprimer la configuration privée si aucun autre outil
ne l'utilise. Les sauvegardes et les fichiers HTML existants restent compatibles.

Plusieurs villes peuvent utiliser le même modèle : l'unicité et un classement
Google ne sont pas garantis. Les anciens seuils de diversité de paragraphes ne
s'appliquent plus au choix demandé de vingt textes complets. Les tests vérifient
le nombre exact de modèles, leur sélection et la fidélité du texte à la source
après les seules substitutions prévues. Les pages et sauvegardes de version 1
restent lisibles sans réécriture ; régénérer puis republier pour adopter la version 2.

## Titres et descriptions des pages mariage

Les métadonnées des pages villes mariage suivent ces modèles :

- Titre : `Le Paradise 0184196949 | Salle de mariage Meaux 77100`
- Description : `Vous recherchez une salle de mariage à Meaux 77 ? Découvrez notre salle de réception a proximité de seine et marne, idéale pour célébrer votre mariage. Contactez-nous pour réserver une salle de mariage et obtenir un devis personnalisé à Meaux !`

Les noms de villes dans ces métadonnées sont sans accents ni ponctuation :
`Nanteuil-lès-Meaux` devient `Nanteuil les Meaux`. Les noms des départements
sont également normalisés, en minuscules. Le nom et le téléphone du titre sont
ceux du modèle demandé, indépendamment du nom configuré pour les autres contenus.
Les noms de villes affichés et injectés dans les nouveaux textes sont également
sans accents ni ponctuation. Les URL et adresses structurées restent inchangées ;
les anciens textes sauvegardés sont conservés et normalisés à l'affichage.
Déployer puis utiliser **Publier / actualiser les pages** pour actualiser
les métadonnées des pages enregistrées dont le HTML utilise un ancien modèle.
Après restauration, publier les pages dont les données ont changé.

`src/data/wedding-postcodes.json` contient les codes postaux par département
et slug, sans requête externe au chargement. Source : base officielle La Poste
(Licence Ouverte), distribuée par Etalab dans
`sources/codes-postaux.json`, version
`9814e676cd05e23d4d8dddffdfc1df1f5cadb291` du 2 mars 2026.
Les anciens noms et communes déléguées sont rapprochés à l'aide des champs
postaux du fichier `20230823-communes-departement-region.csv` du dépôt
`mohamed-badaoui/communes-de-france-base-des-codes-postaux`, version
`56b411009c5af32f10c000cdf82ccb50ca6c7de0`, également issu de La Poste.
Les codes historiques retenus sont encore présents dans la base 2026 pour
le département concerné. Les arrondissements parisiens utilisent leurs codes
75001 à 75020. Pour plusieurs codes valides, un seul est affiché : le premier
dans l'ordre numérique, sans prétendre qu'il s'agit du code principal.
Les URL homonymes conservent la première commune résolue par le site.

## Annuaire public et SEO local

Après publication, les pages villes affichent **Location salle de mariage près
de <ville>** ; l'accueil conserve son titre générique. L'annuaire est classé
par département puis par nom de commune, en colonnes adaptées au mobile. Les
liens utilisent le texte et l'attribut `title`
`Location salle de mariage <ville>`. Les liens textuels n'ont pas d'attribut
`alt` : cet attribut concerne les images, dont les descriptions identifient
la salle réelle à Nanteuil-lès-Meaux.

Seules les pages mariage publiées sont incluses. Le bouton de publication
vérifie les URL, puis écrit `wedding-directory.html`, `wedding-pages.json` et
insère l'annuaire dans `index.html` et dans le HTML de chaque page ville.
Les liens sont accessibles sans JavaScript. Après publication de nouvelles
villes, les fichiers existants sont modifiés pour actualiser leur annuaire,
sans reconstruire le reste de leur page. Lors de la migration des anciennes
pages, leur ancien annuaire React est conservé mais masqué pour préserver les
interactions de leurs anciens fichiers JavaScript ; le nouvel annuaire visible
est directement inscrit dans le HTML. Les espaces privés et l'administration ne
l'affichent pas. La génération SEO depuis Mes Infos filtre les pages mariage
sur le registre de publication ; le devis, marqué `noindex`, n'est pas dans
le sitemap.

La publication actualise aussi les métadonnées de l'accueil dans `index.html`.
Les pages villes ont des titres et descriptions ciblés, un fil d'Ariane, des
données `LocalBusiness` / `EventVenue` et `Service`, avec l'adresse réelle
(5 avenue Fridingen, 77100 Nanteuil-lès-Meaux), et une image de la salle plutôt
que le favicon. La carte pointe vers la salle, pas vers une implantation
fictive dans la ville recherchée. L'accès local renvoie vers un itinéraire
actualisé sans distance calculée affichée. Les FAQ utilisent
`details` / `summary` : leurs réponses sont dans le HTML même sans JavaScript.

Les modèles locaux utilisent un vocabulaire maîtrisé, sans quota de mots-clés
ni informations locales ou avis inventés. Les textes déjà
sauvegardés ne sont pas réécrits automatiquement : relisez-les et corrigez les
informations non vérifiées avant de republier. La salle reste située à
Nanteuil-lès-Meaux, même lorsque la page s'adresse aux habitants d'une autre ville.

**Déployer tout `dist/`, puis lancer la publication des pages mariage.** Le compte PHP doit
pouvoir remplacer `index.html` en plus des fichiers de publication précédents.
Conserver `wedding-directory.html`, `wedding-pages.json`, les contenus et les
anciens assets tant qu'une page publiée les utilise ; relancer la publication
après un déploiement remplaçant `index.html` ou après restauration pour
réinsérer l'annuaire et actualiser les contenus modifiés.
Si le modèle `index.html` est ancien, la publication est refusée avec un message
explicite. Aucune page départementale supplémentaire ni ancienne URL n'est
créée/supprimée par ce changement : les départements organisent l'annuaire.

Ces améliorations facilitent l'exploration et la pertinence locale, mais ne
garantissent pas un top 3. Mesurer les impressions, clics, positions et pages
indexées dans Search Console après déploiement.

## Bandeau vidéo des pages publiques

Le bandeau utilise la même vidéo sur l'accueil, les pages villes de tous les
types, la liste et les articles du blog, le devis et les trois pages légales.
L'administration, les espaces client/staff et le formulaire de devis intégré
dans une page ville ne reçoivent pas de bandeau supplémentaire.

Les fichiers partagés sont `public/media/hero-paradise.mp4` et
`public/media/hero-paradise.jpg`, copiés dans `dist/media/` à la compilation.
La vidéo fournie est réencodée en H.264, 960 x 540, 25 images/seconde, sans son
et sans modification de sa durée (environ 50 secondes), avec les métadonnées
MP4 en tête pour permettre la lecture progressive. Elle pèse environ 4,2 Mo
contre 7,7 Mo pour l'original ; l'image d'attente pèse environ 116 Ko.

L'image est affichée immédiatement, y compris sans JavaScript. La vidéo est
muette, en boucle, adaptée au mobile et chargée seulement après un délai de
800 ms, lorsque le bandeau est visible. La lecture automatique est désactivée
si l'utilisateur préfère réduire les animations ou active l'économie de
données. Le bouton permet une lecture volontaire ou une pause ; la lecture
s'arrête lorsque le bandeau sort de l'écran ou que l'onglet est masqué. En cas
d'échec, l'image reste visible et un message explicite est affiché.

Déployer tout `dist/`, notamment `media/`. Les sauvegardes de contenus
antérieures restent compatibles : elles utilisent le modèle actuel après
restauration. Utiliser **Publier / actualiser les pages** après le déploiement
si les fichiers HTML existants ne contiennent pas encore le bandeau.
Les anciens fichiers HTML ne sont pas modifiés automatiquement ; restaurer
un ancien fichier HTML complet rétablira son ancien aspect.

## Publication des pages mariage

L'administration ne propose plus que l'onglet **Pages salle de mariage**.
Les contenus sauvegardés et les anciennes URL des autres types restent disponibles.

Dans **Pages salle de mariage > Sélection villes**, le bouton
**Générer** conserve la génération et la sauvegarde des villes sélectionnées,
sans publication automatique. **Publier / actualiser les pages** applique le
modèle compilé actuel, les réglages SEO et la galerie, sans régénérer les textes
ni les avis. Aucun second bouton de mise à jour du modèle n'est nécessaire.
Le HTML cible est comparé à l'empreinte du fichier existant : les fichiers
identiques ne sont ni réécrits ni vérifiés par une nouvelle requête HTTP.
Chaque fichier nouvellement écrit contient dès le premier passage le pied de
page complet du lot. L'annuaire général et le sitemap sont finalisés à la fin
de la même opération ; aucune deuxième publication manuelle n'est nécessaire.
Gardez le navigateur ouvert pour générer et publier : aucun cron ni traitement
en arrière-plan n'est installé. Relancer après une interruption conserve les
fichiers déjà écrits et ignore ceux qui sont maintenant identiques.
Les pages déjà publiées absentes d'une sauvegarde restaurée restent dans le
registre et l'annuaire tant que leur fichier existe.

L'inspection reconnaît les anciennes balises JSON dont les attributs sont
réordonnés ou utilisent des apostrophes, et les collections facultatives
absentes. Un HTML sans données valides de publication reste bloqué pour ne
pas écraser son contenu. Pour une erreur telle que `paris-1er-75001`, conserver
le fichier et vérifier son bloc `city-page-data` ; ne pas supprimer le fichier
pour contourner ce contrôle. Le correctif de compatibilité ne garantit pas
la récupération d'un fichier réellement corrompu.

La publication crée également **16 pages département**, pour les huit
départements d'Île-de-France et l'Aisne (02), l'Eure (27), l'Eure-et-Loir (28),
le Loiret (45), la Marne (51), l'Oise (60), la Seine-Maritime (76) et l'Yonne (89).
Elles sont enregistrées dans `locationsalledemariage/departements/<code>.html`
et accessibles sans extension à `/locationsalledemariage/departements/<code>`.
Leur contenu, leur canonical et leur liste de communes sont présents en HTML.
Les titres département dans l'annuaire pointent vers ces pages et le sitemap
les référence après publication. Le registre `wedding-departments.json` permet
à Mes Infos de conserver ces URL lors d'une nouvelle génération du sitemap.
Une page département inchangée n'est ni réécrite ni vérifiée par une nouvelle
requête HTTP.

L'annuaire général et celui des villes d'Île-de-France conservent toutes les
communes publiées. Sur une page ville hors Île-de-France, l'annuaire de pied de
page ne liste que les communes publiées de son propre département. Une page
département liste également uniquement ses communes ; aucun lien vers une
commune non publiée n'est ajouté.

Le bandeau supérieur de l'accueil propose **BLOG** juste après **ESPACE STAFF** ;
ce lien supplémentaire n'est pas ajouté aux bandeaux des autres pages.
La liste du blog et tous ses articles affichent uniquement l'annuaire des
départements et communes publiées d'Île-de-France. La publication crée
`wedding-directory-idf.html` ; Apache sert les routes `/blog` et `/blog/...`
via `api/blog-shell.php`, qui insère ce fragment dans le HTML initial.
La navigation côté navigateur charge le même fragment régional.
Déployer `.htaccess` et `api/blog-shell.php`, puis lancer une publication
des pages mariage pour créer ou actualiser ce fragment. Aucune republication
des fichiers ville inchangés n'est nécessaire pour cette modification du blog.

Après une mise à jour du modèle du site, le bouton distinct **Mettre à jour le
modèle des pages** demande confirmation avant de remplacer les fichiers des
pages sauvegardées, même si leurs textes n'ont pas changé. Utilisez-le seulement
si vous souhaitez appliquer ce nouveau modèle aux anciennes pages. Les pages
non présentes dans la sauvegarde ne sont pas remplacées.

La vidéo des en-têtes occupe au moins une hauteur d'écran, comme sur l'accueil.
Les boutons superposés de l'accueil sont retirés, mais les accès du bandeau
supérieur restent disponibles. Les quatre thèmes de l'accueil s'affichent sur
une ligne à partir de 1100 px, en deux lignes de deux entre 600 et 1099 px et
sur une colonne en dessous. Le baptême utilise l'icône bébé.
Les blocs génériques « Témoignages » des modèles ne sont plus affichés :
les extraits d'avis Google conservés présentent le nom, la note, les étoiles
jaunes et le texte dans une carte blanche. Ce ne sont pas des avis chargés
en direct depuis Google.
Pour appliquer ces changements visuels aux fichiers de villes existants,
utiliser **Publier / actualiser les pages** après le déploiement.

Chaque ville possède un fichier physique
`locationsalledemariage/<ville>.html`, servi à l'adresse existante
`/locationsalledemariage/<ville>`. Le fichier contient le texte complet, la
galerie, les liens, les métadonnées et la canonical avant toute exécution de
JavaScript. JavaScript conserve les interactions (galerie et formulaire de
devis), mais n'est pas nécessaire à la lecture du contenu.

### Hébergement et utilisation

- Exécuter `npm run build` et déployer **tout le contenu de `dist/`**, y compris
  `static-city.html`, les fichiers `assets/`, `api/static-publish.php` et
  `.htaccess`, à la racine du site.
- Utiliser Apache avec PHP 7.4 ou supérieur, `mod_rewrite` et une configuration
  autorisant `.htaccess` (`AllowOverride All`). Le compte PHP doit pouvoir créer
  `locationsalledemariage/` et écrire les fichiers HTML, `sitemap.xml` et
  `robots.txt`. Les pages sont remplacées par écriture atomique.
- Enregistrer **Mes Infos** sur le serveur avec le code PIN et le domaine public
  du site. Le domaine configuré doit correspondre au domaine sur lequel la
  publication est lancée. L'API vérifie le PIN enregistré côté serveur et ne
  permet d'écrire que les fichiers prévus.
- Enregistrer la configuration, les photos et les réseaux sociaux, puis cliquer
  sur le bouton de publication. Garder l'onglet ouvert jusqu'au message final.
  Chaque URL nouvellement écrite est contrôlée par une requête HTTP ; les pages
  inchangées sont détectées par comparaison de leurs données enregistrées.
  Le sitemap et `robots.txt` sont ensuite actualisés et contrôlés.
- Republier après une modification du contenu, de la configuration de page ou
  de la galerie. L'ajout d'une ville actualise l'annuaire HTML dans chaque
  fichier existant sans reconstruire le reste de la page. Les fichiers restent
  inchangés tant qu'on ne publie pas.
  En cas d'interruption ou d'erreur, les fichiers déjà écrits restent conservés ;
  relancer l'opération pour terminer. Aucun ancien fichier de page n'est supprimé.
- Préserver les dossiers `storage-data/` et `locationsalledemariage/` lors des
  déploiements. Conserver les anciens fichiers `assets/` jusqu'à la republication
  des pages : leur HTML référence les ressources compilées de la publication.
- La limite est de 15 Mo par requête de page. Configurer `post_max_size` à au
  moins `15M` et réduire les photos si une page dépasse cette limite.

La canonical et le sitemap facilitent l'exploration, sans garantir l'indexation
ni le classement par Google. Les pages des autres types et leurs données ne
sont pas supprimées par le retrait des onglets.

### Trajets routiers et informations de l'établissement

La génération calcule un itinéraire routier OSRM entre le centre de la commune
et Le Paradise, au **5 avenue Fridingen, 77100 Nanteuil-lès-Meaux**
(48.937362, 2.882801). La distance et la durée arrondies sont enregistrées avec
la page et reprises dans les textes, les cartes de présentation et les FAQ.
Il s'agit d'un itinéraire automobile sans trafic en temps réel, pas d'une
garantie de durée. Aucun calcul ni appel OSRM n'a lieu à l'ouverture d'une page.
La carte Google Maps recherche explicitement l'établissement à son adresse ;
les coordonnées des données structurées utilisent le même emplacement.

Les requêtes de génération sont séquentielles, espacées d'au moins 1,1 seconde
et limitées à 20 secondes. Une erreur du service arrête le lot sans enregistrer
de chiffres inventés ; les pages déjà enregistrées sont conservées. Le service
public OSRM exige une connexion Internet et peut être indisponible ou limiter
les requêtes. Les tests automatisés simulent ses réponses.

Pour les pages anciennes ou restaurées sans trajet enregistré, utiliser
**Mettre à jour les trajets**, puis **Publier / actualiser les pages**.
La mise à jour sauvegarde les pages côté serveur, conserve leurs modèles et
leurs textes personnalisés et ne calcule que les trajets manquants. La publication
refuse les pages sans trajet : elle ne substitue pas une estimation géométrique.
Les fichiers HTML existants restent inchangés jusqu'à la republication.

**Mes Infos** affiche les informations de l'établissement préremplies et
verrouillées. Cliquer sur **Modifier**, puis **Sauvegarder** après une modification.
Les valeurs déjà enregistrées priment ; seuls les champs vides ou absents
reçoivent les valeurs par défaut. Elles sont enregistrées lors de l'initialisation
administrative, pas pendant une visite publique. Vérifier le domaine SEO avant
publication. Le titulaire du compte, l'IBAN et le BIC restent vides dans le code
du dépôt public et doivent être saisis manuellement dans Mes Infos.

### Vérification

`npm test` compile le site puis contrôle la génération HTML, les erreurs, la
publication PHP et les URL publiques avec un Apache isolé. Ces tests nécessitent
PHP et le binaire Apache (`apache2` avec les modules standard). `npm run lint`
contrôle le code JavaScript.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

## Suivi des demandes de devis

Après acceptation des conditions, chaque étape validée transmet un récapitulatif
cumulatif à l'adresse e-mail de contact configurée dans **Mes Infos**.
Une demande peut donc être traitée et faire l'objet d'une reprise de contact même
si le formulaire n'est pas terminé. L'API `public/api/notify.php` valide les données,
limite les envois à 120 par heure et par adresse IP (20 parcours complets de six
étapes) et déduplique les reprises et
les étapes identiques. Les réglages SMTP configurés pour les notifications
transactionnelles sont réutilisés. Un dépassement renvoie HTTP 429 avec
`X-RateLimit-Scope: quote-followup` et `Retry-After`, afin de rester distinct
de la limitation globale de l'hébergement.
