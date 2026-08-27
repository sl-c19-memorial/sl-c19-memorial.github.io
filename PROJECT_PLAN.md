# Project plan — `memorial-static`

Turning the Sri Lanka COVID-19 Memorial into a **living archive**: a site that
keeps working for years with no runtime, no paid services, and no routine
maintenance.

---

## 1. Why

The current memorial is three repositories:

| Repo | Role | Runtime dependency |
| --- | --- | --- |
| `memorial-dataset` | Node scraper → Google Sheets → JSON on a `data` branch | GitHub Actions (still fine) |
| `scraped-dgi-reports` | Scrapes DGI press releases → `data` branch | GitHub Actions (still fine) |
| `memorial-web` | **Next.js 14** app on **Netlify** | Node server, Netlify functions, hCaptcha, ZeptoMail, Google APIs, a daily build hook |

`memorial-web` is the fragile part. It needs a Node runtime, serverless functions
for the contact/submission forms, third-party API keys that expire, a Netlify
account in good standing, and a cron hook to redeploy. Any of those failing takes
the memorial offline.

**Goal:** one repository that builds to plain HTML and can be hosted anywhere
static (GitHub Pages, Cloudflare Pages, Netlify drop, S3, IPFS, a USB stick). The
data pipeline repos stay as-is; this repo consumes their published output.

## 2. Principles

1. **Monolithic.** Data snapshot, site source, templates, and assets all live
   here. Cloning this repo is sufficient to build the site offline.
2. **Static output only.** No client JS required to read the archive. JS, if
   added later, is progressive enhancement.
3. **Data is the source of truth.** People pages are generated from
   `data/covid19_deaths.json` by a template, not hand-written. Re-running the
   fetch script + `hugo` is the entire update cycle.
4. **Drop interactivity, keep access.** No infinite scroll, no live filter
   widget, no forms. Every view a visitor could reach by filtering is instead a
   real, linkable, pre-built page.
5. **Preserve the feel.** Same palette, same flower, same typography, same
   copy.

## 3. Repository layout

```
memorial-static/
├── hugo.toml                     # config: taxonomies, permalinks, pagination
├── data/
│   ├── covid19_deaths.json       # committed snapshot (newest-first, slug-normalised)
│   ├── geo.json                  # provinces / districts / cities, en|si|ta
│   └── site_stats.json           # headline counters (official toll, documented count)
├── scripts/
│   └── fetch-data.mjs            # the only network step; refreshes data/
├── content/
│   ├── _index.md
│   ├── about.md                  # ported from about_en.mdx
│   ├── approach.md               # ported from approach_en.mdx
│   ├── browse/_index.md
│   └── people/_content.gotmpl    # content adapter: 1 page per person, from data
├── layouts/
│   ├── baseof.html
│   ├── home.html                 # flower grid, paginated
│   ├── section.html              # /people/ list
│   ├── page.html                 # prose pages
│   ├── term.html                 # one facet value → flower grid
│   ├── taxonomy.html             # list of facet values + counts
│   ├── browse/section.html       # all facets on one page
│   ├── people/page.html          # one person
│   ├── 404.html
│   └── partials/                 # head, header, footer, person-cell, pagination
├── assets/
│   ├── css/main.css              # DaisyUI "light" theme ported to CSS variables
│   └── img/flower.png
├── static/                       # favicon, OG image
├── i18n/                         # (Stage C) en/si/ta strings
└── .github/workflows/
    ├── refresh-data.yml          # daily: fetch-data → commit
    └── build.yml                 # push: hugo → GitHub Pages
```

## 4. Data model

One record in `data/covid19_deaths.json`:

