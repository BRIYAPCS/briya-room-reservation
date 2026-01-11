// src/services/emailTemplates.js
// -----------------------------------------------------------------------------
// EMAIL TEMPLATES
// -----------------------------------------------------------------------------
// Responsibilities:
// • Generate HTML + text email bodies
// • Centralize wording, formatting, and branding
// • Keep email presentation separate from invite logic
// -----------------------------------------------------------------------------

/* =============================================================================
   DATE FORMATTING HELPERS (HUMAN-FRIENDLY)
============================================================================= */

/**
 * Format MySQL DATETIME into readable string (EST)
 * Example:
 * 2026-01-10 14:30:00 →
 * Monday, January 10, 2026 • 2:30 PM (EST)
 */
function formatDateTime(mysqlDateTime) {
  if (!mysqlDateTime) return "";

  const date = new Date(mysqlDateTime.replace(" ", "T"));

  return (
    date.toLocaleString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "America/New_York",
    }) + " (EST)"
  );
}

/**
 * Format a start → end range in a compact, friendly way
 */
function formatDateRange(start, end) {
  return `
    ${formatDateTime(start)}<br/>
    <strong>to</strong><br/>
    ${formatDateTime(end)}
  `;
}

/* =============================================================================
   BASE LAYOUT (BRIYA BRANDING)
============================================================================= */

function baseLayout({ title, body }) {
  return `
  <div style="font-family: Arial, sans-serif; background:#f5f7fa; padding:24px;">
    <div style="max-width:600px; margin:auto; background:#ffffff; border-radius:8px; overflow:hidden; border:1px solid #e5e7eb;">
      
      <!-- HEADER -->
      <div style="background:#0f172a; padding:16px 24px; text-align:center;">
        <img
          src="https://YOUR_DOMAIN/assets/briya-logo.png"
          alt="Briya Logo"
          style="height:48px; margin-bottom:8px;"
        />
        <div style="color:#e5e7eb; font-size:14px;">
          Briya Public Charter School
        </div>
      </div>

      <!-- BODY -->
      <div style="padding:24px;">
        <h2 style="margin-top:0; color:#111827;">${title}</h2>
        ${body}
      </div>

      <!-- FOOTER -->
      <div style="padding:16px 24px; font-size:12px; color:#6b7280; background:#f9fafb;">
        This message was sent automatically by the Briya Room Reservation System.
        <br/>Please do not reply to this email.
      </div>
    </div>
  </div>
  `;
}

/* =============================================================================
   CREATE / REQUEST TEMPLATE
============================================================================= */
export function inviteCreatedTemplate(reservation) {
  const body = `
    <p>You have been invited to a room reservation.</p>

    <p>
      <strong>Room:</strong><br/>
      ${reservation.room_name_snapshot} – ${reservation.site_name_snapshot}
    </p>

    <p>
      <strong>Date & Time:</strong><br/>
      ${formatDateRange(reservation.start_time, reservation.end_time)}
    </p>

    <p>
      Please accept the calendar invitation to add this event to your calendar.
    </p>
  `;

  return {
    subject: `Room Reservation: ${reservation.title}`,
    html: baseLayout({
      title: reservation.title,
      body,
    }),
    text: `You have been invited to a room reservation: ${reservation.title}`,
  };
}

/* =============================================================================
   UPDATE / REQUEST TEMPLATE
============================================================================= */
export function inviteUpdatedTemplate(reservation) {
  const body = `
    <p>A room reservation you are part of has been updated.</p>

    <p>
      <strong>Room:</strong><br/>
      ${reservation.room_name_snapshot} – ${reservation.site_name_snapshot}
    </p>

    <p>
      <strong>Updated Date & Time:</strong><br/>
      ${formatDateRange(reservation.start_time, reservation.end_time)}
    </p>

    <p>
      Your calendar will update automatically once you accept the change.
    </p>
  `;

  return {
    subject: `Updated Reservation: ${reservation.title}`,
    html: baseLayout({
      title: "Reservation Updated",
      body,
    }),
    text: `A reservation was updated: ${reservation.title}`,
  };
}

/* =============================================================================
   ORGANIZER CHANGED TEMPLATE
============================================================================= */
export function inviteOrganizerChangedTemplate(reservation) {
  const body = `
    <p>
      The organizer for the following reservation has changed.
    </p>

    <p>
      <strong>Room:</strong><br/>
      ${reservation.room_name_snapshot} – ${reservation.site_name_snapshot}
    </p>

    <p>
      <strong>Date & Time:</strong><br/>
      ${formatDateRange(reservation.start_time, reservation.end_time)}
    </p>

    <p>
      No action is required unless you wish to remove this event from your calendar.
    </p>
  `;

  return {
    subject: `Organizer Updated: ${reservation.title}`,
    html: baseLayout({
      title: "Organizer Updated",
      body,
    }),
    text: `The organizer changed for: ${reservation.title}`,
  };
}

/* =============================================================================
   CANCEL TEMPLATE
============================================================================= */
export function inviteCancelledTemplate(reservation) {
  const body = `
    <p>The following room reservation has been cancelled for you.</p>

    <p>
      <strong>Room:</strong><br/>
      ${reservation.room_name_snapshot} – ${reservation.site_name_snapshot}
    </p>

    <p>
      This event will be removed from your calendar.
    </p>
  `;

  return {
    subject: `Reservation Cancelled: ${reservation.title}`,
    html: baseLayout({
      title: "Reservation Cancelled",
      body,
    }),
    text: `A reservation was cancelled: ${reservation.title}`,
  };
}
