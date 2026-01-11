// src/components/ReservationModal.jsx
// ------------------------------------------------------------
// Reusable modal for creating/editing reservations.
//
// Supports:
// • Room context display (centered title)
// • Event title
// • Start / End date & time
// • Booked by
// • Optional description
// • Recurring event UI (logic added later)
//
// Validation:
// • Weekend rules (rule-driven)
// • Business hours
// • Invalid ranges
//
// Design goals:
// • No drag & drop regressions
// • Backend-safe (POST / PUT unchanged)
// • Fully responsive (desktop + mobile)
// • Easy to extend (recurrence engine, approvals, permissions)
// ------------------------------------------------------------

import { useEffect, useMemo, useRef, useState } from "react";
import "../css/reservationModal.css";

import {
  combineDateAndTime,
  toInputDate,
  toInputTime,
  getTodayInputDate,
  snapTimeUpToSlot,
  generateTimeSlots,
  formatTime12h,
  toMySQLDateTime,
} from "../utils/reservationDateTime";

import {
  IS_WEEKENDS_ENABLED,
  isWeekend,
  CALENDAR_MIN_TIME,
  CALENDAR_MAX_TIME,
  TIME_SLOT_MINUTES,
} from "../utils/calendarUtils";

import { validateReservationRange } from "../utils/reservationValidation";

/* ------------------------------------------------------------------
   BUSINESS HOURS — DERIVED FROM CALENDAR RULES
   ------------------------------------------------------------------
   Used to constrain native <input type="time"> pickers
   Keeps modal aligned with calendar rules (single source of truth)
------------------------------------------------------------------ */
const MIN_TIME_STRING = CALENDAR_MIN_TIME.toTimeString().slice(0, 5);
const MAX_TIME_STRING = CALENDAR_MAX_TIME.toTimeString().slice(0, 5);

