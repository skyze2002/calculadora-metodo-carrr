// Usa el backend publicado sin copiar la clave de OpenAI al entorno local.
// La llave de la app sólo se reenvía al destino de producción configurado.
export function createDevApiProxy({ override, productionUrl, appKey } = {}) {
  const target = override || productionUrl || "http://localhost:8000";
  const parsed = new URL(target);
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error("La URL del backend de desarrollo no es válida.");
  }
  const isProduction = productionUrl && parsed.href === new URL(productionUrl).href;
  return {
    target,
    changeOrigin: true,
    ...(isProduction && appKey ? { headers: { "X-App-Key": appKey } } : {}),
    // Permite el arranque en frío de Render y las dos consultas de IA.
    timeout: 180000,
    proxyTimeout: 180000,
  };
}
