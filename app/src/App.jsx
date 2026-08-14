import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Circle, Marker, Tooltip } from "react-leaflet";
import L from "leaflet";

// Fix Leaflet's default marker icon in Vite (no external asset assumption)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const money = n => (n == null || isNaN(n)) ? "—" : "$" + n.toFixed(n < 10 ? 2 : 0);
const num = n => (n == null || isNaN(n)) ? "—" : n.toLocaleString(undefined, { maximumFractionDigits: 0 });

export default function App() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [metroKey, setMetroKey] = useState("orlando");

  // Assumption sliders
  const [radius, setRadius] = useState(15);
  const [impressionShare, setImpressionShare] = useState(65);
  const [ctr, setCtr] = useState(13);
  const [cvr, setCvr] = useState(13);
  const [bookingRate, setBookingRate] = useState(60);
  const [position, setPosition] = useState("smart"); // 'top' | 'smart'
  const [budgetMin, budgetMax] = [250, 500];

  useEffect(() => {
    fetch("/dashboard-data.json").then(async r => {
      if (!r.ok) throw new Error("dashboard-data.json not found — run `npm run pipeline` first");
      setData(await r.json());
    }).catch(e => setErr(e.message));
  }, []);

  if (err) return <ErrorScreen msg={err} />;
  if (!data) return <div className="center-msg">Loading…</div>;

  const metros = data.metros || {};
  const metro = metros[metroKey];
  if (!metro) return <ErrorScreen msg={`Metro "${metroKey}" not in dataset`} />;

  return (
    <>
      <header className="hdr">
        <div>
          <h1>JAC Builders — Roofing Paid-Ads Market Analysis</h1>
          <div className="sub">
            Compare the <b>Orlando</b> vs <b>Tampa Bay</b> service areas.
            Generated {new Date(data.generated_at).toLocaleDateString()}. Source: Google Ads via DataForSEO.
          </div>
        </div>
        <div className="metro-toggle" role="tablist">
          {Object.entries(metros).map(([k, m]) => (
            <button key={k}
              className={k === metroKey ? "active" : ""}
              onClick={() => setMetroKey(k)}>{m.label.replace(/\s*\(.*\)/, "")}</button>
          ))}
        </div>
      </header>

      <div className="layout">
        <div className="map-pane">
          <MetroMap metro={metro} radius={radius} />
        </div>

        <aside className="panel">
          <MetricsPanel
            metro={metro}
            radius={radius}
            impressionShare={impressionShare}
            ctr={ctr} cvr={cvr}
            bookingRate={bookingRate}
            position={position}
            budgetMin={budgetMin} budgetMax={budgetMax}
          />

          <div className="section-title">Assumptions</div>

          <SliderRow label="Service radius" val={`${radius} mi`}
            min={5} max={50} step={1} value={radius} onChange={setRadius} />
          <div className="control">
            <div className="row"><label>Position strategy</label></div>
            <div className="pos-toggle">
              <button className={position === "top" ? "active" : ""} onClick={() => setPosition("top")}>
                Own #1 (top-of-page bids)
              </button>
              <button className={position === "smart" ? "active" : ""} onClick={() => setPosition("smart")}>
                Smart position 3–4
              </button>
            </div>
            <div className="metric" style={{ paddingTop: 8, borderBottom: 0 }}>
              <div className="note">
                #1 uses volume-weighted high-top bid; position 3–4 uses low-top bid, both from the DMA head-term set.
              </div>
            </div>
          </div>
          <SliderRow label="Impression share" val={`${impressionShare}%`}
            min={20} max={90} step={1} value={impressionShare} onChange={setImpressionShare} />
          <SliderRow label="Click-through rate" val={`${ctr}%`}
            min={4} max={25} step={1} value={ctr} onChange={setCtr} />
          <SliderRow label="Conversion rate (click → lead)" val={`${cvr}%`}
            min={8} max={20} step={1} value={cvr} onChange={setCvr} />
          <SliderRow label="Booking rate (lead → job)" val={`${bookingRate}%`}
            min={40} max={80} step={1} value={bookingRate} onChange={setBookingRate} />

          <p className="footnote">
            Volumes and CPCs pulled from Google Ads via DataForSEO on {new Date(data.generated_at).toLocaleDateString()};
            rounded and directional. City volumes may partially overlap where markets bleed together.
            CVR and booking-rate sliders default to industry-typical ranges — replace with account actuals when available.
            Long-tail total uses the DMA-level multiplier ({metro.longTailMultiplier}× core) since city-level long-tail data is mostly null.
            {(metro.cities || []).some(c => c.estimated) &&
              <> Cities marked with a dashed marker were not returned by the volume API and were left at zero.</>}
          </p>
        </aside>
      </div>
    </>
  );
}

