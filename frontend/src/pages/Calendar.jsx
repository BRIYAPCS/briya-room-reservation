// Calendar.jsx — Secure, gated, and resilient
// -----------------------------------------------------------------------------
// CALENDAR PAGE
// • Requires PIN access
// • Uses centralized API error handling
// • Builds breadcrumb data for RoomCalendar
// • UI displays err.message only
// -----------------------------------------------------------------------------

import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

import Header from "../components/Header";
import RoomCalendar from "../components/RoomCalendar";
import PinAccessModal from "../components/PinAccessModal";
import FloatingPinButton from "../components/FloatingPinButton";

import { getSites } from "../data/siteService";
import { getRoomById } from "../services/roomsService";

export default function Calendar({ headerTransitionClass = "" }) {
  const { siteSlug, roomId } = useParams();
  const navigate = useNavigate();

  // ---------------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------------
  const [sites, setSites] = useState([]);
  const [room, setRoom] = useState(null);
  const [access, setAccess] = useState(null);
  const [showPinGate, setShowPinGate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ---------------------------------------------------------------------------
  // FETCH SITES (for validation + breadcrumbs)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let alive = true;

    async function loadSites() {
      try {
        const data = await getSites();
        if (alive) setSites(data);
      } catch (err) {
        if (alive) setError(err.message);
      }
    }

    loadSites();
    return () => (alive = false);
  }, []);

  // ---------------------------------------------------------------------------
  // RESOLVE SITE FROM SLUG
  // ---------------------------------------------------------------------------
  const site = useMemo(
    () => sites.find((s) => s.slug === siteSlug) || null,
    [sites, siteSlug]
  );

  // ---------------------------------------------------------------------------
  // FETCH ROOM
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!site) return;

    let alive = true;

    async function loadRoom() {
      try {
        const data = await getRoomById(siteSlug, roomId);
        if (alive) setRoom(data);
      } catch (err) {
        if (alive) setError(err.message);
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadRoom();
    return () => (alive = false);
  }, [site, siteSlug, roomId]);

  // ---------------------------------------------------------------------------
  // PIN ACCESS CHECK (DEVICE-BASED)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const saved = localStorage.getItem("calendarAccess");
    if (saved) {
      setAccess(JSON.parse(saved));
    } else {
      setShowPinGate(true);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // BREADCRUMBS DATA
  // ---------------------------------------------------------------------------
  // Rendered INSIDE RoomCalendar (not here)
  // Keeps header clean and calendar self-contained
  const breadcrumbItems = useMemo(() => {
    if (!site || !room) return [];
    return [
      { label: "All Sites", to: "/" },
      { label: site.name, to: `/rooms/${siteSlug}` },
      { label: room.name },
    ];
  }, [site, siteSlug, room]);

  // ---------------------------------------------------------------------------
  // EARLY RETURNS
  // ---------------------------------------------------------------------------
  if (loading) return null;

  if (error) {
    return (
      <>
        <Header className={headerTransitionClass} />
        <main className="body">
          <div className="page-error">{error}</div>
        </main>
      </>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  return (
    <>
      {/* PIN GATE */}
      {showPinGate && (
        <PinAccessModal
          force={false}
          onCancel={() => navigate("/", { replace: true })}
          onSuccess={(data) => {
            setAccess(data);
            setShowPinGate(false);
          }}
        />
      )}

      {/* HEADER — LOGO ONLY */}
      <Header
        className={headerTransitionClass}
        showBack={false}
        showTitle={false}
      />

      {/* FLOATING PIN BUTTON */}
      <FloatingPinButton />

      {/* CALENDAR */}
      <main className="body body--compact">
        <RoomCalendar
          site={site}
          room={room}
          access={access}
          breadcrumbItems={breadcrumbItems} 
        />
      </main>
    </>
  );
}
