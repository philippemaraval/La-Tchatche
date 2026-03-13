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
- Partage d'extraits (modal `Citer`, segment 15s-30s)
- QR code, partage social, telechargement MP3

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
```

## Structure

- `src/App.jsx` : interface principale + logique feed/audio/carte
- `src/index.css` : systeme visuel premium (palette, texture, composants)
- `src/assets/la-tchatche-logo.png` : logo officiel
- `tailwind.config.js` : tokens visuels et extensions Tailwind

## Notes

- Le projet ne necessite pas de variables d'environnement pour le moment.
- Les URLs audio de demonstration sont a remplacer par les fichiers definitifs du podcast.

## Deploiement Cloudflare Pages

Reglages recommandes dans Cloudflare Pages (Build & Deployments):

- Build command: `npm run build`
- Build output directory: `dist`
- Node.js version: `22`

Le fichier `public/_redirects` est inclus pour le fallback SPA.
