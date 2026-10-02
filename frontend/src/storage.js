// Guarda los deals en el teléfono (localStorage). Sin backend. Cada lectura/
// escritura esta protegida por try/catch porque el storage puede fallar
// (modo privado, sin permiso, etc.).

const KEY = "brrrr_deals";

export function getDeals() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistir(deals) {
  try {
    localStorage.setItem(KEY, JSON.stringify(deals));
  } catch {
    // sin storage disponible: no rompe la app
  }
}

// Guarda un deal al principio de la lista. Si ya existe uno con el mismo nombre,
// lo reemplaza en vez de duplicarlo. Devuelve la lista actualizada.
export function saveDeal({ name, form, trapped }) {
  const id =
    Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const nuevo = {
    id,
    name,
    form,
    trapped,
    savedAt: new Date().toISOString(),
  };
  const resto = getDeals().filter((d) => d.name !== name);
  const deals = [nuevo, ...resto];
  persistir(deals);
  return deals;
}

export function deleteDeal(id) {
  const deals = getDeals().filter((d) => d.id !== id);
  persistir(deals);
  return deals;
}
