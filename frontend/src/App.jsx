// Orquesta el estado del deal, llama a POST /deals/evaluate y compone los dos
// paneles. REGLA 4: el front no hace aritmetica; solo muestra lo que devuelve
// la API (la unica excepcion es el % de recupero, calculo de display).

import { useEffect, useMemo, useRef, useState } from "react";
import { explainDeal } from "./api.js";
import { evaluateLocal } from "./calc.js";
import { percentToFraction } from "./format.js";
import AiAnalysis from "./components/AiAnalysis.jsx";
import BankRefiCalculator from "./components/BankRefiCalculator.jsx";
import DealForm from "./components/DealForm.jsx";
import FloatingBar from "./components/FloatingBar.jsx";
import LenderClosing from "./components/LenderClosing.jsx";
import Levers from "./components/Levers.jsx";
import SavedDeals from "./components/SavedDeals.jsx";
import TopBar from "./components/TopBar.jsx";
import Verdict from "./components/Verdict.jsx";
import Waterfall from "./components/Waterfall.jsx";
import ResultTable from "./components/ResultTable.jsx";
import { exportarPDF, puedeCompartir } from "./pdf.js";
import { deleteDeal, getDeals, saveDeal } from "./storage.js";
import "./styles.css";

// Deal de ejemplo inicial para que el panel nunca aparezca vacio.
const INICIAL = {
  name: "Casa ejemplo",
  purchase_price: "100000",
  rehab_budget: "30000",
  arv: "180000",
  loan_total: "100000",
  closing_fee: "10000",
  ltv: "75",
};

// Convierte el form (LTV como %) al deal que usa el calculo (LTV fraccion).
function aCalc(form) {
  return { ...form, ltv: percentToFraction(form.ltv) };
}

