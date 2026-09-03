// Cliente de la API. El dinero viaja como string en ambos sentidos.

// Base de la API. En dev queda vacia y el proxy de Vite manda a localhost:8000.
// En produccion (Vercel) se define VITE_API_URL con la URL del backend externo.
const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export async function evaluateDeal(deal) {
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
