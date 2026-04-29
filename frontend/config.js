// config.js
const CONFIG = {
  API_BASE: window.location.hostname === "localhost"
    ? "http://localhost:10000"
    : "https://instaguard-backend-2ldg.onrender.com",
  PAGE_SIZE: 10,
};