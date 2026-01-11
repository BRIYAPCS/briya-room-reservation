// src/services/calendarInviteService.js
// -----------------------------------------------------------------------------
// CALENDAR INVITE SERVICE (QUEUE-BASED)
// -----------------------------------------------------------------------------
// Responsibilities:
// • Decide WHO should receive calendar emails
// • Decide WHAT type of email (REQUEST / CANCEL)
// • Enqueue email jobs (does NOT send directly)
// • Handle organizer email changes correctly
// • Prevent duplicate emails using reservation_invites table
// -----------------------------------------------------------------------------

import { pool } from "../db/mysql.js"; // ✅ FIX path
import { enqueueEmailJob } from "../queue/emailQueue.js"; // ✅ FIX path

import {
  inviteCreatedTemplate,
  inviteUpdatedTemplate,
  inviteCancelledTemplate,
} from "./emailTemplates.js";

/* =============================================================================
   INVITE TRACKING HELPERS
============================================================================= */
async function getAlreadyInvitedEmails(reservationId) {
  const [rows] = await pool.query(
    `SELECT email FROM reservation_invites WHERE reservation_id = ?`,
    [reservationId]
  );
  return rows.map((r) => r.email);
}

async function markEmailInvited(reservationId, email) {
  await pool.query(
    `
    INSERT INTO reservation_invites (reservation_id, email, last_sent_at)
    VALUES (?, ?, NOW())
    ON DUPLICATE KEY UPDATE last_sent_at = NOW()
    `,
    [reservationId, email]
  );
}

async function removeInvitedEmail(reservationId, email) {
  await pool.query(
    `
    DELETE FROM reservation_invites
    WHERE reservation_id = ? AND email = ?
    `,
    [reservationId, email]
  );
}

/* =============================================================================
   EMAIL NORMALIZATION
============================================================================= */
function splitEmails(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

/* =============================================================================
   SEND INVITES ON CREATE (REQUEST → QUEUE)
============================================================================= */
async function sendInvitesOnCreate(reservation) {
  const { id, email, attendees_emails } = reservation;

  // STEP 1 — Normalize recipients (organizer + attendees)
  const allRecipients = Array.from(
    new Set([email, ...splitEmails(attendees_emails)].filter(Boolean)) // ✅ FIX
  );

  // STEP 2 — Filter out already invited
  const alreadyInvited = await getAlreadyInvitedEmails(id);
  const newRecipients = allRecipients.filter(
    (addr) => !alreadyInvited.includes(addr)
  );

  if (newRecipients.length === 0) {
    console.log("ℹ️ No new recipients to invite (create)");
    return;
  }

  // STEP 3 — enqueue job
  await enqueueEmailJob("invite_create", {
    reservation,
    recipients: newRecipients,
    // (optional) include template snapshot — worker can also build it
    template: inviteCreatedTemplate(reservation),
  });

  // STEP 4 — track invited
  for (const addr of newRecipients) {
    await markEmailInvited(id, addr);
  }

  console.log("📥 Email job enqueued (create):", newRecipients);
}

/* =============================================================================
   SEND INVITES ON UPDATE (DIFF → REQUEST / CANCEL → QUEUE)
============================================================================= */
async function sendInvitesOnUpdate({ reservation, previousReservation }) {
  const reservationId = reservation.id;

  // STEP 0 — Organizer email change handling
  const oldOrganizer = previousReservation.email;
  const newOrganizer = reservation.email;

  if (oldOrganizer && newOrganizer && oldOrganizer !== newOrganizer) {
    // new organizer -> REQUEST
    await enqueueEmailJob("invite_update", {
      reservation,
      recipients: [newOrganizer],
      template: inviteUpdatedTemplate(reservation),
    });
    await markEmailInvited(reservationId, newOrganizer);

    // old organizer -> CANCEL
    await enqueueEmailJob("invite_cancel", {
      reservation: previousReservation,
      recipients: [oldOrganizer],
      template: inviteCancelledTemplate(previousReservation),
    });
    await removeInvitedEmail(reservationId, oldOrganizer);
  }

  // STEP 1 — attendee sets (excluding organizer)
  const prevEmails = new Set(splitEmails(previousReservation.attendees_emails));
  const nextEmails = new Set(splitEmails(reservation.attendees_emails));

  // STEP 2 — added -> REQUEST
  for (const addr of nextEmails) {
    if (!prevEmails.has(addr)) {
      await enqueueEmailJob("invite_update", {
        reservation,
        recipients: [addr],
        template: inviteUpdatedTemplate(reservation),
      });
      await markEmailInvited(reservationId, addr);
    }
  }

  // STEP 3 — removed -> CANCEL
  for (const addr of prevEmails) {
    if (!nextEmails.has(addr)) {
      await enqueueEmailJob("invite_cancel", {
        reservation: previousReservation,
        recipients: [addr],
        template: inviteCancelledTemplate(previousReservation),
      });
      await removeInvitedEmail(reservationId, addr);
    }
  }

  console.log("📥 Email jobs enqueued (update)");
}

export default {
  sendInvitesOnCreate,
  sendInvitesOnUpdate,
};
