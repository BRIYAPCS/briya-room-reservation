import { useState, useEffect } from "react";
import "../css/PinAccessModal.css";
import { API_BASE } from "../services/api";

/**
 * PIN ACCESS MODAL
 * ------------------------------------------------------------
 * • Blocks interaction until PIN is verified
 * • Locks page scrolling while open
 * • Supports optional Cancel
 * • Numeric-only PIN input
 * • Enter key submits
 */
export default function PinAccessModal({
  isOpen = true,
  onCancel,
  onSuccess,
  force = false,
}) {
  // DEV SAFETY CHECK
  if (!force && !onCancel) {
    console.warn("PinAccessModal used without onCancel while force=false");
  }

  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);

  /* ------------------------------------------------------------------
     🔒 SCROLL LOCK
     Disable background scroll while modal is open
  ------------------------------------------------------------------ */
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  /* ------------------------------------------------------------------
     VERIFY PIN
  ------------------------------------------------------------------ */
  async function handleVerify() {
    if (!pin) {
      setError("PIN is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/pin/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Invalid PIN");
      }

      const data = await res.json();

      // Store access for this device/session
      localStorage.setItem("calendarAccess", JSON.stringify(data));

      onSuccess?.(data);
    } catch (err) {
      setError(err.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  /* ------------------------------------------------------------------
     RENDER
  ------------------------------------------------------------------ */
  return (
    <div className="pin-backdrop">
      <div className="pin-modal" role="dialog" aria-modal="true">
        <h2>Enter Access PIN</h2>

        {/* PIN INPUT WITH VISIBILITY TOGGLE */}
        <div className="pin-input-wrapper">
          <input
            type={showPin ? "text" : "password"}
            inputMode="numeric"
            autoFocus
            value={pin}
            placeholder="Enter PIN"
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && handleVerify()}
          />

          <button
            type="button"
            className="pin-toggle"
            aria-label={showPin ? "Hide PIN" : "Show PIN"}
            onClick={() => setShowPin((v) => !v)}
          >
            {showPin ? "🙈" : "👁️"}
          </button>
        </div>

        {/* ERROR MESSAGE */}
        {error && <div className="pin-error">{error}</div>}

        {/* VERIFY */}
        <button onClick={handleVerify} disabled={loading}>
          {loading ? "Verifying…" : "Verify"}
        </button>

        {/* CANCEL (only when allowed) */}
        {!force && (
          <button className="pin-cancel" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
