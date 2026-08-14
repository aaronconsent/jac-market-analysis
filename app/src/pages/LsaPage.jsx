import React, { useMemo, useState } from "react";

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

  const diagnosis = useMemo(() => diagnose(intake), [intake]);

  return (
    <div className="lsa-page">
      <div className="lsa-intro">
        <div className="sub">
          Diagnose an underperforming LSA / Google Verified account and generate a client-ready action plan.
          Fill in what you know — the diagnosis, checklist, and CPL band update live. Export as markdown when done.
          Based on the <a href="/references/lsa-diagnostic-skill.md" rel="noopener">LSA Lead Diagnostic skill</a>.
        </div>
      </div>

      <div className="lsa-grid">
        <section className="lsa-form">
          <h3>Intake</h3>

          <Field label="Client / business name">
            <input type="text" value={intake.business} onChange={e => patch("business")(e.target.value)}
              placeholder="e.g. JAC Builders" />
          </Field>
          <Row>
            <Field label="Trade">
              <select value={intake.trade} onChange={e => patch("trade")(e.target.value)}>
                {Object.keys(TRADES).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Market size">
              <select value={intake.marketSize} onChange={e => patch("marketSize")(e.target.value)}>
                <option value="small">Small city / single town</option>
                <option value="midsize">Mid-size metro</option>
                <option value="large">Saturated major metro</option>
              </select>
            </Field>
          </Row>
          <Field label="Service areas (cities / zips / counties)">
            <textarea rows={2} value={intake.serviceAreas} onChange={e => patch("serviceAreas")(e.target.value)}
              placeholder="e.g. Tampa, St Petersburg, Clearwater, Brandon, 33601, 33602…" />
          </Field>

          <h4>Account state</h4>
          <Row>
            <Field label="Platform">
              <select value={intake.platform} onChange={e => patch("platform")(e.target.value)}>
                <option value="legacy">Legacy LSA dashboard</option>
                <option value="migrated">Migrated to Google Ads (PMax pay-per-lead)</option>
                <option value="unsure">Unsure — check if ads.google.com/localservices redirects</option>
              </select>
            </Field>
            <Field label="Verified / badge">
              <select value={intake.verified} onChange={e => patch("verified")(e.target.value)}>
                <option value="yes">Active</option>
                <option value="pending">Pending / re-review</option>
                <option value="no">Not verified / dropped</option>
              </select>
            </Field>
          </Row>
          <Row>
            <Field label="Ad status">
              <select value={intake.running} onChange={e => patch("running")(e.target.value)}>
                <option value="yes">Running</option>
                <option value="paused">Paused</option>
                <option value="limited">Limited serving flag</option>
              </select>
            </Field>
            <Field label="Ever generated leads?">
              <select value={intake.everGeneratedLeads} onChange={e => patch("everGeneratedLeads")(e.target.value)}>
                <option value="yes">Yes, in the past</option>
                <option value="no">Never</option>
              </select>
            </Field>
          </Row>

          <h4>Key numbers (last 30 days)</h4>
          <Row>
            <Field label="Impressions (30d)">
              <input type="number" min={0} value={intake.impressions30d}
                onChange={e => patch("impressions30d")(e.target.value)} placeholder="0 = serving problem" />
            </Field>
            <Field label="Account age (months)">
              <input type="number" min={0} value={intake.accountAgeMonths}
                onChange={e => patch("accountAgeMonths")(e.target.value)} placeholder="e.g. 4" />
            </Field>
          </Row>

          <h4>Reviews (Google Business Profile)</h4>
          <Row>
            <Field label="Review count">
              <input type="number" min={0} value={intake.reviewCount}
                onChange={e => patch("reviewCount")(e.target.value)} placeholder="e.g. 12" />
            </Field>
            <Field label="Rating (avg)">
              <input type="number" min={0} max={5} step={0.1} value={intake.reviewRating}
                onChange={e => patch("reviewRating")(e.target.value)} placeholder="e.g. 4.8" />
            </Field>
            <Field label="Top-3 competitor review median">
              <input type="number" min={0} value={intake.top3ReviewMedian}
                onChange={e => patch("top3ReviewMedian")(e.target.value)} placeholder="e.g. 120" />
            </Field>
          </Row>

          <div className="lsa-actions">
            <button className="primary" onClick={() => copyMarkdown(intake, diagnosis)}>Copy report as markdown</button>
            <button onClick={() => downloadMarkdown(intake, diagnosis)}>Download .md</button>
          </div>
        </section>

        <section className="lsa-output">
          <DiagnosisBlock intake={intake} diagnosis={diagnosis} />
          <ChecklistBlock intake={intake} diagnosis={diagnosis} />
          <MigrationBlock />
          <FootnoteBlock diagnosis={diagnosis} />
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

function FootnoteBlock({ diagnosis }) {
  return (
    <div className="lsa-footnote">
      Diagnostic logic follows the LSA Lead Diagnostic skill (2026-08). CPL bands are directional
      agency benchmarks — re-verify with a web search for anything time-sensitive. Ranking-factor weight
      order: <b>responsiveness → reviews (count × velocity × rating) → proximity → profile
      completeness → lead history → bid/budget</b>. Timeline framing must be honest: nobody promises
      top-3 in 30 days in a saturated market.
    </div>
  );
}

/* ---------- helpers ---------- */

function Field({ label, children }) {
  return (
    <label className="lsa-field">
      <span>{label}</span>
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

function buildMarkdown(intake, diagnosis) {
  const trackTitle = diagnosis.track === "serving" ? "Serving Track (0 impressions)"
                   : diagnosis.track === "ranking" ? "Ranking Track (serving but not enough leads)"
                   : "Track: unknown (fill in impressions)";
  const areas = (intake.serviceAreas || "").split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
  const lines = [];
  lines.push(`# LSA Lead Diagnostic — ${intake.business || "[client]"}`);
  lines.push("");
  lines.push(`**Trade:** ${intake.trade}   **Market:** ${intake.marketSize}   **Platform:** ${intake.platform}`);
  lines.push(`**Service areas:** ${areas.join(", ") || "—"}`);
  lines.push("");
  lines.push(`## Diagnosis`);
  lines.push(`**Track:** ${trackTitle}`);
  lines.push("");
  lines.push(`**Most likely causes:**`);
  diagnosis.topCauses.slice(0, 3).forEach(c => lines.push(`- ${c}`));
  lines.push("");
  lines.push(`**Directional CPL band (${intake.trade}):** $${diagnosis.trade.cplLow}–$${diagnosis.trade.cplHigh} per lead — ${diagnosis.trade.note}`);
  lines.push(`**Market shape:** ${diagnosis.marketNote}`);
  if (diagnosis.reviewGap != null) lines.push(`**Review gap:** ${diagnosis.reviewGap.toFixed(1)}× top-3 median. ${diagnosis.timeline?.label || ""}`);
  lines.push("");
  lines.push(`## Action checklist`);
  if (diagnosis.track === "serving") {
    lines.push(`### Serving Track (in order)`);
    SERVING_TRACK.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  } else if (diagnosis.track === "ranking") {
    lines.push(`### Ranking Track (in order)`);
    RANKING_TRACK.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  }
  lines.push("");
  lines.push(`### Phased goals`);
  const phases = [
    ["Phase A — Maximize auction eligibility (week 1)", [
      `Bidding: Max Leads / Target-CPA. Budget sized for ~20 leads/week ≈ $${diagnosis.trade.cplLow * 20}–$${diagnosis.trade.cplHigh * 20}/week at benchmark CPL.`,
      `100% of legitimate job types on; widest truthful hours; message + booking leads ON.`,
      `Tighten service area to ≤30-min reach; dominate close-proximity first.`,
      `Complete bio; 4–6 real photos (post-migration: up to 100 photos + 6 callouts per category).`,
    ]],
    ["Phase B — Manufacture trust signals (weeks 1–6)", [
      `Review velocity: 4–8+ new GBP reviews/month; hold 4.7–4.9★; respond to all reviews.`,
      `100%-answer system BEFORE leads flow (2+ phones or answering service).`,
      `Lead hygiene: disposition every lead within 48 hrs.`,
    ]],
    ["Phase C — Competitive benchmark (week 1, then monthly)", [
      `Search money queries incognito from inside the area (e.g. "${intake.trade.toLowerCase()} repair ${firstArea(intake.serviceAreas)}").`,
      `Record top-3 name / rating / review count / badge / responds-in / hours.`,
      `Track monthly: impression share, provider-list position, top-3 review counts.`,
    ]],
    ["Phase D — Verify (rolling)", [
      `Week 2: impressions trending up? If ~0 → escalate Serving Track.`,
      `Week 4: first leads? Answer rate ≥95%?`,
      `Week 8: top-3 for close-proximity queries (the beachhead)?`,
      `Front-load changes in week 1, then hold — edits trigger re-review and reset learning.`,
    ]],
  ];
  phases.forEach(([title, items]) => {
    lines.push(`#### ${title}`);
    items.forEach(it => lines.push(`- ${it}`));
  });
  lines.push("");
  lines.push(`## Migration overlay (LSA → Google Ads PMax pay-per-lead)`);
  MIGRATION_ITEMS.forEach(m => lines.push(`- ${m}`));
  lines.push("");
  lines.push(`---`);
  lines.push(`Generated ${new Date().toLocaleDateString()} from the JAC market-analysis dashboard.`);
  return lines.join("\n");
}

function copyMarkdown(intake, diagnosis) {
  const md = buildMarkdown(intake, diagnosis);
  navigator.clipboard.writeText(md).then(
    () => alert("Report copied as markdown."),
    () => alert("Copy failed — use Download instead."),
  );
}

function downloadMarkdown(intake, diagnosis) {
  const md = buildMarkdown(intake, diagnosis);
  const blob = new Blob([md], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lsa-diagnostic-${(intake.business || "client").toLowerCase().replace(/\s+/g, "-")}.md`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
