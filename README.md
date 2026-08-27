# Sri Lanka COVID-19 Memorial — static archive

A fully self-contained [Hugo](https://gohugo.io) rebuild of
[srilankac19memorial.org](https://srilankac19memorial.org), designed to run as a
**living archive** with no application server, no build hooks, and no hosted
services to maintain.

The original site (`memorial-web`, Next.js on Netlify) needed a Node runtime,
Netlify functions for form handling, and a daily deploy hook. This repo replaces
all of that with plain pre-rendered HTML in English, Sinhala and Tamil. The
source repositories are now archived; everything needed to build and serve the
memorial — data, submitted photos, geo lookup, styling — lives here.

## What's in here (monolithic by design)

| Path | What it is |
| --- | --- |
| `data/` | Committed dataset snapshot: `covid19_deaths.json`, `geo.json` (place names in en/si/ta), `site_stats.json`. |
| `assets/people/` | Vendored submission photos, referenced from `covid19_deaths.json` by local path. |
| `scripts/fetch-data.mjs` | The only networked step. Refreshes `data/` and re-vendors photos from the (archived) upstream repos. |
| `content/` | Prose (`about`, `approach`, home intro) as `*.md` / `*.si.md` / `*.ta.md`, plus `people/_content.gotmpl` — the [content adapter](https://gohugo.io/content-management/content-adapters/) that generates one page per documented person, in every language, from data. |
| `i18n/` | UI strings per language. |
| `layouts/` | Templates. Palette and shapes ported from the original DaisyUI theme; place names localised at render time from `data/geo.json`. |
| `static/CNAME` | `srilankac19memorial.org` for GitHub Pages. |
| `.github/workflows/` | `refresh-data.yml` (daily data pull + commit) and `build.yml` (Hugo build + GitHub Pages deploy). |

No per-person Markdown files are committed — people pages exist only as data plus
a template, and are materialised at build time.

## Local development

Prerequisites: **Hugo extended ≥ 0.161** and **Node ≥ 20**.

```sh
node scripts/fetch-data.mjs   # refresh data/ + assets/people/ (a snapshot is already committed)
hugo server                   # http://localhost:1313
hugo --gc --minify            # production build into ./public
```

## Languages

English at `/`, Sinhala at `/si/`, Tamil at `/ta/` (matching the original).
UI strings live in `i18n/<lang>.toml`; prose in `content/<name>.<lang>.md`;
place names come from `data/geo.json`. Person records themselves (free-text
fields like place of death) are shown as recorded, in their original language.

> The UI strings carried over from the original site are the maintainers'
> translations. Strings newly authored for this rebuild (pager, facet labels,
> age bands, a few notes) would benefit from a native review — they are all in
> `i18n/si.toml` and `i18n/ta.toml`.

## URL scheme

| Route | Page |
| --- | --- |
| `/` (`/si/`, `/ta/`) | Flower grid of everyone documented, newest first, paginated |
| `/person/<indexKey>/` | One person |
| `/people/` | Full list (same grid) — linked from the footer, not the top nav |
| `/browse/` | Every drill-down facet with counts |
| `/provinces/<name>/`, `/districts/<name>/` | People from a place |
| `/years/<yyyy>/` | People who died that year |
| `/sexes/<sex>/`, `/agebands/<band>/`, `/sources/<type>/` | Other facets |

## Data provenance

Upstream (now **archived**, read-only):

- [`sl-c19-memorial/memorial-dataset`](https://github.com/sl-c19-memorial/memorial-dataset) — documented deaths, geo lookup, submission photos
- [`sl-c19-memorial/scraped-dgi-reports`](https://github.com/sl-c19-memorial/scraped-dgi-reports) — scraped DGI press releases (each person's source line still links here for citation)

`fetch-data.mjs` normalises a few malformed `indexKey` values from the source
(stray spaces, `*`) into clean URL slugs while keeping the original key visible on
each person page.

## Status

Stage A (static site + data integration) and the Stage C language + self-
containment work are complete. See [`PROJECT_PLAN.md`](PROJECT_PLAN.md) for the
rest of the roadmap.

## Licence

MIT, matching the upstream repos. Data © the memorial's contributors.
