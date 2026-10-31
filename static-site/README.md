# Site vitrine statique — Le Paradise

Site HTML statique public de la salle de mariage (vidéo en bannière, pages département, 1 283 pages ville, maillage interne, schema.org, sitemap).

## Générer et vérifier

```bash
cd static-site
node build.mjs      # génère dist/ (1 299 pages)
node validate.mjs   # titles uniques, H1, canonicals, schema.org, sitemap, liens internes
php -l contact.php
```

Aperçu local : `php -S 127.0.0.1:8082 -t dist`

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
