import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";

/* ✅ GLOBAL CSS */
import "./css/index.css"; // resets & base styles
import "./css/layout.css"; // header/body/footer layout
import "./css/cards.css"; // floating cards system
import "./css/header.css"; // header styles
import "./css/footer.css"; // footer styles
import "react-big-calendar/lib/css/react-big-calendar.css"; //Big Calendar styles

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
