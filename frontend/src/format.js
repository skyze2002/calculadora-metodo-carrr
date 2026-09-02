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
