// FloatingHelpButton.jsx
// --------------------------------------------------
// Global floating Help button
//
// Features implemented:
// • Top-level help options
// • "How to reserve a room" → choose method
// • Video walkthrough (fullscreen modal)
// • Step-by-step contextual guidance (in-panel)
// • Context-aware via route detection
// --------------------------------------------------

import { useState, useMemo } from "react";
import { useLocation } from "react-router-dom";
import "../css/help-button.css";

export default function FloatingHelpButton() {
  const location = useLocation();

  /* ==================================================
     UI STATE
  =================================================== */
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeGuide, setActiveGuide] = useState(null); // RESERVE_ROOM
  const [reserveMode, setReserveMode] = useState(null); // VIDEO | GUIDED

  /* ==================================================
     CONTEXT DETECTION (PAGE AWARENESS)
  =================================================== */
  const context = useMemo(() => {
    const path = location.pathname;
    if (path === "/") return "HOME";
    if (path.startsWith("/rooms")) return "ROOMS";
    if (path.startsWith("/calendar")) return "CALENDAR";
    return "GENERAL";
  }, [location.pathname]);

  /* ==================================================
     TRACK VIDEO OPEN / CLOSE
  =================================================== */
  function trackVideoEvent(type) {
    const event = {
      eventType: type,
      context,
      path: location.pathname,
      timestamp: new Date().toISOString(),
    };

    console.info("[Help Video]", event);

    const existing =
      JSON.parse(localStorage.getItem("helpVideoAnalytics")) || [];
    existing.push(event);

    localStorage.setItem("helpVideoAnalytics", JSON.stringify(existing));
  }

  /* ==================================================
     VIDEO SOURCE (PLACEHOLDER)
  =================================================== */
  const reserveRoomVideoSrc = "/videos/how-to-reserve-a-room.mp4";

  /* ==================================================
     GUIDED PROMPTS (STEP-BY-STEP, CONTEXTUAL)
  =================================================== */
  const guidedPrompts = useMemo(() => {
    switch (context) {
      case "HOME":
        return [
          "🏫 Start by selecting the site where you want to reserve a room.",
          "➡️ Click on a site card to view its rooms.",
        ];

      case "ROOMS":
        return [
          "🚪 Choose a room that fits your needs.",
          "📅 Click the room to open its availability calendar.",
        ];

      case "CALENDAR":
        return [
          "🕒 Select an available date and time range.",
          "✅ Review details and confirm your reservation.",
        ];

      default:
        return [
          "🧭 Navigate to a site, then select a room.",
          "📅 Use the calendar to complete your reservation.",
        ];
    }
  }, [context]);

  return (
    <>
      {/* ==================================================
          FLOATING HELP BUTTON
      =================================================== */}
      <button
        className="help-fab"
        aria-label="Help and support"
        onClick={() => setPanelOpen((v) => !v)}
      >
        ?
      </button>

      {/* ==================================================
          STEP 1 — MAIN HELP OPTIONS
      =================================================== */}
      {panelOpen && !activeGuide && (
        <div className="help-panel" role="dialog" aria-modal="true">
          <h3>How can we help?</h3>

          <ul>
            <li
              style={{ cursor: "pointer" }}
              onClick={() => setActiveGuide("RESERVE_ROOM")}
            >
              📅 How to reserve a room
            </li>

            <li style={{ opacity: 0.6 }}>
              📨 Contact IT support (coming next)
            </li>
          </ul>

          <button className="help-close" onClick={() => setPanelOpen(false)}>
            Close
          </button>
        </div>
      )}

      {/* ==================================================
          STEP 2 — CHOOSE HELP METHOD
      =================================================== */}
      {panelOpen && activeGuide === "RESERVE_ROOM" && !reserveMode && (
        <div className="help-panel" role="dialog" aria-modal="true">
          <h3>How would you like help?</h3>

          <ul>
            <li
              style={{ cursor: "pointer" }}
              onClick={() => {
                setReserveMode("VIDEO");
                trackVideoEvent("VIDEO_OPEN");
              }}
            >
              🎥 Watch a video walkthrough
            </li>

            <li
              style={{ cursor: "pointer" }}
              onClick={() => setReserveMode("GUIDED")}
            >
              🧭 Step-by-step guidance on this page
            </li>
          </ul>

          <button
            className="help-close"
            onClick={() => {
              setActiveGuide(null);
              setReserveMode(null);
            }}
          >
            Back
          </button>
        </div>
      )}

      {/* ==================================================
          STEP 3A — FULLSCREEN VIDEO GUIDE
      =================================================== */}
      {reserveMode === "VIDEO" && (
        <div className="help-overlay">
          <div className="help-overlay-content">
            <button
              className="help-overlay-close"
              aria-label="Close help video"
              onClick={() => {
                trackVideoEvent("VIDEO_CLOSE");
                setReserveMode(null);
                setActiveGuide(null);
              }}
            >
              ✕
            </button>

            <h2>How to Reserve a Room</h2>

            <video src={reserveRoomVideoSrc} autoPlay controls playsInline />

            <p className="help-overlay-hint">
              Current step: <strong>{context}</strong>
            </p>
          </div>
        </div>
      )}

      {/* ==================================================
          STEP 3B — GUIDED PROMPTS (IN-PANEL)
      =================================================== */}
      {reserveMode === "GUIDED" && (
        <div className="help-panel" role="dialog" aria-modal="true">
          <h3>Step-by-step guidance</h3>

          <ul>
            {guidedPrompts.map((text, i) => (
              <li key={i}>{text}</li>
            ))}
          </ul>

          <p style={{ fontSize: "0.85rem", opacity: 0.7 }}>
            This guidance updates automatically as you move through the app.
          </p>

          <button
            className="help-close"
            onClick={() => {
              setReserveMode(null);
              setActiveGuide(null);
            }}
          >
            Close
          </button>
        </div>
      )}
    </>
  );
}
