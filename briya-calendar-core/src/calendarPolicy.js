// calendarPolicy.js
// ------------------------------------------------------------
// CANONICAL CALENDAR POLICY (ENGINE LEVEL)
// ------------------------------------------------------------

export function getDefaultCalendarPolicy() {
  return {
    features: {
      recurrence: true,
      pinRequired: true,
      dragAndDrop: true,
    },

    time: {
      slotMinutes: 15,
      businessHours: {
        start: "08:00",
        end: "22:00",
      },
    },

    rules: {
      disableWeekends: true,
      allowMultiDay: true,
      allowPastDates: false,
    },

    ui: {
      defaultView: "week",
      scrollToTime: "08:00",
      showAllDayRow: false,
    },
  };
}
