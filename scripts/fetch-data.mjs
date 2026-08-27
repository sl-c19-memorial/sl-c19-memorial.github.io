#!/usr/bin/env node
/**
 * fetch-data.mjs
 *
 * Pulls the latest upstream snapshots into ./data so the site can be built
 * fully offline. This is the ONLY network step in the whole project; running
 * `hugo` afterwards needs nothing but the files in this repo.
 *
 * Upstream sources (all published on the `data` branch of their repos):
 *   - sl-c19-memorial/memorial-dataset   -> manually documented deaths + geo table
 *   - sl-c19-memorial/scraped-dgi-reports -> DGI press-release archive (Stage C)
 *
 * Usage:  node scripts/fetch-data.mjs
 *
 * Writes:
 *   data/covid19_deaths.json  raw documented-death records (newest first)
 *   data/geo.json             provinces / districts / cities with en|si|ta names
 *   data/site_stats.json      headline counters used across the layouts
 */

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data");

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

  console.log(
    `Wrote ${stats.documented} documented records ` +
      `(official toll ${stats.cumDeaths} as of ${stats.cumDeathsAsOf}).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
