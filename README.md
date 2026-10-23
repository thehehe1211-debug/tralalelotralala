# Ten Years Away – static copy

Static site, no build step. Works from a domain root or a sub-folder (GitHub Pages `/repo/`).

```
index.html        page markup (+ tiny script that detects the sub-folder it is served from)
css/style.css     all styles
js/               compiled app bundles (patched for relative paths)
fonts/            PP Valve woff2
textures/         noise.webp
api/              years.json / team.json  (replace the original Next.js /api routes)
tools/            fetch-assets.mjs  <- run once, see below
404.html, .nojekyll
```

## One-time step: download the files that were not in the saved copy
The original save missed the lazy-loaded 3D scene and the media. Without them the loader
stops at **40 %**. With Node 18+ installed, from the repo root:

```
node tools/fetch-assets.mjs
```

It downloads the scene chunks into `js/`, comic pages/textures into `media/`, audio, the cover image
and live API data, and rewrites their absolute paths so they work under `/repo/`.
Commit the new files afterwards.

If a file is reported `MISSING`, open the live site, DevTools → Network, reload, and save that
file into the same path.

## Run locally
```
python3 -m http.server 8000
```

## Deploy
GitHub → Settings → Pages → Deploy from branch → `main` / root.

## Notes
- Only the home page was captured; `/en/year` and `/en/about` are not included.
- Design and artwork belong to Studio375 / Davide Grazi – use with permission and credit.
