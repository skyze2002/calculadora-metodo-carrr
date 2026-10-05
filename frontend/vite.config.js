import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { createDevApiProxy } from "./devProxy.js";

// En desarrollo usa Render si hay configuración de producción disponible.
// Las credenciales se cargan sólo para el proxy, no se inyectan en el navegador.
export default defineConfig(() => {
  const production = loadEnv("production", process.cwd(), ["VITE_API_URL", "VITE_APP_KEY"]);
  const proxy = createDevApiProxy({
    override: process.env.DEV_API_PROXY_URL,
    productionUrl: production.VITE_API_URL,
    appKey: production.VITE_APP_KEY,
  });
  return {
    plugins: [react()],
    server: {
      proxy: {
        "/deals": { ...proxy },
        "/products": { ...proxy },
        "/health": { ...proxy },
      },
    },
  };
});
