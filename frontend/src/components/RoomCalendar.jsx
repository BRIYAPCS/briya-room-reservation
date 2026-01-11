// RoomCalendar.jsx
// -----------------------------------------------------------------------------
// ROOM CALENDAR COMPONENT — DRAG & DROP ENABLED + MODAL CREATE/EDIT
//
// Responsibilities:
// • Render Big React Calendar in CONTROLLED mode
// • Apply rules from calendarUtils.js
// • Grey-out & disable weekends when rule is false
// • Allow drag & drop + resize
// • Persist updates to MySQL (DATETIME-safe, no UTC "Z")
// • Support continuous multi-day reservations
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

import {
  mapReservationsToEvents,
  CALENDAR_MIN_TIME,
  CALENDAR_MAX_TIME,
  IS_WEEKENDS_ENABLED,
  isWeekend,
} from "../utils/calendarUtils";

import { toMySQLDateTime } from "../utils/reservationDateTime";

import {
  getReservationsByRoom,
  updateReservation,
  createReservation,
} from "../services/reservationsService";

import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import "../css/roomCalendar.css";

/* =============================================================================
   RECURRENCE GUARD — INSTANCE DETECTION
============================================================================= */
function isRecurringInstance(event) {
  return event?.recurrence_id != null;
}

const RECURRENCE_BLOCK_MSG = "Recurring reservations cannot be edited yet.";

function blockRecurringAction() {
  alert(RECURRENCE_BLOCK_MSG);
}

