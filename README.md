# La Tchatche

Site officiel du podcast **La Tchatche**, construit en SPA React avec une direction artistique **Dark Premium Brutiste**.

## Stack

- React 19 + Vite 8
- Tailwind CSS 3
- Framer Motion (animations)
- Howler.js (lecture audio)
- Lucide React (icones)
- qrcode.react (QR codes episodes)

## Fonctionnalites

- Header sticky premium avec navigation par categories
- Feed vertical infini d'episodes
- Cartes episodes immersives (waveform animee, resume artistique, lexique interactif)
- Player audio integre (play/pause, seek, timer)
- Transition sonore entre pistes (ambiance portuaire)
- Mode Carte avec geolocalisation et episodes les plus proches
- Favoris persistants via `localStorage`
- Partage d'extraits avec deep-link hash (`#episode`, `t`, `d`)
- QR code, partage social, telechargement MP3
- Suggestions utilisateur via API edge (`POST /api/suggestions`) avec fallback local
- PWA: service worker avec fallback navigation et cache audio hors ligne

## Lancer le projet

```bash
npm install
npm run dev
```

Application disponible ensuite sur `http://localhost:5173`.

## Scripts

```bash
npm run dev      # serveur local
npm run build    # build production
npm run preview  # previsualisation build
npm run lint     # verifications ESLint
npm run test     # tests automatises (Vitest)
npm run test:coverage
```

## Structure

- `src/App.jsx` : interface principale + logique feed/audio/carte
- `src/features/episodes/catalog.js` : catalogue episodes + constantes editoriales
- `src/features/deeplink/hashDeepLink.js` : parse/build des liens de partage
- `src/features/suggestions/suggestionService.js` : envoi API + fallback localStorage
- `functions/api/suggestions.js` : endpoint edge Cloudflare Pages Functions
- `src/index.css` : systeme visuel premium (palette, texture, composants)
- `src/assets/la-tchatche-logo.png` : logo officiel
- `tailwind.config.js` : tokens visuels et extensions Tailwind

## Variables d'environnement

- `VITE_SUGGESTIONS_API_URL` (optionnelle): URL de l'API suggestions.
  - valeur par defaut: `/api/suggestions`

## Notes

- Les URLs audio de demonstration sont a remplacer par les fichiers definitifs du podcast.

## Deploiement Cloudflare Pages

Reglages recommandes dans Cloudflare Pages (Build & Deployments):

- Build command: `npm run build`
- Build output directory: `dist`
- Node.js version: `22`

Le fichier `public/_redirects` est inclus pour le fallback SPA.
