# Sri Lanka COVID-19 Memorial — static archive

A self-contained [Hugo](https://gohugo.io) rebuild of
[srilankac19memorial.org](https://srilankac19memorial.org), designed to run as a
**living archive** with no application server, no build hooks, and no hosted
services to maintain.

The original site (`memorial-web`, Next.js on Netlify) rendered the same data but
needed a Node runtime, Netlify functions for form handling, and a daily deploy
hook. This repo replaces all of that with plain pre-rendered HTML.

## What's in here (monolithic by design)

| Path | What it is |
| --- | --- |
| `data/` | Committed snapshot of the dataset. `covid19_deaths.json`, `geo.json`, `site_stats.json`. |
| `scripts/fetch-data.mjs` | The only networked step. Pulls the latest upstream snapshots into `data/`. |
| `content/` | Prose pages (`about`, `approach`) + `people/_content.gotmpl`, the [content adapter](https://gohugo.io/content-management/content-adapters/) that generates one page per documented person from `data/covid19_deaths.json`. |
| `layouts/` | Templates. Palette and shapes ported from the original DaisyUI theme. |
| `assets/` | `css/main.css` and the flower image, run through Hugo's asset pipeline. |
| `.github/workflows/` | `refresh-data.yml` (daily data pull + commit) and `build.yml` (Hugo build + GitHub Pages deploy). |

No per-person Markdown files are committed — people pages exist only as data plus
a template, and are materialised at build time.

## Local development

Prerequisites: **Hugo extended ≥ 0.161** and **Node ≥ 20**.

```sh
node scripts/fetch-data.mjs   # refresh data/ from upstream (optional; a snapshot is committed)
hugo server                   # http://localhost:1313
hugo --gc --minify            # production build into ./public
```

## URL scheme

| Route | Page |
| --- | --- |
| `/` | Flower grid of everyone documented, newest first, paginated |
| `/person/<indexKey>/` | One person |
| `/people/` | Full list (same grid) |
| `/browse/` | Every drill-down facet with counts |
| `/provinces/<name>/`, `/districts/<name>/` | People from a place |
| `/years/<yyyy>/` | People who died that year |
| `/sexes/<sex>/`, `/agebands/<band>/`, `/sources/<type>/` | Other facets |

## Data provenance

Upstream, unchanged, still maintained in their own repos:

- [`sl-c19-memorial/memorial-dataset`](https://github.com/sl-c19-memorial/memorial-dataset) — manually documented deaths + the geo lookup table
- [`sl-c19-memorial/scraped-dgi-reports`](https://github.com/sl-c19-memorial/scraped-dgi-reports) — scraped Department of Government Information press releases (wired in at Stage C)

`fetch-data.mjs` normalises a few malformed `indexKey` values from the source
(stray spaces, `*`) into clean URL slugs while keeping the original key visible on
each person page.

## Status

Stage A (static site + data integration) is complete. See
[`PROJECT_PLAN.md`](PROJECT_PLAN.md) for the roadmap.

## Licence

MIT, matching the upstream repos. Data © the memorial's contributors.
