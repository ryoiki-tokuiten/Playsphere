import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import App from "./App";
import "./index.css";

const rootElement = document.getElementById("root");
console.log("Root element:", rootElement);

if (!rootElement) {
  throw new Error("Failed to find the root element");
}

const root = createRoot(rootElement);

// Add error boundary
window.onerror = function(message, source, lineno, colno, error) {
  console.error("Global error:", { message, source, lineno, colno, error });
  return false;
};

try {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
  console.log("App rendered successfully");
} catch (error) {
  console.error("Error rendering app:", error);
}
