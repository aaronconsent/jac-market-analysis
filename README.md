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

## Assumption defaults (conservative, sourced)

Defaults are set to the **conservative side** of published 2025-26 roofing /
home-services benchmarks — so the dashboard's baseline output reflects a
realistic worst-case, not a best-case. Adjust every slider up or down as
you get JAC's actual account data.

| Slider | Default | Published benchmark | Why conservative here |
|---|---:|---|---|
| Service radius | 15 mi | — | Typical single-crew radius; sweep 5–50 to see the reach curve. |
| Impression share | **40%** | 60–80% "ideal and realistic" for mature campaigns; new/limited-budget local commonly 30–50% ([StoreYA][is1], [WordStream][is2]) | Assume a launching or moderately-funded campaign, not a mature one. |
| Click-through rate | **5%** | Home services average **4.8%** in 2025; construction/general contractors **6.25%**; plumbing 3.34% ([LocaliQ 2025 benchmarks][ctr1]) | Roofing sits in the ~5% band — right at the home-services average, not above it. |
| Conversion rate (click → lead) | **4%** | Roofing & Gutters **3.7%** — one of the lowest CVRs in home services ([LocaliQ][cvr1], [MDM PPC][cvr2]). Roofing requires trust proofs (portfolio, insurance) that lengthen the decision. | Round the industry figure up slightly to 4% — anything higher is optimistic without proven landing pages. |
| Position strategy | Smart 3–4 | Position #1 on head terms costs ~3-4× the low-top-of-page bid | Playing at 3–4 keeps CPA sane; toggle to "Own #1" to see how much more you'd pay per lead. |

**Note on booked-job math:** the earlier version of the dashboard converted
cost-per-lead into cost-per-booked-job via a booking-rate assumption. That
was one guess too many stacked on top of another; we now stop at
**cost per lead**. Sales close rate is a JAC-side operational metric —
apply it in the sales conversation, not baked into the media plan.

Replace defaults with account actuals as soon as you have them; every slider
is live-wired to every metric.

[is1]: https://www.storeya.com/ppc/GuideGoogleAdWordsImpressionShare
[is2]: https://www.wordstream.com/blog/ws/2023/06/07/impression-share
[ctr1]: https://localiq.com/blog/home-services-search-advertising-benchmarks/
[cvr1]: https://localiq.com/blog/home-services-search-advertising-benchmarks/
[cvr2]: https://mdmppc.com/google-ads-benchmarks/roofing/

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
