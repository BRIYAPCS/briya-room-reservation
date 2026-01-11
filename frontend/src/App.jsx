// App.jsx
// -------------------------------------------------------------
// Global Application Root
//
// Responsibilities:
// • Routing (React Router)
// • Shared layout (header/footer handled in pages)
// • Page transitions (enter / exit animations)
// • Navigation direction detection (forward / back)
// • Mobile swipe gestures (left / right navigation)
// • Global UI elements (Floating Help Button)
//
// IMPORTANT:
// • Global UI (Help button) must live OUTSIDE page transitions
// • Pages mount/unmount independently
// -------------------------------------------------------------

import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { useSwipeable } from "react-swipeable";

// Pages
import Home from "./pages/Home";
import Rooms from "./pages/Rooms";
import Calendar from "./pages/Calendar";

// Layout components
import Footer from "./components/Footer";

// Global UI components
import FloatingHelpButton from "./components/FloatingHelpButton";

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

  /* ======================================================
     NAVIGATION HISTORY — Detect forward / back direction
     ====================================================== */
  // Keeps a stack of visited location keys to determine
  // whether the user navigated forward or backward
  const historyStack = useRef([]);
  const [direction, setDirection] = useState("forward");

  /* ======================================================
     PAGE TRANSITION STATE (Delayed unmount system)
     ====================================================== */
  // Allows exit animation to finish before mounting next page
  const [transitionStage, setTransitionStage] = useState("page-enter");
  const [displayLocation, setDisplayLocation] = useState(location);
  const [pendingLocation, setPendingLocation] = useState(null);

  // Must match the CSS exit animation duration (ms)
  const EXIT_DURATION = 350;

  /* ======================================================
     LOCATION CHANGE HANDLING
     ====================================================== */
  useEffect(() => {
    const key = location.key;

    // Detect navigation direction
    if (!historyStack.current.includes(key)) {
      historyStack.current.push(key);
      setDirection("forward");
    } else {
      setDirection("back");
    }

    // Trigger exit animation if location changed
    if (location !== displayLocation) {
      setTransitionStage("page-exit");
      setPendingLocation(location);
    }
  }, [location, displayLocation]);

  /* ======================================================
     COMPLETE EXIT → MOUNT NEXT PAGE
     ====================================================== */
  useEffect(() => {
    if (transitionStage === "page-exit" && pendingLocation) {
      const timeout = setTimeout(() => {
        setDisplayLocation(pendingLocation);
        setTransitionStage("page-enter");
        setPendingLocation(null);
      }, EXIT_DURATION);

      return () => clearTimeout(timeout);
    }
  }, [transitionStage, pendingLocation]);

  /* ======================================================
     MOBILE SWIPE GESTURES
     ====================================================== */
  // Enables:
  // • Swipe right → back
  // • Swipe left → forward (if browser history allows)
  const swipeHandlers = useSwipeable({
    onSwipedRight: () => {
      if (window.history.length > 1) navigate(-1);
    },
    onSwipedLeft: () => {
      try {
        window.history.forward();
      } catch {
        // Safely ignore
      }
    },
    delta: 40,
    preventScrollOnSwipe: true,
    trackTouch: true,
    trackMouse: false,
  });

  /* ======================================================
     RENDER
     ====================================================== */
  return (
    <div {...swipeHandlers} className={`layout ${direction}`}>
      {/* --------------------------------------------------
          GLOBAL FLOATING HELP BUTTON
          - Mounted ONCE
          - Visible on all pages
          - Not affected by route transitions
      --------------------------------------------------- */}
      <FloatingHelpButton />

      {/* --------------------------------------------------
          PAGE TRANSITION WRAPPER
          - Pages mount/unmount here
          - Exit animation completes before next mount
      --------------------------------------------------- */}
      <div
        className={`page-wrapper ${transitionStage} ${direction}`}
        key={displayLocation.pathname}
      >
        <Routes location={displayLocation}>
          {/* HOME */}
          <Route
            path="/"
            element={
              <Home headerTransitionClass={`${transitionStage} ${direction}`} />
            }
          />

          {/* ROOMS (by site) */}
          <Route
            path="/rooms/:siteSlug"
            element={
              <Rooms
                headerTransitionClass={`${transitionStage} ${direction}`}
              />
            }
          />

          {/* CALENDAR (by site + room) */}
          <Route
            path="/calendar/:siteSlug/:roomId"
            element={
              <Calendar
                headerTransitionClass={`${transitionStage} ${direction}`}
              />
            }
          />
        </Routes>
      </div>

      {/* --------------------------------------------------
          GLOBAL FOOTER
          - Sits below page content
          - Participates in page transitions
      --------------------------------------------------- */}
      <Footer className={`footer-transition ${transitionStage} ${direction}`} />
    </div>
  );
}
