// Rooms.jsx — API-driven, clean, and resilient
// -----------------------------------------------------------------------------
// ROOMS PAGE
// Displays all rooms for a selected site.
//
// Design principles:
// • Data fetching delegated to services
// • Error interpretation delegated to apiFetch
// • UI only displays err.message
// • Safe redirects for invalid routes
// -----------------------------------------------------------------------------

import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

import Header from "../components/Header";
import Breadcrumbs from "../components/Breadcrumbs";
import Cards from "../components/Cards";
import FloatingPinButton from "../components/FloatingPinButton";

import { getSites } from "../data/siteService";
import { getRoomsBySiteSlug } from "../services/roomsService";

export default function Rooms({ headerTransitionClass = "" }) {
  const { siteSlug } = useParams();
  const navigate = useNavigate();

  // ---------------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------------
  const [sites, setSites] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ---------------------------------------------------------------------------
  // FETCH SITES (VALIDATION ONLY)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let alive = true;

    async function loadSites() {
      try {
        const data = await getSites();
        if (alive) setSites(data);
      } catch {
        navigate("/", { replace: true });
      }
    }

    loadSites();
    return () => (alive = false);
  }, [navigate]);

  // ---------------------------------------------------------------------------
  // RESOLVE SITE
  // ---------------------------------------------------------------------------
  const site = useMemo(
    () => sites.find((s) => s.slug === siteSlug) || null,
    [sites, siteSlug]
  );

  // ---------------------------------------------------------------------------
  // FETCH ROOMS
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!site) return;

    let alive = true;

    async function loadRooms() {
      try {
        setLoading(true);
        setError("");

        const data = await getRoomsBySiteSlug(siteSlug);
        if (alive) setRooms(data);
      } catch (err) {
        if (alive) setError(err.message);
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadRooms();
    return () => (alive = false);
  }, [site, siteSlug]);

  // ---------------------------------------------------------------------------
  // INVALID SITE GUARD
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (sites.length > 0 && !site) {
      navigate("/", { replace: true });
    }
  }, [sites, site, navigate]);

  // ---------------------------------------------------------------------------
  // BREADCRUMBS
  // ---------------------------------------------------------------------------
  const breadcrumbItems = useMemo(() => {
    if (!site) return [];
    return [{ label: "All Sites", to: "/" }, { label: site.name }];
  }, [site]);

  // ---------------------------------------------------------------------------
  // SAFE EARLY RETURN
  // ---------------------------------------------------------------------------
  if (!site || loading) return null;

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  return (
    <>
      <Header
        subtitle={`${site.name} – Choose a Room`}
        className={headerTransitionClass}
        showBack
        backTo="/"
        backLabel="Back to All Sites"
      />

      <FloatingPinButton />

      <Breadcrumbs items={breadcrumbItems} />

      <main className="body body--compact">
        {error && <div className="page-error">{error}</div>}

        {!error && rooms.length === 0 && (
          <p style={{ textAlign: "center" }}>No rooms available.</p>
        )}

        {!error && rooms.length > 0 && (
          <Cards items={rooms} siteSlug={siteSlug} />
        )}
      </main>
    </>
  );
}
