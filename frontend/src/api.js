// Cliente de la API. El dinero viaja como string en ambos sentidos.

export async function evaluateDeal(deal) {
  const response = await fetch("/deals/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(deal),
  });
  if (!response.ok) {
    throw new Error(`La API respondio ${response.status}`);
  }
  return response.json();
}
