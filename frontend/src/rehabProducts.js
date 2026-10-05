// Datos y validación del buscador. No calcula costes ni modifica ningún deal.

export const PRODUCT_CATEGORIES = [
  { id: "mirrors", label: "Espejos", hint: "Baño, entrada o dormitorio", example: "Ej. Espejo redondo de 24 pulgadas, sin luz" },
  { id: "lighting", label: "Luces", hint: "LED, plafones y lámparas", example: "Ej. Plafón LED de techo, luz cálida" },
  { id: "faucets", label: "Grifos", hint: "Lavamanos y cocina", example: "Ej. Grifo sencillo para lavamanos" },
  { id: "handles", label: "Tiradores", hint: "Puertas, cajones y muebles", example: "Ej. Tiradores negros de 128 mm, paquete de 10" },
  { id: "bathroom", label: "Accesorios de baño", hint: "Toalleros, ganchos y repisas", example: "Ej. Toallero de pared sencillo, acabado negro" },
  { id: "other", label: "Otros básicos", hint: "Pequeños detalles del rehab", example: "Ej. Barra para cortina de 120 cm" },
];

export const PRODUCT_MARKETS = [
  { country: "US", label: "Estados Unidos", currency: "USD" },
  { country: "PE", label: "Perú", currency: "PEN" },
  { country: "MX", label: "México", currency: "MXN" },
  { country: "CO", label: "Colombia", currency: "COP" },
  { country: "ES", label: "España", currency: "EUR" },
  { country: "AR", label: "Argentina", currency: "ARS" },
  { country: "CL", label: "Chile", currency: "CLP" },
];

// Mercado confirmado por el usuario, no inferido de su ubicación.
export const INITIAL_PRODUCT_SEARCH = {
  category: "mirrors", country: "US", city: "", region: "", budget: "", details: "",
};

export function validateProductSearch(form) {
  if (!PRODUCT_CATEGORIES.some((item) => item.id === form.category)) throw new Error("Elegí un tipo de producto.");
  if (!PRODUCT_MARKETS.some((item) => item.country === form.country)) throw new Error("Elegí el país donde comprarías.");
  const city = String(form.city ?? "").trim();
  const region = String(form.region ?? "").trim();
  const details = String(form.details ?? "").trim();
  if (city.length > 80 || region.length > 80 || details.length > 400) throw new Error("El detalle, la ciudad o el estado son demasiado largos.");
  const raw = String(form.budget ?? "").trim().replace(",", ".");
  if (raw && (!/^\d{1,9}(?:\.\d{1,2})?$/.test(raw) || !/[1-9]/.test(raw))) {
    throw new Error("Ingresá un presupuesto mayor que cero, sin miles y con hasta dos decimales.");
  }
  return { category: form.category, country: form.country, city, region, details, budget: raw || null };
}

export function safeProductUrl(value) {
  if (typeof value !== "string" || /\s/.test(value)) return null;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password
      || (url.port && !["80", "443"].includes(url.port))) return null;
    const host = url.hostname.toLowerCase();
    if (!host.includes(".") || host === "localhost" || /(?:\.localhost|\.local|\.internal)$/.test(host)
      || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(":")) return null;
    url.hash = "";
    return url.href;
  } catch { return null; }
}

export function validateProductResults(data, country) {
  const market = PRODUCT_MARKETS.find((item) => item.country === country);
  if (!market || data?.country !== country || data.currency !== market.currency
    || !Array.isArray(data.products) || data.products.length > 8
    || typeof data.message !== "string" || typeof data.searched_at !== "string"
    || Number.isNaN(Date.parse(data.searched_at))) throw new Error("El servidor devolvió una búsqueda inválida. Intentá nuevamente.");
  const seen = new Set();
  const products = data.products.map((product) => {
    if (!product || typeof product !== "object") throw new Error("La búsqueda contiene un producto inválido. Intentá nuevamente.");
    const url = safeProductUrl(product.url);
    // La foto es opcional: si el enlace no es válido se descarta sin romper.
    const image = product.image == null ? null : safeProductUrl(product.image);
    if (!url || seen.has(url) || product.currency !== market.currency
      || typeof product.title !== "string" || !product.title.trim()
      || typeof product.store !== "string" || !product.store.trim()
      || (product.delivery != null && typeof product.delivery !== "string")
      || (product.rating != null && (typeof product.rating !== "number" || product.rating < 0 || product.rating > 5))
      || (product.price !== null && (typeof product.price !== "string"
        || !/^\d{1,9}\.\d{2}$/.test(product.price) || !/[1-9]/.test(product.price)))) {
      throw new Error("La búsqueda contiene un producto o enlace inválido. Intentá nuevamente.");
    }
    seen.add(url);
    return { ...product, url, image };
  });
  return { ...data, products };
}

export function productPrice(product) {
  if (product.price == null) return "Consultar precio";
  const [integer, decimals] = product.price.split(".");
  if (product.currency === "USD") return `USD ${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${decimals}`;
  return `${product.currency} ${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${decimals}`;
}
