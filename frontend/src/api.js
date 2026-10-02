// Cliente de la API. El dinero viaja como string en ambos sentidos.

import { evaluateLocal } from "./calc.js";

// Base de la API. En dev queda vacia y el proxy de Vite manda a localhost:8000.
// En produccion (Vercel) se define VITE_API_URL con la URL del backend externo.
const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export async function evaluateDeal(deal) {
  // El calculo es SIEMPRE local (offline) y es la fuente de verdad. El backend
  // (VITE_API_URL) se usa solo para el analisis con IA, ver explainDeal.
  return evaluateLocal(deal);
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

// Autocompleta el deal desde una foto. Manda la imagen (data URL base64) al
// backend, que la lee con IA y devuelve los campos encontrados. Necesita backend.
export async function extractDeal(imageDataUrl) {
  let response;
  try {
    response = await fetch(`${API_BASE}/deals/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: imageDataUrl }),
    });
  } catch {
    throw new Error("Necesita conexión al servidor para leer la foto.");
  }
  if (!response.ok) {
    let detalle = `No se pudo leer la foto (${response.status}).`;
    try {
      const data = await response.json();
      if (data && data.detail) detalle = data.detail;
    } catch {
      // sin cuerpo JSON
    }
    throw new Error(detalle);
  }
  const data = await response.json();
  return data.fields || {};
}
