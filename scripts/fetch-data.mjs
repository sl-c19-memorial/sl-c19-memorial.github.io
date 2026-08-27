#!/usr/bin/env node
/**
 * fetch-data.mjs
 *
 * Pulls the upstream dataset into this repo and vendors every asset it
 * references, so the site is fully self-contained. After this runs, building
 * with `hugo` needs nothing from the network and nothing from the (now
 * archived) source repositories.
 *
 * Historic upstream (read-only archives):
 *   - sl-c19-memorial/memorial-dataset    documented deaths + geo table + photos
 *   - sl-c19-memorial/scraped-dgi-reports  DGI press-release archive
 *
 * Usage:  node scripts/fetch-data.mjs
 *
 * Writes:
 *   data/covid19_deaths.json   documented-death records, newest first,
 *                              slug-normalised, submitted photos rewritten to
 *                              local paths under assets/people/
 *   data/geo.json              provinces / districts / cities with en|si|ta names
 *   data/site_stats.json       headline counters used across the layouts
 *   assets/people/<slug>.jpg   vendored submission photos
 */

import { writeFile, mkdir, readdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data");
const PHOTOS = path.join(ROOT, "assets", "people");

const RAW = "https://raw.githubusercontent.com/sl-c19-memorial";
const SOURCES = {
  deaths: `${RAW}/memorial-dataset/data/data/covid19_deaths_latest.json`,
  geo: `${RAW}/memorial-dataset/data/data/geo_processed_latest.json`,
  keys: `${RAW}/memorial-dataset/data/data/user_keys_latest.json`,
};

async function getJSON(url) {
  const res = await fetch(url, { headers: { "user-agent": "memorial-static/fetch-data" } });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
  return res.json();
}

async function getBinary(url) {
  const res = await fetch(url, { headers: { "user-agent": "memorial-static/fetch-data" } });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  console.log("Fetching upstream snapshots ...");
  const [deaths, geo, keys] = await Promise.all([
    getJSON(SOURCES.deaths),
    getJSON(SOURCES.geo),
    getJSON(SOURCES.keys),
  ]);

  // A handful of upstream indexKey values are malformed (stray spaces, "*",
  // short date parts). Derive a clean, unique URL slug without losing the
  // original key, which is still shown on the person page.
  const seen = new Map();
  const toSlug = (key) => {
    let s = String(key).trim().replace(/\s+/g, "").replace(/\*/g, "-");
    if (!s) s = "record";
    const n = (seen.get(s) ?? 0) + 1;
    seen.set(s, n);
    return n === 1 ? s : `${s}--dup${n}`;
  };

  // The site renders newest death first, matching the original web app.
  const ordered = [...deaths].reverse().map((r) => ({ ...r, slug: toSlug(r.indexKey) }));

  const malformed = ordered.filter((r) => r.slug !== String(r.indexKey).trim());
  if (malformed.length) {
    console.warn(
      `Normalised ${malformed.length} malformed indexKey(s): ` +
        malformed.map((r) => `"${r.indexKey}" -> ${r.slug}`).join(", "),
    );
  }

  // Vendor submitted photos. Rewrite detail.photo to a repo-local asset path
  // (relative to assets/) and drop the remote URL entirely.
  await rm(PHOTOS, { recursive: true, force: true });
  await mkdir(PHOTOS, { recursive: true });
  let vendored = 0;
  for (const r of ordered) {
    const remote = r.detail && r.detail.photo;
    if (!remote) {
      if (r.detail) r.detail.photo = null;
      continue;
    }
    const ext = (path.extname(new URL(remote).pathname) || ".jpg").toLowerCase();
    const file = `${r.slug}${ext}`;
    try {
      const bytes = await getBinary(remote);
      await writeFile(path.join(PHOTOS, file), bytes);
      r.detail.photo = `people/${file}`;
      vendored += 1;
    } catch (err) {
      console.warn(`  photo for ${r.indexKey} failed (${err.message}); falling back to flower`);
      r.detail.photo = null;
    }
  }

  // keys is the cumulative-deaths time series; its tail is the official toll.
  const lastKey = keys[keys.length - 1] ?? {};

  const stats = {
    cumDeaths: lastKey.cumDeaths ?? null,
    cumDeathsAsOf: lastKey.deathDate ?? null,
    documented: ordered.length,
    documentedFrom: ordered.reduce(
      (min, r) => (r.deathDate < min ? r.deathDate : min),
      ordered[0]?.deathDate ?? null,
    ),
    documentedTo: ordered.reduce(
      (max, r) => (r.deathDate > max ? r.deathDate : max),
      ordered[0]?.deathDate ?? null,
    ),
    refreshedAt: new Date().toISOString(),
  };

  await writeFile(path.join(DATA, "covid19_deaths.json"), JSON.stringify(ordered, null, 2) + "\n");
  await writeFile(path.join(DATA, "geo.json"), JSON.stringify(geo, null, 2) + "\n");
  await writeFile(path.join(DATA, "site_stats.json"), JSON.stringify(stats, null, 2) + "\n");

  const kept = (await readdir(PHOTOS)).length;
  console.log(
    `Wrote ${stats.documented} documented records ` +
      `(official toll ${stats.cumDeaths} as of ${stats.cumDeathsAsOf}); ` +
      `vendored ${vendored} photo(s), ${kept} on disk.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
