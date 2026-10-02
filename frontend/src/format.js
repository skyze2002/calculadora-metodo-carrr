// Formateo SOLO para mostrar. No hay aritmetica: los montos vienen como string
// desde la API y se muestran tal cual, agregando separador de miles sin pasar
// por float (para no perder precision).

export function formatMoney(value) {
  if (value == null) return "";
  const [entero, decimales = "00"] = String(value).split(".");
  const negativo = entero.startsWith("-");
  const digitos = negativo ? entero.slice(1) : entero;
  const conMiles = digitos.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negativo ? "-" : ""}$${conMiles},${decimales}`;
}

// --- Helpers para los inputs (lo que escribe el usuario) ---

// Muestra un entero con separador de miles: "100000" -> "100.000".
export function formatThousands(raw) {
  const digitos = String(raw ?? "").replace(/\D/g, "");
  if (!digitos) return "";
  return digitos.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Deja solo digitos: lo que se guarda en el estado de un input de dinero.
export function onlyDigits(s) {
  return String(s ?? "").replace(/\D/g, "");
}

// Limpia un input de porcentaje: digitos y un solo punto decimal.
export function cleanPercent(s) {
  const limpio = String(s ?? "").replace(/[^\d.]/g, "");
  const partes = limpio.split(".");
  return partes.length <= 1 ? limpio : `${partes[0]}.${partes.slice(1).join("")}`;
}

// Convierte un porcentaje escrito ("75") a fraccion string ("0.75") para el
// calculo. Es normalizacion de input, no aritmetica del negocio.
export function percentToFraction(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return String(n / 100);
}