/* ---------- child components ---------- */

function SliderRow({ label, val, min, max, step, value, onChange }) {
  return (
    <div className="control">
      <div className="row"><label>{label}</label><span className="val">{val}</span></div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(+e.target.value)} />
    </div>
  );
}

function MetroMap({ metro, radius }) {
  const anchor = metro.anchor;
  return (
    <MapContainer center={[anchor.lat, anchor.lng]} zoom={9} scrollWheelZoom={true} style={{ height: "100%" }}>
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[anchor.lat, anchor.lng]}>
        <Tooltip permanent direction="top" offset={[0, -20]}>JAC office</Tooltip>
      </Marker>
      <Circle center={[anchor.lat, anchor.lng]} radius={radius * 1609.34}
              pathOptions={{ color: "#0f4c81", weight: 1.5, fillOpacity: 0.05, dashArray: "6 4" }} />
      {(metro.cities || []).map(city => {
        const inRadius = (city.distanceMiles ?? 999) <= radius;
        const size = Math.max(6, Math.min(28, Math.sqrt((city.estimatedTotalVolume || city.coreVolume || 10)) / 3));
        return (
          <CircleMarker key={city.name} center={[city.lat, city.lng]} radius={size}
            pathOptions={{
              color: city.estimated ? "#b02a37" : (inRadius ? "#0d6ea3" : "#7b8494"),
              fillColor: inRadius ? "#0d6ea3" : "#c4cdd9",
              fillOpacity: inRadius ? 0.55 : 0.35,
              weight: city.estimated ? 2 : 1.5,
              dashArray: city.estimated ? "3 3" : undefined,
            }}>
            <Tooltip direction="top">
              <div style={{ fontWeight: 700 }}>{city.name}{city.estimated && " (est.)"}</div>
              <div>{city.distanceMiles} mi from office</div>
              <div>Core vol: {num(city.coreVolume)}/mo · CPC {money(city.weightedCPC)}</div>
              <div>Est. total (w/ long-tail): {num(city.estimatedTotalVolume)}/mo</div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}

function MetricsPanel({ metro, radius, impressionShare, ctr, cvr, bookingRate, position, budgetMin, budgetMax }) {
  const m = useMemo(() => computeMetrics({ metro, radius, impressionShare, ctr, cvr, bookingRate, position }), [
    metro, radius, impressionShare, ctr, cvr, bookingRate, position
  ]);
  const other = position === "top"
    ? computeMetrics({ metro, radius, impressionShare, ctr, cvr, bookingRate, position: "smart" })
    : computeMetrics({ metro, radius, impressionShare, ctr, cvr, bookingRate, position: "top" });

  const perBookedDelta = (other.costPerBooked != null && m.costPerBooked != null)
    ? other.costPerBooked - m.costPerBooked : null;

  const leadsPerDay = m.leadsPerDay;
  const heroClass = leadsPerDay == null ? "warn"
    : leadsPerDay >= 5 ? "" : leadsPerDay >= 3 ? "warn" : "bad";

  const spend = (m.costPerLead != null) ? m.costPerLead * 5 : null;
  const spendClass = spend == null ? "warn"
    : (spend >= budgetMin && spend <= budgetMax) ? "" : (spend > budgetMax) ? "bad" : "warn";

  return (
    <>
      <div className={`metric hero ${heroClass}`}>
        <div className="label">Max leads/day supportable (5-lead goal)</div>
        <div className="value">{leadsPerDay == null ? "—" : leadsPerDay.toFixed(1)}
          <span className="unit"> leads/day</span></div>
        <div className="note">
          {leadsPerDay == null ? "No CPC data for this radius." :
           leadsPerDay >= 5 ? `On paper, this radius can support the 5-lead target from Search alone.` :
           `Search alone cannot reach 5/day at this radius — expand radius or blend in LSA/Meta/organic.`}
        </div>
      </div>

      <div className="section-title">Market inside radius ({m.citiesInRadius.length} cities, ≤ {radius} mi)</div>
      <div className="metric">
        <div className="label">Estimated searches / month</div>
        <div className="value">{num(m.estimatedVolume)}<span className="unit"> (core: {num(m.coreVolume)})</span></div>
        <div className="note">
          Seasonal high {MONTHS[m.seasonalHighMonth]} ({(m.seasonalHigh * 100).toFixed(0)}% of avg),
          low {MONTHS[m.seasonalLowMonth]} ({(m.seasonalLow * 100).toFixed(0)}% of avg).
        </div>
      </div>
      <div className="metric">
        <div className="label">Blended CPC (volume-weighted, in-radius)</div>
        <div className="value">{money(m.blendedCPC)}
          <span className="unit"> · using {position === "top" ? "position #1" : "position 3–4"}</span></div>
      </div>
      <div className="metric">
        <div className="label">Capturable clicks / month</div>
        <div className="value">{num(m.capturableClicks)}
          <span className="unit"> @ {impressionShare}% IS · {ctr}% CTR</span></div>
      </div>
      <div className="metric">
        <div className="label">Cost per lead (CPA)</div>
        <div className="value">{money(m.costPerLead)}
          <span className="unit"> = CPC ÷ {cvr}% CVR</span></div>
      </div>
      <div className="metric">
        <div className="label">Cost per booked job</div>
        <div className="value">{money(m.costPerBooked)}
          <span className="unit"> = CPA ÷ {bookingRate}% booking rate</span></div>
        {perBookedDelta != null && Math.abs(perBookedDelta) >= 1 &&
          <div className="note">
            {position === "top"
              ? <>Owning #1 adds <span className="delta">+{money(-perBookedDelta)}</span> per booked job vs position 3–4.</>
              : <>Owning #1 would add <span className="delta">+{money(perBookedDelta)}</span> per booked job.</>}
          </div>}
      </div>

      <div className={`metric hero ${spendClass}`} style={{ marginTop: 12 }}>
        <div className="label">Daily spend to hit 5 leads/day</div>
        <div className="value">{money(spend)}<span className="unit"> / day</span></div>
        <div className="note">Target band ${budgetMin}–${budgetMax}/day.
          {spend != null && spend > budgetMax && " Above ceiling — narrow keyword mix, drop position, or expand radius."}
          {spend != null && spend < budgetMin && " Under band — you have room to expand radius or bid up."}
        </div>
      </div>
    </>
  );
}

/* ---------- pure metric math ---------- */

function computeMetrics({ metro, radius, impressionShare, ctr, cvr, bookingRate, position }) {
  const inRadius = (metro.cities || []).filter(c => (c.distanceMiles ?? 999) <= radius);
  const coreVolume = inRadius.reduce((a, c) => a + (c.coreVolume || 0), 0);
  const estimatedVolume = inRadius.reduce((a, c) => a + (c.estimatedTotalVolume || 0), 0);

  // Volume-weighted CPC across in-radius cities, then substitute DMA head-term CPC for position toggle.
  const cityBlended = weighted(inRadius.map(c => [c.weightedCPC, c.coreVolume]));
  const dmaPositionBase = position === "top" ? metro.position1CPC : metro.position34CPC;
  // Blend: prefer DMA position-specific CPC (reflects real head-term spread), fall back to city-blended.
  const blendedCPC = dmaPositionBase ?? cityBlended;

  const capturableClicks = estimatedVolume * (impressionShare / 100) * (ctr / 100);
  const leadsMonth = capturableClicks * (cvr / 100);
  const leadsPerDay = leadsMonth / 30.4;
  const costPerLead = blendedCPC != null ? blendedCPC / (cvr / 100) : null;
  const costPerBooked = costPerLead != null ? costPerLead / (bookingRate / 100) : null;

  // Seasonal high/low from average of in-radius cities' indices.
  const monthAvgs = Array(12).fill(0);
  let n = 0;
  for (const c of inRadius) {
    if (Array.isArray(c.seasonalIndex) && c.seasonalIndex.length === 12) {
      c.seasonalIndex.forEach((v, i) => { monthAvgs[i] += v; });
      n++;
    }
  }
  const seasonal = n > 0 ? monthAvgs.map(v => v / n) : Array(12).fill(1);
  const seasonalHigh = Math.max(...seasonal);
  const seasonalLow = Math.min(...seasonal);
  const seasonalHighMonth = seasonal.indexOf(seasonalHigh);
  const seasonalLowMonth = seasonal.indexOf(seasonalLow);

  return {
    citiesInRadius: inRadius,
    coreVolume, estimatedVolume,
    blendedCPC, capturableClicks,
    leadsMonth, leadsPerDay,
    costPerLead, costPerBooked,
    seasonalHigh, seasonalLow, seasonalHighMonth, seasonalLowMonth,
  };
}

function weighted(pairs) {
  let num = 0, den = 0;
  for (const [v, w] of pairs) {
    if (typeof v === "number" && typeof w === "number" && w > 0) { num += v * w; den += w; }
  }
  return den > 0 ? num / den : null;
}

function ErrorScreen({ msg }) {
  return <div className="center-msg">
    <div>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No dashboard data yet</div>
      <div style={{ marginBottom: 12 }}>{msg}</div>
      <div>From the project root, run:</div>
      <pre style={{ background: "#efeff2", padding: 12, borderRadius: 6, marginTop: 10 }}>
        export DFS_LOGIN="..."{"\n"}export DFS_PASSWORD="..."{"\n"}npm run pipeline
      </pre>
    </div>
  </div>;
}
