# React + Vite

## Protection contre les rafales LWS

Les appels `fetch` de même origine passent par une file commune : au moins
650 ms entre départs (moins de deux appels par seconde), sans burst et sans
appels concurrents. Sur HTTPS avec Web Locks, les onglets du même navigateur
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
assets nécessaires aux pages statiques et republier celles-ci pour leur fournir
également le nouveau code réseau. Les modèles éditoriaux ne changent pas ici.

## Génération automatique des pages mariage depuis les modèles

Les pages mariage sont générées **sans IA, sans clé API et sans coût d'API**.
Six familles éditoriales reprennent les thèmes des vingt pages fournies :
présentation et visite, organisation, accueil des invités, personnalisation,
budget et devis, accès et déplacements.

Chaque génération choisit une famille, des titres, des paragraphes complets,
trois questions fréquentes et deux extraits d'avis. L'ordre des sections dépend
de la famille pour conserver un enchaînement cohérent. Le texte et la sélection
des avis sont sauvegardés avec la version du modèle et sa graine aléatoire :
ils ne changent pas lors d'une visite, d'une publication ou d'une restauration.
Une régénération volontaire peut produire une autre combinaison. Les noms de
villes, départements et codes postaux sont résolus par les données existantes ;
les distances à vol d'oiseau ne sont pas présentées comme des durées de trajet.

La capacité **jusqu'à 300 personnes**, le traiteur, le service, la décoration
et le DJ sont repris des exemples après accord du propriétaire. Les prestations
retenues restent à confirmer au devis. Les nouveaux textes indiquent la salle
réelle à Nanteuil-lès-Meaux, sans nouvelle implantation ni témoignage local inventé.
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

Après fusion, déployer tout `dist/`, puis générer et **republier les pages HTML**
pour afficher les nouveaux textes et avis. Les anciens textes ne sont jamais
réécrits automatiquement, y compris les témoignages éventuellement présents.
Après restauration, republier pour synchroniser les fichiers statiques.
L'ancien endpoint `api/openai-generate.php` renvoie désormais HTTP 410, afin
de désactiver aussi l'ancienne version lors d'un transfert par écrasement.
La variable `OPENAI_API_KEY` et le fichier privé OpenAI ne sont plus nécessaires
aux pages villes ; supprimer la configuration privée si aucun autre outil
ne l'utilise. Les sauvegardes et les fichiers HTML existants restent compatibles.

Les variantes réduisent les répétitions, sans garantir que chaque page est
entièrement unique ou un classement Google. Les tests comparent notamment
100 textes pour une même ville (donc sans masquer les ressemblances par des
changements de noms) : similarité moyenne des séquences de cinq mots inférieure
à 30 %, maximum inférieur à 70 %, hors sections communes du site et avis.

## Titres et descriptions des pages mariage

Les métadonnées des pages villes mariage suivent ces modèles :

- Titre : `Le Paradise 0184196949 | Salle de mariage Meaux 77100`
- Description : `Vous recherchez une salle de mariage à Meaux 77 ? Découvrez notre salle de réception a proximité de seine et marne, idéale pour célébrer votre mariage. Contactez-nous pour réserver une salle de mariage et obtenir un devis personnalisé à Meaux !`

Les noms de villes dans ces métadonnées sont sans accents ni ponctuation :
`Nanteuil-lès-Meaux` devient `Nanteuil les Meaux`. Les noms des départements
sont également normalisés, en minuscules. Le nom et le téléphone du titre sont
ceux du modèle demandé, indépendamment du nom configuré pour les autres contenus.
Les H1 visibles, URL, textes sauvegardés et adresses structurées restent inchangés.
Déployer puis **republier toutes les pages mariage statiques**, y compris après
restauration d'une sauvegarde, pour actualiser leurs métadonnées.

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

Après publication, chaque page publique propose une **Zone de location de salle
de mariage**, classée par département puis par nom de commune, en colonnes
adaptées au mobile. Les liens utilisent le texte et l'attribut `title`
`Location salle de mariage <ville>`. Les liens textuels n'ont pas d'attribut
`alt` : cet attribut concerne les images, dont les descriptions identifient
la salle réelle à Nanteuil-lès-Meaux.

Seules les pages mariage publiées sont incluses. Le bouton de publication
vérifie les URL, puis écrit `wedding-directory.html`, `wedding-pages.json` et
insère l'annuaire dans `index.html`. Les liens sont donc présents dans le HTML
initial, sans dépendre de JavaScript. Le modèle React des pages villes publiées
contient le même annuaire. Les espaces privés et l'administration ne l'affichent
pas. La génération SEO depuis Mes Infos filtre également les pages mariage
sur le registre de publication ; le devis, marqué `noindex`, n'est pas dans
le sitemap.

La publication actualise aussi les métadonnées de l'accueil dans `index.html`.
Les pages villes ont des titres et descriptions ciblés, un fil d'Ariane, des
données `LocalBusiness` / `EventVenue` et `Service`, avec l'adresse réelle
(5 avenue Fridingen, 77100 Nanteuil-lès-Meaux), et une image de la salle plutôt
que le favicon. La carte pointe vers la salle, pas vers une implantation
fictive dans la ville recherchée. Les informations locales distinguent les
distances à vol d'oiseau des itinéraires routiers. Les FAQ utilisent
`details` / `summary` : leurs réponses sont dans le HTML même sans JavaScript.

Les modèles locaux utilisent un vocabulaire maîtrisé, sans quota de mots-clés
ni informations locales ou avis inventés. Les textes déjà
sauvegardés ne sont pas réécrits automatiquement : relisez-les et corrigez les
informations non vérifiées avant de republier. La salle reste située à
Nanteuil-lès-Meaux, même lorsque la page s'adresse aux habitants d'une autre ville.

**Déployer tout `dist/`, puis republier les pages mariage.** Le compte PHP doit
pouvoir remplacer `index.html` en plus des fichiers de publication précédents.
Conserver `wedding-directory.html`, `wedding-pages.json`, les contenus et les
anciens assets lors des mises à jour ; republier après un déploiement remplaçant
`index.html` ou après restauration pour réinsérer l'annuaire et actualiser le HTML.
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
restauration. **Republier les pages mariage statiques après le déploiement ou
une restauration** pour remplacer leur HTML par celui incluant le bandeau.
Les anciens fichiers HTML ne sont pas modifiés automatiquement ; restaurer
un ancien fichier HTML complet rétablira son ancien aspect.

## Publication des pages mariage

L'administration ne propose plus que l'onglet **Pages salle de mariage**.
Les contenus sauvegardés et les anciennes URL des autres types restent disponibles.

Dans **Pages salle de mariage > Sélection villes**, le bouton
**Publier les pages en HTML statique** publie toutes les pages mariage déjà
générées. Chaque ville possède un fichier physique
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
  Chaque URL est contrôlée par une requête HTTP avant d'être comptée comme
  publiée ; le sitemap et `robots.txt` sont ensuite actualisés et contrôlés.
- Republier après une modification du contenu, des réglages, des liens ou de la
  galerie. Les fichiers existants restent inchangés tant qu'on ne republie pas.
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
