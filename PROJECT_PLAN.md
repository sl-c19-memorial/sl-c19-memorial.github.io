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
├── hugo.toml                     # config: languages, taxonomies, permalinks, menu
├── data/
│   ├── covid19_deaths.json       # committed snapshot (newest-first, slug-normalised,
│   │                             #   photo paths rewritten to assets/people/)
│   ├── geo.json                  # provinces / districts / cities, en|si|ta
│   └── site_stats.json           # headline counters (official toll, documented count)
├── scripts/
│   └── fetch-data.mjs            # the only network step; refreshes data/ + vendors photos
├── content/
│   ├── _index.md .si.md .ta.md   # home intro prose (per language)
│   ├── about.md  .si.md .ta.md
│   ├── approach.md .si.md .ta.md
│   ├── browse/_index.md .si .ta
│   ├── people/_index.md .si .ta
│   └── people/_content.gotmpl    # content adapter: 1 page/person/language, from data
├── i18n/
│   └── en.toml si.toml ta.toml   # UI strings
├── layouts/
│   ├── baseof.html home.html section.html page.html
│   ├── term.html taxonomy.html   # one facet value / list of facet values
│   ├── browse/section.html       # all facets on one page
│   ├── people/page.html          # one person
│   ├── 404.html
│   ├── _shortcodes/documented.html
│   └── partials/                 # head, header, footer, person-cell, pagination,
│                                 #   portrait, loc-place, geo-maps, term-label
├── assets/
│   ├── css/main.css              # DaisyUI "light" theme ported to CSS variables
│   ├── img/flower.png
│   └── people/<slug>.jpg         # vendored submission photos
├── static/                       # favicon, OG image, CNAME
└── .github/workflows/
    ├── refresh-data.yml          # daily: fetch-data → commit data/ + assets/people/
    └── build.yml                 # push: hugo → GitHub Pages
```

## 4. Data model

One record in `data/covid19_deaths.json`:

| Field | Example | Notes |
| --- | --- | --- |
| `indexKey` | `2020-11-02-0001` | Unique id. Shown on the person page. A few upstream values are malformed. |
| `slug` | `2020-11-02-0001` | Added by `fetch-data.mjs`: cleaned, unique, URL-safe. Drives the permalink. |
| `deathDate` | `2020-11-02T05:30:00.000+05:30` | ISO with +5:30 offset. |
| `province` / `district` / `city` | `Western` / `Colombo` / `Colombo 12` | English keys. Localised names come from `geo.json` at render time. `city` missing for ~15 records. |
| `ageType` | `FINE` \| `ROUGH` | `ROUGH` (1 record) carries a range like `70-80`. |
| `ageValue` | `89` | String. |
| `gender` | `Male` \| `Female` | ~0.5% blank. |
| `deathPlace` | `Colombo General Hospital` | Free text. |
| `incarcerated` | `false` | Flagged where the source noted a prison death. |
| `sourceType` | `DGI_PR_DOCS` \| `VERIFIED_SUBMISSION` | 4 records blank. |
| `sourceRef` | `5a281a09…` | Hash → DGI report in `scraped-dgi-reports` (citation link only). |
| `detail` | `null` or `{name, occupation, description, photo}` | Non-null only for the 7 verified family submissions. `photo` rewritten by `fetch-data.mjs` to `people/<slug>.jpg` (or `null` if none / unreachable). |

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

## Stage C — Multilingual & self-containment ✅ (done)

### Delivered

- [x] **Sinhala & Tamil.** Hugo multilingual mode — English at `/`, Sinhala at
      `/si/`, Tamil at `/ta/`. UI strings ported to `i18n/{en,si,ta}.toml`;
      `about` / `approach` / home intro translated (`content/<name>.<lang>.md`);
      header language switcher that cross-links the current page's translations
      (including generated person pages, via `.EnableAllLanguages`).
- [x] **Localised place names.** Province / district / city names render in the
      active language via `data/geo.json`, looked up through a cached map
      (`partials/geo-maps.html` + `loc-place.html`); taxonomy term headings and
      the `/browse/` facets are localised the same way.
- [x] **Self-contained.** `fetch-data.mjs` downloads the 6 submission photos into
      `assets/people/` and rewrites `detail.photo` to a local path. The build
      now touches nothing outside this repo. Source repos are archived; the
      committed snapshot is the record.
- [x] `static/CNAME` = `srilankac19memorial.org`.

### Remaining (secondary datasets — optional)

- **DGI press-release archive.** Vendor `scraped-dgi-reports` (~1,300 releases +
  scanned images) into `data/` + `assets/`; build `/sources/dgi/<ref>/` pages;
  point each person's source line at the local release instead of the GitHub
  citation link.
- **Aggregate context.** Use `dgi_reports_deaths_latest.tsv` (daily age/sex
  bucket counts) for a "what the government reported vs. what we could document"
  panel on `/approach/`.
- **Native-speaker review** of the newly authored si/ta UI strings (pager,
  facet labels, age bands, notes) in `i18n/{si,ta}.toml`.

## Stage D — Living-archive automation & hosting

- **Host: GitHub Pages** (decided). `build.yml` builds with Hugo extended and
  deploys via `actions/deploy-pages`; `static/CNAME` carries the custom domain.
  Needs *Settings → Pages → Source: GitHub Actions* enabled on the repo, and the
  DNS for `srilankac19memorial.org` pointed at Pages.
- **Update loop.** `refresh-data.yml` (daily) commits `data/` + `assets/people/`
  diffs with dated messages → push triggers `build.yml` → deploy. No build
  hooks, no functions.
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
- Performance budget: inline critical CSS, lazy-load flower images (already
  `loading="lazy"`). Fonts stay on Google Fonts by decision — good enough.
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

- **Google Fonts dependency.** UI strings and Sinhala/Tamil rendering pull Noto
  from `fonts.googleapis.com`. Kept by decision ("default fonts are okay"); a
  fully offline archive would self-host the subsets, but that is not planned.
- **Scale.** At ~767 people × 3 languages the build is ~3 s. The design (content
  adapter + taxonomies + cached geo map) scales to tens of thousands of pages;
  only build time grows.
- **Upstream is archived.** The committed snapshot in `data/` + `assets/people/`
  is now the record. `fetch-data.mjs` still works against the archived repos
  (they stay readable) but nothing depends on them at build time.
- **DGI citation links** on person pages point at the archived
  `scraped-dgi-reports`. Vendoring that archive (Stage C remaining) would make
  even those local.
- **si/ta wording** for the strings authored in this rebuild wants a native
  review before wide sharing.
