// Genera un PDF con los datos del resultado del deal, para que el cliente lo
// descargue o lo comparta. Todo en el dispositivo (sin servidor).

import { jsPDF } from "jspdf";
import { formatMoney } from "./format.js";

const UMBRAL = 5000;

function veredicto(trappedStr) {
  const t = Number(trappedStr);
  if (t <= 0) return { chip: "El deal sirve", color: [46, 160, 120] };
  if (t <= UMBRAL) return { chip: "Al limite", color: [120, 108, 191] };
  return { chip: "No sirve", color: [200, 80, 80] };
}

// Arma el documento con jsPDF (unidades en puntos, hoja A4).
export function construirPDF({ nombre, result, analisis }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  const right = W - M;
  let y = 62;

  // Encabezado
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(25, 27, 40);
  doc.text("Análisis del deal", M, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120, 124, 140);
  doc.text(new Date().toLocaleDateString("es-AR"), right, y, { align: "right" });

  y += 12;
  doc.setDrawColor(220, 222, 230);
  doc.line(M, y, right, y);

  y += 28;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(40, 42, 55);
  doc.text(nombre || "Deal sin nombre", M, y);

  // Bloque destacado: dinero atrapado
  y += 30;
  const v = veredicto(result.trapped_cash);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120, 124, 140);
  doc.text("DINERO ATRAPADO", M, y);
  doc.setTextColor(v.color[0], v.color[1], v.color[2]);
  doc.text(v.chip.toUpperCase(), right, y, { align: "right" });

  y += 32;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  doc.setTextColor(v.color[0], v.color[1], v.color[2]);
  doc.text(formatMoney(result.trapped_cash), M, y);

  y += 30;
  doc.setDrawColor(230, 230, 236);
  doc.line(M, y, right, y);
  y += 28;

  // Filas de detalle
  const filas = [
    ["Se lleva al cierre (prestamista)", result.lender_closing],
    ["Total del préstamo", result.private_loan_amount],
    ["Aporte inicial", result.down_payment],
    ["Préstamo del refi", result.refinance_loan_amount],
    ["Dinero devuelto por el banco", result.cash_out],
    ["Total invertido", result.total_invested],
  ];

  doc.setFontSize(12);
  for (const [label, val] of filas) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(90, 94, 110);
    doc.text(label, M, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(35, 37, 50);
    doc.text(formatMoney(val), right, y, { align: "right" });
    y += 12;
    doc.setDrawColor(236, 236, 240);
    doc.line(M, y, right, y);
    y += 22;
  }

  // Analisis con IA (si se genero)
  if (analisis) {
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(232, 89, 12);
    doc.text("ANÁLISIS", M, y);
    y += 18;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11.5);
    doc.setTextColor(60, 55, 50);
    const lineas = doc.splitTextToSize(analisis, right - M);
    doc.text(lineas, M, y, { lineHeightFactor: 1.4 });
  }

  // Pie
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(150, 152, 165);
  doc.text("Calculadora BRRRR", M, 802);

  return doc;
}

// Nombre de archivo seguro a partir del nombre del deal.
function nombreArchivo(nombre) {
  const base = (nombre || "analisis").trim().replace(/[^\w-]+/g, "_");
  return `deal-${base || "analisis"}.pdf`;
}

// Descarga el PDF, o abre la hoja de compartir nativa si se pide y esta
// disponible (celular / APK). Si no, cae en descarga.
export async function exportarPDF(datos, { compartir = false } = {}) {
  const doc = construirPDF(datos);
  const fileName = nombreArchivo(datos.nombre);

  if (compartir && typeof navigator !== "undefined" && navigator.canShare) {
    const blob = doc.output("blob");
    const file = new File([blob], fileName, { type: "application/pdf" });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: datos.nombre || "Análisis del deal",
        });
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return; // el usuario cancelo
      }
    }
  }
  doc.save(fileName);
}

// True si el navegador puede compartir archivos (para mostrar el boton).
export function puedeCompartir() {
  return typeof navigator !== "undefined" && !!navigator.share;
}
