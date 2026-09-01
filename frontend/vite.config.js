import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Proxy /deals y /health al backend de FastAPI en desarrollo.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/deals": "http://localhost:8000",
      "/health": "http://localhost:8000",
    },
  },
});
