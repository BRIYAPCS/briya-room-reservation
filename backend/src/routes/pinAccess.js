const express = require("express");
const router = express.Router();

/* ============================================================
   POST /api/pin/verify
   ------------------------------------------------------------
   Verifies access PIN against environment variables.
   Returns role on success.
============================================================ */
router.post("/verify", (req, res) => {
  const { pin } = req.body;

  if (!pin) {
    return res.status(400).json({ message: "PIN is required" });
  }

  // Match against ENV PINs
  if (pin === process.env.PIN_USER) {
    return res.json({ role: "user" });
  }

  if (pin === process.env.PIN_ADMIN) {
    return res.json({ role: "admin" });
  }

  if (pin === process.env.PIN_SUPER_ADMIN) {
    return res.json({ role: "super_admin" });
  }

  // Invalid PIN
  return res.status(401).json({ message: "Invalid PIN" });
});

module.exports = router;
