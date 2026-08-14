#!/usr/bin/env node
/**
 * collect-lsa.js — automate the pull-able half of the LSA Lead Diagnostic
 * intake for a given client (default JAC Builders) across its metros.
 *
 * For each metro:
 *   1. Look up the client's Google Business Profile — review count + rating.
 *   2. For each money query (roofing contractor X, roof repair X, near me...),
 *      pull the local pack top-3 with business name + rating + review count.
 *   3. Look up each unique competitor's GBP for a richer picture.
 *
 * Writes data/lsa-data.json (+ copy into app/public/ for Vite).
 *
 * What this can NOT pull (LSA-account-only; still manual on the page):
 *   impressions/30d, verified/badge status, ad running status, account age,
 *   ever-generated-leads. Fields marked accordingly in the output.
 *
 * Env: DFS_LOGIN, DFS_PASSWORD. Uses cache in data/raw/. --fresh to force live.
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

const GEO = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "cities-geo.json"), "utf8"));
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "client-config.json"), "utf8"));

let totalCost = 0;

function auth() {
  return "Basic " + Buffer.from(`${LOGIN}:${PASSWORD}`).toString("base64");
}
function cacheKey(endpoint, body) {
  const h = crypto.createHash("sha1").update(endpoint + JSON.stringify(body)).digest("hex").slice(0, 16);
  return path.join(RAW, `${h}.json`);
}
async function call(endpoint, body, label) {
  const cf = cacheKey(endpoint, body);
  if (!FRESH && fs.existsSync(cf)) {
    console.log(`  [cache] ${label}`);
    return JSON.parse(fs.readFileSync(cf, "utf8"));
  }
  const res = await fetch(DFS + endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: auth() },
    body: JSON.stringify(body),
  });
  const j = await res.json();
  fs.writeFileSync(cf, JSON.stringify(j, null, 2));
  const cost = typeof j.cost === "number" ? j.cost : 0;
  totalCost += cost;
  console.log(`  [live]  ${label}  status=${j.status_code}  $${cost.toFixed(4)}`);
  if (j.status_code !== 20000) console.warn(`      WARN: ${j.status_message}`);
  return j;
}

/**
 * SERP local-pack top-3 for a query in a given city.
 * Returns [{ rank, name, rating, review_count, place_id?, cid?, url? }].
 */
async function localPackTop3(query, cityLocationName) {
  const body = [{
    keyword: query,
    location_name: cityLocationName,
    language_code: "en",
    device: "desktop",
    depth: 20,
  }];
  const j = await call("/serp/google/organic/live/advanced", body,
    `serp: ${query} @ ${cityLocationName}`);
  const items = j.tasks?.[0]?.result?.[0]?.items || [];
  // Local pack items have type=local_pack containing sub-items
  const lp = items.find(i => i.type === "local_pack");
  const arr = lp?.items || items.filter(i => i.type === "local_pack");
  // Some responses put local_pack as items array directly
  const rows = Array.isArray(arr) ? arr : (lp?.items || []);
  const top3 = rows.slice(0, 3).map((it, i) => ({
    rank: i + 1,
    name: it.title || it.name || null,
    rating: it.rating?.value ?? it.rating_value ?? null,
    review_count: it.rating?.votes_count ?? it.rating_reviews_count ?? it.reviews_count ?? null,
    cid: it.cid ?? null,
    place_id: it.place_id ?? null,
    url: it.url ?? it.domain ?? null,
  }));
  return top3;
}

/**
 * Look up a specific business's GBP details by name + location.
 * Uses my_business_info live endpoint. Returns { name, rating, review_count, ... } or null.
 */
async function gbpByName(keyword, locationName) {
  const body = [{
    keyword,
    location_name: locationName,
    language_code: "en",
  }];
  const j = await call("/business_data/google/my_business_info/live", body, `gbp: "${keyword}" @ ${locationName}`);
  const items = j.tasks?.[0]?.result?.[0]?.items || [];
  const item = items[0];
  if (!item) return null;
  return {
    resolved_name: item.title || item.name,
    rating: item.rating?.value ?? null,
    review_count: item.rating?.votes_count ?? item.rating_reviews_count ?? null,
    place_id: item.place_id ?? null,
    cid: item.cid ?? null,
    address: item.address ?? null,
    domain: item.domain ?? null,
    is_claimed: item.is_claimed ?? null,
  };
}

