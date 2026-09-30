// Cliente de la API. El dinero viaja como string en ambos sentidos.

import { evaluateLocal } from "./calc.js";

// Base de la API. En dev queda vacia y el proxy de Vite manda a localhost:8000.
// En produccion (Vercel) se define VITE_API_URL con la URL del backend externo.
const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export async function evaluateDeal(deal) {
  // App standalone (APK y dev sin backend): calcula en el dispositivo con el
  // espejo de core. Solo pega a la red si se configura VITE_API_URL (para
  // reconectar el backend, ej. guardar/listar deals).
  if (!API_BASE) {
    return evaluateLocal(deal);
  }

  const response = await fetch(`${API_BASE}/deals/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(deal),
  });
  if (!response.ok) {
    throw new Error(`La API respondio ${response.status}`);
  }
  return response.json();
}

// Pide el analisis con IA. Siempre necesita el backend (no hay version local):
// en dev pega por el proxy a localhost:8000; en produccion, a VITE_API_URL.
export async function explainDeal(name, result) {
  let response;
  try {
    response = await fetch(`${API_BASE}/deals/explain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name || "", result }),
    });
  } catch {
    throw new Error("Necesita conexión al servidor para el análisis con IA.");
  }
  if (!response.ok) {
    let detalle = `No se pudo generar el análisis (${response.status}).`;
    try {
      const data = await response.json();
      if (data && data.detail) detalle = data.detail;
    } catch {
      // sin cuerpo JSON: dejamos el mensaje por defecto
    }
    throw new Error(detalle);
  }
  const data = await response.json();
  return data.analisis;
}