/* =============================================================================
   LOCALIZER — STABLE WEEK ANCHOR (CRITICAL)
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
     - NEVER store Date objects here
     - start_time / end_time are MySQL DATETIME strings
  ========================================================================== */
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);

  /* ===========================================================================
     STATE — CALENDAR CONTROL
  ========================================================================== */
  const [currentView, setCurrentView] = useState("week");
  const [currentDate, setCurrentDate] = useState(new Date());

  /* ===========================================================================
     STATE — MODAL CONTROL
  ========================================================================== */
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [activeEvent, setActiveEvent] = useState(null);
  const [modalStart, setModalStart] = useState(null);
  const [modalEnd, setModalEnd] = useState(null);

  const BUSINESS_START_HOUR = CALENDAR_MIN_TIME.getHours();
  const BUSINESS_END_HOUR = CALENDAR_MAX_TIME.getHours();

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

  // function openEditModal(event) {
  //   if (isRecurringInstance(event)) {
  //     blockRecurringAction();
  //     return;
  //   }

  //   setModalMode("edit");
  //   setActiveEvent(event);
  //   setModalStart(event.start);
  //   setModalEnd(event.end);
  //   setModalOpen(true);
  // }

  const openEditModal = useCallback(
    (event) => {
      // 🚫 Block editing of recurring instances
      if (isRecurringInstance(event)) {
        blockRecurringAction();
        return;
      }

      // ------------------------------------------------------------------
      // React Big Calendar event ≠ DB reservation row
      // Normalize ID and lookup FULL reservation
      // ------------------------------------------------------------------
      const reservationId = Number(event.resource?.parentId ?? event.id);

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
      setActiveEvent(fullReservation);
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
     LOAD RESERVATIONS
  ========================================================================== */
  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        const data = await getReservationsByRoom(site.slug, room.id);
        if (alive) setReservations(data);
      } catch (err) {
        console.error("Failed to load reservations:", err);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => (alive = false);
  }, [site.slug, room.id]);

  /* ===========================================================================
     DB → CALENDAR EVENTS
  ========================================================================== */
  const events = useMemo(
    () => mapReservationsToEvents(reservations),
    [reservations]
  );

  /* ===========================================================================
     CALENDAR NAVIGATION
  ========================================================================== */
  const handleViewChange = useCallback((view) => {
    setCurrentView(view);
  }, []);

  const handleNavigate = useCallback((date) => {
    setCurrentDate(new Date(date.getTime()));
  }, []);

  /* ===========================================================================
     EVENT / SLOT SELECTION
  ========================================================================== */
  // const handleSelectEvent = useCallback((event) => {
  //   if (!IS_WEEKENDS_ENABLED && isWeekend(event.start)) return;
  //   openEditModal(event);
  // }, []);

  const handleSelectEvent = useCallback(
    (event) => {
      if (!IS_WEEKENDS_ENABLED && isWeekend(event.start)) return;
      openEditModal(event);
    },
    [openEditModal]
  );

  const handleSelectSlot = useCallback((slotInfo) => {
    if (!IS_WEEKENDS_ENABLED && isWeekend(slotInfo.start)) return;
    openCreateModal(slotInfo.start, slotInfo.end);
  }, []);

  /* ===========================================================================
     🔑 CRITICAL FIX — BUILD FULL PUT PAYLOAD FOR DRAG / RESIZE
     - Backend PUT validates email + other fields
     - Drag/resize MUST NOT send partial payloads
  ========================================================================== */
  function buildEditablePutPayload(row, startDate, endDate) {
    if (!row) return null;

    return {
      start_time: toMySQLDateTime(startDate),
      end_time: toMySQLDateTime(endDate),

      title: row.title ?? null,
      description: row.description ?? null,
      created_by_name: row.created_by_name,
      email: row.email ?? null,
      attendees_emails: row.attendees_emails ?? null,

      // Future-safe (backend rejects series edits for now)
      edit_scope: "single",
    };
  }

  /* ===========================================================================
   MODAL SUBMIT
   ===========================================================================
   Architecture rules:
   • ReservationModal owns all editable fields
     (title, description, created_by_name, email, attendees_emails, times, etc.)
   • RoomCalendar injects ONLY contextual identifiers
     (site_id, room_id, reservation id)
   • Backend responses are ALWAYS authoritative
   • Local state must reflect FULL DB rows, never partial modal payloads
   ========================================================================== */
  async function handleModalSubmit(modalPayload) {
    if (!modalPayload) return;

    /* -------------------------------------------------------------------------
     CREATE MODE
     -------------------------------------------------------------------------
     Flow:
     1) ReservationModal validates + builds modalPayload
     2) RoomCalendar injects site_id + room_id
     3) Backend INSERTS and returns:
        • Single full reservation row (non-recurring), OR
        • { reservations: [...] } for recurring expansion
     4) Local state is updated ONLY with backend-returned rows
     ------------------------------------------------------------------------- */
    if (modalMode === "create") {
      const payload = {
        // Context owned by RoomCalendar
        site_id: site.id,
        room_id: room.id,

        // Forward ALL modal-owned fields verbatim
        ...modalPayload,
      };

      const result = await createReservation(payload);

      if (result?.reservations) {
        // Recurring expansion (already full DB rows)
        setReservations((prev) => [...prev, ...result.reservations]);
      } else if (result?.id) {
        // Single reservation — trust backend row
        setReservations((prev) => [...prev, result]);
      } else {
        // Defensive guard — should never happen
        console.error("Unexpected createReservation response:", result);
      }

      closeModal();
      return;
    }

    /* -------------------------------------------------------------------------
     EDIT MODE (SINGLE INSTANCE ONLY)
     -------------------------------------------------------------------------
     Rules:
     • Recurring instances are blocked BEFORE reaching this point
     • modalPayload may be PARTIAL (UI-oriented)
     • Backend response is the SINGLE source of truth
     ------------------------------------------------------------------------- */
    const id = activeEvent?.id;

    // 🚫 HARD BLOCK invalid or synthetic IDs
    if (!Number.isInteger(Number(id))) {
      alert("This reservation cannot be edited yet.");
      return;
    }

    // Persist update and capture FULL backend row
    const updated = await updateReservation(id, modalPayload);

    // Replace local row with backend-returned row
    setReservations((prev) => prev.map((r) => (r.id === id ? updated : r)));

    closeModal();
  }

  /* ===========================================================================
   DRAG EVENT
   ===========================================================================
   Rules:
   • Drag updates ONLY start/end times
   • Backend remains authoritative for validation & normalization
   • Local state must always store FULL DB rows
   ========================================================================== */
  const handleEventDrop = useCallback(
    async ({ event, start, end }) => {
      // 🚫 Block weekends if disabled
      if (!IS_WEEKENDS_ENABLED && isWeekend(start)) return;

      // 🚫 Block recurring instances (future-safe)
      if (isRecurringInstance(event)) {
        blockRecurringAction();
        return;
      }

      // Use parentId for split weekday segments
      const parentId = event.resource?.parentId ?? event.id;

      // Source of truth for existing editable fields
      const row = reservations.find((r) => r.id === parentId);

      // Defensive guard — should never happen
      const payload = buildEditablePutPayload(row, start, end);
      if (!payload) return;

      // -----------------------------------------------------------------------
      // CRITICAL FIX:
      // Capture backend response and REPLACE local row
      // -----------------------------------------------------------------------
      const updated = await updateReservation(parentId, payload);

      setReservations((prev) =>
        prev.map((r) => (r.id === parentId ? updated : r))
      );
    },
    [reservations]
  );

  /* ===========================================================================
   RESIZE EVENT
   ===========================================================================
   Rules:
   • Resize updates ONLY start/end times
   • Backend remains authoritative for validation & normalization
   • Local state must always store FULL DB rows
   ========================================================================== */
  const handleEventResize = useCallback(
    async ({ event, start, end }) => {
      // 🚫 Block weekends if disabled
      if (!IS_WEEKENDS_ENABLED && isWeekend(start)) return;

      // 🚫 Block recurring instances (future-safe)
      if (isRecurringInstance(event)) {
        blockRecurringAction();
        return;
      }

      // Use parentId for split weekday segments
      const parentId = Number(event.resource?.parentId ?? event.id);

      // Source of truth for existing editable fields
      const row = reservations.find((r) => Number(r.id) === parentId);

      // Defensive guard — should never happen
      const payload = buildEditablePutPayload(row, start, end);
      if (!payload) return;

      // -----------------------------------------------------------------------
      // CRITICAL FIX:
      // Capture backend response and REPLACE local row
      // -----------------------------------------------------------------------
      const updated = await updateReservation(parentId, payload);

      setReservations((prev) =>
        prev.map((r) => (Number(r.id) === parentId ? updated : r))
      );
    },
    [reservations]
  );

  /* ===========================================================================
     VISUAL RULES
  ========================================================================== */
  const dayPropGetter = useCallback((date) => {
    if (!IS_WEEKENDS_ENABLED && isWeekend(date)) {
      return { className: "calendar-weekend-disabled" };
    }
    return {};
  }, []);

  const slotPropGetter = useCallback((date) => {
    if (!IS_WEEKENDS_ENABLED && isWeekend(date)) {
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
        min={CALENDAR_MIN_TIME}
        max={CALENDAR_MAX_TIME}
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

      <ReservationModal
        isOpen={modalOpen}
        mode={modalMode}
        roomName={room.name}
        initialStart={modalStart}
        initialEnd={modalEnd}
        activeEvent={activeEvent}
        businessStartHour={BUSINESS_START_HOUR}
        businessEndHour={BUSINESS_END_HOUR}
        onClose={closeModal}
        onSubmit={handleModalSubmit}
      />
    </div>
  );
}