export default function App() {
  const [form, setForm] = useState(INICIAL);
  // Snapshot del form que produjo el resultado actual (nombre, closing_fee).
  const [evaluado, setEvaluado] = useState(INICIAL);
  // Resultado inicial sincrono: el panel nunca arranca vacio.
  const [result, setResult] = useState(() => evaluateLocal(aCalc(INICIAL)));
  const [error, setError] = useState(null);
  // Analisis con IA (a pedido).
  const [analisis, setAnalisis] = useState(null);
  const [analizando, setAnalizando] = useState(false);
  const [errorIa, setErrorIa] = useState(null);
  // El analisis queda "viejo" cuando el resultado cambia despues de generarlo.
  const [analisisStale, setAnalisisStale] = useState(false);
  // Vista actual y deals guardados en el telefono.
  const [vista, setVista] = useState("calc");
  const [deals, setDeals] = useState(() => getDeals());
  const [guardado, setGuardado] = useState(false);
  // Campos recien autocompletados o cambiados por una palanca (resalte 1,6 s).
  const [resaltados, setResaltados] = useState([]);
  const resaltarTimer = useRef(0);
  // Deal "base" para comparar cambios (al empezar, abrir o guardar).
  const [base, setBase] = useState(INICIAL);
  const baseResult = useMemo(() => evaluateLocal(aCalc(base)), [base]);
  const resultRef = useRef(null);

  function resaltar(campos) {
    setResaltados(campos);
    clearTimeout(resaltarTimer.current);
    resaltarTimer.current = setTimeout(() => setResaltados([]), 1600);
  }

  // Recalcula en vivo con debounce de 250ms. Si el form cambia antes, el
  // timeout anterior se cancela (debounce = cancelacion, porque el calculo es
  // local y sincrono). El panel sigue mostrando el ultimo resultado.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        setResult(evaluateLocal(aCalc(form)));
        setEvaluado(form);
        setError(null);
      } catch (err) {
        setError(err.message);
      }
      // El analisis previo (si hay) queda viejo respecto al nuevo resultado.
      setAnalisisStale(true);
      setErrorIa(null);
    }, 250);
    return () => clearTimeout(t);
  }, [form]);

  async function pedirAnalisis() {
    setAnalizando(true);
    setErrorIa(null);
    try {
      const texto = await explainDeal(evaluado?.name, result);
      setAnalisis(texto);
      setAnalisisStale(false);
    } catch (err) {
      setErrorIa(err.message);
    } finally {
      setAnalizando(false);
    }
  }

  function actualizar(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  // Merge de los campos leidos de una foto / link + resaltado 1,6 s.
  function autocompletar(fields) {
    const soloDigitos = (v) => String(v).replace(/\D/g, "");
    const cambios = {};
    const aplicados = [];
    if (fields.name) {
      cambios.name = fields.name;
      aplicados.push("name");
    }
    for (const clave of ["purchase_price", "rehab_budget", "arv"]) {
      if (fields[clave]) {
        cambios[clave] = soloDigitos(fields[clave]);
        aplicados.push(clave);
      }
    }
    setForm((prev) => ({ ...prev, ...cambios }));
    resaltar(aplicados);
  }

  // Aplica una palanca: escribe el valor en un campo y lo resalta.
  function aplicarPalanca(campo, valor) {
    const digitos = String(Math.round(Number(valor)) || 0);
    setForm((prev) => ({ ...prev, [campo]: digitos }));
    resaltar([campo]);
  }

  function deshacer() {
    setForm(base);
  }

  // Scroll al panel de resultados (boton "Ver" de la barra flotante).
  function verResultado() {
    const el = resultRef.current;
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 76;
    window.scrollTo({ top: y, behavior: "smooth" });
  }

  function guardarDeal() {
    if (!evaluado || !result) return;
    setDeals(
      saveDeal({
        name: evaluado.name,
        form: evaluado,
        trapped: result.trapped_cash,
      }),
    );
    // El deal guardado pasa a ser la base de comparacion.
    setBase(evaluado);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 1800);
  }

  function abrirDeal(d) {
    setBase(d.form);
    setForm(d.form);
    setVista("calc");
    evaluar(d.form);
  }

  function eliminarDeal(id) {
    setDeals(deleteDeal(id));
  }

  return (
    <div className="shell">
      <TopBar
        vista={vista}
        setVista={setVista}
        dealsCount={deals.length}
        onGuardar={guardarDeal}
        guardado={guardado}
      />

      {vista === "guardados" ? (
        <SavedDeals
          deals={deals}
          onAbrir={abrirDeal}
          onEliminar={eliminarDeal}
          onIrCalculadora={() => setVista("calc")}
        />
      ) : (
        <>
        <main className="app">
      <div className="left-col">
        <DealForm
          form={form}
          onChange={actualizar}
          onExtracted={autocompletar}
          result={result}
          resaltados={resaltados}
        />
        <BankRefiCalculator arvActual={form.arv} />
      </div>

      <aside className="result-panel" ref={resultRef}>
        {error && <p className="error">Error: {error}</p>}

        {result && (
          <>
            <Verdict
              result={result}
              baseTrapped={baseResult.trapped_cash}
              onDeshacer={deshacer}
            />
            <Levers result={result} onProbar={aplicarPalanca} />
            <LenderClosing result={result} closingFee={evaluado?.closing_fee} />
            <Waterfall result={result} />
            <AiAnalysis
              analisis={analisis}
              analizando={analizando}
              error={errorIa}
              stale={analisisStale}
              onPedir={pedirAnalisis}
            />
            <ResultTable result={result} />

            <div className="result-actions">
              <button
                type="button"
                className="btn-pdf ghost"
                onClick={() =>
                  exportarPDF({ nombre: evaluado?.name, result, analisis })
                }
              >
                Descargar PDF
              </button>
              {puedeCompartir() && (
                <button
                  type="button"
                  className="btn-pdf ghost"
                  onClick={() =>
                    exportarPDF(
                      { nombre: evaluado?.name, result, analisis },
                      { compartir: true },
                    )
                  }
                >
                  Compartir
                </button>
              )}
            </div>
          </>
        )}
        </aside>
        </main>
        <FloatingBar
          trapped={result.trapped_cash}
          onGuardar={guardarDeal}
          guardado={guardado}
          onVer={verResultado}
        />
        </>
      )}
    </div>
  );
}
