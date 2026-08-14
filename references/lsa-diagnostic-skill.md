---
name: lsa-lead-diagnostic
description: Diagnose why a Google Local Services Ads (LSA / Google Guaranteed / Google Verified) account — or its successor, a Performance Max pay-per-lead campaign — is getting zero or too few leads, then produce a prioritized goal checklist to get leads flowing and rank in the top 3. Works for any trade and any market. USE THIS SKILL whenever the user mentions LSA problems, Google Guaranteed, Google Verified, Local Services Ads, "approved but no leads," "max budget zero leads," LSA ranking, the LSA top-3 carousel, pay-per-lead Performance Max, or wants to audit/benchmark LSA competition for a client — even if they don't say "diagnose" or "skill." Also trigger for onboarding a NEW client onto LSA, since the same checklist applies.
---

# LSA Lead Diagnostic & Top-3 Ranking Playbook

Diagnose a zero/low-lead LSA account and produce a client-ready action plan with measurable goals. Generic across trades and markets — always run the intake below first.

## Step 0 — Intake (ALWAYS ask before diagnosing)

Never assume the client. Ask the user for (skip anything already stated in the conversation):

1. **Trade/vertical** (e.g., garage door, roofing, HVAC, plumbing, locksmith)
2. **Service areas** — cities/zips/counties targeted, and where the business is physically located
3. **Client/business name** (for competitor benchmark searches)
4. **Platform status:** still on the legacy LSA dashboard, or already migrated to Google Ads (Performance Max pay-per-lead)? If unsure: does logging into ads.google.com/localservices redirect to Google Ads? Redirect = migrated.
5. **Account health basics:** verified/badge active? Ad status "running"? Budget level? Any policy flags?
6. **The key number:** impressions over the last 30 days (from the LSA report or, post-migration, Google Ads reporting)
7. Current **review count and rating** on the linked Google Business Profile
8. Roughly how long the account has been live, and whether it has EVER generated leads

Use the `ask_user_input_v0` tool for these when available (one batch, short options where possible; free-text via follow-up for names/areas).

## Step 1 — The splitting diagnostic

The impressions number splits everything:

- **0 impressions** → serving problem, not a ranking problem. "Running" status does NOT prove serving. Go to **Serving Track** below.
- **Impressions > 0, zero leads** → ranking/visibility problem. The account serves but loses. Go to **Ranking Track**.
- **Leads exist but too few** → same Ranking Track, plus demand-ceiling analysis.

Also run the field test: search the money queries (e.g., "[trade] repair [city]", "[trade] near me") incognito from inside the service area (use a location-simulated SERP tool like Valentin.app, or on-site mobile). Record whether the client appears in the visible carousel, only under "More providers," or nowhere. Visible carousel is often only 1–2 slots now — rank 4+ is functionally invisible.

## Step 2A — Serving Track (0 impressions)

Check in order (fastest first). Confidence tags: [G]=Google-documented, [C]=community consensus, [A]=anecdotal.

1. **Terms acceptance banner** at ads.google.com/localservices — unaccepted terms silently pause accounts. [C]
2. **Payment profile in Google Ads** (not the LSA UI): declined card, or a silently-applied low daily spend threshold. [C]
3. **License/insurance expiry** — dropped badge can zero visibility in competitive markets. Renewals accepted 3–4 weeks early. [G/C]
4. **Policy Manager** — limited-serving or violation flags; profile edits (name/hours/area) can trigger re-review. [C]
5. **Profile enabled, schedule covers business hours, job types active.** [G]
6. **GBP↔LSA link integrity** — strictly 1-to-1. Fast check: GBP review count vs. review count shown in LSA. Mismatch = mislinked. Duplicate GBPs don't display [G] and can zero out serving. Never create a second LSA account while an old one is live/un-deny-listed — Circumventing Systems suspends without warning. [G]
7. **Escalate:** LSA support **1-833-272-1444** (M–F, 6am–5pm PT). Have the 10-digit Customer ID. Script: "Account is active with zero impression share for [X] days despite full eligibility. Please verify actual ad serving on your end, check for limited-serving or internal flags, and open an internal ticket. I need the case number." Make the rep open the public provider link and show the listing serving for a real query. Don't accept "your account looks fine." If unresolved after ~7 business days, request Tier 2 escalation by case number. Don't submit duplicate tickets or make account changes mid-escalation.

## Step 2B — Ranking Track (serving but no/few leads)

Explain the likely causes in this order (most common first):

1. **Carousel shrank** — often 1–2 visible LSA slots; there is no page-2 traffic. Top 2–3 or nothing.
2. **Cold start** — the algorithm optimizes for "likelihood of a good lead." No lead history = throttled exposure. Budget is permission to spend, NOT a ranking signal. Self-reinforcing until trust signals are manufactured.
3. **Review gap** vs. top-3 incumbents — count, rating, AND recency/velocity. Fresh velocity is the new-account opening: 5 recent reviews can beat 50 stale ones.
4. **Responsiveness score** — answer rate on LSA-routed calls + message response time is a top-weighted factor [G]. Targets: ≥95% answer rate, <60s message response. Missed calls actively demote; low-volume accounts get punished hardest per miss.
5. **Service area too broad** — proximity is heavily weighted. Broad claims dilute relevance everywhere.
6. **Eligibility gaps** — unselected job types, narrow hours, message/booking leads off.
7. **Demand ceiling / saturation** — small markets cap volume regardless of rank; saturated verticals (e.g., metro roofing) mean perfect configuration still loses to 1,000-review incumbents until the gap closes.

