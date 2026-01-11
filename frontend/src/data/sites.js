/* ============================================================================
   ROOM RESERVATIONS SYSTEM — SITES + ROOMS DATASET
   ----------------------------------------------------------------------------
   OPTION A IMPLEMENTATION:
   - Uses *only* static paths with `new URL(..., import.meta.url).href`
   - Zero imports, zero globbing, zero dynamic logic
   - Vite resolves and bundles all images automatically
   - Easiest to maintain and guarantees 100% image loading
============================================================================ */

/* ============================================================================
   SITE + ROOM DATASET (ONE SINGLE EXPORT — NO DUPLICATES)
============================================================================ */

export const sites = [
  /* ------------------------------------------------------------------------
     1) FORT TOTTEN
     Room images folder:
     src/assets/images/rooms/fort-totten/
  ------------------------------------------------------------------------ */
  {
    id: 1,
    slug: "fort-totten",
    name: "Fort Totten",
    image: new URL("../assets/images/sites/fort-totten.jpg", import.meta.url)
      .href,

    rooms: [
      {
        id: 101,
        name: "Academic NEST (1)",
        image: new URL(
          "../assets/images/rooms/fort-totten/Academic NEST (1).jpg",
          import.meta.url
        ).href,
      },
      {
        id: 102,
        name: "Staff Kitchen NEST (1)",
        image: new URL(
          "../assets/images/rooms/fort-totten/Staff Kitchen NEST (1).jpg",
          import.meta.url
        ).href,
      },
      {
        id: 103,
        name: "Mama Nook 136 Blue (1)",
        image: new URL(
          "../assets/images/rooms/fort-totten/Mama Nook 136 Blue (1).jpg",
          import.meta.url
        ).href,
      },
      {
        id: 104,
        name: "Adika Nook 156 Yellow (4)",
        image: new URL(
          "../assets/images/rooms/fort-totten/Adika Nook 156 Yellow (4).jpg",
          import.meta.url
        ).href,
      },
      {
        id: 105,
        name: "Stella Nook 162 Yellow (4)",
        image: new URL(
          "../assets/images/rooms/fort-totten/Stella Nook 162 Yellow (4).jpg",
          import.meta.url
        ).href,
      },
      {
        id: 106,
        name: "Kondi Nook 163 Yellow (4)",
        image: new URL(
          "../assets/images/rooms/fort-totten/Kondi Nook 163 Yellow (4).jpg",
          import.meta.url
        ).href,
      },
      {
        id: 107,
        name: "Milo Nook 155 Yellow (4)",
        image: new URL(
          "../assets/images/rooms/fort-totten/Milo Nook 155 Yellow (4).jpg",
          import.meta.url
        ).href,
      },
      {
        id: 108,
        name: "Garden Room 144 Blue (6)",
        image: new URL(
          "../assets/images/rooms/fort-totten/Garden Room 144 Blue (6).jpg",
          import.meta.url
        ).href,
      },
      {
        id: 109,
        name: "Classroom 141 Blue (25)",
        image: new URL(
          "../assets/images/rooms/fort-totten/Classroom 141 Blue (25).jpg",
          import.meta.url
        ).href,
      },
      {
        id: 110,
        name: "Classroom 143 Blue (25)",
        image: new URL(
          "../assets/images/rooms/fort-totten/Classroom 143 Blue (25).jpg",
          import.meta.url
        ).href,
      },
      {
        id: 111,
        name: "Classroom 139 Blue (25)",
        image: new URL(
          "../assets/images/rooms/fort-totten/Classroom 139 Blue (25).jpg",
          import.meta.url
        ).href,
      },

      /* IMPORTANT:
         Filename contains *two spaces* after "CASAS"
         Must match EXACT file name exactly!
      */
      {
        id: 112,
        name: "CASAS Conference Room 134 Blue",
        image: new URL(
          "../assets/images/rooms/fort-totten/CASAS  Conference Room 134 Blue.jpg",
          import.meta.url
        ).href,
      },

      {
        id: 113,
        name: "Classroom 153 Yellow (25)",
        image: new URL(
          "../assets/images/rooms/fort-totten/Classroom 153 Yellow (25).jpg",
          import.meta.url
        ).href,
      },
      {
        id: 114,
        name: "Classroom 159 Yellow (21)",
        image: new URL(
          "../assets/images/rooms/fort-totten/Classroom 159 Yellow (21).jpg",
          import.meta.url
        ).href,
      },
      {
        id: 115,
        name: "Lobby Room 146 (4)",
        image: new URL(
          "../assets/images/rooms/fort-totten/Lobby Room 146 (4).jpg",
          import.meta.url
        ).href,
      },
      {
        id: 116,
        name: "Registration Room 131B Lobby (5)",
        image: new URL(
          "../assets/images/rooms/fort-totten/Registration Room 131B Lobby (5).jpg",
          import.meta.url
        ).href,
      },
    ],
  },

  /* ------------------------------------------------------------------------
     2) GEORGIA
     Folder: src/assets/images/rooms/georgia/
  ------------------------------------------------------------------------ */
  {
    id: 2,
    slug: "georgia",
    name: "Georgia",
    image: new URL("../assets/images/sites/georgia.jpg", import.meta.url).href,

    rooms: [
      {
        id: 201,
        name: "GA Classroom 79",
        image: new URL(
          "../assets/images/rooms/georgia/GA Classroom 79.jpeg",
          import.meta.url
        ).href,
      },
      {
        id: 202,
        name: "GA Classroom 85",
        image: new URL(
          "../assets/images/rooms/georgia/GA Classroom 85.jpeg",
          import.meta.url
        ).href,
      },
      {
        id: 203,
        name: "GA Lg Counseling Rm",
        image: new URL(
          "../assets/images/rooms/georgia/GA Lg Counseling Rm.jpeg",
          import.meta.url
        ).href,
      },
      {
        id: 204,
        name: "GA Sm Counseling Rm",
        image: new URL(
          "../assets/images/rooms/georgia/GA Sm Counseling Rm.jpeg",
          import.meta.url
        ).href,
      },
    ],
  },

  /* ------------------------------------------------------------------------
     3) GEORGIA ANNEX
     Folder: src/assets/images/rooms/georgia-annex/
  ------------------------------------------------------------------------ */
  {
    id: 3,
    slug: "georgia-annex",
    name: "Georgia Annex",
    image: new URL("../assets/images/sites/georgia-annex.jpg", import.meta.url)
      .href,

    rooms: [
      {
        id: 301,
        name: "1st Floor (1–20)",
        image: new URL(
          "../assets/images/rooms/georgia-annex/1st Floor (1–20).png",
          import.meta.url
        ).href,
      },
      {
        id: 302,
        name: "2nd Floor Office (4)",
        image: new URL(
          "../assets/images/rooms/georgia-annex/2nd Floor Office (4).jpeg",
          import.meta.url
        ).href,
      },
      {
        id: 303,
        name: "Basement (1)",
        image: new URL(
          "../assets/images/rooms/georgia-annex/Basement (1).png",
          import.meta.url
        ).href,
      },
    ],
  },

  /* ------------------------------------------------------------------------
     4) ONTARIO
     Folder: src/assets/images/rooms/ontario/
  ------------------------------------------------------------------------ */
  {
    id: 4,
    slug: "ontario",
    name: "Ontario",
    image: new URL("../assets/images/sites/ontario.jpg", import.meta.url).href,

    rooms: [
      {
        id: 501,
        name: "Bletzinger Classroom (25)",
        image: new URL(
          "../assets/images/rooms/ontario/Bletzinger Classroom (25).jpeg",
          import.meta.url
        ).href,
      },
      {
        id: 502,
        name: "Green Classroom",
        image: new URL(
          "../assets/images/rooms/ontario/Green Classroom.jpeg",
          import.meta.url
        ).href,
      },
      {
        id: 503,
        name: "IT-Testing Room",
        image: new URL(
          "../assets/images/rooms/ontario/IT-Testing Room.jpeg",
          import.meta.url
        ).href,
      },
      {
        id: 504,
        name: "Zoom Conf 2nd Floor",
        image: new URL(
          "../assets/images/rooms/ontario/Zoom Conf 2nd Floor.jpeg",
          import.meta.url
        ).href,
      },
      {
        id: 505,
        name: "Zoom Spot (1) Inside Testing Room",
        image: new URL(
          "../assets/images/rooms/ontario/Zoom Spot (1) Inside Testing Room.jpeg",
          import.meta.url
        ).href,
      },
    ],
  },

  /* ------------------------------------------------------------------------
     5) SHEPHERD
     Folder: src/assets/images/rooms/shepherd/
  ------------------------------------------------------------------------ */
  {
    id: 5,
    slug: "shepherd",
    name: "Shepherd",
    image: new URL("../assets/images/sites/shepherd.jpg", import.meta.url).href,

    rooms: [
      {
        id: 601,
        name: "218A VI Teaching (1)",
        image: new URL(
          "../assets/images/rooms/shepherd/218A VI Teaching (1).jpeg",
          import.meta.url
        ).href,
      },
      {
        id: 602,
        name: "AE Classrm 207 (30)",
        image: new URL(
          "../assets/images/rooms/shepherd/AE Classrm 207 (30).jpeg",
          import.meta.url
        ).href,
      },
      {
        id: 603,
        name: "AE Classrm 211 (30)",
        image: new URL(
          "../assets/images/rooms/shepherd/AE Classrm 211 (30).jpeg",
          import.meta.url
        ).href,
      },
      {
        id: 604,
        name: "AE Classrm 218 (30)",
        image: new URL(
          "../assets/images/rooms/shepherd/AE Classrm 218 (30).jpeg",
          import.meta.url
        ).href,
      },
      {
        id: 605,
        name: "NEDP-CARES Rm 219 (4)",
        image: new URL(
          "../assets/images/rooms/shepherd/NEDP-CARES Rm 219 (4).jpeg",
          import.meta.url
        ).href,
      },
      {
        id: 606,
        name: "West Conf Rm 224 (6)",
        image: new URL(
          "../assets/images/rooms/shepherd/West Conf Rm 224 (6).jpeg",
          import.meta.url
        ).href,
      },
      {
        id: 607,
        name: "East Conf Rm 226 (8)",
        image: new URL(
          "../assets/images/rooms/shepherd/East Conf Rm 226 (8).jpeg",
          import.meta.url
        ).href,
      },
      {
        id: 608,
        name: "Zoom Rm 1 242 (1)",
        image: new URL(
          "../assets/images/rooms/shepherd/Zoom Rm 1 242 (1).jpeg",
          import.meta.url
        ).href,
      },
      {
        id: 609,
        name: "Zoom Rm 2 243 (1)",
        image: new URL(
          "../assets/images/rooms/shepherd/Zoom Rm 2 243 (1).jpeg",
          import.meta.url
        ).href,
      },
      {
        id: 610,
        name: "CASAS Rm 209 (6)",
        image: new URL(
          "../assets/images/rooms/shepherd/CASAS Rm 209 (6).jpeg",
          import.meta.url
        ).href,
      },
    ],
  },
];
