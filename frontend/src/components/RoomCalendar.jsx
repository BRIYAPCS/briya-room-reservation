// RoomCalendar.jsx
// -----------------------------------------------------------------------------
// ROOM CALENDAR COMPONENT — DRAG & DROP ENABLED + MODAL CREATE/EDIT
//
// Responsibilities:
// • Render Big React Calendar in CONTROLLED mode
// • Apply rules from calendarPolicy (single source of truth)
// • Grey-out & disable weekends when weekends are not allowed
// • Allow drag & drop + resize
// • Persist updates to backend MySQL (DATETIME-safe, no UTC "Z")
// • Support continuous multi-day reservations (Big Calendar + split rendering)
//
// Adds (SAFELY):
// • Click empty slot → Create Reservation modal
// • Click existing event → Edit Reservation modal
// • POST create + PUT edit (syncs immediately with UI)
//
// Guarantees:
// • Drag & Drop and Resize behavior remain unchanged
// • No routing logic
// • No UI toggles
// • Rule-driven behavior only
// -----------------------------------------------------------------------------

import { useEffect, useMemo, useState, useCallback } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import { format, parse, startOfWeek, getDay } from "date-fns";
import enUS from "date-fns/locale/en-US";

import Breadcrumbs from "./Breadcrumbs";
import ReservationModal from "./ReservationModal";

import { getCalendarPolicy } from "../policies/calendarPolicy.adapter";
import { mapReservationsToEvents } from "../utils/calendarUtils";

import { toMySQLDateTime } from "../utils/reservationDateTime";

import {
  getReservationsByRoom,
  updateReservation,
  createReservation,
} from "../services/reservationsService";

import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import "../css/roomCalendar.css";
import { isWeekend } from "../policies/calendarPolicy.adapter";


/* ------------------------------------------------------------------
   CALENDAR POLICY — SINGLE SOURCE OF TRUTH
   ------------------------------------------------------------------
   IMPORTANT:
   • All business-hour logic + weekend logic must come from here
   • Later, your admin dashboard can swap / update this policy
------------------------------------------------------------------ */

const policy = getCalendarPolicy();

/* =============================================================================
   RECURRENCE GUARD — INSTANCE DETECTION
   -----------------------------------------------------------------------------
   Why this exists:
   • Your backend may generate expanded instances for recurring series
   • Until "Edit series vs Edit single" is implemented, editing is blocked
============================================================================= */
function isRecurringInstance(event) {
  // Defensive: recurrence_id may exist in event.resource OR directly on event
  return (
    event?.resource?.recurrence_id != null ||
    event?.recurrence_id != null
  );
}

const RECURRENCE_BLOCK_MSG = "Recurring reservations cannot be edited yet.";

function blockRecurringAction() {
  alert(RECURRENCE_BLOCK_MSG);
}

/* =============================================================================
   LOCALIZER — STABLE WEEK ANCHOR (CRITICAL)
   -----------------------------------------------------------------------------
   Why we anchor:
   • Big Calendar uses week start calculations that can drift based on locale
   • Anchoring makes rendering deterministic across environments
============================================================================= */
const WEEK_ANCHOR = startOfWeek(new Date(2020, 0, 5), { weekStartsOn: 0 });

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => WEEK_ANCHOR,
  getDay,
  locales: { "en-US": enUS },
});

const DnDCalendar = withDragAndDrop(Calendar);

