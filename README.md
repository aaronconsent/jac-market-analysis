# JAC Builders — Roofing Paid-Ads Market Analysis (Orlando + Tampa)

A market-sizing pipeline + interactive React dashboard that compares the
**Orlando (Central Florida)** and **Tampa Bay (Gulf Coast)** metros for JAC
Builders' Search-ads program. Use it to decide where the paid-ads sweet spot
is — cost per booked job as a function of service radius, CPC position, and
your conversion assumptions.

## Prereqs

- Node 18+ (uses global `fetch`).
- A DataForSEO account. Export creds in the terminal (they never touch code):

  ```bash
  export DFS_LOGIN="your_api_login"
  export DFS_PASSWORD="your_api_password"
  ```

## First run

```bash
npm install
cd app && npm install && cd ..
npm run pipeline          # collect.js + process.js — writes data/dashboard-data.json (~$3 in API cost)
npm run dev               # http://localhost:5173
```

`npm run pipeline` prints the total DataForSEO spend at the end and warns on
any city that failed to return volumes (it does not fail the run).

## Swapping in the real JAC office addresses

The dashboard centers each metro on an office anchor. Placeholders sit in
[`data/cities-geo.json`](data/cities-geo.json) under
`metros.orlando.anchor` and `metros.tampa.anchor`:

```json
"anchor": { "name": "…", "lat": 28.5384, "lng": -81.3789 }
```

Update `lat`/`lng` and re-run `npm run process` (no API calls) — the radius
and distance math will re-compute against the new anchor.

## Monthly refresh

Responses are cached in `data/raw/*.json` so re-runs return instantly and
cost $0. To pull fresh Google Ads figures:

```bash
npm run collect:fresh    # forces LIVE billed calls (~$3)
npm run process
```

Commit the updated `data/dashboard-data.json` (it's the only file the app
reads at runtime) and redeploy.

## What each assumption slider means

| Slider | Default | Why that default |
|---|---:|---|
| Service radius | 15 mi | Typical single-crew service radius; sweep 5–50 to see the reach curve. |
| Impression share | 65% | Achievable with sustained bidding + healthy Quality Score in mid-competitive local markets. |
| Click-through rate | 13% | Local-services Search benchmark for the top 3 positions with good ad copy. |
| Conversion rate (click → lead) | 13% | Home-services Search Ads industry median (WordStream/Google benchmarks). Range 8–20% covers laggards through best-in-class landing pages. |
| Booking rate (lead → job) | 60% | Roofing outbound speed-to-lead + sales-close typical band 40–80%. |
| Position strategy | Smart 3–4 | Position #1 on "near me" head terms roughly doubles CPC vs positions 3–4; the toggle lets you A/B the cost per booked job. |

Replace defaults with account actuals as soon as you have them; every slider
is live-wired to every metric.

## Files

```
collect.js          # DataForSEO puller (Search Volume + Keywords-for-Keywords)
process.js          # Merge + weighted-avg + seasonal index → dashboard-data.json
data/cities-geo.json      # City lat/lng per metro + office anchors (hand-maintained)
data/raw/                 # Cached API responses (gitignored)
data/dashboard-data.json  # Final dataset the dashboard reads (gitignored by default)
app/                # Vite React dashboard (metro toggle, radius slider, position toggle)
```

## Honest data caveats

- Google Keyword Planner rounds/bands small-city volumes; treat them as
  directional, not billing-grade.
- City volumes can partially overlap where metros bleed together (e.g.
  Sarasota vs Bradenton). The dashboard footnote states this.
- CPC bids are Google Ads top-of-page suggestions, not real auction wins.
  Real CPCs settle 10–30% below suggested for well-run accounts.
- Cities that returned no data are marked `estimated: true` and render with
  a dashed red marker on the map.
