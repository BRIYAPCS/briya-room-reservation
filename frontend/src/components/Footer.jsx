// Footer.jsx
// ---------------------------------------------------------------------
// Global Footer Component
//
// • Appears on all routed pages (managed in App.jsx)
// • Accepts animation classes for page transitions:
//      <Footer className={`footer-transition ${transitionStage} ${direction}`} />
// • Pure presentational component → memoized for performance
//
// NOTE:
// Footer styling, animations, and responsiveness are fully defined in
// footer.css. This component only holds structure & content.
// ---------------------------------------------------------------------

import { memo } from "react";
import "../css/footer.css";

function Footer({ className = "" }) {
  // Computed once per render; negligible cost
  const currentYear = new Date().getFullYear();

  return (
    <footer className={`footer ${className}`.trim()}>
      © {currentYear} | Designed & Engineered by the Briya IT Team
    </footer>
  );
}

// Prevents rerenders when parent components re-render unnecessarily.
export default memo(Footer);
