// Home.jsx — API-driven, clean, and resilient
// -----------------------------------------------------------------------------
// HOME PAGE
// Displays all Sites.
//
// Design principles:
// • Data fetching delegated to services
// • Error interpretation delegated to apiFetch
// • UI only displays err.message
// • No browser / network logic here
// -----------------------------------------------------------------------------

import { useEffect, useState } from "react";

import Header from "../components/Header";
import Cards from "../components/Cards";
import FloatingPinButton from "../components/FloatingPinButton";

import { getSites } from "../data/siteService";

export default function Home({ headerTransitionClass = "" }) {
  // ---------------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------------
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ---------------------------------------------------------------------------
  // FETCH SITES
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let alive = true;

    async function loadSites() {
      try {
        setLoading(true);
        setError("");

        const data = await getSites();
        if (alive) setSites(data);
      } catch (err) {
        if (alive) setError(err.message);
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadSites();
    return () => {
      alive = false;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  return (
    <>
      <Header subtitle="Choose a Site" className={headerTransitionClass} />

      {/* Optional PIN login */}
      <FloatingPinButton />

      <main className="body">
        {loading && <div className="page-loading">Loading sites…</div>}

        {error && <div className="page-error">{error}</div>}

        {!loading && !error && sites.length === 0 && (
          <p style={{ textAlign: "center" }}>No sites available.</p>
        )}

        {!loading && !error && sites.length > 0 && <Cards items={sites} />}
      </main>
    </>
  );
}