export default function RoomCalendar({ site, room, breadcrumbItems = [] }) {
  /* ===========================================================================
     STATE — RAW RESERVATIONS (DB SHAPE ONLY)
     ---------------------------------------------------------------------------
     • Do NOT store Date objects here
     • start_time / end_time are MySQL DATETIME strings
  ========================================================================== */
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);

  /* ===========================================================================
     STATE — CALENDAR CONTROL (CONTROLLED MODE)
  ========================================================================== */
  const [currentView, setCurrentView] = useState("week");
  const [currentDate, setCurrentDate] = useState(new Date());

  /* ===========================================================================
     STATE — MODAL CONTROL
  ========================================================================== */
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // "create" | "edit"
  const [activeEvent, setActiveEvent] = useState(null); // FULL DB ROW (not RBC event)
  const [modalStart, setModalStart] = useState(null); // Date (from calendar selection)
  const [modalEnd, setModalEnd] = useState(null); // Date (from calendar selection)

  /* ===========================================================================
     MODAL HELPERS
  ========================================================================== */
  function openCreateModal(start, end) {
    setModalMode("create");
    setActiveEvent(null);
    setModalStart(start);
    setModalEnd(end);
    setModalOpen(true);
  }

  const openEditModal = useCallback(
    (event) => {
      // 🚫 Block editing of recurring instances (until series editing is built)
      if (isRecurringInstance(event)) {
        blockRecurringAction();
        return;
      }

      // ------------------------------------------------------------------
      // React Big Calendar event ≠ DB reservation row
      //
      // For split multi-day render:
      // • event.resource.parentId may point to the original DB reservation
      // For normal:
      // • event.id may be the DB id
      // ------------------------------------------------------------------
      const reservationId = Number(event?.resource?.parentId ?? event?.id);

      const fullReservation = reservations.find(
        (r) => Number(r.id) === reservationId
      );

      if (!fullReservation) {
        console.error("Failed to locate reservation for event:", {
          reservationId,
          event,
          reservationsCount: reservations.length,
        });
        return;
      }

      setModalMode("edit");
      setActiveEvent(fullReservation); // ✅ FULL DB ROW goes to modal
      setModalStart(event.start);
      setModalEnd(event.end);
      setModalOpen(true);
    },
    [reservations]
  );

  function closeModal() {
    setModalOpen(false);
    setActiveEvent(null);
  }

  /* ===========================================================================
     LOAD RESERVATIONS (API)
  ========================================================================== */
  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        const data = await getReservationsByRoom(site.slug, room.id);
        if (alive) setReservations(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to load reservations:", err);
        if (alive) setReservations([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [site.slug, room.id]);

  /* ===========================================================================
     DB → CALENDAR EVENTS
     ---------------------------------------------------------------------------
     mapReservationsToEvents is your transform layer:
     • Converts MySQL DATETIME strings into Date objects (local wall time)
     • Adds resource metadata (parentId, recurrence_id, etc.)
  ========================================================================== */
  const events = useMemo(() => {
    return mapReservationsToEvents(reservations);
  }, [reservations]);

  /* ===========================================================================
     CALENDAR NAVIGATION (CONTROLLED)
  ========================================================================== */
  const handleViewChange = useCallback((view) => {
    setCurrentView(view);
  }, []);

  const handleNavigate = useCallback((date) => {
    // Defensive clone to avoid weird mutations
    setCurrentDate(new Date(date.getTime()));
  }, []);

  /* ===========================================================================
     SELECT HANDLERS
  ========================================================================== */
  const handleSelectEvent = useCallback(
    (event) => {
      // If weekends are disabled, do not allow interactions on weekend days
      if (!policy.rules.allowWeekends && isWeekend(event.start)) return;
      openEditModal(event);
    },
    [openEditModal]
  );

  const handleSelectSlot = useCallback((slotInfo) => {
    if (!policy.rules.allowWeekends && isWeekend(slotInfo.start)) return;
    openCreateModal(slotInfo.start, slotInfo.end);
  }, []);

  /* ===========================================================================
     🔑 CRITICAL FIX — BUILD FULL PUT PAYLOAD FOR DRAG / RESIZE
     ---------------------------------------------------------------------------
     Your backend PUT validates multiple fields (title/email/etc).
     So drag/resize MUST NOT send partial payloads.
  ========================================================================== */
  function buildEditablePutPayload(row, startDate, endDate) {
    if (!row) return null;

    return {
      // Date/time updates from drag/resize
      start_time: toMySQLDateTime(startDate),
      end_time: toMySQLDateTime(endDate),

      // Preserve required/editable fields so backend validation passes
      title: row.title ?? null,
      description: row.description ?? null,
      created_by_name: row.created_by_name ?? null,
      email: row.email ?? null,
      attendees_emails: row.attendees_emails ?? null,

      // Future-safe flag (backend can ignore or enforce later)
      edit_scope: "single",
    };
  }

  /* ===========================================================================
     MODAL SUBMIT
     ---------------------------------------------------------------------------
     Ownership rules:
     • ReservationModal owns all editable fields + builds modalPayload
     • RoomCalendar injects site_id + room_id (context)
     • Backend response is authoritative (always replace/append using it)
  ========================================================================== */
  async function handleModalSubmit(modalPayload) {
    if (!modalPayload) return;

    // ------------------------------
    // CREATE
    // ------------------------------
    if (modalMode === "create") {
      const payload = {
        site_id: site.id,
        room_id: room.id,
        ...modalPayload,
      };

      const result = await createReservation(payload);

      // Backend may return:
      // • { id: ... } single row
      // • { reservations: [...] } for expanded recurring creation
      if (result?.reservations && Array.isArray(result.reservations)) {
        setReservations((prev) => [...prev, ...result.reservations]);
      } else if (result?.id) {
        setReservations((prev) => [...prev, result]);
      } else {
        console.error("Unexpected createReservation response:", result);
      }

      closeModal();
      return;
    }

    // ------------------------------
    // EDIT (single instance only)
    // ------------------------------
    const id = activeEvent?.id;

    // 🚫 Hard block invalid IDs
    if (!Number.isInteger(Number(id))) {
      alert("This reservation cannot be edited yet.");
      return;
    }

    const updated = await updateReservation(id, modalPayload);

    // Replace local row with backend-returned row
    setReservations((prev) =>
      prev.map((r) => (Number(r.id) === Number(id) ? updated : r))
    );

    closeModal();
  }

  /* ===========================================================================
     DRAG EVENT (MOVE)
  ========================================================================== */
  const handleEventDrop = useCallback(
    async ({ event, start, end }) => {
      if (!policy.rules.allowWeekends && isWeekend(start)) return;

      if (isRecurringInstance(event)) {
        blockRecurringAction();
        return;
      }

      const parentId = Number(event?.resource?.parentId ?? event?.id);
      const row = reservations.find((r) => Number(r.id) === parentId);

      const payload = buildEditablePutPayload(row, start, end);
      if (!payload) return;

      const updated = await updateReservation(parentId, payload);

      setReservations((prev) =>
        prev.map((r) => (Number(r.id) === parentId ? updated : r))
      );
    },
    [reservations]
  );

  /* ===========================================================================
     RESIZE EVENT
  ========================================================================== */
  const handleEventResize = useCallback(
    async ({ event, start, end }) => {
      if (!policy.rules.allowWeekends && isWeekend(start)) return;

      if (isRecurringInstance(event)) {
        blockRecurringAction();
        return;
      }

      const parentId = Number(event?.resource?.parentId ?? event?.id);
      const row = reservations.find((r) => Number(r.id) === parentId);

      const payload = buildEditablePutPayload(row, start, end);
      if (!payload) return;

      const updated = await updateReservation(parentId, payload);

      setReservations((prev) =>
        prev.map((r) => (Number(r.id) === parentId ? updated : r))
      );
    },
    [reservations]
  );

  /* ===========================================================================
     VISUAL RULES (WEEKENDS DISABLED)
  ========================================================================== */
  const dayPropGetter = useCallback((date) => {
    if (!policy.rules.allowWeekends && isWeekend(date)) {
      return { className: "calendar-weekend-disabled" };
    }
    return {};
  }, []);

  const slotPropGetter = useCallback((date) => {
    if (!policy.rules.allowWeekends && isWeekend(date)) {
      return { className: "calendar-weekend-disabled" };
    }
    return {};
  }, []);

  if (loading) {
    return <div className="calendar-loading">Loading calendar…</div>;
  }

  /* ===========================================================================
     RENDER
  ========================================================================== */
  return (
    <div className="room-calendar-wrapper">
      {/* Breadcrumbs (optional) */}
      {breadcrumbItems.length > 0 && (
        <div className="calendar-breadcrumbs">
          <Breadcrumbs items={breadcrumbItems} />
        </div>
      )}

      <DnDCalendar
        localizer={localizer}
        events={events}
        view={currentView}
        date={currentDate}
        onView={handleViewChange}
        onNavigate={handleNavigate}
        views={["day", "week", "work_week", "month"]}
        defaultView="week"

        /* ------------------------------------------------------------------
           BUSINESS HOURS — FROM POLICY
           ------------------------------------------------------------------
           Big Calendar expects Date objects for min/max.
           policy.time.min/max should already be Date objects.
        ------------------------------------------------------------------ */
        min={policy.time.min}
        max={policy.time.max}

        /* ------------------------------------------------------------------
           SLOT CONFIG
           ------------------------------------------------------------------
           Keep step/timeslots consistent with your time-slot engine.
           If policy.time.slotMinutes changes later, we should align step/timeslots.
        ------------------------------------------------------------------ */
        step={30}
        timeslots={2}

        showMultiDayTimes
        selectable
        resizable
        onSelectSlot={handleSelectSlot}
        onSelectEvent={handleSelectEvent}
        onEventDrop={handleEventDrop}
        onEventResize={handleEventResize}
        dayPropGetter={dayPropGetter}
        slotPropGetter={slotPropGetter}
        eventPropGetter={(event) =>
          isRecurringInstance(event)
            ? { className: "calendar-event-recurring" }
            : {}
        }
        popup
        style={{ height: "70vh", minHeight: "520px" }}
      />

      {/* Modal (Create/Edit) */}
      <ReservationModal
        isOpen={modalOpen}
        mode={modalMode}
        roomName={room.name}
        initialStart={modalStart}
        initialEnd={modalEnd}
        activeEvent={activeEvent} // ✅ FULL DB ROW
        onClose={closeModal}
        onSubmit={handleModalSubmit}
      />
    </div>
  );
}
