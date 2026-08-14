#!/usr/bin/env node
/**
 * process.js — merge raw DataForSEO pulls into dashboard-data.json.
 * Per-city: coreVolume, estimatedTotalVolume (× long-tail multiplier),
 * weightedCPC, seasonalIndex (12 months), distanceMiles from metro anchor.
 * Per-metro: longTailMultiplier, position1CPC, position34CPC.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const raw = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "raw-pulls.json"), "utf8"));

// --- Haversine distance in miles --------------------------------------------
function distMiles(a, b) {
  const toRad = d => (d * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// --- Volume-weighted average of a numeric field across keyword items --------
function weightedAvg(items, field) {
  let num = 0, den = 0;
  for (const it of items) {
    const v = it[field];
    const w = it.search_volume || 0;
    if (typeof v === "number" && !isNaN(v) && w > 0) { num += v * w; den += w; }
  }
  return den > 0 ? num / den : null;
}

// --- Seasonal index: normalize each month against a keyword's 12-mo mean, ---
// then average across keywords weighted by volume. Returns array of 12 numbers
// (index=0 → Jan) where 1.0 = average month.
function seasonalIndex(items) {
  const monthTotals = Array(12).fill(0);
  const monthWeights = Array(12).fill(0);
  for (const it of items) {
    const ms = it.monthly_searches;
    if (!Array.isArray(ms) || ms.length === 0) continue;
    const mean = ms.reduce((a, m) => a + (m.search_volume || 0), 0) / ms.length;
    if (mean <= 0) continue;
    const w = it.search_volume || mean;
    for (const m of ms) {
      const i = (m.month || 1) - 1;
      if (i < 0 || i > 11) continue;
      monthTotals[i] += ((m.search_volume || 0) / mean) * w;
      monthWeights[i] += w;
    }
  }
  return monthTotals.map((t, i) => (monthWeights[i] > 0 ? +(t / monthWeights[i]).toFixed(3) : 1));
}

// --- Per-city summary from its Google Ads Search Volume items ---------------
function summarizeCity(cityPull) {
  if (!cityPull) return null;
  const items = cityPull.items || [];
  const coreVolume = items.reduce((a, it) => a + (it.search_volume || 0), 0);
  const weightedCPC = weightedAvg(items, "cpc");
  const highTopBid = weightedAvg(items, "high_top_of_page_bid");
  const lowTopBid = weightedAvg(items, "low_top_of_page_bid");
  const season = seasonalIndex(items);
  return {
    name: cityPull.city,
    coreVolume,
    weightedCPC,
    highTopBid,
    lowTopBid,
    seasonalIndex: season,
  };
}

// --- DMA position spread from head-term subset ------------------------------
function dmaPositionSpread(universe, headTerms) {
  const set = new Set(headTerms.map(t => t.toLowerCase()));
  const head = universe.filter(u => set.has((u.keyword || "").toLowerCase()));
  const src = head.length > 0 ? head : universe.slice(0, 15);
  return {
    position1CPC: weightedAvg(src, "high_top_of_page_bid"),
    position34CPC: weightedAvg(src, "low_top_of_page_bid"),
    basisTerms: src.length,
  };
}

// --- Main -------------------------------------------------------------------
const out = { generated_at: raw.generated_at, metros: {} };

for (const [key, metro] of Object.entries(raw.metros)) {
  const anchor = metro.anchor;
  const cityMap = new Map(metro.cities.map(c => [c.name, c]));

  // Per-city summaries + distance from anchor
  const citySummaries = (metro.city_pulls || []).map(cp => {
    const geo = cityMap.get(cp.city);
    const s = summarizeCity(cp);
    if (!s) return null;
    s.lat = geo?.lat;
    s.lng = geo?.lng;
    s.distanceMiles = geo ? +distMiles(anchor, geo).toFixed(2) : null;
    return s;
  }).filter(Boolean);

  // Any cities without pulls (failed) — mark estimated for the dashboard
  const gotNames = new Set(citySummaries.map(c => c.name));
  const missing = metro.cities.filter(c => !gotNames.has(c.name)).map(c => ({
    name: c.name, lat: c.lat, lng: c.lng,
    distanceMiles: +distMiles(anchor, c).toFixed(2),
    coreVolume: 0, weightedCPC: null,
    seasonalIndex: Array(12).fill(1),
    estimated: true,
  }));

  // Long-tail multiplier: DMA universe total volume / DMA universe volume of core-term subset
  const universe = metro.dma_universe || [];
  const coreSet = new Set(raw.core_keywords.map(k => k.toLowerCase()));
  const dmaCoreVol = universe.filter(u => coreSet.has((u.keyword || "").toLowerCase()))
                             .reduce((a, u) => a + (u.search_volume || 0), 0);
  const dmaTotalVol = universe.reduce((a, u) => a + (u.search_volume || 0), 0);
  const longTailMultiplier = dmaCoreVol > 0 ? +(dmaTotalVol / dmaCoreVol).toFixed(2) : 1.0;

  for (const c of citySummaries) {
    c.estimatedTotalVolume = Math.round(c.coreVolume * longTailMultiplier);
  }

  const posSpread = dmaPositionSpread(universe, raw.head_terms);

  out.metros[key] = {
    label: metro.label,
    anchor,
    dma_location_name: metro.dma_location_name,
    longTailMultiplier,
    position1CPC: posSpread.position1CPC,
    position34CPC: posSpread.position34CPC,
    positionSpreadBasisTerms: posSpread.basisTerms,
    dmaUniverseSize: universe.length,
    cities: [...citySummaries, ...missing].sort((a, b) => a.distanceMiles - b.distanceMiles),
  };
}

const outPath = path.join(ROOT, "data", "dashboard-data.json");
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
// Also drop a copy inside the React app so Vite bundles it.
const appDest = path.join(ROOT, "app", "public", "dashboard-data.json");
fs.mkdirSync(path.dirname(appDest), { recursive: true });
fs.copyFileSync(outPath, appDest);

// Sanity readout
console.log("Wrote " + outPath);
for (const [key, m] of Object.entries(out.metros)) {
  const inRadius30 = m.cities.filter(c => c.distanceMiles <= 30);
  const coreVol30 = inRadius30.reduce((a, c) => a + c.coreVolume, 0);
  const estVol30 = inRadius30.reduce((a, c) => a + (c.estimatedTotalVolume || 0), 0);
  console.log(`\n[${m.label}]`);
  console.log(`  long-tail multiplier: ${m.longTailMultiplier}   universe size: ${m.dmaUniverseSize}`);
  console.log(`  position #1 CPC (head): $${(m.position1CPC || 0).toFixed(2)}   position 3-4 CPC: $${(m.position34CPC || 0).toFixed(2)}`);
  console.log(`  at 30-mi radius: ${inRadius30.length} cities, core vol/mo=${coreVol30}, est-total=${estVol30}`);
  if (coreVol30 < 500 || coreVol30 > 20000) {
    console.log(`  ⚠  30-mi core volume ${coreVol30} is outside the sanity band (500-20000). Investigate.`);
  }
  const est = m.cities.filter(c => c.estimated).map(c => c.name);
  if (est.length) console.log(`  estimated (no pull) cities: ${est.join(", ")}`);
}
