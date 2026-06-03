import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/globals.css";

// Global unhandled promise rejection handler.
// Shows a dismissible toast-style banner instead of silently failing.
window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  const message =
    reason instanceof Error
      ? reason.message
      : typeof reason === "string"
      ? reason
      : "An unexpected error occurred.";

  // eslint-disable-next-line no-console
  console.error("[Voxlen] Unhandled promise rejection:", reason);

  const id = "voxlen-unhandled-toast";
  // Deduplicate: don't stack identical banners.
  if (document.getElementById(id)) return;

  const el = document.createElement("div");
  el.id = id;
  el.setAttribute(
    "style",
    [
      "position:fixed",
      "bottom:20px",
      "left:50%",
      "transform:translateX(-50%)",
      "z-index:9999",
      "background:#1e1e2e",
      "color:#e8e8f0",
      "border:1px solid rgba(255,255,255,0.12)",
      "border-radius:10px",
      "padding:10px 16px",
      "font-size:13px",
      "max-width:420px",
      "display:flex",
      "align-items:center",
      "gap:10px",
      "box-shadow:0 4px 20px rgba(0,0,0,0.4)",
    ].join(";")
  );

  const text = document.createElement("span");
  text.style.flex = "1";
  text.textContent = `Error: ${message.slice(0, 200)}`;

  const close = document.createElement("button");
  close.textContent = "×";
  close.setAttribute(
    "style",
    "background:none;border:none;color:#888;font-size:18px;cursor:pointer;padding:0 2px;line-height:1"
  );
  close.onclick = () => el.remove();

  el.appendChild(text);
  el.appendChild(close);
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 7000);
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
