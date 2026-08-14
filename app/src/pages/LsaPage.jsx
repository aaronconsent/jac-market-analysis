import React, { useEffect, useMemo, useState } from "react";

/**
 * LSA Lead Diagnostic — interactive translation of the lsa-lead-diagnostic
 * skill (see /references/lsa-diagnostic-skill.md). Walks trade + market +
 * account state into a Serving-vs-Ranking track, tailored 4-phase checklist,
 * and an exportable markdown deliverable.
 */

const TRADES = {
  "Roofing":            { cplLow: 80,  cplHigh: 150, note: "Most saturated home-service vertical in many metros; storm-driven demand spikes; storm-chaser competition." },
  "HVAC":               { cplLow: 50,  cplHigh: 120, note: "Seasonal spikes (heat waves / cold snaps)." },
  "Electrical":         { cplLow: 40,  cplHigh: 100, note: "Balanced demand year-round." },
  "Plumbing":           { cplLow: 30,  cplHigh: 90,  note: "Emergency-driven; after-hours coverage is a big lever." },
  "Garage door":        { cplLow: 25,  cplHigh: 60,  note: "Among the cheapest trades; low avg ticket; small-market volume ceilings are common." },
  "Locksmith":          { cplLow: 20,  cplHigh: 50,  note: "High fraud/spam lead rates; dispute hygiene matters." },
  "House cleaning":     { cplLow: 15,  cplHigh: 45,  note: "High volume, low ticket." },
  "Lawn care":          { cplLow: 15,  cplHigh: 45,  note: "High volume, low ticket; strong seasonality." },
  "Water damage":       { cplLow: 100, cplHigh: 250, note: "Highest CPLs in home services." },
  "Other":              { cplLow: 40,  cplHigh: 120, note: "Verify with a quick web search for current trade CPL band." },
};

const MARKET_SIZES = {
  "small":    "Small city / single town — demand ceiling is real; zero-lead days can be demand, not rank. Judge weekly/monthly, not daily.",
  "midsize":  "Mid-size metro — balanced; top-3 usually reachable in 1–2 quarters with review velocity + answer rate.",
  "large":    "Saturated major metro — top-3 hold hundreds-thousands of reviews and years of lead history. 2+ quarter trust campaign; supplement with Search/PMax for interim volume.",
};

const REVIEW_GAP_TIMELINE = [
  { max: 3,  label: "Gap < 3× top-3 median: catchable in ~1 quarter at 4–8 reviews/month." },
  { max: 10, label: "Gap 3–10×: two quarters, sustained velocity." },
  { max: Infinity, label: "Gap 10×+: 6–12 months; set expectations in writing and run supplementary channels." },
];

const SERVING_TRACK = [
  "Accept any pending Terms banner at ads.google.com/localservices (unaccepted terms silently pause the account).",
  "Verify payment profile in Google Ads (not the LSA UI): no declined card, no silently-applied low daily spend threshold.",
  "Check license/insurance expiry (renewals accepted 3–4 weeks early; dropped badge zeros visibility).",
  "Open Policy Manager — clear any limited-serving or violation flags; profile edits (name/hours/area) can trigger re-review.",
  "Confirm profile is enabled, schedule covers business hours, and all legit job types are active.",
  "Audit GBP↔LSA link integrity — strictly 1-to-1. Fast check: GBP review count == LSA review count. Never create a second LSA account while an old one is live (Circumventing Systems suspension).",
  "If still zero: escalate to LSA support 1-833-272-1444 (M–F, 6am–5pm PT) with the 10-digit Customer ID. Ask them to open the public provider link and show it serving; request an internal ticket and case number. Tier 2 escalation after ~7 business days if unresolved.",
];

const RANKING_TRACK = [
  "The carousel shrank — often only 1–2 visible LSA slots. Top 2–3 or nothing; there is no page-2 traffic.",
  "Cold start throttle — the algorithm optimizes for likelihood of a good lead. No lead history = throttled exposure. Budget is permission to spend, NOT a ranking signal.",
  "Review gap vs. top-3 incumbents (count, rating, AND recency/velocity). Fresh velocity is the new-account opening.",
  "Responsiveness score — answer rate on LSA-routed calls + message response time is top-weighted. Target ≥95% answer rate, <60s message response. Missed calls actively demote low-volume accounts.",
  "Service area too broad — proximity is heavily weighted. Broad claims dilute relevance everywhere.",
  "Eligibility gaps — unselected job types, narrow hours, message/booking leads off.",
  "Demand ceiling / saturation — small markets cap volume regardless of rank; saturated verticals mean perfect configuration still loses to 1,000-review incumbents until the gap closes.",
];

