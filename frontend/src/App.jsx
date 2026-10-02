// Orquesta el estado del deal, llama a POST /deals/evaluate y compone los dos
// paneles. REGLA 4: el front no hace aritmetica; solo muestra lo que devuelve
// la API (la unica excepcion es el % de recupero, calculo de display).

import { useEffect, useRef, useState } from "react";
import { evaluateDeal, explainDeal } from "./api.js";
import { percentToFraction } from "./format.js";
import AiAnalysis from "./components/AiAnalysis.jsx";
import BankRefiCalculator from "./components/BankRefiCalculator.jsx";
import DealForm from "./components/DealForm.jsx";
import LenderClosing from "./components/LenderClosing.jsx";
import SavedDeals from "./components/SavedDeals.jsx";
import Verdict from "./components/Verdict.jsx";
import Waterfall from "./components/Waterfall.jsx";
import ResultTable from "./components/ResultTable.jsx";
import { exportarPDF, puedeCompartir } from "./pdf.js";
import { deleteDeal, getDeals, saveDeal } from "./storage.js";
import "./styles.css";

// Deal de ejemplo: se evalua al montar para que el panel nunca aparezca vacio.
const INICIAL = {
  name: "Casa ejemplo",
  purchase_price: "100000",
  rehab_budget: "30000",
  arv: "180000",
  loan_total: "100000",
  closing_fee: "10000",
  ltv: "75",
};

export default function App() {
  const [form, setForm] = useState(INICIAL);
  // Snapshot del form que produjo el resultado actual (para closing_costs y nombre).
  const [evaluado, setEvaluado] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [dirty, setDirty] = useState(false);
  // Analisis con IA (a pedido).
  const [analisis, setAnalisis] = useState(null);
  const [analizando, setAnalizando] = useState(false);
  const [errorIa, setErrorIa] = useState(null);
  // Vista actual y deals guardados en el telefono.
  const [vista, setVista] = useState("calc");
  const [deals, setDeals] = useState(() => getDeals());
  const [guardado, setGuardado] = useState(false);
  const resultRef = useRef(null);

  async function evaluar(datos) {
    setCargando(true);
    setError(null);
    // El analisis anterior deja de aplicar al nuevo resultado.
    setAnalisis(null);
    setErrorIa(null);
    try {
      // El LTV se ingresa como porcentaje (75); el calculo usa fraccion (0.75).
      const dealCalc = { ...datos, ltv: percentToFraction(datos.ltv) };
      const data = await evaluateDeal(dealCalc);
      setResult(data);
      setEvaluado(datos);
      setDirty(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  async function pedirAnalisis() {
    setAnalizando(true);
    setErrorIa(null);
    try {
      const texto = await explainDeal(evaluado?.name, result);
      setAnalisis(texto);
    } catch (err) {
      setErrorIa(err.message);
    } finally {
      setAnalizando(false);
    }
  }

  // Evaluacion inicial, una sola vez.
  useEffect(() => {
    evaluar(INICIAL);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function actualizar(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
    setDirty(true);
  }

  // Merge de los campos leidos de una foto en el formulario.
  function autocompletar(fields) {
    const soloDigitos = (v) => String(v).replace(/\D/g, "");
    setForm((prev) => {
      const next = { ...prev };
      if (fields.name) next.name = fields.name;
      for (const clave of ["purchase_price", "rehab_budget", "arv"]) {
        if (fields[clave]) next[clave] = soloDigitos(fields[clave]);
      }
      return next;
    });
    setDirty(true);
  }

  async function enviar(evento) {
    evento.preventDefault();
    await evaluar(form);
    // En celular, llevar la vista al resultado tras evaluar.
    if (typeof window !== "undefined" && window.innerWidth <= 1080) {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
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
    setGuardado(true);
    setTimeout(() => setGuardado(false), 1800);
  }

  function abrirDeal(d) {
    setForm(d.form);
    setVista("calc");
    evaluar(d.form);
  }

  function eliminarDeal(id) {
    setDeals(deleteDeal(id));
  }

  return (
    <div className="shell">
      <nav className="tabs">
        <button
          type="button"
          className={"tab" + (vista === "calc" ? " active" : "")}
          onClick={() => setVista("calc")}
        >
          Calculadora
        </button>
        <button
          type="button"
          className={"tab" + (vista === "guardados" ? " active" : "")}
          onClick={() => setVista("guardados")}
        >
          Guardados{deals.length ? ` (${deals.length})` : ""}
        </button>
      </nav>

      {vista === "guardados" ? (
        <SavedDeals
          deals={deals}
          onAbrir={abrirDeal}
          onEliminar={eliminarDeal}
        />
      ) : (
        <main className="app">
      <div className="left-col">
        <DealForm
          form={form}
          onChange={actualizar}
          onSubmit={enviar}
          onExtracted={autocompletar}
          cargando={cargando}
          dirty={dirty}
          evaluatedName={evaluado?.name}
        />
        <BankRefiCalculator />
      </div>

      <aside className="result-panel" ref={resultRef}>
        {error && <p className="error">Error: {error}</p>}

        {result && (
          <>
            <LenderClosing result={result} closingFee={evaluado?.closing_fee} />
            <Verdict result={result} />
            <AiAnalysis
              analisis={analisis}
              analizando={analizando}
              error={errorIa}
              onPedir={pedirAnalisis}
            />
            <Waterfall result={result} />
            <ResultTable result={result} />

            <button type="button" className="btn-save" onClick={guardarDeal}>
              {guardado ? "Guardado ✓" : "Guardar deal"}
            </button>

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
      )}
    </div>
  );
}
