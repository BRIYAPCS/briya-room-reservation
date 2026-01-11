// Cards.jsx
// -----------------------------------------------------------------------------
// Universal Card Grid
// -----------------------------------------------------------------------------
// Used by:
// • Home page → displays Sites
// • Rooms page → displays Rooms for a Site
//
// Design principles:
// • Render-only (NO data fetching)
// • Context-aware behavior (Home vs Rooms)
// • Safe preloading ONLY where appropriate
//
// Performance enhancements:
// • Native lazy-loading for images (loading="lazy")
// • Preloads SINGLE room metadata on hover / touch (Rooms page only)
// • Preloads Calendar route JS chunk (instant navigation)
// • Keeps animations, layout, and accessibility intact
// -----------------------------------------------------------------------------

import { Link, useLocation } from "react-router-dom";
import { useEffect, useRef, useMemo } from "react";

// 🔹 Non-blocking preload helper (Room metadata ONLY)
import { preloadRoom } from "../services/roomsService";

export default function Cards({ items = [], siteSlug = null }) {
  const location = useLocation();

  // ---------------------------------------------------------------------------
  // CONTEXT DETECTION
  // ---------------------------------------------------------------------------
  // Home page → sites
  // Rooms page → rooms
  const isHome = location.pathname === "/";

  // ---------------------------------------------------------------------------
  // EARLY GRACEFUL FALLBACK
  // ---------------------------------------------------------------------------
  if (!Array.isArray(items) || items.length === 0) {
    return (
      <p style={{ color: "white", textAlign: "center", marginTop: "40px" }}>
        Nothing to display.
      </p>
    );
  }

  // ---------------------------------------------------------------------------
  // MEMOIZED CONTAINER CLASS
  // ---------------------------------------------------------------------------
  const containerClass = useMemo(
    () =>
      isHome ? "cards-container cards--sites" : "cards-container cards--rooms",
    [isHome]
  );

  // ---------------------------------------------------------------------------
  // INTERSECTION OBSERVER (STAGGERED ANIMATIONS)
  // ---------------------------------------------------------------------------
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const cards = container.querySelectorAll(".card");
    if (!cards.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate");
          }
        });
      },
      { threshold: 0.15 }
    );

    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, []);

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  return (
    <div className={containerClass} ref={containerRef}>
      {items.map((item, index) => {
        // ---------------------------------------------------------------------
        // LINK GENERATION (CONTEXT-AWARE)
        // ---------------------------------------------------------------------
        const link = isHome
          ? `/rooms/${item.slug}`
          : `/calendar/${siteSlug}/${item.id}`;

        return (
          <Link
            key={item.id || item.slug}
            to={link}
            className="card"
            style={{ "--i": index }}
            // -----------------------------------------------------------------
            // 🔥 PRELOADING STRATEGY (ROOMS CONTEXT ONLY)
            // -----------------------------------------------------------------
            onMouseEnter={() => {
              // Desktop intent → preload room metadata ONLY
              if (!isHome && siteSlug && item.id) {
                preloadRoom(siteSlug, item.id);
              }

              // Preload Calendar route JS chunk
              import("../pages/Calendar");
            }}
            onTouchStart={() => {
              // Mobile intent → preload room metadata ONLY
              if (!isHome && siteSlug && item.id) {
                preloadRoom(siteSlug, item.id);
              }

              // Preload Calendar route JS chunk
              import("../pages/Calendar");
            }}
          >
            {/* ---------------------------------------------------------------
                CARD IMAGE (LAZY-LOADED)
                - Uses native browser lazy loading
                - Falls back gracefully if image is missing
            ---------------------------------------------------------------- */}
            <div className="card-image">
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt={item.name}
                  loading="lazy"
                  draggable={false}
                  onError={(e) => {
                    // Fallback if image is missing or broken
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : null}
            </div>

            {/* ---------------------------------------------------------------
                CARD LABEL
            ---------------------------------------------------------------- */}
            <div className="card-label">{item.name}</div>
          </Link>
        );
      })}
    </div>
  );
}
