// Header.jsx
// ------------------------------------------------------------------
// Highly optimized Header component
//
// Improvements:
// • Added ResizeObserver → perfectly tracks real header height
// • Reduced layout thrashing using useLayoutEffect efficiently
// • Added memo() to prevent unnecessary rerenders
// • Added showTitle prop (Calendar-safe)
// • Same API and exact same visual structure by default
// ------------------------------------------------------------------

import { useRef, useLayoutEffect, memo } from "react";
import BackButton from "./BackButton";
import "../css/header.css";

function Header({
  subtitle,
  className = "",
  showBack = false,
  backTo = "/",
  backLabel = "Back",

  // NEW (optional)
  showTitle = true, // 👈 DEFAULT: title is shown everywhere
}) {
  const headerRef = useRef(null);

  // ------------------------------------------------------------------
  // DYNAMIC HEADER HEIGHT
  // Uses ResizeObserver to track header size changes accurately
  // ------------------------------------------------------------------
  useLayoutEffect(() => {
    if (!headerRef.current) return;

    const updateHeaderHeight = () => {
      const height = headerRef.current?.offsetHeight || 0;
      document.documentElement.style.setProperty(
        "--header-height",
        `${height}px`
      );
    };

    updateHeaderHeight();

    const observer = new ResizeObserver(updateHeaderHeight);
    observer.observe(headerRef.current);

    return () => observer.disconnect();
  }, []);

  return (
    <header ref={headerRef} className={`header ${className}`.trim()}>
      <div className="header-container">
        {/* --------------------------------------------------------
            ROW 1 — Centered Logo (always visible)
        --------------------------------------------------------- */}
        <img
          src="/BriyaLogo.png"
          alt="Briya Public Charter School"
          className="header-logo"
        />

        {/* --------------------------------------------------------
            ROW 2 — Back Button + Title
            Title can be disabled per page (Calendar)
        --------------------------------------------------------- */}
        {(showBack || showTitle) && (
          <div className="header-title-row">
            {showBack && (
              <BackButton
                inline
                to={backTo}
                label={backLabel}
                showOnScroll={false}
              />
            )}

            {showTitle && (
              <h1 className="header-title">Briya Room Reservations</h1>
            )}
          </div>
        )}

        {/* --------------------------------------------------------
            ROW 3 — Subtitle (Optional)
        --------------------------------------------------------- */}
        {subtitle && <h2 className="header-subtitle">{subtitle}</h2>}
      </div>
    </header>
  );
}

// Prevent unnecessary rerenders when props do not change
export default memo(Header);