## Step 3 — Goal checklist (deliverable)

Produce a client-ready checklist customized to the trade/market from intake, with measurable targets:

**Phase A — Maximize auction eligibility (week 1)**
- Bidding: Maximize Leads (legacy) or the automated Target-CPA-style bidding (post-migration). Budget sized for ~20 leads/week.
- 100% of legitimate job types enabled; widest truthful hours (evenings/weekends; 24/7 only if truly answered); message + booking leads ON.
- **Tighten** service area to ≤30-min reach (core city + first ring). Dominate close-proximity first, expand after leads flow.
- Complete bio with services/keywords; 4–6 real photos (post-migration: up to 100 photos + 6 callouts per category — use them).

**Phase B — Manufacture trust signals (weeks 1–6)**
- Review velocity: systematized ask at job completion. Target 4–8+ new GBP reviews/month sustained; hold 4.7–4.9★; respond to all reviews.
- 100%-answer system BEFORE leads flow: routing to 2+ phones or after-hours answering service.
- Lead hygiene: disposition every lead within 48 hrs (booked/completed/archived w/ reason) — feeds the "good lead" signal. Post-migration this lives in Google Ads Lead Manager.

**Phase C — Competitive benchmark (week 1, then monthly)**
- Search money queries from inside the service area. Record top-3: name, rating, review count, badge, "responds in…" text, hours.
- Compute review gap (top-3 median ÷ client count). <3x gap = catchable in a quarter; 10x+ = 6–12 month campaign — set expectations and supplement with Search/PMax meanwhile.
- Track monthly: impression share, provider-list position for 5 tracked queries, top-3 review counts.

**Phase D — Verify (rolling)**
- Week 2: impressions trending up? If still ~0 → Serving Track escalation.
- Week 4: first leads? Answer rate ≥95%?
- Week 8: top-3 for close-proximity queries (the beachhead)? Radius of dominance grows with velocity + lead history.
- Front-load changes in week 1, then hold steady — edits trigger re-review and reset learning.

## Step 4 — Migration overlay (ALWAYS include; date-sensitive)

LSA is folding into Google Ads as a specialized **Performance Max campaign type with pay-per-lead goals** (announced Jul 20, 2026). Phased: **Aug 2026** first wave (select U.S. home & storefront services), broader U.S. groups late 2026, non-U.S. + remaining categories 2027. 14-day advance email + dashboard banner before each account's date; on transition day the LSA dashboard redirects to Google Ads.

**What does NOT change** (so the playbook above survives intact): pay-per-lead billing (calls/messages/bookings, not clicks), placements (Search + Maps, same positions), no keywords, verification carries over, settings auto-transfer (job types, areas, budgets, schedules, photos). Ranking levers (reviews, responsiveness, proximity) unchanged.

**What changes / action items:**
- **Historical LSA campaign reports do NOT migrate and the old dashboard becomes inaccessible. EXPORT ALL REPORTS NOW** — before the 14-day notice, not after. Lead history/messages/call recordings transfer; performance reports don't. This is the only unrecoverable item.
- Weekly budgets convert to daily (weekly ÷ 7); monthly billing ≈ daily × 30.4. Recompute "max budget."
- Bidding becomes Target-CPA-style automation — watch blended CPA on multi-service campaigns with very different lead values.
- Lead handling moves to Google Ads **Lead Manager** (charged status, source, details, feedback, CRM export, message replies).
- Manual per-lead bidding, the LSA mobile app, and the old dispute button (removed Aug 2024; leads auto-reviewed within 72 hrs via Lead Feedback) are gone/obsolete — never recommend them.
- Badges consolidated to **"Google Verified"** (Oct 20, 2025); Money Back Guarantee discontinued for work booked after Nov 7, 2025 — don't reference "Google Guaranteed" checkmark language in client-facing copy.
- Add a **Phase 0.5** to every engagement: export historical reports, screenshot current settings, record the impression baseline — clean before/after data survives the handoff.

If today's date is well past mid-2027, verify current platform state with a web search before relying on the specifics above.

## Output format

Deliver as a markdown file: (1) one-paragraph diagnosis naming the track and top 2–3 causes for THIS trade/market, (2) the phased goal checklist with targets filled in for the client, (3) the competitive benchmark table (run the searches if tools allow, otherwise give the exact queries to run), (4) the migration Phase 0.5 items, (5) an honest timeline framing calibrated to the review gap and market saturation — never promise top-3 in 30 days in a saturated market. See `references/market-calibration.md` for trade/market calibration guidance and CPL benchmarks.
