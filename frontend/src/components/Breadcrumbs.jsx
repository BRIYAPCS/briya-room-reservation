// Breadcrumbs.jsx
// -----------------------------------------------------------------------------
// BREADCRUMBS NAVIGATION COMPONENT
//
// Purpose:
// • Display a clear navigation path (intent-based, NOT history-based)
// • Prevent navigation loops (Calendar → Rooms → Calendar)
// • Ensure predictable navigation from deep routes
//
// Design Rules:
// • Only items with `to` are clickable
// • Current page is ALWAYS plain text
// • Navigation ALWAYS uses replace:true
// • Visual styling handled via breadcrumbs.css
// -----------------------------------------------------------------------------

import { memo } from "react";
import { useNavigate } from "react-router-dom";
import "../css/breadcrumbs.css";

function Breadcrumbs({ items = [] }) {
  const navigate = useNavigate();

  // Safety guard — do not render empty breadcrumbs
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <span key={index} className="crumb">
            {/* --------------------------------------------------
                Clickable breadcrumb (intent-based navigation)
            --------------------------------------------------- */}
            {item.to && !isLast ? (
              <button
                type="button"
                className="breadcrumb-link"
                onClick={() => navigate(item.to, { replace: true })}
              >
                {item.label}
              </button>
            ) : (
              /* ------------------------------------------------
                 Current page (non-clickable)
              ------------------------------------------------- */
              <span className="crumb-current">{item.label}</span>
            )}

            {/* Separator (›), except after last crumb */}
            {!isLast && <span className="crumb-separator">›</span>}
          </span>
        );
      })}
    </nav>
  );
}

// Memoized for performance (breadcrumbs rarely change)
export default memo(Breadcrumbs);
