#!/usr/bin/env node
/**
 * collect.js — DataForSEO puller for the JAC Builders roofing market analysis
 * (Orlando + Tampa Bay metros).
 *
 * Env: DFS_LOGIN, DFS_PASSWORD.
 * Caching: every response is written to data/raw/<hash>.json and re-used on
 * subsequent runs unless --fresh is passed (which forces LIVE billed calls).
 * The script prints total cost from each response's `cost` field.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DFS = "https://api.dataforseo.com/v3";
const LOGIN = process.env.DFS_LOGIN;
const PASSWORD = process.env.DFS_PASSWORD;
const FRESH = process.argv.includes("--fresh");
const ROOT = path.dirname(new URL(import.meta.url).pathname);
const RAW = path.join(ROOT, "data", "raw");
fs.mkdirSync(RAW, { recursive: true });

if (!LOGIN || !PASSWORD) {
  console.error("ERROR: export DFS_LOGIN and DFS_PASSWORD before running.");
  process.exit(1);
}

// --- Roofing keyword set (adapted from garage-door for JAC Builders) --------
const CORE_KEYWORDS = [
  "roof repair",
  "roof repair near me",
  "roofer near me",
  "roofing contractor",
  "roof replacement",
  "new roof",
  "roof installation",
  "roof leak repair",
  "roof leak",
  "storm damage roof repair",
  "hail damage roof",
  "emergency roof repair",
  "shingle roof repair",
  "tile roof repair",
  "roof inspection",
];

// Head terms used for position1 vs position3-4 CPC spread (Phase 2).
const HEAD_TERMS = new Set([
  "roof repair",
  "roof repair near me",
  "roofer near me",
  "roofing contractor",
  "roof replacement",
]);

const GEO = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "cities-geo.json"), "utf8"));

let totalCost = 0;
let failedCities = [];

function auth() {
  return "Basic " + Buffer.from(`${LOGIN}:${PASSWORD}`).toString("base64");
}

function cacheKey(endpoint, body) {
  const h = crypto.createHash("sha1").update(endpoint + JSON.stringify(body)).digest("hex").slice(0, 16);
  return path.join(RAW, `${h}.json`);
}

async function call(endpoint, body, label) {
  const cacheFile = cacheKey(endpoint, body);
  if (!FRESH && fs.existsSync(cacheFile)) {
    const j = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
    console.log(`  [cache] ${label}`);
    return j;
  }
  const res = await fetch(DFS + endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: auth() },
    body: JSON.stringify(body),
  });
  const j = await res.json();
  fs.writeFileSync(cacheFile, JSON.stringify(j, null, 2));
  const cost = typeof j.cost === "number" ? j.cost : 0;
  totalCost += cost;
  const status = j.status_code;
  console.log(`  [live]  ${label}  status=${status}  $${cost.toFixed(4)}`);
  if (status !== 20000) console.warn(`      WARN: non-20000 status: ${j.status_message}`);
  return j;
}

// --- Phase 1a: per-city search volumes --------------------------------------
// DataForSEO's Google Ads location index uses varied conventions ("St." with
// period, "Saint" spelled out, apostrophes). Try common variants, then fall
// back to the Locations API to find the city's numeric location_code.
function nameVariants(name) {
  const out = new Set([name]);
  if (/^St\b/i.test(name)) {
    out.add(name.replace(/^St\b/i, "Saint"));
    out.add(name.replace(/^St\b/i, "St."));
  }
  if (/^Land O Lakes$/i.test(name)) out.add("Land O' Lakes");
  return [...out];
}

// Cache of Google Ads US locations (one large list). Fetched at most once.
let usLocations = null;
async function loadUsLocations() {
  if (usLocations) return usLocations;
  const cacheFile = path.join(RAW, "us-locations.json");
  if (!FRESH && fs.existsSync(cacheFile)) {
    usLocations = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
    console.log(`  [cache] google-ads locations/us (${usLocations.length})`);
    return usLocations;
  }
  const res = await fetch(DFS + "/keywords_data/google_ads/locations/us", {
    method: "GET", headers: { Authorization: auth() },
  });
  const j = await res.json();
  fs.writeFileSync(cacheFile, JSON.stringify(j, null, 2));
  usLocations = (j.tasks?.[0]?.result) || [];
  console.log(`  [live]  google-ads locations/us  entries=${usLocations.length}`);
  return usLocations;
}

async function resolveLocationCode(cityName) {
  const list = await loadUsLocations();
  const needle = cityName.toLowerCase().replace(/[.']/g, "").trim();
  const candidates = list.filter(l => {
    if (l.country_iso_code !== "US") return false;
    const n = (l.location_name || "").toLowerCase();
    if (!n.includes("florida")) return false;
    const first = n.split(",")[0].replace(/[.']/g, "").trim();
    return first === needle || first === "saint " + needle.replace(/^st\s+/, "");
  });
  // prefer City over sub-types (Airport, University, etc.) — City lands as basic entry with type=City
  candidates.sort((a, b) => (a.location_type === "City" ? -1 : 1) - (b.location_type === "City" ? -1 : 1));
  return candidates[0] || null;
}

async function pullCity(metroKey, city) {
  for (const variant of nameVariants(city.name)) {
    const locName = `${variant},Florida,United States`;
    const body = [{
      location_name: locName,
      language_code: "en",
      keywords: CORE_KEYWORDS,
      search_partners: false,
    }];
    const j = await call(
      "/keywords_data/google_ads/search_volume/live",
      body,
      `search-volume ${metroKey}:${variant}`
    );
    const task = (j.tasks || [])[0];
    if (task && task.status_code === 20000 && task.result) {
      return { city: city.name, location_name: locName, items: task.result };
    }
  }
  // Fallback: resolve via Locations API and retry by location_code
  const loc = await resolveLocationCode(city.name);
  if (loc) {
    console.log(`      resolved ${city.name} -> location_code=${loc.location_code} (${loc.location_name})`);
    const j = await call(
      "/keywords_data/google_ads/search_volume/live",
      [{ location_code: loc.location_code, language_code: "en", keywords: CORE_KEYWORDS, search_partners: false }],
      `search-volume ${metroKey}:${city.name}#${loc.location_code}`
    );
    const task = (j.tasks || [])[0];
    if (task && task.status_code === 20000 && task.result) {
      return { city: city.name, location_name: loc.location_name, items: task.result };
    }
  }
  failedCities.push({ metro: metroKey, city: city.name, reason: "not resolvable via name or locations API" });
  return null;
}

// --- Phase 1b: DMA-level keyword universe expansion -------------------------
async function pullDmaUniverse(metroKey, dmaName) {
  const body = [{
    location_name: dmaName,
    language_code: "en",
    keywords: ["roof repair", "roof replacement", "roofing contractor"],
    include_seed_keyword: true,
    include_serp_info: false,
    limit: 1000,
  }];
  const j = await call(
    "/keywords_data/google_ads/keywords_for_keywords/live",
    body,
    `dma-expand ${metroKey}`
  );
  const task = (j.tasks || [])[0];
  if (!task || task.status_code !== 20000) {
    console.warn(`  WARN: DMA expansion failed for ${metroKey} — long-tail multiplier will fall back to 1.0`);
    return [];
  }
  const raw = task.result || [];
  // Filter to service-intent commercial terms; drop DIY/parts/how-to/jobs/brand names.
  const KEEP = /\b(repair|replace|replacement|install|installation|fix|leak|storm|hail|damage|inspect|inspection|shingle|tile|metal|flat|contractor|company|service|emergency|cost|price|near me|financing|estimate|quote)\b/i;
  const DROP = /\b(diy|how to|youtube|jobs|salary|manual|schematic|parts only|calculator|game|meme|amazon|home depot|lowes|owens corning|gaf|certainteed|iko|malarkey|tamko)\b/i;
  const kept = raw
    .filter(r => r.keyword && KEEP.test(r.keyword) && !DROP.test(r.keyword))
    .filter(r => (r.search_volume || 0) >= 10)
    .sort((a, b) => (b.search_volume || 0) - (a.search_volume || 0))
    .slice(0, 60);
  return kept;
}

// --- Main -------------------------------------------------------------------
async function main() {
  console.log(`DataForSEO puller — ${FRESH ? "FRESH (LIVE BILLED)" : "cached where possible"}`);
  const out = { generated_at: new Date().toISOString(), metros: {} };

  for (const [metroKey, metro] of Object.entries(GEO.metros)) {
    console.log(`\n=== ${metro.label} ===`);
    const cityPulls = [];
    for (const city of metro.cities) {
      const r = await pullCity(metroKey, city);
      if (r) cityPulls.push(r);
    }
    console.log(`Expanding DMA universe: ${metro.dma_location_name}`);
    const universe = await pullDmaUniverse(metroKey, metro.dma_location_name);
    out.metros[metroKey] = {
      label: metro.label,
      dma_location_name: metro.dma_location_name,
      anchor: metro.anchor,
      cities: metro.cities,
      city_pulls: cityPulls,
      dma_universe: universe,
    };
  }

  out.core_keywords = CORE_KEYWORDS;
  out.head_terms = [...HEAD_TERMS];
  out.failed_cities = failedCities;
  out.total_cost_usd = +totalCost.toFixed(4);

  const outPath = path.join(ROOT, "data", "raw-pulls.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\nWrote ${outPath}`);
  console.log(`Total DataForSEO spend this run: $${totalCost.toFixed(4)}`);
  if (failedCities.length) {
    console.log(`Failed cities (${failedCities.length}): ${JSON.stringify(failedCities)}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
