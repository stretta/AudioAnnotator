# canvas-audio-annotator

A compact static web app for embedding annotated audio examples inside Canvas LMS via iframe.

## Production-ready v1 additions

- npm scripts for local development, linting, and tests
- a tiny built-in static dev server so local setup does not depend on Python
- extracted core parsing and normalization logic for easier maintenance
- basic regression tests around CSV parsing, URL normalization, and track building

## Stack recommendation

Use plain HTML, CSS, and JavaScript for v1.

This project has one small page, no routing, no state complexity, and a strong preference for static hosting and minimal setup. Plain web files keep GitHub Pages deployment simple, reduce iframe friction, and make the project easier for instructors to inspect and maintain.

## V1 file tree

```text
.
├── assets/
│   ├── app.js
│   └── styles.css
├── notes/
│   └── canvas-embed-notes.md
├── sample-data/
│   ├── annotations.csv
│   ├── annotations.json
│   └── audio/
│       ├── piece1.wav
│       └── piece2.wav
├── index.html
├── player.html
├── README.md
└── spec.md
```

## What v1 does

- Loads a track by query parameter, for example `player.html?track=piece1`
- Reads rows from a published Google Sheet when `sheet=` is provided
- Falls back to local sample JSON or CSV during development
- Displays track title, audio player, and clickable timestamped annotations
- Seeks on annotation click and auto-highlights the active annotation during playback
- Shows friendly errors for missing track, missing data, invalid rows, and audio load failure
- Uses a compact layout that works well inside a narrow Canvas iframe

## Local development

Because the app uses `fetch()`, run it from a local static server instead of opening the HTML file directly.

Example with npm:

```bash
npm install
npm run dev
```

Or with Python:

```bash
python3 -m http.server 4173
```

Then open:

```text
http://localhost:4173/player.html?track=piece1
```

## Scripts

```bash
npm run dev
npm run lint
npm test
```

You can also use the landing page at:

```text
http://localhost:4173/
```

## Query parameters

Required:

- `track`: track id to display, such as `piece1`

Optional:

- `sheet`: published Google Sheet URL, published CSV URL, or Google Sheet id
- `gid`: sheet tab id when `sheet` points at a Google Sheet id or generic sheet URL
- `data`: custom JSON or CSV URL for local testing

Examples:

```text
player.html?track=piece1
player.html?track=piece1&sheet=FILE_ID&gid=0
player.html?track=piece1&data=./sample-data/annotations.csv
```

## Google Sheet setup

The app expects these required columns:

- `track_id`
- `title`
- `audio_url`
- `start_seconds`
- `label`
- `comment`

Example rows:

```csv
track_id,title,audio_url,start_seconds,label,comment
piece1,String Quartet Excerpt,https://example.com/audio/piece1.mp3,12,Opening texture,Listen to the initial registral spacing
piece1,String Quartet Excerpt,https://example.com/audio/piece1.mp3,92,Strings enter,Listen to the cello and viola voicing here
```

To use a Google Sheet:

1. Put your annotation rows in one public sheet tab with the columns above.
2. Make sure the audio URLs are public and load in a browser without authentication.
3. Publish or share the sheet so it can be fetched anonymously.
4. Load the player with `track` and `sheet` in the URL.

Example:

```text
https://your-site.example/player.html?track=piece1&sheet=FILE_ID&gid=0
```

If you prefer to pass the full Google Sheet URL, URL-encode it first so it survives inside the page query string.

The app converts Google Sheet ids and standard Google Sheet URLs into a CSV export URL and reads the rows client-side.

## Canvas embed example

```html
<iframe
  src="https://your-site.example/player.html?track=piece1&sheet=FILE_ID&gid=0"
  title="Annotated audio player"
  width="100%"
  height="560"
  style="border: 0;"
  loading="lazy"
></iframe>
```

For a shorter embed, reduce the height once you know how many annotations your track needs.

## GitHub Pages deployment

This app is static, so GitHub Pages can serve it directly.

1. Push the repository to GitHub.
2. In the repository settings, open `Pages`.
3. Set the source to deploy from your default branch and the repository root.
4. Save, then wait for the site URL to appear.
5. Open `player.html?track=piece1` on the published site to confirm it loads.

If your repository is published under a project subpath such as `https://username.github.io/repo-name/`, the relative asset and sample-data paths in this project will still work.