const MIGRATION_ITEMS = [
  "**Phase 0.5 (do NOW, before any 14-day migration notice arrives):** export ALL historical LSA campaign reports — these do NOT transfer. Lead history/messages/call recordings transfer; performance reports don't.",
  "Screenshot current LSA settings (areas, hours, job types, budget, photos, callouts) as a before/after baseline.",
  "Record the impression baseline (last 30/60/90 days) so post-migration comparisons are honest.",
  "Recompute the budget: weekly ÷ 7 = daily; monthly ≈ daily × 30.4. Post-migration bidding becomes Target-CPA-style automation.",
  "Learn Google Ads Lead Manager (post-migration lead handling: charged status, source, feedback, CRM export, message replies).",
  "Stop using / recommending manual per-lead bidding, the LSA mobile app, and the removed dispute button — Lead Feedback auto-reviews within 72 hrs.",
  "Update client-facing copy: badges consolidated to \"Google Verified\" (Oct 2025). Money-Back Guarantee discontinued for work booked after Nov 7, 2025 — do NOT reference \"Google Guaranteed\" checkmark language.",
];

export default function LsaPage() {
  const [intake, setIntake] = useState({
    business: "",
    trade: "Roofing",
    serviceAreas: "",
    platform: "unsure",
    marketSize: "midsize",
    verified: "yes",
    running: "yes",
    impressions30d: "",
    reviewCount: "",
    reviewRating: "",
    top3ReviewMedian: "",
    accountAgeMonths: "",
    everGeneratedLeads: "yes",
  });
  const patch = k => v => setIntake(s => ({ ...s, [k]: v }));

  // Auto-populate from data/lsa-data.json when available. User can still edit
  // any field; the "auto" tag next to a field disappears once it's been edited.
  const [autoData, setAutoData] = useState(null);
  const [marketData, setMarketData] = useState(null);    // for the exec report
  const [autoMetro, setAutoMetro] = useState("tampa");   // toggle which metro's auto data to use
  const [dirty, setDirty] = useState({});               // fields the user has touched

  useEffect(() => {
    const fetchJson = async (url) => {
      const r = await fetch(url); if (!r.ok) return null;
      const ct = r.headers.get("content-type") || "";
      if (!ct.includes("json")) return null;
      return r.json();
    };
    fetchJson("/lsa-data.json").then(setAutoData).catch(() => setAutoData(null));
    fetchJson("/dashboard-data.json").then(setMarketData).catch(() => setMarketData(null));
  }, []);

  useEffect(() => {
    if (!autoData) return;
    const clientMetro = autoData.client?.metros?.[autoMetro] || null;
    const queries = autoData.money_queries_by_metro?.[autoMetro] || null;
    const auto = {
      business: autoData.client?.name || "",
      trade: autoData.client?.trade || "Roofing",
      serviceAreas: queries?.primary_city ? `${queries.primary_city}, Florida (+ neighbors, see Market Analysis)` : "",
      marketSize: "large",
      reviewCount: clientMetro?.review_count != null ? String(clientMetro.review_count) : "",
      reviewRating: clientMetro?.rating != null ? String(clientMetro.rating) : "",
      top3ReviewMedian: queries?.review_moat_median != null ? String(queries.review_moat_median) : "",
    };
    setIntake(prev => {
      const next = { ...prev };
      Object.entries(auto).forEach(([k, v]) => {
        if (!dirty[k] && v !== "" && v != null) next[k] = v;
      });
      return next;
    });
  }, [autoData, autoMetro]);

  // wrap patch to mark field dirty
  const setField = k => v => { setDirty(d => ({ ...d, [k]: true })); patch(k)(v); };

  const diagnosis = useMemo(() => diagnose(intake), [intake]);

  const MANUAL = ["platform","verified","running","everGeneratedLeads","impressions30d","accountAgeMonths"];
  const AUTOABLE = ["business","trade","serviceAreas","marketSize","reviewCount","reviewRating","top3ReviewMedian"];
  const tagFor = name => {
    if (MANUAL.includes(name)) return "manual";
    if (autoData && AUTOABLE.includes(name) && !dirty[name]) return "auto";
    return undefined;
  };

  return (
    <div className="lsa-page">
      <div className="lsa-intro">
        <div className="sub">
          Diagnose an underperforming LSA / Google Verified account and generate a client-ready action plan.
          Fill in what you know — the diagnosis, checklist, and CPL band update live. Export as markdown when done.
        </div>
        {autoData && (
          <div className="lsa-auto-bar">
            <b>Auto-loaded for {autoData.client?.name}.</b> Metro:
            <div className="metro-toggle" role="tablist" style={{ marginLeft: 8 }}>
              {Object.keys(autoData.client?.metros || {}).map(k => (
                <button key={k}
                  className={k === autoMetro ? "active" : ""}
                  onClick={() => { setAutoMetro(k); setDirty({}); }}>{k[0].toUpperCase() + k.slice(1)}</button>
              ))}
            </div>
            <span className="lsa-auto-note">Client name, trade, service city, review count, rating, and top-3 review moat are pulled from DataForSEO. Fields you edit stop auto-syncing. Non-automatable fields (impressions, verified status, ad status, account age) still need JAC's LSA login.</span>
          </div>
        )}
      </div>

      <div className="lsa-grid">
        <section className="lsa-form">
          <h3>Intake</h3>

          <Field label="Client / business name" tag={tagFor("business")}>
            <input type="text" value={intake.business} onChange={e => setField("business")(e.target.value)}
              placeholder="e.g. JAC Builders" />
          </Field>
          <Row>
            <Field label="Trade" tag={tagFor("trade")}>
              <select value={intake.trade} onChange={e => setField("trade")(e.target.value)}>
                {Object.keys(TRADES).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Market size" tag={tagFor("marketSize")}>
              <select value={intake.marketSize} onChange={e => setField("marketSize")(e.target.value)}>
                <option value="small">Small city / single town</option>
                <option value="midsize">Mid-size metro</option>
                <option value="large">Saturated major metro</option>
              </select>
            </Field>
          </Row>
          <Field label="Service areas (cities / zips / counties)" tag={tagFor("serviceAreas")}>
            <textarea rows={2} value={intake.serviceAreas} onChange={e => setField("serviceAreas")(e.target.value)}
              placeholder="e.g. Tampa, St Petersburg, Clearwater, Brandon, 33601, 33602…" />
          </Field>

          <h4>Account state</h4>
          <Row>
            <Field label="Platform" tag={tagFor("platform")}>
              <select value={intake.platform} onChange={e => setField("platform")(e.target.value)}>
                <option value="legacy">Legacy LSA dashboard</option>
                <option value="migrated">Migrated to Google Ads (PMax pay-per-lead)</option>
                <option value="unsure">Unsure — check if ads.google.com/localservices redirects</option>
              </select>
            </Field>
            <Field label="Verified / badge" tag={tagFor("verified")}>
              <select value={intake.verified} onChange={e => setField("verified")(e.target.value)}>
                <option value="yes">Active</option>
                <option value="pending">Pending / re-review</option>
                <option value="no">Not verified / dropped</option>
              </select>
            </Field>
          </Row>
          <Row>
            <Field label="Ad status" tag={tagFor("running")}>
              <select value={intake.running} onChange={e => setField("running")(e.target.value)}>
                <option value="yes">Running</option>
                <option value="paused">Paused</option>
                <option value="limited">Limited serving flag</option>
              </select>
            </Field>
            <Field label="Ever generated leads?" tag={tagFor("everGeneratedLeads")}>
              <select value={intake.everGeneratedLeads} onChange={e => setField("everGeneratedLeads")(e.target.value)}>
                <option value="yes">Yes, in the past</option>
                <option value="no">Never</option>
              </select>
            </Field>
          </Row>

          <h4>Key numbers (last 30 days)</h4>
          <Row>
            <Field label="Impressions (30d)" tag={tagFor("impressions30d")}>
              <input type="number" min={0} value={intake.impressions30d}
                onChange={e => setField("impressions30d")(e.target.value)} placeholder="0 = serving problem" />
            </Field>
            <Field label="Account age (months)" tag={tagFor("accountAgeMonths")}>
              <input type="number" min={0} value={intake.accountAgeMonths}
                onChange={e => setField("accountAgeMonths")(e.target.value)} placeholder="e.g. 4" />
            </Field>
          </Row>

          <h4>Reviews (Google Business Profile)</h4>
          <Row>
            <Field label="Review count" tag={tagFor("reviewCount")}>
              <input type="number" min={0} value={intake.reviewCount}
                onChange={e => setField("reviewCount")(e.target.value)} placeholder="e.g. 12" />
            </Field>
            <Field label="Rating (avg)" tag={tagFor("reviewRating")}>
              <input type="number" min={0} max={5} step={0.1} value={intake.reviewRating}
                onChange={e => setField("reviewRating")(e.target.value)} placeholder="e.g. 4.8" />
            </Field>
            <Field label="Top-3 competitor review median" tag={tagFor("top3ReviewMedian")}>
              <input type="number" min={0} value={intake.top3ReviewMedian}
                onChange={e => setField("top3ReviewMedian")(e.target.value)} placeholder="e.g. 120" />
            </Field>
          </Row>

          <div className="lsa-actions">
            <button className="primary" onClick={() => copyExec(intake, autoData, marketData, autoMetro)}>Copy executive brief</button>
            <button onClick={() => downloadExec(intake, autoData, marketData, autoMetro)}>Download .md</button>
          </div>
          <div className="lsa-actions-note">
            Executive brief covers <b>both metros</b> and folds in market data (CPC, CPL, demand) from the Market Analysis page.
            LSA-account fields (impressions, badge, ad status) reflect what's entered above for the currently-selected metro ({autoMetro[0].toUpperCase() + autoMetro.slice(1)}).
          </div>
        </section>

        <section className="lsa-output">
          <DiagnosisBlock intake={intake} diagnosis={diagnosis} />
          {autoData && <CompetitorSnapshot autoData={autoData} metroKey={autoMetro} />}
          <ChecklistBlock intake={intake} diagnosis={diagnosis} />
          <MigrationBlock />
          <FootnoteBlock diagnosis={diagnosis} autoData={autoData} />
        </section>
      </div>
    </div>
  );
}

/* ---------- diagnosis logic ---------- */

function diagnose(intake) {
  const impressions = intake.impressions30d === "" ? null : Number(intake.impressions30d);
  const reviewCount = Number(intake.reviewCount || 0);
  const top3Median = Number(intake.top3ReviewMedian || 0);
  const reviewGap = reviewCount > 0 && top3Median > 0 ? top3Median / reviewCount : null;

  let track;
  if (impressions === null) track = "unknown";
  else if (impressions === 0) track = "serving";
  else track = "ranking";

  const trade = TRADES[intake.trade] || TRADES["Other"];
  const marketNote = MARKET_SIZES[intake.marketSize];

  // Top causes tailored to signals
  const topCauses = [];
  if (track === "serving") {
    if (intake.verified === "no") topCauses.push("Badge dropped / not verified — this alone zeros visibility.");
    if (intake.verified === "pending") topCauses.push("Verification pending — no serving until it clears.");
    if (intake.running !== "yes") topCauses.push(`Ad status is "${intake.running}" — not fully live.`);
    topCauses.push("Silent pause suspects: unaccepted Terms banner, declined payment profile, expired license/insurance.");
    if (topCauses.length < 3) topCauses.push("GBP↔LSA mislink or duplicate GBP — mismatched review counts is the fast tell.");
  } else if (track === "ranking") {
    if (reviewGap && reviewGap > 10) topCauses.push(`Massive review gap (${reviewGap.toFixed(0)}× top-3 median) — the review moat is the ceiling.`);
    else if (reviewGap && reviewGap > 3) topCauses.push(`Moderate review gap (${reviewGap.toFixed(1)}× top-3 median) — 2-quarter climb with sustained velocity.`);
    if (intake.everGeneratedLeads === "no") topCauses.push("Cold-start throttle — no lead history means the algorithm hasn't learned this account converts.");
    topCauses.push("Responsiveness — every missed call or slow message response actively demotes low-volume accounts.");
    if (topCauses.length < 3) topCauses.push("Service area may be too broad — proximity is heavily weighted; tighten to a 30-min beachhead first.");
  }

  const timeline = reviewGap == null ? null : (REVIEW_GAP_TIMELINE.find(t => reviewGap <= t.max) || REVIEW_GAP_TIMELINE[REVIEW_GAP_TIMELINE.length - 1]);

  return { track, trade, marketNote, topCauses, reviewGap, timeline };
}

/* ---------- output blocks ---------- */

function DiagnosisBlock({ intake, diagnosis }) {
  const trackLabel = diagnosis.track === "serving" ? "Serving Track (0 impressions)"
                   : diagnosis.track === "ranking" ? "Ranking Track (serving but not converting into leads)"
                   : "Fill in impressions to route diagnosis";
  const trackClass = diagnosis.track === "serving" ? "bad"
                   : diagnosis.track === "ranking" ? "warn" : "muted";
  return (
    <div className="lsa-block">
      <div className="lsa-h">Diagnosis</div>
      <div className={`lsa-hero ${trackClass}`}>
        <div className="lsa-hero-label">Track</div>
        <div className="lsa-hero-value">{trackLabel}</div>
      </div>
      {diagnosis.topCauses.length > 0 && <>
        <div className="lsa-sub">Most likely causes for {intake.trade.toLowerCase()} in a {intake.marketSize === "large" ? "saturated" : intake.marketSize} market</div>
        <ol className="lsa-ol">{diagnosis.topCauses.slice(0, 3).map((c, i) => <li key={i}>{c}</li>)}</ol>
      </>}
      <div className="lsa-facts">
        <div><b>Directional CPL band</b> ({intake.trade}): <b>${diagnosis.trade.cplLow}–${diagnosis.trade.cplHigh}</b> per LSA lead. {diagnosis.trade.note}</div>
        <div><b>Market shape:</b> {diagnosis.marketNote}</div>
        {diagnosis.reviewGap != null && <div><b>Review gap:</b> {diagnosis.reviewGap.toFixed(1)}× top-3 median. {diagnosis.timeline?.label}</div>}
      </div>
    </div>
  );
}

function ChecklistBlock({ intake, diagnosis }) {
  const track = diagnosis.track;
  return (
    <div className="lsa-block">
      <div className="lsa-h">Action checklist</div>

      {track === "serving" && <>
        <div className="lsa-sub">Serving Track — check in this order (fastest first)</div>
        <ol className="lsa-ol">{SERVING_TRACK.map((s, i) => <li key={i}>{s}</li>)}</ol>
      </>}

      {track === "ranking" && <>
        <div className="lsa-sub">Ranking Track — most common causes to attack in order</div>
        <ol className="lsa-ol">{RANKING_TRACK.map((s, i) => <li key={i}>{s}</li>)}</ol>
      </>}

      <div className="lsa-sub" style={{ marginTop: 14 }}>Phased goal checklist (client-ready)</div>
      <PhaseList intake={intake} diagnosis={diagnosis} />
    </div>
  );
}

function PhaseList({ intake, diagnosis }) {
  const phases = [
    { title: "Phase A — Maximize auction eligibility (week 1)", items: [
        "Bidding: Maximize Leads (legacy) or Target-CPA automation (post-migration). Budget sized for ~20 leads/week — for " + intake.trade + " that's roughly $" + (diagnosis.trade.cplLow * 20) + "–$" + (diagnosis.trade.cplHigh * 20) + "/week at benchmark CPL.",
        "Turn on 100% of legitimate job types; widest truthful hours (evenings/weekends; 24/7 only if truly answered); message + booking leads ON.",
        "Tighten service area to ≤30-min reach (core city + first ring). Dominate close-proximity first; expand after leads flow.",
        "Complete bio with services/keywords; 4–6 real photos (post-migration: up to 100 photos + 6 callouts per category — use them).",
    ]},
    { title: "Phase B — Manufacture trust signals (weeks 1–6)", items: [
        "Review velocity: systematized ask at job completion. Target 4–8+ new GBP reviews/month; hold 4.7–4.9★; respond to every review.",
        "100%-answer system BEFORE leads flow: route to 2+ phones or an after-hours answering service. Missed calls actively demote low-volume accounts.",
        "Lead hygiene: disposition every lead within 48 hrs (booked/completed/archived w/ reason). Post-migration this lives in Google Ads Lead Manager.",
    ]},
    { title: "Phase C — Competitive benchmark (week 1, then monthly)", items: [
        `Search money queries incognito from inside the service area: "${intake.trade.toLowerCase()} repair ${firstArea(intake.serviceAreas)}", "${intake.trade.toLowerCase()} near me", "${intake.trade.toLowerCase()} ${firstArea(intake.serviceAreas)}".`,
        "Record top-3 for each query: name, rating, review count, badge, \"responds in…\" text, hours.",
        "Compute review gap = top-3 median ÷ your count. <3× catchable in a quarter; 10×+ = 6–12 month campaign — set expectations and supplement with Search/PMax.",
        "Track monthly: impression share, provider-list position for the tracked queries, top-3 review counts.",
    ]},
    { title: "Phase D — Verify (rolling)", items: [
        "Week 2: impressions trending up? If still ~0 → back to the Serving Track escalation.",
        "Week 4: first leads landing? Answer rate ≥95%?",
        "Week 8: top-3 for the close-proximity queries (the beachhead)? Radius of dominance grows with velocity + lead history.",
        "Front-load changes in week 1, then hold steady — edits trigger re-review and reset learning.",
    ]},
  ];
  return <>
    {phases.map(p => <div key={p.title} className="lsa-phase">
      <div className="lsa-phase-title">{p.title}</div>
      <ul className="lsa-ul">{p.items.map((it, i) => <li key={i}>{it}</li>)}</ul>
    </div>)}
  </>;
}

function MigrationBlock() {
  return (
    <div className="lsa-block">
      <div className="lsa-h">Migration overlay (LSA → Google Ads PMax pay-per-lead)</div>
      <div className="lsa-sub">First wave began Aug 2026 for select U.S. home & storefront services. Do these regardless of client's current status.</div>
      <ul className="lsa-ul">{MIGRATION_ITEMS.map((m, i) => <li key={i} dangerouslySetInnerHTML={{ __html: renderInlineMd(m) }} />)}</ul>
    </div>
  );
}

function CompetitorSnapshot({ autoData, metroKey }) {
  const q = autoData.money_queries_by_metro?.[metroKey];
  if (!q) return null;
  return (
    <div className="lsa-block">
      <div className="lsa-h">Competitor snapshot · {metroKey[0].toUpperCase() + metroKey.slice(1)}</div>
      <div className="lsa-sub">
        Top-3 local pack for the money queries in <b>{q.primary_city}</b>.
        Median review count across queries: <b>{q.review_moat_median ?? "—"}</b>
        {" · "}unique competitors seen: <b>{q.unique_competitor_count ?? "—"}</b>
      </div>
      {q.queries.map(qq => (
        <div key={qq.query} className="lsa-comp-query">
          <div className="lsa-comp-query-title">"{qq.query}"</div>
          <table className="lsa-comp-table">
            <thead>
              <tr><th>#</th><th>Business</th><th style={{textAlign:"right"}}>Reviews</th><th style={{textAlign:"right"}}>Rating</th></tr>
            </thead>
            <tbody>
              {qq.top3.length === 0 && <tr><td colSpan={4} className="lsa-comp-empty">No local pack returned.</td></tr>}
              {qq.top3.map(row => (
                <tr key={row.rank}>
                  <td>{row.rank}</td>
                  <td>{row.name || "—"}</td>
                  <td style={{textAlign:"right"}}>{row.review_count ?? "—"}</td>
                  <td style={{textAlign:"right"}}>{row.rating ?? "—"}★</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function FootnoteBlock({ diagnosis, autoData }) {
  return (
    <div className="lsa-footnote">
      Diagnostic logic follows the LSA Lead Diagnostic skill (2026-08). CPL bands are directional
      agency benchmarks — re-verify with a web search for anything time-sensitive. Ranking-factor weight
      order: <b>responsiveness → reviews (count × velocity × rating) → proximity → profile
      completeness → lead history → bid/budget</b>. Timeline framing must be honest: nobody promises
      top-3 in 30 days in a saturated market.
      {autoData && <> Auto-pulled data (client GBP + competitor local pack) fetched from Google via DataForSEO on {new Date(autoData.generated_at).toLocaleDateString()}; run <code>npm run collect-lsa:fresh</code> to refresh.</>}
    </div>
  );
}

/* ---------- helpers ---------- */

function Field({ label, children, tag }) {
  return (
    <label className="lsa-field">
      <span>
        {label}
        {tag === "auto" && <em className="lsa-tag lsa-tag-auto">auto</em>}
        {tag === "manual" && <em className="lsa-tag lsa-tag-manual">needs LSA login</em>}
      </span>
      {children}
    </label>
  );
}
function Row({ children }) { return <div className="lsa-row">{children}</div>; }
function firstArea(s) { return (s || "").split(/[,\n]/)[0].trim() || "[city]"; }
function renderInlineMd(s) {
  // very small subset: **bold** and \n
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
}

/* ---------- executive report ---------- */

// Assumption defaults used by the exec brief when live sliders aren't relevant
// to the report (they belong to the Market page). Kept in sync with MarketPage.
const EXEC_ASSUMPT = { impressionShare: 40, ctr: 5, cvr: 4 };
const money = n => (n == null || isNaN(n)) ? "—" : "$" + n.toFixed(n < 10 ? 2 : 0);
const num = n => (n == null || isNaN(n)) ? "—" : n.toLocaleString(undefined, { maximumFractionDigits: 0 });

// Roll up per-metro business facts from auto/market data + intake state.
function metroRollup(metroKey, autoData, marketData, intake, currentMetro) {
  const lsa = autoData?.client?.metros?.[metroKey];
  const comp = autoData?.money_queries_by_metro?.[metroKey];
  const market = marketData?.metros?.[metroKey];
  const reviewGap = (lsa?.review_count && comp?.review_moat_median)
    ? comp.review_moat_median / lsa.review_count : null;

  // Market inside a 30-mile radius (executive-scale default).
  let marketScope = null;
  if (market?.cities?.length) {
    const inR = market.cities.filter(c => (c.distanceMiles ?? 999) <= 30);
    const est = inR.reduce((a, c) => a + (c.estimatedTotalVolume || 0), 0);
    const capturable = est * (EXEC_ASSUMPT.impressionShare / 100) * (EXEC_ASSUMPT.ctr / 100);
    const leadsMonth = capturable * (EXEC_ASSUMPT.cvr / 100);
    const cpc34 = market.position34CPC;
    const cpc1 = market.position1CPC;
    const cpl34 = cpc34 != null ? cpc34 / (EXEC_ASSUMPT.cvr / 100) : null;
    const cpl1 = cpc1 != null ? cpc1 / (EXEC_ASSUMPT.cvr / 100) : null;
    marketScope = { est, capturable, leadsMonth, cpc34, cpc1, cpl34, cpl1, cityCount: inR.length };
  }

  // Track (uses intake fields — only meaningful for the currently-shown metro).
  const isCurrent = metroKey === currentMetro;
  const track = isCurrent ? (intake.impressions30d === "" ? "unknown"
                            : Number(intake.impressions30d) === 0 ? "serving" : "ranking") : null;

  return { key: metroKey, label: metroLabel(metroKey), lsa, comp, market, reviewGap, marketScope, track, isCurrent };
}

function metroLabel(k) {
  return k === "orlando" ? "Orlando (Central Florida)"
       : k === "tampa"   ? "Tampa Bay (Gulf Coast)"
       : k;
}

function verdictFor(m) {
  // Business-language one-line verdict for a metro.
  if (m.reviewGap == null) {
    return "Review data pending — verify in the LSA dashboard before deciding.";
  }
  if (m.reviewGap < 1) {
    return `Already ahead of the local top-3 (${m.lsa.review_count} reviews vs. ${m.comp.review_moat_median} top-3 median). If LSA leads aren't flowing, the fix is administrative, not budget.`;
  }
  if (m.reviewGap < 3) {
    return `Within striking distance (${m.reviewGap.toFixed(1)}× review gap). One quarter of sustained review velocity and JAC belongs in the top-3.`;
  }
  if (m.reviewGap < 10) {
    return `Two-quarter climb (${m.reviewGap.toFixed(1)}× review gap). Recommend blending in paid Search to carry lead volume while reviews build.`;
  }
  return `Long-horizon rebuild (${m.reviewGap.toFixed(0)}× review gap vs. entrenched incumbents). Six to twelve months of review velocity + paid Search / PMax to stay competitive in the interim.`;
}

function recommendedActionFor(m, intake) {
  // Tie business verdict to a concrete first-30-day action.
  if (m.reviewGap == null) return "Grab impressions / badge status from the LSA dashboard to complete the diagnosis.";
  if (m.reviewGap < 1) {
    if (m.isCurrent && m.track === "serving") return "Fix Serving Track: accept terms, verify payment, confirm badge, check GBP↔LSA link. 2–4 hours of admin, no additional spend.";
    if (m.isCurrent && m.track === "ranking") return "Serving is fine but leads are throttled — likely responsiveness or cold-start. Tighten answer rate to ≥95% and lead-hygiene routine before adding budget.";
    return "LSA should be top-3 here. If it isn't, first check for a serving / verification issue in the account.";
  }
  if (m.reviewGap < 3) return "Systematize review-ask at job completion (target 4–8/month). Run paid Search at position 3–4 to carry volume this quarter.";
  return "Paid Search is the primary lead source for the next 1–2 quarters. Run a parallel review-generation program (target 6–10 new GBP reviews/month) to close the LSA moat.";
}

function budgetLine(m) {
  if (!m.marketScope?.cpl34 || !m.marketScope?.leadsMonth) return "Market data pending.";
  const cpl = m.marketScope.cpl34;
  const monthlyLeads = m.marketScope.leadsMonth;
  const monthlySpend = cpl * monthlyLeads;
  // Round to sensible band
  const lo = Math.max(1000, Math.round(monthlySpend * 0.6 / 500) * 500);
  const hi = Math.round(monthlySpend / 500) * 500;
  return `Recommended monthly Search budget: **$${lo.toLocaleString()}–$${hi.toLocaleString()}** for ~${Math.round(monthlyLeads * 0.6)}–${Math.round(monthlyLeads)} qualified leads at an estimated ${money(cpl)} CPL.`;
}

function buildExecutive({ intake, autoData, marketData, currentMetro }) {
  const metros = (autoData?.client?.metros ? Object.keys(autoData.client.metros) : ["orlando", "tampa"]);
  const rollups = metros.map(k => metroRollup(k, autoData, marketData, intake, currentMetro));
  const client = autoData?.client?.name || intake.business || "[client]";
  const today = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const lines = [];

  // Header
  lines.push(`# ${client} — Paid-Ads Readiness Brief`);
  lines.push(`**Prepared:** ${today}   **Trade:** ${intake.trade}   **Markets:** ${rollups.map(r => r.label).join(" · ")}`);
  lines.push("");

  // BLUF
  lines.push(`## Bottom line`);
  lines.push("");
  rollups.forEach(m => {
    lines.push(`**${m.label}** — ${verdictFor(m)}`);
    lines.push("");
  });
  lines.push(`*Recommendation summary:* ${rollups.map(m => `${m.key === "orlando" ? "Orlando" : "Tampa"}: ${recommendedActionFor(m, intake).split(".")[0]}.`).join(" ")}`);
  lines.push("");

  // Per-metro detail
  rollups.forEach(m => {
    lines.push(`---`);
    lines.push(`## ${m.label}`);
    lines.push("");

    // The numbers
    lines.push(`### Where JAC stands`);
    if (m.lsa?.review_count != null) {
      lines.push(`- **JAC's Google Business Profile:** ${m.lsa.review_count} reviews at ${m.lsa.rating}★ (${m.lsa.resolved_name || "profile located"}).`);
    } else {
      lines.push(`- **JAC's Google Business Profile:** not located — verify the business is listed and claimed.`);
    }
    if (m.comp?.review_moat_median != null) {
      lines.push(`- **Local top-3 review moat (median across money queries):** ${m.comp.review_moat_median} reviews.`);
      if (m.reviewGap != null) {
        const dir = m.reviewGap < 1 ? "**ahead** of" : "**behind**";
        lines.push(`- **Review gap:** JAC is ${dir} the top-3 by ${m.reviewGap.toFixed(1)}× ${m.reviewGap < 1 ? "(strong position)" : "(review-velocity project)"}.`);
      }
    }
    if (m.marketScope) {
      lines.push(`- **Market demand (30-mile radius):** ~${num(m.marketScope.est)} rooftop-searches per month across ${m.marketScope.cityCount} cities.`);
      lines.push(`- **Paid Search cost per click:** ${money(m.marketScope.cpc34)} at position 3–4 (${money(m.marketScope.cpc1)} to own #1 on head terms).`);
      lines.push(`- **Estimated cost per lead:** ${money(m.marketScope.cpl34)} at position 3–4 — ~${Math.round(m.marketScope.leadsMonth)} leads/month achievable inside this radius at default conversion assumptions.`);
    }
    if (m.isCurrent && intake.impressions30d !== "") {
      const impN = Number(intake.impressions30d);
      lines.push(`- **LSA account state (last 30 days):** ${num(impN)} impressions; badge ${labelize(intake.verified)}; ad status ${labelize(intake.running)}.`);
      if (m.track === "serving") lines.push(`  → **Serving Track:** the account is not serving. Admin fix required before ranking is even relevant.`);
      if (m.track === "ranking") lines.push(`  → **Ranking Track:** the account serves but competitors outrank it in the auction.`);
    } else {
      lines.push(`- **LSA account state:** pending — needs a JAC LSA-dashboard login to pull impressions / badge / ad status.`);
    }
    lines.push("");

    // Recommendation
    lines.push(`### Recommendation`);
    lines.push(`> ${recommendedActionFor(m, intake)}`);
    lines.push("");
    lines.push(budgetLine(m));
    lines.push("");

    // Competitor table
    if (m.comp?.queries?.length) {
      lines.push(`### Who ranks today`);
      lines.push(`| Query | #1 | #2 | #3 |`);
      lines.push(`|---|---|---|---|`);
      m.comp.queries.forEach(q => {
        const cell = (row) => row ? `${row.name || "—"} (${row.review_count ?? "—"} ★${row.rating ?? "—"})` : "—";
        lines.push(`| "${q.query}" | ${cell(q.top3[0])} | ${cell(q.top3[1])} | ${cell(q.top3[2])} |`);
      });
      lines.push("");
    }
  });

  // 30 / 60 / 90-day plan
  lines.push(`---`);
  lines.push(`## 30 / 60 / 90-day plan`);
  lines.push("");
  lines.push(`### First 30 days`);
  rollups.forEach(m => lines.push(`- **${m.label}:** ${recommendedActionFor(m, intake)}`));
  lines.push(`- **Both metros — review-generation system:** systematize the review-ask at job completion; target 4–8 new Google reviews per month per metro; respond to every review within 48 hours.`);
  lines.push(`- **Both metros — answer-rate coverage:** ensure ≥95% answer rate on all lead calls; missed calls demote the account faster than they cost the immediate lead.`);
  lines.push("");
  lines.push(`### 30–90 days`);
  lines.push(`- Monthly competitor benchmark — re-run this brief's money-query check; watch top-3 review counts + JAC's provider-list position.`);
  lines.push(`- Weekly lead hygiene — disposition every lead within 48 hours (booked / completed / archived w/ reason).`);
  lines.push(`- If Tampa fix succeeds, evaluate raising Tampa LSA budget; if Orlando reviews reach ≥250, re-test LSA visibility.`);
  lines.push("");
  lines.push(`### 90–180 days`);
  lines.push(`- **Migration prep (see below):** LSA is folding into Google Ads Performance Max pay-per-lead through late 2026 / 2027. Historical LSA reports do NOT transfer — export them now.`);
  lines.push(`- Re-evaluate Orlando LSA once review gap is < 3×; scale Search / PMax budget to demand.`);
  lines.push("");

  // Assumptions & caveats
  lines.push(`---`);
  lines.push(`## Assumptions & honest caveats`);
  lines.push(`- **Market CPC/CPL figures** are Google Ads' suggested top-of-page bids blended by search volume across the metro, pulled from DataForSEO. Real auction CPCs typically settle 10–30% below suggested for well-run accounts. JAC's actuals may vary 20–30%.`);
  lines.push(`- **Conversion defaults** used in the CPL math: ${EXEC_ASSUMPT.impressionShare}% impression share, ${EXEC_ASSUMPT.ctr}% CTR, ${EXEC_ASSUMPT.cvr}% click-to-lead conversion. These sit at the conservative end of published 2025-26 roofing benchmarks; a mature account with strong landing pages can beat them meaningfully.`);
  lines.push(`- **Review moat** is the median top-3 review count across four money queries per metro. A single dominant incumbent (e.g. Westfall Roofing in Tampa at 1,900 reviews) can pull individual query rankings without moving the median much — the moat is directional, not a hard ceiling.`);
  lines.push(`- **Ranking-factor weight order for LSA** (community consensus, 2025-26): responsiveness → reviews (count × velocity × rating) → proximity → profile completeness → lead history → bid/budget. Bid is permission to spend, not a ranking signal once sufficient.`);
  lines.push(`- **Timelines are honest, not aspirational.** No one promises top-3 in 30 days in a saturated market. Ranges above assume competent execution of the review + answer-rate program.`);
  lines.push("");

  // Migration overlay
  lines.push(`---`);
  lines.push(`## LSA platform migration (2026–2027)`);
  lines.push(`Google is folding Local Services Ads into Google Ads as a specialized Performance Max campaign type with pay-per-lead bidding. First wave: August 2026 (select U.S. home & storefront services), broader U.S. groups late 2026, non-U.S. + remaining categories in 2027. Nothing about the strategy above changes — same ranking levers, same billing model — but two operational items matter:`);
  lines.push("");
  MIGRATION_ITEMS.forEach(m => lines.push(`- ${m}`));
  lines.push("");

  lines.push(`---`);
  lines.push(`*Prepared by Hey Aaron! Marketing. Data pulled ${autoData ? new Date(autoData.generated_at).toLocaleDateString() : "—"}; market data pulled ${marketData ? new Date(marketData.generated_at).toLocaleDateString() : "—"}. Total DataForSEO cost for this brief: $${((autoData?.total_cost_usd || 0) + 3).toFixed(2)} (one-time — cached).*`);
  return lines.join("\n");
}

function labelize(v) {
  const m = { yes: "active", no: "not verified / dropped", pending: "pending review",
              running: "running", paused: "paused", limited: "limited-serving flag",
              legacy: "legacy LSA dashboard", migrated: "migrated to Google Ads", unsure: "unknown" };
  return m[v] || v;
}

function copyExec(intake, autoData, marketData, currentMetro) {
  const md = buildExecutive({ intake, autoData, marketData, currentMetro });
  navigator.clipboard.writeText(md).then(
    () => alert("Executive brief copied to clipboard as markdown."),
    () => alert("Copy failed — use Download instead."),
  );
}

function downloadExec(intake, autoData, marketData, currentMetro) {
  const md = buildExecutive({ intake, autoData, marketData, currentMetro });
  const blob = new Blob([md], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const name = (autoData?.client?.name || intake.business || "client").toLowerCase().replace(/\s+/g, "-");
  a.href = url;
  a.download = `${name}-paid-ads-brief-${new Date().toISOString().slice(0,10)}.md`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
