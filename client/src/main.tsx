import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Redirect www. to canonical domain (SSL cert only covers non-www)
if (window.location.hostname.startsWith('www.')) {
  const canonical = window.location.href.replace(
    `://${window.location.hostname}`,
    `://${window.location.hostname.replace(/^www\./, '')}`
  );
  window.location.replace(canonical);
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Failed to find the root element. Make sure there is a <div id='root'></div> in your HTML.");
}

try {
  createRoot(rootElement).render(<App />);
} catch (error) {
  console.error("Failed to render app:", error);
  rootElement.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; flex-direction: column; font-family: system-ui, -apple-system, sans-serif; padding: 20px;">
      <h1 style="color: #dc2626; margin-bottom: 16px;">Application Error</h1>
      <p style="color: #6b7280; margin-bottom: 24px;">Failed to initialize the application.</p>
      <pre style="background: #f3f4f6; padding: 16px; border-radius: 8px; overflow: auto; max-width: 600px; font-size: 12px;">${error instanceof Error ? error.message : String(error)}</pre>
      <button onclick="window.location.reload()" style="margin-top: 24px; padding: 12px 24px; background: #008060; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">Reload Page</button>
    </div>
  `;
}