| Field | Example | Notes |
| --- | --- | --- |
| `indexKey` | `2020-11-02-0001` | Unique id. Shown on the person page. A few upstream values are malformed. |
| `slug` | `2020-11-02-0001` | Added by `fetch-data.mjs`: cleaned, unique, URL-safe. Drives the permalink. |
| `deathDate` | `2020-11-02T05:30:00.000+05:30` | ISO with +5:30 offset. |
| `province` / `district` / `city` | `Western` / `Colombo` / `Colombo 12` | English keys. Localised names come from `geo.json` (Stage C). `city` missing for ~15 records. |
| `ageType` | `FINE` \| `ROUGH` | `ROUGH` (1 record) carries a range like `70-80`. |
| `ageValue` | `89` | String. |
| `gender` | `Male` \| `Female` | ~0.5% blank. |
| `deathPlace` | `Colombo General Hospital` | Free text. |
| `incarcerated` | `false` | Flagged where the source noted a prison death. |
| `sourceType` | `DGI_PR_DOCS` \| `VERIFIED_SUBMISSION` | 4 records blank. |
| `sourceRef` | `5a281a09…` | Hash → DGI report in `scraped-dgi-reports`. |
| `detail` | `null` or `{name, occupation, description, photo}` | Non-null only for the 7 verified family submissions. |

**Derived at build time** (in the content adapter): `ageBand`
(`below-30` / `30-59` / `60-and-above`), `year` (from `deathDate`).

**Current snapshot:** 767 documented people, deaths from 2020-11-02 to
2021-08-26; official cumulative toll 15,065 (as of 2022-01-05, from
`user_keys_latest.json`).

## 5. Facets / drill-down

Hugo taxonomies, each producing an auto-paginated list page:

| Taxonomy | URL | Terms |
| --- | --- | --- |
| `provinces` | `/provinces/` | 9 |
| `districts` | `/districts/` | 25 |
| `years` | `/years/` | 2020, 2021 |
| `sexes` | `/sexes/` | Male, Female |
| `agebands` | `/agebands/` | below-30, 30-59, 60-and-above |
| `sources` | `/sources/` | DGI, verified submission |

`/browse/` lists every term of every facet with a count. Each person page links
back out to its province, district and year.

---

## Stage A — Static Hugo site + data integration ✅ (this stage)

**Scope:** a complete, plain-HTML site rendering the full dataset, English only,
no interactivity, buildable offline from a committed data snapshot.

### Delivered

- [x] Monolithic repo scaffold; data snapshot committed under `data/`.
- [x] `scripts/fetch-data.mjs` — fetches the three upstream JSON files, orders
      newest-first, normalises malformed `indexKey`s to unique slugs, writes
      `covid19_deaths.json`, `geo.json`, `site_stats.json`.
- [x] `content/people/_content.gotmpl` content adapter — generates 767 person
      pages at `/person/<slug>/` from data, with facet params, no committed
      Markdown.
- [x] Home page: intro card (official toll + documented count from
      `site_stats.json`) + flower grid, newest first, 96/page, prev/next pager.
- [x] Person page: flower (or submitted photo), age/sex, place, date,
      description/occupation when present, province/district/city, place of
      death, incarceration note, source + link to the DGI reference, raw
      `indexKey`.
- [x] Drill-down: `provinces`, `districts`, `years`, `sexes`, `agebands`,
      `sources` taxonomies; `/browse/` hub with counts; term pages reuse the
      grid and paginate.
- [x] `about` and `approach` ported from the MDX originals to Markdown.
- [x] Styling ported: DaisyUI `light` theme (primary `#5c7f67`, the greys, the
      pink accent, 1rem radius) as CSS custom properties; Noto Sans / Sinhala /
      Tamil via Google Fonts; sticky header, neutral footer; responsive
      2→5→8-column grid matching the original.
- [x] `sitemap.xml`, `robots.txt`, RSS of newly documented people, `404.html`.
- [x] CI: `refresh-data.yml` (daily pull + commit), `build.yml` (Hugo → Pages).

### Build

```sh
node scripts/fetch-data.mjs && hugo --gc --minify
# → ./public, ~910 HTML files, ~7 MB, no external runtime
```

### Known data-quality notes (upstream, not blocking)

- 5 `indexKey` values are malformed (`2021*04-20-000`, embedded spaces, a short
  date). Handled by slug normalisation; worth fixing in `memorial-dataset`.
- ~15 records have no `city`; 4 have no `sourceType`; a few have no `gender`.
  Templates degrade gracefully ("Age unknown", district shown instead of city).

---

## Stage B — Drill-down depth & findability

- **Nested geo browse.** `/provinces/western/` gains a district breakdown;
  district pages gain a city breakdown. Built with `.GroupByParam`, still static.
- **Facet combinations that matter.** Pre-build the handful the old filter made
  common (province × year, age-band × sex) rather than the full cross-product.