// --- Main -------------------------------------------------------------------
async function main() {
  console.log(`LSA collector — client="${CFG.client.name}" trade="${CFG.client.trade}" — ${FRESH ? "FRESH (LIVE BILLED)" : "cached where possible"}`);
  const out = {
    generated_at: new Date().toISOString(),
    client: {
      id: CFG.client.id,
      name: CFG.client.name,
      trade: CFG.client.trade,
      metros: {},
    },
    money_queries_by_metro: {},
    non_automatable: {
      // Explicit list so the front-end labels these as manual-only
      fields: [
        "platform_status",
        "verified_badge_status",
        "ad_running_status",
        "impressions_30d",
        "account_age_months",
        "ever_generated_leads",
      ],
      reason: "These live in the LSA / Google Ads account UI and require the client's login. Not exposed via DataForSEO.",
    },
    total_cost_usd: 0,
  };

  for (const metroKey of CFG.client.metros) {
    const metro = GEO.metros[metroKey];
    if (!metro) continue;
    console.log(`\n=== ${metro.label} ===`);
    const primaryCity = CFG.money_query_primary_city[metroKey] || metro.cities[0].name;
    const primaryLoc = `${primaryCity},Florida,United States`;

    // 1) Client's GBP for this metro — try multiple search terms
    let clientGbp = null;
    for (const term of CFG.client.gbp_search_terms) {
      const g = await gbpByName(term, primaryLoc);
      if (g && g.review_count != null) { clientGbp = g; break; }
    }
    out.client.metros[metroKey] = clientGbp || { resolved_name: null, note: "No GBP match returned for this metro" };

    // 2) Money queries — top-3 local pack per query
    const queries = CFG.money_query_templates.map(t =>
      t.replaceAll("{trade}", CFG.client.trade.toLowerCase())
       .replaceAll("{city}", primaryCity)
    );
    const perQuery = [];
    const seenCompetitors = new Map();
    for (const q of queries) {
      const top3 = await localPackTop3(q, primaryLoc);
      const top3ReviewCount = top3.map(r => r.review_count).filter(n => typeof n === "number");
      const median = medianOf(top3ReviewCount);
      perQuery.push({
        query: q,
        location_name: primaryLoc,
        top3,
        top3_review_median: median,
      });
      // Track competitors for optional richer GBP lookup
      for (const c of top3) {
        if (c.name) seenCompetitors.set(c.name.toLowerCase(), c);
      }
    }
    // Median across all money-query top-3 medians (a simple "typical review moat")
    const allMedians = perQuery.map(q => q.top3_review_median).filter(n => typeof n === "number");
    const metroMedian = medianOf(allMedians);

    out.money_queries_by_metro[metroKey] = {
      primary_city: primaryCity,
      primary_location_name: primaryLoc,
      queries: perQuery,
      review_moat_median: metroMedian,
      unique_competitor_count: seenCompetitors.size,
    };
  }

  out.total_cost_usd = +totalCost.toFixed(4);
  const outPath = path.join(ROOT, "data", "lsa-data.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  const appDest = path.join(ROOT, "app", "public", "lsa-data.json");
  fs.mkdirSync(path.dirname(appDest), { recursive: true });
  fs.copyFileSync(outPath, appDest);

  console.log(`\nWrote ${outPath}`);
  console.log(`Total DFS spend this run: $${totalCost.toFixed(4)}`);
  for (const metroKey of CFG.client.metros) {
    const g = out.client.metros[metroKey];
    const q = out.money_queries_by_metro[metroKey];
    const gap = (g?.review_count && q?.review_moat_median)
      ? (q.review_moat_median / g.review_count).toFixed(1) + "×"
      : "n/a";
    console.log(`  [${metroKey}] JAC GBP: ${g?.review_count ?? "?"} reviews @ ${g?.rating ?? "?"}★  |  top-3 review moat (median): ${q?.review_moat_median ?? "?"}  |  gap: ${gap}`);
  }
}

function medianOf(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

main().catch(e => { console.error(e); process.exit(1); });