export default function ReservationModal({
  isOpen,
  mode, // "create" | "edit"
  roomName, // Display room name in header
  initialStart,
  initialEnd,
  businessStartHour,
  businessEndHour,
  activeEvent,
  onClose,
  onSubmit,
}) {
  /* ------------------------------------------------------------------
   TIME SLOT OPTIONS (DROPDOWN)
------------------------------------------------------------------ */
  const timeOptions = useMemo(
    () =>
      generateTimeSlots(
        CALENDAR_MIN_TIME,
        CALENDAR_MAX_TIME,
        TIME_SLOT_MINUTES
      ),
    []
  );

  /* ----------------------------------------------------------------------------
   DATE NORMALIZATION — WEEKDAY ONLY (FORWARD SAFE)
   ----------------------------------------------------------------------------
   Purpose:
   • Automatically move a selected date forward to the next valid weekday
     when weekends are disabled.
   • Used during modal initialization and date auto-correction flows.

   CRITICAL TIMEZONE RULE:
   • NEVER use `new Date(date)` — this may re-interpret the date
     and introduce UTC / DST drift.
   • ALWAYS clone using `date.getTime()` to preserve local wall-time.

   SAFETY GUARANTEES:
   • No timezone shifting
   • No mutation of the original Date object
   • Forward-only correction (never moves backward in time)
--------------------------------------------------------------------------------- */
  function normalizeToNextValidWeekday(date) {
    // Defensive clone — preserves exact local wall-time
    const d = new Date(date.getTime());

    // Move forward until a valid weekday is reached
    while (!IS_WEEKENDS_ENABLED && isWeekend(d)) {
      d.setDate(d.getDate() + 1);
    }

    return d;
  }

  /* ------------------------------------------------------------------
   TIME AUTO-SNAP — BUSINESS HOURS
   ------------------------------------------------------------------
   Ensures native <input type="time"> values always stay
   within calendar business hours.
   This is UI-level enforcement (validation still runs later).
------------------------------------------------------------------ */
  function clampTimeToBusinessHours(time) {
    if (!time) return time;

    // time is a string: "HH:MM"
    if (time < MIN_TIME_STRING) return MIN_TIME_STRING;
    if (time > MAX_TIME_STRING) return MAX_TIME_STRING;

    return time;
  }

  /* ------------------------------------------------------------------
   INCOMING DATETIME PARSER (MYSQL DATETIME SAFE)
   ------------------------------------------------------------------
   Problem:
   • JS `new Date("YYYY-MM-DD HH:MM:SS")` is implementation-dependent.
   • Some browsers treat it as UTC, others as invalid, causing time drift.

   Solution:
   • If we receive a MySQL DATETIME string, parse it manually into a
     LOCAL Date (wall time preserved).
   • If we receive an ISO string, Date can parse it (but beware of trailing Z).
   • If we receive an actual Date, clone it.

   Accepted inputs:
   • Date
   • "YYYY-MM-DD HH:MM"
   • "YYYY-MM-DD HH:MM:SS"
   • ISO-like ("YYYY-MM-DDTHH:MM..."), with or without timezone
  ------------------------------------------------------------------ */
  function parseIncomingDateTime(value) {
    if (!value) return null;

    // Already a Date object → clone to avoid mutation side effects
    if (value instanceof Date) {
      return new Date(value.getTime());
    }

    const str = String(value).trim();

    // ----------------------------------------------------------------
    // MySQL DATETIME: "YYYY-MM-DD HH:MM[:SS]"
    // Parse manually to preserve LOCAL wall time
    // ----------------------------------------------------------------
    const mysqlMatch = str.match(
      /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/
    );

    if (mysqlMatch) {
      const [, y, mo, d, hh, mm, ss] = mysqlMatch;

      return new Date(
        Number(y),
        Number(mo) - 1, // JS months are 0-based
        Number(d),
        Number(hh),
        Number(mm),
        ss ? Number(ss) : 0,
        0
      );
    }

    // ----------------------------------------------------------------
    // Fallback: let the platform parse (ISO, RFC 2822, etc.)
    // IMPORTANT:
    // • ISO strings with trailing "Z" are interpreted as UTC
    // • This is acceptable here because:
    //   - Modal inputs already avoid sending "Z"
    //   - This path is a LAST resort only
    // ----------------------------------------------------------------
    const parsed = new Date(str);

    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed;
  }

  /* ------------------------------------------------------------------
   UI HELPERS — TIME SLOT AVAILABILITY
   ------------------------------------------------------------------
   Purpose:
   • Disable past time slots when selected date is TODAY
   • Applies ONLY in create mode
   • Validation remains authoritative
------------------------------------------------------------------ */
  function isPastTimeSlotToday(time, selectedDate, mode) {
    if (mode !== "create") return false;
    if (!selectedDate) return false;

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    if (selectedDate !== todayStr) return false;

    const nowSlotMinutes = getNowSlotMinutes();

    const [h, m] = time.split(":").map(Number);
    const slotMinutes = h * 60 + m;

    return slotMinutes < nowSlotMinutes;
  }

  /* ------------------------------------------------------------------
     CORE DATE/TIME STATE
     ------------------------------------------------------------------
     Stored as separate date + time strings so inputs remain controlled
  ------------------------------------------------------------------ */
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");

  /* ------------------------------------------------------------------
   FORM STATE — CONTROLLED INPUTS
------------------------------------------------------------------ */
  const [title, setTitle] = useState(activeEvent?.title ?? "");
  const [bookedBy, setBookedBy] = useState(activeEvent?.created_by_name ?? "");
  const [email, setEmail] = useState(activeEvent?.email ?? "");
  // ------------------------------------------------------------------
  // ATTENDEES STATE (CHIPS-BASED INPUT)
  // - attendeesEmails: array of valid emails
  // - attendeeInput: raw user typing buffer
  // ------------------------------------------------------------------
  const [attendeesEmails, setAttendeesEmails] = useState([]);
  const [attendeeInput, setAttendeeInput] = useState("");
  const [description, setDescription] = useState(
    activeEvent?.description ?? ""
  );

  /* ------------------------------------------------------------------
   FIELD REFS — USED TO FORCE USER ATTENTION ON ERRORS
   ------------------------------------------------------------------
   WHY:
   • Allows us to programmatically focus the first invalid field
   • Eliminates user guesswork
------------------------------------------------------------------ */
  const titleRef = useRef(null);
  const bookedByRef = useRef(null);
  const emailRef = useRef(null);
  const startTimeRef = useRef(null);
  const errorBannerRef = useRef(null);

  // ------------------------------------------------------------------
  // DEFENSIVE GUARD — ENSURE ARRAY BEFORE RENDERING
  // Protects against backend or refactor regressions
  // ------------------------------------------------------------------
  const safeAttendees = Array.isArray(attendeesEmails) ? attendeesEmails : [];

  // ------------------------------------------------------------------
  // ADD ATTENDEE EMAIL
  // - Triggered on Enter / Tab / Space
  // - Prevents duplicates
  // - Rejects invalid emails silently
  // ------------------------------------------------------------------
  function addAttendee(email) {
    const clean = email.trim().toLowerCase();

    if (!clean) return;
    if (!isValidEmail(clean)) return;

    setAttendeesEmails((prev) =>
      prev.includes(clean) ? prev : [...prev, clean]
    );

    setAttendeeInput("");
  }

  // ------------------------------------------------------------------
  // EMAIL VALIDATION HELPER
  // Used for live validation + attendee chips
  // ------------------------------------------------------------------
  function isValidEmail(email) {
    return /^\S+@\S+\.\S+$/.test(email);
  }

  /* ------------------------------------------------------------------
   SYNC FORM STATE FROM MODE + ACTIVE EVENT
   ------------------------------------------------------------------
   Rules:
   • CREATE mode → always clear form
   • EDIT mode → populate ONLY from activeEvent
   • Never clear fields just because activeEvent is temporarily null
------------------------------------------------------------------ */
  useEffect(() => {
    // CREATE MODE → clean slate
    if (mode === "create") {
      setTitle("");
      setBookedBy("");
      setEmail("");
      setAttendeesEmails([]); // ✅ array
      setDescription("");
      return;
    }

    // EDIT MODE → require a valid activeEvent
    if (mode === "edit" && activeEvent) {
      setTitle(activeEvent.title ?? "");
      setBookedBy(activeEvent.created_by_name ?? "");
      setEmail(activeEvent.email ?? "");
      // Convert backend comma-separated string → array
      setAttendeesEmails(
        activeEvent.attendees_emails
          ? activeEvent.attendees_emails
              .split(",")
              .map((e) => e.trim())
              .filter(Boolean)
          : []
      );
      setDescription(activeEvent.description ?? "");
    }
  }, [mode, activeEvent]);

  /* ------------------------------------------------------------------
     RECURRENCE (UI ONLY FOR NOW)
     ------------------------------------------------------------------
     Backend + calendar logic intentionally deferred
  ------------------------------------------------------------------ */
  const [isRecurring, setIsRecurring] = useState(false);
  const [repeatType, setRepeatType] = useState("daily");
  const [repeatEndDate, setRepeatEndDate] = useState("");

  /* ------------------------------------------------------------------
     META STATE
  ------------------------------------------------------------------ */
  const [errors, setErrors] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  /* ------------------------------------------------------------------
   SUBMIT ATTEMPT TRACKING
   ------------------------------------------------------------------
   WHY:
   • Prevents showing error banners on modal open
   • Errors become visible ONLY after user clicks Book / Update
------------------------------------------------------------------ */
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  /* ------------------------------------------------------------------
   ERROR ATTENTION — SHAKE STATE
   ------------------------------------------------------------------
   WHY:
   • Motion forces attention
   • Short duration (non-annoying)
------------------------------------------------------------------ */
  const [shake, setShake] = useState(false);

  function triggerErrorShake() {
    setShake(true);
    setTimeout(() => setShake(false), 400);
  }

  /* ------------------------------------------------------------------
   ERROR VISIBILITY ENHANCEMENT — AUTO SCROLL
   ------------------------------------------------------------------
   WHY:
   • Long modals can push the error banner off-screen
   • Users may click "Book" and see nothing change
   • This guarantees the error summary is visible
   • Runs ONLY after a submit attempt
------------------------------------------------------------------ */
  useEffect(() => {
    if (hasAttemptedSubmit && errors.length > 0) {
      errorBannerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [hasAttemptedSubmit, errors]);

  /* =============================================================================
   EDIT MODE HYDRATION — POPULATE FORM FROM CALENDAR EVENT
   =============================================================================
   Purpose:
   • When editing an existing reservation, populate the form fields
     from the selected calendar event.
   • Reads data from `activeEvent.resource` (full DB row).
   • DISPLAY-ONLY for recurrence (editing still blocked elsewhere).

   IMPORTANT:
   • Runs ONLY in edit mode
   • Does NOT touch date/time logic
   • Safe to run alongside modal open/reset logic
============================================================================= */
  // useEffect(() => {
  //   if (mode === "edit" && activeEvent) {
  //     const r = activeEvent.resource || {};

  //     setTitle(r.title || "");
  //     setBookedBy(r.created_by_name || "");
  //     setDescription(r.description || "");

  //     // Display-only (logic is blocked elsewhere)
  //     setIsRecurring(Boolean(r.recurrence_id));
  //   }
  // }, [mode, activeEvent]);

  /* ------------------------------------------------------------------
     USER INTENT LOCK — START TIME (CREATE MODE)
     ------------------------------------------------------------------
     Problem this solves:
     • When the modal opens in CREATE mode we may auto-correct the start
       time (e.g., "today" + past time, clamping to business hours).
     • But if the user manually picks a start time, we must NOT overwrite it
       during later prop-driven re-initialization (modal re-open, parent re-render).

     This flag is UI-only and resets on each modal open.
  ------------------------------------------------------------------ */
  const [hasUserTouchedStartTime, setHasUserTouchedStartTime] = useState(false);

  // Ref version prevents stale closures inside initialization effects.
  // We keep both:
  // • state (for readability / potential UI needs)
  // • ref (for logic that must survive prop-driven re-initialization safely)
  const hasUserTouchedStartTimeRef = useRef(false);

  /* ------------------------------------------------------------------
   UI DERIVED STATE — TODAY HAS DISABLED TIME SLOTS
   ------------------------------------------------------------------
   Purpose:
   • High-level boolean sed ONLY to decide whether a hint
     should be rendered below the Start Time dropdown.

   Conditions:
   • Create mode only
   • Selected start date is TODAY
   • At least one time slot is considered "past" relative
     to the current time (slot-aligned)

   RELATED:
   • This boolean does NOT compute the actual time shown
   • The specific time value is computed separately by
     `nextAvailableStartTimeToday`
   • Both rely on the SAME underlying rule:
     isPastTimeSlotToday()
------------------------------------------------------------------ */
  const hasDisabledTodaySlots = useMemo(() => {
    if (mode !== "create" || !startDate) return false;

    return timeOptions.some((t) => isPastTimeSlotToday(t, startDate, mode));
  }, [mode, startDate, timeOptions]);

  /* ------------------------------------------------------------------
   UI DERIVED STATE — NEXT AVAILABLE START TIME (TODAY ONLY)
   ------------------------------------------------------------------
   Purpose:
   • Computes the earliest START time that is still valid
     for TODAY, aligned to TIME_SLOT_MINUTES.

   Conditions:
   • Create mode only
   • Selected start date is TODAY

   Behavior:
   • Uses a slot-aligned "now" reference (getNowSlotMinutes)
   • Returns the first slot whose minutes are >= nowSlotMinutes
   • Returns a raw "HH:MM" string or null if none available

   RELATED:
   • This value is only meaningful when
     `hasDisabledTodaySlots === true`
   • Separation is intentional:
       - boolean = should we show a hint?
       - value   = what should the hint say?
------------------------------------------------------------------ */
  const nextAvailableStartTimeToday = useMemo(() => {
    if (mode !== "create" || !startDate) return null;

    const nowSlotMinutes = getNowSlotMinutes();

    return (
      timeOptions.find((t) => {
        const [h, m] = t.split(":").map(Number);
        return h * 60 + m >= nowSlotMinutes;
      }) || null
    );
  }, [mode, startDate, timeOptions]);

  /* ------------------------------------------------------------------
   CURRENT TIME — SNAP TO NEXT VALID SLOT
   ------------------------------------------------------------------
   This is the single source of truth for:
   • disabling past slots
   • next-available hint
   • auto-correction
------------------------------------------------------------------ */
  function getNowSlotMinutes() {
    const now = new Date();
    return (
      Math.ceil((now.getHours() * 60 + now.getMinutes()) / TIME_SLOT_MINUTES) *
      TIME_SLOT_MINUTES
    );
  }

  /* ------------------------------------------------------------------
     LOCAL "TODAY" (DATE INPUT SAFE)
     ------------------------------------------------------------------
     Used for:
     • min attribute on <input type="date">
     • Prevents past date selection
     • Timezone-safe (no UTC drift)
  ------------------------------------------------------------------ */
  const todayLocal = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(now.getDate()).padStart(2, "0")}`;
  }, []);

  /* ------------------------------------------------------------------
   AUTO-ADJUST END TIME WHEN START MOVES FORWARD
------------------------------------------------------------------ */
  useEffect(() => {
    if (!startTime || !endTime) return;

    // If end is now invalid, push it forward by one slot
    if (endTime <= startTime) {
      const corrected = snapTimeUpToSlot(startTime, TIME_SLOT_MINUTES);
      setEndTime(corrected);
    }
  }, [startTime]);

  /* ------------------------------------------------------------------
     INITIALIZE FORM ON MODAL OPEN
     ------------------------------------------------------------------
     Runs every time the modal opens

     CRITICAL NOTE (TIME DEFAULTS / "12:30 → 1:00" BUG):
     ------------------------------------------------------------
     React Big Calendar selection snaps to the grid (step=30). That is correct.
     The bug we must avoid is the modal "helpfully" re-snapping start to NOW
     (or clamping) in a way that overwrites the calendar-selected slot.

     Rules we enforce here:
     • If the user selected a slot on the calendar, trust initialStart/initialEnd.
     • Only apply "start cannot be in the past" correction when:
         - create mode AND
         - there is NO initialStart (manual open / fallback) OR
         - initialStart is today but already in the past (rare: user clicked past time)
     • Once the user touches the Start Time dropdown, we never overwrite their choice.
  ------------------------------------------------------------------ */
  useEffect(() => {
    if (!isOpen) return;

    // Reset user-intent lock on each open.
    // IMPORTANT: we reset BOTH state + ref.
    setHasUserTouchedStartTime(false);
    hasUserTouchedStartTimeRef.current = false;

    // For debugging purposes
    console.group("🧪 MODAL INIT TRACE");
    console.log("initialStart prop:", initialStart);
    console.log("initialEnd prop:", initialEnd);

    // Parse incoming datetimes safely (Date | MySQL DATETIME string | ISO).
    let s = parseIncomingDateTime(initialStart) || new Date();
    let e =
      parseIncomingDateTime(initialEnd) || new Date(s.getTime() + 30 * 60000);

    // For debugging purposes
    console.group("🧪 MODAL INIT TRACE");
    console.log("initialStart prop:", initialStart);
    console.log("initialEnd prop:", initialEnd);
    console.log("parsed s (Date):", s);
    console.log("parsed e (Date):", e);
    console.log("FINAL startDate:", toInputDate(s));
    console.log("FINAL startTime:", toInputTime(s));
    console.log("FINAL endTime:", toInputTime(e));
    console.log("FINAL endDate:", toInputDate(e));
    console.groupEnd();

    /* ------------------------------------------------------------
     CREATE-ONLY SAFETY
     ------------------------------------------------------------
     When creating a reservation:
     • Do NOT allow starting in the past
     • If start is today and past, push to the NEXT slot boundary (TIME_SLOT_MINUTES)
     • Avoid overriding a calendar-selected slot unless it is truly invalid
  ------------------------------------------------------------ */
    if (mode === "create" && !hasUserTouchedStartTimeRef.current) {
      const now = new Date();

      // If we weren't provided a start (fallback open), always clamp to now.
      const noInitialStart = !initialStart;

      // If a calendar slot WAS provided but it is already in the past (today),
      // push it forward to the next valid slot. This prevents "select past time"
      // while preserving the user's intent as closely as possible.
      const sameDay = s.toDateString() === now.toDateString();

      if (noInitialStart && s < now) {
        s = now;
      } else if (!noInitialStart && sameDay && s < now) {
        // Slot-aligned "now" (single source of truth used by disabled slots)
        const nowSlotMinutes = getNowSlotMinutes();
        const adjusted = new Date(now);
        adjusted.setHours(0, 0, 0, 0);
        adjusted.setMinutes(nowSlotMinutes);
        s = adjusted;
      }

      // Ensure end is always after start (at least one slot).
      if (e <= s) {
        e = new Date(s.getTime() + TIME_SLOT_MINUTES * 60000);
      }
    }

    // Respect weekend rules (forward-only)
    s = normalizeToNextValidWeekday(s);
    e = normalizeToNextValidWeekday(e);

    setStartDate(toInputDate(s));

    // Start time:
    // • If the user already touched it (rare on open), keep previous.
    // • Otherwise:
    //    - create: clamp to business hours
    //    - edit:   trust exact stored time
    setStartTime((prev) =>
      hasUserTouchedStartTimeRef.current
        ? prev
        : mode === "create"
        ? clampTimeToBusinessHours(toInputTime(s))
        : toInputTime(s)
    );

    setEndDate(toInputDate(e));
    setEndTime(
      mode === "create"
        ? clampTimeToBusinessHours(toInputTime(e))
        : toInputTime(e)
    );

    // Reset fields ONLY for create mode
    if (mode === "create") {
      setTitle("");
      setBookedBy("");
      setEmail("");
      setAttendeesEmails([]); // ✅ array
      setDescription("");

      // Reset recurrence UI
      setIsRecurring(false);
      setRepeatType("daily");
      setRepeatEndDate("");
    }

    setErrors([]);
    setIsSaving(false);
    setHasAttemptedSubmit(false);
  }, [isOpen, initialStart, initialEnd, mode]);

  /* ------------------------------------------------------------------
   EDIT MODE HYDRATION — LOAD EXISTING RESERVATION DATA
   ------------------------------------------------------------------
   Purpose:
   • When opening the modal in EDIT mode, populate the form fields
     with data from the selected calendar event.
   • Ensures the modal reflects the existing reservation state
     instead of showing empty inputs.

   Why this is REQUIRED:
   • The main initialization effect resets all form fields on modal open
     (this is intentional for CREATE mode).
   • Without this effect, EDIT mode would incorrectly clear:
       - Event Title
       - Booked By
       - Description
       - Recurring indicator

   Data source:
   • activeEvent comes from react-big-calendar
   • activeEvent.resource contains the FULL reservation row
     (attached in mapReservationsToEvents)

   IMPORTANT GUARANTEES:
   • Runs ONLY in edit mode
   • Does NOT modify start/end date or time
   • Does NOT enable editing of recurring instances
   • Safe if resource is missing or partial
------------------------------------------------------------------ */
  // useEffect(() => {
  //   // Guard: only hydrate fields when editing an existing event
  //   if (mode !== "edit" || !activeEvent) return;

  //   // Defensive extraction of the reservation row
  //   // (resource is guaranteed by mapReservationsToEvents,
  //   //  but we guard anyway for safety)
  //   const r = activeEvent.resource || {};

  //   // Populate editable form fields
  //   setTitle(r.title || "");
  //   setBookedBy(r.created_by_name || "");
  //   setDescription(r.description || "");

  //   setEmail(r.email || "");
  //   setAttendeesEmails(r.attendees_emails || "");

  //   // Display-only indicator:
  //   // • Used to show whether this reservation belongs to a recurrence series
  //   // • Editing recurring instances is still blocked elsewhere
  //   setIsRecurring(Boolean(r.recurrence_id));
  // }, [mode, activeEvent]);

  /* ------------------------------------------------------------------
     BODY SCROLL LOCK (CRITICAL FOR MODALS)
     ------------------------------------------------------------------
     • Prevents background page scrolling
     • Fixes overlay not covering full viewport
     • Required for mobile Safari / Chrome
  ------------------------------------------------------------------ */
  useEffect(() => {
    if (!isOpen) return;

    // Lock background scroll
    document.body.style.overflow = "hidden";

    // Restore scroll on close/unmount
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  /* ------------------------------------------------------------------
     BUILD DATE OBJECTS (USED FOR VALIDATION & SUBMIT)
  ------------------------------------------------------------------ */
  const start = useMemo(() => {
    if (!startDate || !startTime) return null;
    return combineDateAndTime(startDate, startTime);
  }, [startDate, startTime]);

  const end = useMemo(() => {
    if (!endDate || !endTime) return null;
    return combineDateAndTime(endDate, endTime);
  }, [endDate, endTime]);

  /* ------------------------------------------------------------------
   AUTO-FIX INVALID RANGE
   ------------------------------------------------------------------
   Ensures end is always after start
------------------------------------------------------------------ */
  useEffect(() => {
    if (!start || !end) return;

    if (end <= start) {
      const corrected = new Date(start.getTime() + 30 * 60000);
      setEndDate(toInputDate(corrected));
      setEndTime(toInputTime(corrected));
    }
  }, [start, end]);

  /* ------------------------------------------------------------------
      DATE PICKER GUARD — WEEKENDS (TIMEZONE SAFE)
      ------------------------------------------------------------------
      Native <input type="date"> returns YYYY-MM-DD (no timezone).
      We validate using NOON local time to avoid DST / UTC rollover bugs.
    ------------------------------------------------------------------ */
  function handleDateChange(setter) {
    return (e) => {
      const value = e.target.value;
      if (!value) return;

      // ------------------------------------------------------------
      // TIMEZONE-SAFE DATE CHECK
      // Use 12:00 PM local time to prevent date shifting
      // ------------------------------------------------------------
      const safeDate = new Date(`${value}T12:00:00`);

      // Enforce weekend rules
      if (!IS_WEEKENDS_ENABLED && isWeekend(safeDate)) {
        return; // 👈 silently reject weekend selection
      }

      // Store raw YYYY-MM-DD string (DO NOT store Date object)
      setter(value);
    };
  }

  /* ------------------------------------------------------------------
   TIME PICKER GUARD — INVALID TIMES
  ------------------------------------------------------------------
   Native date inputs cannot disable specific weekdays.
   This guard enforces calendar rules at input-time.
------------------------------------------------------------------ */

  function handleTimeChange(setter) {
    return (e) => {
      const value = e.target.value;
      if (!value) return;

      if (value < MIN_TIME_STRING || value > MAX_TIME_STRING) {
        return; // block invalid time
      }

      setter(value);
    };
  }

  /* ------------------------------------------------------------------
   VALIDATION
   ------------------------------------------------------------------
   Runs whenever relevant inputs change.

   High-level rules:
   ------------------------------------------------------------
   CREATE MODE:
   • Start date cannot be in the past
   • Today is allowed
   • If today → start time must be in the future

   SINGLE (NON-RECURRING):
   • End date must be same or after start date
   • If same day → end time must be after start time

   RECURRING:
   • End date field is hidden
   • "Ends On" date is REQUIRED
   • Recurrence end date must be after start date

   EDIT MODE:
   • Historical dates/times are allowed
------------------------------------------------------------------ */
  useEffect(() => {
    if (!isOpen || !start || !end) return;

    const nextErrors = validateReservationRange({
      start,
      end,
      businessStartHour,
      businessEndHour,
      isRecurring,
      repeatEndDate,
    });

    /* ------------------------------------------------------------
     CREATE MODE — DATE & TIME VALIDATION
     ------------------------------------------------------------
     Rules enforced here:
     • Start DATE cannot be before today
     • Today IS allowed
     • If start date is today → start TIME must be in the future
     • End date/time rules apply only to non-recurring events
  ------------------------------------------------------------ */
    if (mode === "create") {
      const now = new Date();

      // Normalize dates to LOCAL midnight (timezone-safe)
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const startDay = new Date(start);
      startDay.setHours(0, 0, 0, 0);

      /* ❌ Start date before today */
      if (startDay < todayStart) {
        nextErrors.push("Start date cannot be in the past.");
      }

      /* ❌ Start time in the past (today only) */
      if (startDay.getTime() === todayStart.getTime() && start < now) {
        nextErrors.push("Start time cannot be in the past for today.");
      }

      /* --------------------------------------------------------
       SINGLE EVENT RULES (NON-RECURRING ONLY)
    -------------------------------------------------------- */
      if (!isRecurring) {
        const endDay = new Date(end);
        endDay.setHours(0, 0, 0, 0);

        /* ❌ End date before start date */
        if (endDay < startDay) {
          nextErrors.push(
            "End date must be the same day or after the start date."
          );
        }

        /* ❌ Same day → end time before or equal to start time */
        if (endDay.getTime() === startDay.getTime() && end <= start) {
          nextErrors.push("End time must be after the start time.");
        }
      }
    }

    /* --------------------------------------------------------
     RECURRING EVENT RULES (RECURRING ONLY)
     --------------------------------------------------------
     Applies to BOTH create & edit modes
  -------------------------------------------------------- */
    if (isRecurring) {
      if (!repeatEndDate) {
        nextErrors.push("Recurring events must have an end date.");
      } else {
        // Use NOON to avoid DST / timezone rollover
        const repeatEnd = new Date(`${repeatEndDate}T12:00:00`);

        if (repeatEnd < start) {
          nextErrors.push("Recurring end date must be after the start date.");
        }
      }
    }

    /* ------------------------------------------------------------
     REQUIRED FIELDS (ALL MODES)
  ------------------------------------------------------------ */
    if (!title.trim()) {
      nextErrors.push("Event title is required.");
    }

    if (!bookedBy.trim()) {
      nextErrors.push("Booked by is required.");
    }

    if (!email.trim()) {
      nextErrors.push("Email is required.");
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      nextErrors.push("Email must be valid.");
    }

    setErrors(nextErrors);
  }, [
    isOpen,
    start,
    end,
    title,
    bookedBy,
    email,
    attendeesEmails,
    businessStartHour,
    businessEndHour,
    isRecurring,
    repeatEndDate,
    mode,
  ]);

  /* ------------------------------------------------------------------
   FOCUS FIRST INVALID FIELD
   ------------------------------------------------------------------
   WHY:
   • Users do not read error lists
   • Cursor placement forces correction
   • Order matters (most critical first)
------------------------------------------------------------------ */
  function focusFirstError() {
    if (errors.includes("Start time cannot be in the past for today.")) {
      startTimeRef.current?.focus();
      return;
    }

    if (errors.includes("Event title is required.")) {
      titleRef.current?.focus();
      return;
    }

    if (errors.includes("Booked by is required.")) {
      bookedByRef.current?.focus();
      return;
    }

    if (
      errors.includes("Email is required.") ||
      errors.includes("Email must be valid.")
    ) {
      emailRef.current?.focus();
      return;
    }
  }

  /* ------------------------------------------------------------------
   SUBMIT HANDLER
   ------------------------------------------------------------------
   Responsibilities:
   • Prevent submit when invalid
   • Build recurrence payload (if enabled)
   • Normalize dates to MySQL DATETIME-safe strings (no ISO Z)
   • Emit RESERVATION-ONLY payload
   • Parent component injects site_id / room_id
------------------------------------------------------------------ */
  async function handleSubmit(e) {
    e.preventDefault();

    // Absolute safety guard
    // ------------------------------------------------------------------
    // HARD BLOCK SUBMIT — FORCE USER ATTENTION
    // ------------------------------------------------------------------
    // Mark that the user tried to submit
    setHasAttemptedSubmit(true);

    // HARD BLOCK SUBMIT — FORCE USER ATTENTION
    if (!start || !end || errors.length > 0) {
      triggerErrorShake(); // visual motion
      focusFirstError(); // cursor jumps to problem
      return;
    }

    try {
      setIsSaving(true);

      // ------------------------------------------------------------
      // BUILD RECURRENCE PAYLOAD (FRONTEND AUTHORITY)
      // ------------------------------------------------------------
      let recurrencePayload = null;

      if (isRecurring) {
        if (!repeatEndDate) {
          setErrors(["Recurring end date is required."]);
          return;
        }

        // bi-weekly = weekly + interval 2
        const isBiWeekly = repeatType === "bi-weekly";

        recurrencePayload = {
          frequency: isBiWeekly ? "weekly" : repeatType, // daily | weekly | monthly
          interval: isBiWeekly ? 2 : 1,
          until: repeatEndDate, // YYYY-MM-DD
          excludeDates: [], // future feature
        };
      }

      // ------------------------------------------------------------
      // FINAL PAYLOAD BEING SENT TO BACKEND MySQL
      // (NO IDs — parent component injects site_id / room_id)
      // ------------------------------------------------------------
      const payload = {
        title,
        description,
        created_by_name: bookedBy,

        email,

        // ------------------------------------------------------------------
        // ATTENDEES EMAILS (EXTRA HARDENING)
        // ------------------------------------------------------------------
        // Backend expects a comma-separated STRING.
        // Even though the UI enforces an array of valid emails,
        // this guard ensures:
        // • No crashes if state is ever corrupted
        // • Backend always receives a predictable value
        // • Safe for future refactors or partial modal resets
        // ------------------------------------------------------------------
        attendees_emails: Array.isArray(attendeesEmails)
          ? attendeesEmails.join(", ")
          : "",

        // ------------------------------------------------------------------
        // DATE / TIME (MySQL DATETIME — WALL TIME, NO TIMEZONE)
        // ------------------------------------------------------------------
        // IMPORTANT:
        // MySQL DATETIME does NOT store timezone.
        // We MUST send "YYYY-MM-DD HH:MM:SS" WITHOUT trailing "Z"
        // to prevent EST/EDT drift.
        // ------------------------------------------------------------------
        start_time: toMySQLDateTime(start), // ✅ MySQL-safe
        end_time: toMySQLDateTime(end), // ✅ MySQL-safe

        // ------------------------------------------------------------------
        // RECURRENCE (object or null)
        // Backend expands recurring events if provided
        // ------------------------------------------------------------------
        recurrence: recurrencePayload,
      };

      // Submit to parent (RoomCalendar handles API + IDs)
      await onSubmit(payload);

      // Close modal on success
      onClose();
    } finally {
      setIsSaving(false);
    }
  }

  /* ------------------------------------------------------------------
     ESC KEY SUPPORT
  ------------------------------------------------------------------ */
  useEffect(() => {
    if (!isOpen) return;

    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  /* ------------------------------------------------------------------
     RENDER
  ------------------------------------------------------------------ */
  return (
    <div className="rr-modal-overlay" role="presentation">
      <div
        className={`rr-modal ${shake ? "shake" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={mode === "edit" ? "Edit reservation" : "Create reservation"}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="rr-modal-header">
          <h2>
            {mode === "edit" ? "Edit" : "Book"} {roomName}
          </h2>

          <button
            className="rr-modal-close"
            onClick={onClose}
            type="button"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* BODY */}
        <form onSubmit={handleSubmit} className="rr-modal-body">
          {/* ------------------------------------------------------------
              CRITICAL ERROR SUMMARY (SHOWN ONLY AFTER SUBMIT ATTEMPT)
              ------------------------------------------------------------
              WHY:
              • Prevents yelling at user on modal open
              • Forces attention ONLY when they try to proceed
          ------------------------------------------------------------ */}
          {hasAttemptedSubmit && errors.length > 0 && (
            <div
              ref={errorBannerRef} // 🔑 used by auto-scroll effect after submit
              className="rr-errors rr-errors-critical"
              role="alert"
            >
              <strong>⚠ Please fix the following before continuing:</strong>
              <ul>
                {errors.map((msg) => (
                  <li key={msg}>{msg}</li>
                ))}
              </ul>
            </div>
          )}

          {/* EVENT TITLE */}
          <div className="rr-field">
            <label>Event Title *</label>

            <input
              ref={titleRef} // 🔑 used to auto-focus when validation fails
              className={
                errors.includes("Event title is required.")
                  ? "rr-input-error"
                  : ""
              }
              type="text"
              placeholder="e.g., Team Meeting"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* START DATE + START TIME */}
          <div className="rr-field-row">
            {/* ------------------------------------------------------------
                START DATE (NO CHANGE)
                ------------------------------------------------------------
                • Native date input
                • Browser controls format
                • No 12h/24h concept here
              ------------------------------------------------------------ */}
            <div className="rr-field">
              <label>Start Date *</label>
              <input
                type="date"
                value={startDate}
                // ------------------------------------------------------------
                // CREATE MODE:
                // - Block past dates
                // - Allow today
                // EDIT MODE:
                // - Allow historical edits
                // ------------------------------------------------------------
                min={mode === "create" ? getTodayInputDate() : undefined}
                onChange={(e) => {
                  const value = e.target.value;
                  if (!value) return;

                  // ------------------------------------------------------------
                  // WEEKEND GUARD (timezone-safe)
                  // Use NOON to avoid date rollover
                  // ------------------------------------------------------------
                  if (!IS_WEEKENDS_ENABLED) {
                    const day = new Date(value + "T12:00:00").getDay();
                    if (day === 0 || day === 6) return;
                  }

                  setStartDate(value);
                }}
                required
              />
            </div>

            {/* ------------------------------------------------------------
                START TIME — SLOT DROPDOWN (12-HOUR DISPLAY)
                ------------------------------------------------------------
                • Values remain "HH:MM" (24h) — authoritative
                • Labels rendered in 12-hour format (UI only)
                • Past slots DISABLED for TODAY (create mode only)
                • NO snapping on change (dropdown already aligned)
                • Prevents browser auto-selection & time drift
            ------------------------------------------------------------ */}
            <div className="rr-field">
              <label>Start Time *</label>

              <select
                ref={startTimeRef} // 🔑 allows auto-focus when validation fails
                className={
                  errors.includes("Start time cannot be in the past for today.")
                    ? "rr-input-error"
                    : ""
                }
                value={startTime}
                onChange={(e) => {
                  setHasUserTouchedStartTime(true);
                  hasUserTouchedStartTimeRef.current = true;
                  setStartTime(e.target.value);
                }}
                required
              >
                {timeOptions.map((t) => {
                  // ------------------------------------------------------------
                  // Disable (DO NOT REMOVE) past time slots when:
                  // • Create mode
                  // • Selected date is TODAY
                  //
                  // Why disable instead of filter?
                  // • Filtering forces browser to auto-select
                  //   the first remaining option (time drift bug)
                  // • Disabled options preserve user intent
                  // ------------------------------------------------------------
                  const isDisabled = isPastTimeSlotToday(t, startDate, mode);

                  return (
                    <option key={t} value={t} disabled={isDisabled}>
                      {/* UI ONLY — convert to 12-hour display */}
                      {formatTime12h(t)}
                    </option>
                  );
                })}
              </select>

              {/* ------------------------------------------------------------
                  HINT — TODAY ONLY (CREATE MODE)
                  ------------------------------------------------------------
                  • Purely informational
                  • Does NOT mutate state
                  • Shows the next available valid slot for today
                ------------------------------------------------------------ */}
              {mode === "create" && hasDisabledTodaySlots && (
                <span className="rr-hint">
                  {nextAvailableStartTimeToday
                    ? `Next available time: ${formatTime12h(
                        nextAvailableStartTimeToday
                      )}`
                    : "No times available today"}
                </span>
              )}
            </div>
          </div>

          {/* ------------------------------------------------------------------
              END DATE / TIME — LAYOUT MATCHES START DATE / TIME
              ------------------------------------------------------------------
              UX Rules:
              • Non-recurring events:
                  - End Date + End Time shown side-by-side
              • Recurring events:
                  - End Date hidden
                  - End Time shown full-width (defines duration)
            ------------------------------------------------------------------ */}

          <div className="rr-field-row">
            {/* ------------------------------------------------------------
                END DATE — ONLY FOR NON-RECURRING EVENTS
                ------------------------------------------------------------
                • Native date input (no 12h/24h concept)
                • Browser controls formatting
              ------------------------------------------------------------ */}
            {!isRecurring && (
              <div className="rr-field">
                <label>End Date *</label>
                <input
                  type="date"
                  value={endDate}
                  /* ------------------------------------------------------------
                      CREATE MODE:
                      • End date cannot be before start date
                      • Past dates are greyed out automatically
                      EDIT MODE:
                      • Historical dates allowed
                    ------------------------------------------------------------ */
                  min={
                    mode === "create"
                      ? startDate || getTodayInputDate()
                      : undefined
                  }
                  title={
                    !IS_WEEKENDS_ENABLED
                      ? "Weekends are disabled. End date will auto-adjust."
                      : ""
                  }
                  onChange={(e) => {
                    const value = e.target.value;
                    if (!value) return;

                    /* ------------------------------------------------------------
                        TIMEZONE-SAFE DATE PARSING
                        Use NOON to avoid:
                        • UTC rollover
                        • DST shifts
                        • Off-by-one-day bugs
                      ------------------------------------------------------------ */
                    const raw = new Date(`${value}T12:00:00`);
                    const normalized = normalizeToNextValidWeekday(raw);

                    // Store YYYY-MM-DD only (never Date objects)
                    setEndDate(toInputDate(normalized));
                  }}
                  required
                />
              </div>
            )}

            {/* ------------------------------------------------------------
                  END TIME — SLOT DROPDOWN (12-HOUR DISPLAY)
                  ------------------------------------------------------------
                  Rules:
                  • Always required
                  • Snaps UP to next slot
                  • Must be AFTER start time (single events)
                  • Recurring events have no restriction here

                  IMPORTANT:
                  • Values remain "HH:MM" (24h)
                  • Labels are formatted to 12-hour for UI consistency
                  • Validation remains authoritative
                ------------------------------------------------------------ */}
            <div
              className="rr-field"
              style={isRecurring ? { width: "100%" } : undefined}
            >
              <label>End Time *</label>

              <select
                value={endTime}
                onChange={(e) => {
                  // ------------------------------------------------------------
                  // END TIME ALWAYS SNAPS UPWARD
                  // Guarantees:
                  // • end ≥ start + TIME_SLOT_MINUTES
                  // • alignment with calendar grid
                  // ------------------------------------------------------------
                  const snapped = snapTimeUpToSlot(
                    e.target.value,
                    TIME_SLOT_MINUTES
                  );
                  setEndTime(snapped);
                }}
                required
              >
                {timeOptions.map((t) => {
                  /* ------------------------------------------------------------
                      DISABLE INVALID END TIMES (UI-LEVEL ONLY)
                      ------------------------------------------------------------
                      • Applies only to non-recurring events
                      • End time must be strictly AFTER start time
                      • We SHOW disabled options instead of hiding them
                      • Validation still enforces correctness
                    ------------------------------------------------------------ */
                  const isBeforeOrEqualStart =
                    !isRecurring && startTime && t <= startTime;

                  return (
                    <option
                      key={t}
                      value={t}
                      disabled={isBeforeOrEqualStart}
                      title={
                        isBeforeOrEqualStart
                          ? "End time must be after the start time"
                          : undefined
                      }
                    >
                      {/* UI ONLY — convert to 12-hour display */}
                      {formatTime12h(t)}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* RECURRENCE (UI ONLY) */}
          <div className="rr-recurring">
            <label className="rr-recurring-toggle">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
              />
              Recurring Event
            </label>

            {isRecurring && (
              <div className="rr-recurring-panel">
                <div className="rr-recurring-types">
                  {["daily", "weekly", "bi-weekly", "monthly"].map((t) => (
                    <label key={t}>
                      <input
                        type="radio"
                        name="repeatType"
                        checked={repeatType === t}
                        onChange={() => setRepeatType(t)}
                      />
                      {t.replace("-", " ")}
                    </label>
                  ))}
                </div>

                <div className="rr-field">
                  <label>Ends On *</label>
                  <input
                    type="date"
                    value={repeatEndDate}
                    onChange={(e) => setRepeatEndDate(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* BOOKED BY */}
          <div className="rr-field">
            <label>Booked By *</label>
            <input
              ref={bookedByRef}
              className={
                errors.includes("Booked by is required.")
                  ? "rr-input-error"
                  : ""
              }
              type="text"
              value={bookedBy}
              placeholder="Enter your name"
              onChange={(e) => setBookedBy(e.target.value)}
              required
            />
          </div>

          {/* EMAIL (REQUIRED) */}
          <div className="rr-field">
            <label>Email *</label>
            <input
              ref={emailRef}
              className={
                errors.includes("Email is required.") ||
                errors.includes("Email must be valid.")
                  ? "rr-input-error"
                  : ""
              }
              type="email"
              value={email}
              placeholder="Enter your email"
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            {/* LIVE EMAIL VALIDATION */}
            {email && !isValidEmail(email) && (
              <small className="rr-error">
                Please enter a valid email address
              </small>
            )}
          </div>

          {/* ATTENDEES — CHIP INPUT (NO COMMAS REQUIRED) */}
          <div className="rr-field">
            <label>Attendees</label>

            <div className="rr-chips-input">
              {safeAttendees.map((email) => (
                <span key={email} className="rr-chip">
                  {email}
                  <button
                    type="button"
                    aria-label="Remove attendee"
                    onClick={() =>
                      setAttendeesEmails((prev) =>
                        Array.isArray(prev)
                          ? prev.filter((e) => e !== email)
                          : []
                      )
                    }
                  >
                    ×
                  </button>
                </span>
              ))}

              <input
                type="email"
                placeholder="Type email and press Enter (optional)"
                value={attendeeInput}
                onChange={(e) => setAttendeeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (["Enter", "Tab", " "].includes(e.key)) {
                    e.preventDefault();
                    addAttendee(attendeeInput);
                  }
                }}
              />
            </div>

            <small className="rr-hint">
              Press Enter or Tab to add each email
            </small>
          </div>

          {/* DESCRIPTION */}
          <div className="rr-field">
            <label>Description</label>
            <textarea
              placeholder="Optional description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* ERRORS */}
          {/* {errors.length > 0 && (
            <div className="rr-errors" role="alert">
              <ul>
                {errors.map((msg) => (
                  <li key={msg}>{msg}</li>
                ))}
              </ul>
            </div>
          )} */}

          {/* FOOTER */}
          <div className="rr-modal-footer">
            {/* ------------------------------------------------------------------
                PRIMARY ACTION — CONTEXTUAL FEEDBACK
                ------------------------------------------------------------------
                  WHY:
                  • Users ignore disabled buttons
                  • Tooltip explains WHY action is blocked
                  • Works with shake + focus behavior
                ------------------------------------------------------------------ */}
            <button
              type="button"
              className="rr-btn rr-btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="rr-btn rr-btn-primary"
              disabled={isSaving} // ✅ allow click even when errors exist
              title={
                errors.length
                  ? "Please fix the highlighted fields above before continuing"
                  : ""
              }
            >
              {isSaving
                ? "Saving..."
                : mode === "edit"
                ? "Update"
                : "Book Room"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
