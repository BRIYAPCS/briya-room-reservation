// BackButton.jsx
// -----------------------------------------------------------------------------
// MULTI-MODE BACK BUTTON COMPONENT
//
// MODES SUPPORTED
// -----------------------------------------------------------------------------
// 1. INLINE MODE (inside Header.jsx)
//    • Lives inside header-title-row
//    • Always visible
//    • Compact, icon-forward
//
// 2. FLOATING MODE (legacy / optional)
//    • Appears after scroll threshold
//    • Positioned using CSS variables
//
// IMPORTANT CHANGE (BUG FIX)
// -----------------------------------------------------------------------------
// • Added `forceTo` prop
// • When forceTo = true, navigation ALWAYS goes to `to`
// • This prevents history-based double-navigation bugs
//   (e.g. Rooms → Calendar → Rooms → Home)
//
// DESIGN RULE
// -----------------------------------------------------------------------------
// • Explicit destination labels ("Back to All Sites") MUST be intent-based
// • Generic "Back" buttons MAY use browser history
// -----------------------------------------------------------------------------

import { useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import "../css/backbutton.css";

export default function BackButton({
  to = "/",
  forceTo = false, // 👈 NEW: force intent-based navigation
  label = "Back",
  dynamic = null, // Optional dynamic label override
  showOnScroll = true, // Floating mode only
  threshold = 80, // Scroll threshold (px)
  corner = "left", // Floating position
  offset = 24, // Floating offset (px)
  inline = false, // INLINE HEADER MODE switch
}) {
  const navigate = useNavigate();

  // Floating mode visibility state
  // Inline mode does NOT use this
  const [visible, setVisible] = useState(!showOnScroll);

  // ---------------------------------------------------------------------------
  // CLICK HANDLER (Stable via useCallback)
  // ---------------------------------------------------------------------------
  const handleClick = useCallback(
    (e) => {
      e.preventDefault();

      // ---------------------------------------------------------
      // INTENT-BASED NAVIGATION (EXPLICIT DESTINATION)
      // ---------------------------------------------------------
      // Used when:
      // • Button label implies a destination ("Back to All Sites")
      // • Breadcrumb-like behavior is required
      // • We must NOT rely on browser history
      //
      // This FIXES the double-click issue.
      // ---------------------------------------------------------
      if (forceTo) {
        navigate(to, { replace: true });
        return;
      }

      // ---------------------------------------------------------
      // HISTORY-BASED NAVIGATION (DEFAULT)
      // ---------------------------------------------------------
      // Used for generic "Back" behavior
      // Falls back to `to` if history is not available
      // ---------------------------------------------------------
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate(to, { replace: true });
      }
    },
    [navigate, to, forceTo]
  );

  // ---------------------------------------------------------------------------
  // SCROLL LISTENER (FLOATING MODE ONLY)
  // ---------------------------------------------------------------------------
  // • Disabled entirely for inline mode
  // • Disabled if showOnScroll = false
  // • Uses passive listener for performance
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (inline || !showOnScroll) return;

    const updateVisibility = () => {
      setVisible(window.scrollY > threshold);
    };

    // Initial check
    updateVisibility();

    window.addEventListener("scroll", updateVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateVisibility);
  }, [inline, showOnScroll, threshold]);

  // ---------------------------------------------------------------------------
  // INLINE MODE (HEADER)
  // ---------------------------------------------------------------------------
  // • No wrapper div
  // • No scroll logic
  // • Always visible
  // ---------------------------------------------------------------------------
  if (inline) {
    return (
      <button
        className="back-button inline"
        onClick={handleClick}
        aria-label={dynamic ?? label}
        type="button"
      >
        {/* Arrow icon */}
        <span className="back-arrow" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            width="1em"
            height="1em"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </span>

        {/* Labels (CSS hides long label on small screens) */}
        <span className="back-label back-label--long">{dynamic ?? label}</span>
        <span className="back-label back-label--short">Back</span>
      </button>
    );
  }

  // ---------------------------------------------------------------------------
  // FLOATING MODE (LEGACY BUT SUPPORTED)
  // ---------------------------------------------------------------------------
  // Build wrapper className once using useMemo
  // ---------------------------------------------------------------------------
  const wrapperClass = useMemo(
    () =>
      [
        "back-button-wrapper",
        "floating",
        visible ? "show" : "hide",
        corner === "right" ? "corner-right" : "corner-left",
      ].join(" "),
    [visible, corner]
  );

  return (
    <div
      className={wrapperClass}
      style={{ "--offset": `${offset}px` }}
      role="navigation"
      aria-label="Floating back button"
    >
      <button
        className="back-button"
        onClick={handleClick}
        aria-label={dynamic ?? label}
        type="button"
      >
        <span className="back-arrow" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            width="1em"
            height="1em"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </span>

        <span className="back-label back-label--long">{dynamic ?? label}</span>
        <span className="back-label back-label--short">Back</span>
      </button>
    </div>
  );
}
