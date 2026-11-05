# React + Vite

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
