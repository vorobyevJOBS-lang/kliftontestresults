import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";

const PublicLanding = lazy(() => import("./PublicLanding.jsx"));
const HiringPlatform = lazy(() => import("./HiringPlatform.jsx"));
const CandidatePortal = lazy(() => import("./CandidatePortal.jsx"));
const PrivacyPage = lazy(() => import("./PrivacyPage.jsx"));

const path = window.location.pathname;
ReactDOM.createRoot(
  document.getElementById("root")
).render(
  <React.StrictMode>

    <Suspense fallback={<div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#F6F5F2", color: "#6B675F", fontFamily: "system-ui, sans-serif" }}>Загрузка...</div>}>
      {path === "/admin" || path === "/hr"
          ? <HiringPlatform />
          : path === "/candidate"
            ? <CandidatePortal />
            : path === "/privacy"
              ? <PrivacyPage />
              : <PublicLanding />}
    </Suspense>

  </React.StrictMode>
);
