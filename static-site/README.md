# Site vitrine statique — Le Paradise

Site HTML statique public de la salle de mariage (vidéo en bannière, pages département, 1 283 pages ville, maillage interne, schema.org, sitemap).

## Générer et vérifier

```bash
cd static-site
node build.mjs      # génère dist/ (1 299 pages)
node --test city-content.test.mjs
node validate.mjs   # titles uniques, H1, canonicals, schema.org, sitemap, liens internes
php -l contact.php
```

Aperçu local : `php -S 127.0.0.1:8082 -t dist`

## Quatre modèles de pages ville

`city-content.mjs` reprend et adapte les textes et la présentation des pages
Aubervilliers, Bobigny, Boulogne-Billancourt et Pavillons-sous-Bois fournies dans
`page_exemple.zip`. L'archive contenait aussi Meaux et Nanteuil-les-Meaux.
Les quatre pages sources gardent leur modèle ; les autres communes sont réparties
par un hachage stable de leur nom de fichier (pas de tirage à chaque build).

Chaque modèle comporte sa propre présentation longue, des H2/H3 ciblés et un
ordre de rubriques distinct : prestations, réservation, équipements, galerie,
cérémonie, conseils, FAQ et accès. La mise en page reprend la colonne de lecture
de 960 px, les titres soulignés d'or et les cartes des exemples. La vidéo hero et
le maillage inter-villes sont conservés.

Les textes utilisent la ville et le département courants, ainsi que la vraie
adresse de la salle. Les capacités contradictoires des exemples (200, 300 ou
500 personnes), les temps de trajet calculés, les témoignages génériques et les
prestations non confirmées ne sont pas repris comme des faits. Les lieux de
cérémonie sont présentés comme des démarches à vérifier, sans monuments inventés.

La validation mesure au moins 2 500 mots par page **hors maillage inter-villes**,
vérifie la présence de l'expression « location de salle de mariage », les ancres,
l'absence de variables résiduelles et une répartition de 20 à 30 % par modèle.
Quatre variantes ne rendent pas les 1 283 textes uniques : les rubriques communes
restent répétées. Elles ne garantissent aucun classement dans les moteurs de
recherche et gagneront à être enrichies avec des informations locales vérifiées.

## Réglages (`config.json`)

- `heroVideo` : fichier MP4/WebM de la bannière (`assets/hero-paradise.mp4`, 720p sans son, ~8 Mo). Les liens Instagram/TikTok ne servent pas de bannière.
- `heroPoster` : image affichée avant le chargement de la vidéo.
- `socialVideos` : liens de publications Instagram (`/p/`, `/reel/`) ou TikTok (`/@compte/video/id`), chargés au clic.
- Coordonnées, SIREN, responsable de publication, hébergeur, `managementUrl` (espace de gestion).

Pour remplacer la vidéo (ffmpeg) :

```bash
ffmpeg -i source.mp4 -an -vf "scale=1280:-2,fps=25" -c:v libx264 -crf 30 -pix_fmt yuv420p -movflags +faststart assets/hero-paradise.mp4
```

## Déploiement (LWS)

1. Déplacer l'application de gestion React/PHP sur un sous-domaine et renseigner `managementUrl`.
2. Envoyer le contenu de `dist/` à la racine du site (il contient `.htaccess` et `contact.php`).
3. Définir la variable d'environnement `PARADISE_CONTACT_FROM` (adresse d'envoi du domaine) et tester le formulaire.
4. Soumettre `sitemap.xml` dans Google Search Console.
