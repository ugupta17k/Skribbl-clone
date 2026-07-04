const isLocalhost =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

export const API_BASE_URL = isLocalhost
  ? "http://localhost:8080"
  : window.location.origin;

export const WS_BASE_URL = API_BASE_URL.replace(/^http/, "ws");
