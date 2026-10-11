// Datos y validación de comparables. No calcula montos (vienen del backend).

import { safeProductUrl } from "./rehabProducts.js";

export const COMP_STATUS = [
  { id: "both", label: "Ambas" },
  { id: "sold", label: "Vendidas" },
  { id: "for_sale", label: "En venta" },
];

export const COMP_RADII = [1, 3, 5, 10, 20];

export const COMP_HOME_TYPES = [
  { id: "", label: "Cualquiera" },
  { id: "house", label: "Casa" },
  { id: "condo", label: "Condo" },
  { id: "townhouse", label: "Townhouse" },
  { id: "multi_family", label: "Multifamiliar" },
  { id: "manufactured", label: "Prefabricada" },
  { id: "apartment", label: "Departamento" },
  { id: "lot", label: "Terreno" },
];

const HOME_TYPE_FROM_ZILLOW = {
  SINGLE_FAMILY: "house",
  CONDO: "condo",
  TOWNHOUSE: "townhouse",
  MULTI_FAMILY: "multi_family",
  MANUFACTURED: "manufactured",
  APARTMENT: "apartment",
  LOT: "lot",
  LAND: "lot",
};

export function mapHomeType(zillowType) {
  return HOME_TYPE_FROM_ZILLOW[String(zillowType || "").toUpperCase()] || "";
}

// Una dirección "sirve" si tiene largo, al menos un número y letras (calle real).
export function esDireccionPlausible(address) {
  const s = String(address || "").trim();
  return s.length >= 6 && /\d/.test(s) && /[a-zA-Z]/.test(s);
}

// Fecha de venta legible (viene como timestamp ISO de Zillow).
export function fechaVenta(iso) {
  const s = String(iso || "");
  if (!s) return "";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s.slice(0, 10) : d.toLocaleDateString("es-AR");
}

// Resumen "3 dorm · 2 baños · 1.650 ft²" tolerante a valores faltantes.
export function resumenAtributos(x) {
  const partes = [];
  if (x && x.beds != null) partes.push(`${Math.round(x.beds)} dorm`);
  if (x && x.baths != null) partes.push(`${x.baths} baños`);
  if (x && x.sqft != null) partes.push(`${Number(x.sqft).toLocaleString("es-AR")} ft²`);
  return partes.join(" · ");
}

export function validateCompsResult(data) {
  if (!data || typeof data !== "object" || typeof data.subject !== "object"
    || !Array.isArray(data.comps)) {
    throw new Error("El servidor devolvió comparables inválidos.");
  }
  const seen = new Set();
  const comps = data.comps.map((c) => {
    if (!c || typeof c !== "object" || typeof c.zpid !== "string") {
      throw new Error("La búsqueda contiene un comparable inválido.");
    }
    const url = safeProductUrl(c.url);
    if (!url || seen.has(c.zpid)) throw new Error("La búsqueda contiene un comparable inválido.");
    seen.add(c.zpid);
    return { ...c, url, image: c.image ? safeProductUrl(c.image) : null };
  });
  const s = data.subject;
  const subject = {
    ...s,
    url: s.url ? safeProductUrl(s.url) || "" : "",
    image: s.image ? safeProductUrl(s.image) : null,
  };
  return { ...data, subject, comps };
}