- **Search.** [Pagefind](https://pagefind.app) run as a post-build step over
  `./public` — a static index, ~tens of KB loaded on demand, works with no
  server. Falls back to the browse pages when JS is off.
- **Timeline view.** A per-month strip (`/timeline/`) showing documented deaths
  over the pandemic, linking into `/years/` and month pages.
- **"Filter" page.** A plain `<form method="get">` whose submit maps to an
  existing pre-built facet URL — the old filter UX, zero JS.

## Stage C — Multilingual + secondary datasets

- **Sinhala & Tamil.** Hugo multilingual mode; port `lang/{si,ta}.json` →
  `i18n/{si,ta}.toml`; translate `about` / `approach`; localise place names by
  joining `geo.json` in the content adapter; language switcher in the header
  (the original's `/si/…` `/ta/…` prefixes).
- **DGI press-release archive.** Pull `scraped-dgi-reports` into `data/`; build
  `/sources/dgi/<ref>/` pages from `dgi_reports_latest.json` (title, date,
  scanned image); link each person's source line to its actual release instead
  of a GitHub blob URL.
- **Aggregate context.** Use `dgi_reports_deaths_latest.tsv` (daily age/sex
  bucket counts) for a "what the government reported vs. what we could document"
  panel on `/approach/`.

## Stage D — Living-archive automation & hosting

- **Decide the host.** Recommended: **GitHub Pages** (free, no account risk,
  deploy included in `build.yml`). Cloudflare Pages as an alternative;
  Netlify-as-static-drop if the domain stays there.
- **Update loop.** `refresh-data.yml` (daily) commits data diffs with dated
  messages → push triggers `build.yml` → deploy. No build hooks, no functions.
- **Monthly snapshot tags.** `archive/2026-08` tags so the archive has
  addressable historical states.
- **Forms, statically.** `submit` and `contact` become either a documented
  "email us / open a PR" flow or an embedded third-party form (Formspree /
  Tally) — no serverless code in this repo.
- **URL parity.** Redirect map from old Next.js routes (`/[slug]`, locale
  prefixes, any shared entry links) to the new scheme, as `aliases` or a host
  redirect file, so existing inbound links survive.
- **Domain + retention.** Point `srilankac19memorial.org` at the static host;
  document renewal. Register with the Internet Archive / submit to Archive.today
  as an explicit preservation step.

## Stage E — Polish

- Per-person Open Graph images (Hugo `images` render hook or a small generator).
- Accessibility pass (landmarks, focus states, colour contrast on the grey base,
  `alt` text, reduced-motion for the hover scale).
- Performance budget: inline critical CSS, self-host the Noto subset for the
  Latin range, lazy-load flower images (already `loading="lazy"`).
- Credits / licence page; data dictionary; "how to contribute a correction".
- Remove `memorial-web` from production once parity is confirmed; leave it
  archived.

---

## What is intentionally dropped from the original

| Original feature | Replacement |
| --- | --- |
| Infinite scroll | Numbered pagination (96/page) |
| Client-side filter widget | Pre-built facet pages + `/browse/` (+ optional GET form in Stage B) |
| Hover card + click overlay | A real `/person/<slug>/` page |
| Submission form (hCaptcha, ZeptoMail, Google Sheets) | Stage D: external form or PR workflow |
| Contact form | `mailto:` / external form |
| Theme switcher | Dropped (was already disabled in the original) |
| Google Analytics | Dropped (add privacy-friendly analytics later if wanted) |
| Netlify functions + build hook | GitHub Actions cron + static deploy |

## Risks / open questions

- **Google Fonts dependency.** Currently linked from `fonts.googleapis.com`. For
  a true offline-durable archive, self-host the Noto subsets (Stage E).
- **Submitted photos** are hot-linked from `raw.githubusercontent.com`. Only 7
  today; Stage C should vendor them into `assets/` so the archive is
  self-contained.
- **Scale.** At ~767 people the build is ~0.5 s. The design (content adapter +
  taxonomies) scales to tens of thousands of pages without change; only build
  time grows.
- **Upstream longevity.** If the `memorial-dataset` repo stops updating, the
  committed snapshot simply becomes the permanent record — which is the point.
- **Host choice** (Stage D) is the one decision that needs an owner.
