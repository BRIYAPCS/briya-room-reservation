// src/utils/mailer.js
// -----------------------------------------------------------------------------
// MAILER UTILITY
// -----------------------------------------------------------------------------
// Responsibilities:
// • Configure SMTP transport (Gmail / Outlook / others)
// • Send emails with optional ICS calendar invites
// • Keep email logic isolated from business logic
//
// NOTES:
// • Uses Nodemailer `icalEvent` for best calendar compatibility
// • Supports Google Calendar, Outlook, Apple Calendar
// -----------------------------------------------------------------------------

import nodemailer from "nodemailer";

/* ------------------------------------------------------------------
   SMTP CONFIGURATION SANITY CHECK (DEBUG)
------------------------------------------------------------------ */
console.log("SMTP CONFIG CHECK:", {
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS ? "✔ present" : "❌ missing",
});

/* ------------------------------------------------------------------
   SMTP TRANSPORT
------------------------------------------------------------------ */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === "true", // true=465, false=587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/* ------------------------------------------------------------------
   SEND MAIL
   - IMPORTANT: allow caller to pass ICS method (REQUEST vs CANCEL)
------------------------------------------------------------------ */
export async function sendMail({ to, subject, text, html, ics, icsMethod }) {
  return transporter.sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject,
    text,
    html,

    ...(ics && {
      icalEvent: {
        filename: "reservation.ics",
        method: icsMethod || "REQUEST", // ✅ FIX: do not hardcode REQUEST
        content: ics,
      },
    }),
  });
}
