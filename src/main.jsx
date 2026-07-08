import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";

import App from "./App.jsx";

const Admin = lazy(() => import("./Admin.jsx"));

const path = window.location.pathname;

ReactDOM.createRoot(
  document.getElementById("root")
).render(
  <React.StrictMode>

    {path === "/admin"
      ? (
        <Suspense fallback={<div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#F6F5F2", color: "#6B675F", fontFamily: "system-ui, sans-serif" }}>Загрузка кабинета...</div>}>
          <Admin />
        </Suspense>
      )
      : <App />}

  </React.StrictMode>
);
