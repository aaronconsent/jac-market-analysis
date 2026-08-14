import React, { useEffect, useState } from "react";
import MarketPage from "./pages/MarketPage.jsx";
import LsaPage from "./pages/LsaPage.jsx";

// Hash-based routing: "" or "#/" → Market, "#/lsa" → LSA diagnostic.
function currentRoute() {
  const h = window.location.hash.replace(/^#\/?/, "");
  return h === "lsa" ? "lsa" : "market";
}

export default function App() {
  const [route, setRoute] = useState(currentRoute());
  useEffect(() => {
    const on = () => setRoute(currentRoute());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const go = target => (e) => { e.preventDefault(); window.location.hash = target === "market" ? "/" : "/" + target; };

  return (
    <>
      <header className="hdr">
        <div>
          <h1>JAC Builders — Paid-Ads Toolkit</h1>
        </div>
        <nav className="page-nav">
          <a href="#/" onClick={go("market")} className={route === "market" ? "active" : ""}>Market Analysis</a>
          <a href="#/lsa" onClick={go("lsa")} className={route === "lsa" ? "active" : ""}>LSA Diagnostic</a>
        </nav>
      </header>
      {route === "market" ? <MarketPage /> : <LsaPage />}
    </>
  );
}
