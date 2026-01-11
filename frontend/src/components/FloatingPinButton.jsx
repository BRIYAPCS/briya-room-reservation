import { useState } from "react";
import PinAccessModal from "../components/PinAccessModal.jsx";
import "../css/FloatingPinButton.css";

/**
 * FLOATING PIN BUTTON
 * ------------------------------------------------------------
 * Small floating button (top-right corner)
 * that allows:
 * • Manual PIN entry
 * • Switching roles (user/admin/super admin)
 * • Re-authentication without page refresh
 *
 * Always visible for demo flexibility.
 */
export default function FloatingPinButton() {
  // Controls visibility of PIN modal
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating login / user icon */}
      <button
        className="floating-pin-btn"
        onClick={() => setOpen(true)}
        title="Login / Change Access"
      >
        👤
      </button>

      {/* PIN modal (not forced) */}
      <PinAccessModal
        isOpen={open}
        onCancel={() => setOpen(false)}
        onSuccess={() => setOpen(false)}
      />
    </>
  );
}
