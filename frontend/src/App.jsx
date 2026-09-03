// Orquesta el estado del deal, llama a POST /deals/evaluate y compone los dos
// paneles. REGLA 4: el front no hace aritmetica; solo muestra lo que devuelve
// la API (la unica excepcion es el % de recupero, calculo de display).

import { useEffect, useState } from "react";
import { evaluateDeal } from "./api.js";
import DealForm from "./components/DealForm.jsx";
import Verdict from "./components/Verdict.jsx";
import Waterfall from "./components/Waterfall.jsx";
import ResultTable from "./components/ResultTable.jsx";
import "./styles.css";

// Deal de ejemplo: se evalua al montar para que el panel nunca aparezca vacio.
const INICIAL = {
  name: "Casa ejemplo",
  purchase_price: "100000",
  rehab_budget: "30000",
  arv: "180000",
  ltc: "0.90",
  monthly_interest_rate: "0.005",
  points: "0.02",
  ltv: "0.75",
  seasoning_months: "6",
  closing_costs: "4000",
};

export default function App() {
  const [form, setForm] = useState(INICIAL);
  // Snapshot del form que produjo el resultado actual (para closing_costs y nombre).
  const [evaluado, setEvaluado] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [dirty, setDirty] = useState(false);

  async function evaluar(datos) {
    setCargando(true);
    setError(null);
    try {
      const data = await evaluateDeal(datos);
      setResult(data);
      setEvaluado(datos);
      setDirty(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
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

  function enviar(evento) {
    evento.preventDefault();
    evaluar(form);
  }

  return (
    <main className="app">
      <DealForm
        form={form}
        onChange={actualizar}
        onSubmit={enviar}
        cargando={cargando}
        dirty={dirty}
        evaluatedName={evaluado?.name}
      />

      <aside className="result-panel">
        {error && <p className="error">Error: {error}</p>}

        {result && (
          <>
            <Verdict result={result} />
            <Waterfall result={result} closingCosts={evaluado?.closing_costs} />
            <ResultTable result={result} />
            <p className="api-note">
              POST /deals/evaluate · montos como string, sin float
            </p>
          </>
        )}
      </aside>
    </main>
  );
}
