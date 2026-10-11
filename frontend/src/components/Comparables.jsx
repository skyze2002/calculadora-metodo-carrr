// Comparables: busca propiedades parecidas al deal (vendidas y/o en venta) para
// estimar el ARV. Automático con la dirección del deal; filtros editables.

import { useEffect, useRef, useState } from "react";
import { searchComps } from "../api.js";
import {
  COMP_HOME_TYPES,
  COMP_RADII,
  COMP_STATUS,
  esDireccionPlausible,
  fechaVenta,
  mapHomeType,
  resumenAtributos,
  validateCompsResult,
} from "../comps.js";
import { formatMoney } from "../format.js";
import "../comps.css";

export default function Comparables({ hidden, dealAddress, onUsarArv }) {
  const [address, setAddress] = useState(dealAddress || "");
  const [status, setStatus] = useState("both");
  const [radius, setRadius] = useState(3);
  const [beds, setBeds] = useState("");
  const [bathsMin, setBathsMin] = useState("");
  const [sqftMin, setSqftMin] = useState("");
  const [sqftMax, setSqftMax] = useState("");
  const [homeType, setHomeType] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const controller = useRef(null);
  const autoHecha = useRef("");

  // Al cambiar el deal: resetear y permitir una auto-búsqueda al abrir.
  useEffect(() => {
    setAddress(dealAddress || "");
    setResult(null);
    setError(null);
    autoHecha.current = "";
  }, [dealAddress]);

  // Al abrir la pestaña con una dirección real, buscar una sola vez.
  useEffect(() => {
    if (hidden) return;
    const addr = (address || "").trim();
    if (esDireccionPlausible(addr) && autoHecha.current !== addr && !result && !loading) {
      autoHecha.current = addr;
      buscar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidden]);

  useEffect(() => () => controller.current?.abort(), []);

  async function buscar() {
    const addr = address.trim();
    if (!esDireccionPlausible(addr)) {
      setError("Escribí una dirección completa (calle, ciudad, estado).");
      return;
    }
    controller.current?.abort();
    const req = new AbortController();
    controller.current = req;
    setLoading(true);
    setError(null);
    try {
      const payload = { address: addr, status, radius_mi: radius };
      if (beds !== "") {
        payload.beds_min = Number(beds);
        payload.beds_max = Number(beds);
      }
      if (bathsMin !== "") payload.baths_min = Number(bathsMin);
      if (sqftMin !== "") payload.sqft_min = Number(sqftMin);
      if (sqftMax !== "") payload.sqft_max = Number(sqftMax);
      if (homeType) payload.home_types = [homeType];

      const data = await searchComps(payload, { signal: req.signal });
      if (req.signal.aborted) return;
      const validado = validateCompsResult(data);
      setResult(validado);
      // Prefill de filtros con los valores del inmueble (si estaban vacíos).
      const s = validado.subject;
      if (beds === "" && s.beds) setBeds(String(Math.round(s.beds)));
      if (bathsMin === "" && s.baths) setBathsMin(String(s.baths));
      if (homeType === "" && s.home_type) {
        const m = mapHomeType(s.home_type);
        if (m) setHomeType(m);
      }
    } catch (err) {
      if (!req.signal.aborted) setError(err.message);
    } finally {
      if (!req.signal.aborted) setLoading(false);
    }
  }

  function etiquetaEstado(s) {
    if (s === "sold") return { txt: "Vendida", cls: "sold" };
    if (s === "for_sale") return { txt: "En venta", cls: "sale" };
    return { txt: "—", cls: "" };
  }

  return (
    <main className="comps-view" hidden={hidden}>
      <div className="comps-head">
        <div>
          <span className="comps-kicker">Comparables</span>
          <h1>Propiedades parecidas<br /><span>para estimar el ARV</span></h1>
          <p>Ventas y listados similares al inmueble del deal, automáticos desde su dirección.</p>
        </div>
      </div>

      <form className="comps-filters" onSubmit={(e) => { e.preventDefault(); buscar(); }}>
        <label className="comps-field comps-address">
          <span className="comps-flabel">Dirección de la propiedad</span>
          <input
            value={address}
            placeholder="Calle, ciudad, estado"
            onChange={(e) => setAddress(e.target.value)}
          />
        </label>
        <div className="comps-field comps-field-wide">
          <span className="comps-flabel">Estado</span>
          <div className="segmented comps-status">
            {COMP_STATUS.map((o) => (
              <button
                key={o.id}
                type="button"
                className={"seg" + (status === o.id ? " active" : "")}
                onClick={() => setStatus(o.id)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <label className="comps-field">
          <span className="comps-flabel">Radio</span>
          <select value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
            {COMP_RADII.map((r) => <option key={r} value={r}>{r} mi</option>)}
          </select>
        </label>
        <label className="comps-field">
          <span className="comps-flabel">Dorm.</span>
          <input inputMode="numeric" value={beds} placeholder="auto"
            onChange={(e) => setBeds(e.target.value.replace(/\D/g, ""))} />
        </label>
        <label className="comps-field">
          <span className="comps-flabel">Baños mín.</span>
          <input inputMode="decimal" value={bathsMin} placeholder="auto"
            onChange={(e) => setBathsMin(e.target.value.replace(/[^\d.]/g, ""))} />
        </label>
        <label className="comps-field">
          <span className="comps-flabel">ft² mín.</span>
          <input inputMode="numeric" value={sqftMin} placeholder="auto"
            onChange={(e) => setSqftMin(e.target.value.replace(/\D/g, ""))} />
        </label>
        <label className="comps-field">
          <span className="comps-flabel">ft² máx.</span>
          <input inputMode="numeric" value={sqftMax} placeholder="auto"
            onChange={(e) => setSqftMax(e.target.value.replace(/\D/g, ""))} />
        </label>
        <label className="comps-field">
          <span className="comps-flabel">Tipo</span>
          <select value={homeType} onChange={(e) => setHomeType(e.target.value)}>
            {COMP_HOME_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
        <button className="comps-search" type="submit" disabled={loading}>
          {loading ? "Buscando…" : "Buscar comparables"}
        </button>
      </form>

      {error && <p className="comps-error" role="alert">{error}</p>}

      {loading && (
        <div className="comps-loading" role="status">
          <span className="comps-spin" aria-hidden="true">✦</span>
          Buscando propiedades parecidas…
        </div>
      )}

      {result && !loading && (
        <>
          <section className="comps-subject">
            <div className="comps-subject-info">
              <span className="comps-kicker">Propiedad de referencia</span>
              <h2>{result.subject.address || address}</h2>
              <p className="comps-attrs">{resumenAtributos(result.subject) || "Sin datos de la propiedad"}</p>
              {result.subject.zestimate && (
                <p className="comps-zest">Zestimate: {formatMoney(result.subject.zestimate)}</p>
              )}
            </div>
            {result.arv_suggestion && (
              <div className="comps-arv">
                <span className="comps-arv-label">ARV sugerido por comps</span>
                <strong className="comps-arv-value">{formatMoney(result.arv_suggestion)}</strong>
                <small>Mediana de precio/ft² de las vendidas × ft² de la propiedad. Es una estimación: revisá los comps.</small>
                {onUsarArv && (
                  <button type="button" className="comps-usar-arv"
                    onClick={() => onUsarArv(result.arv_suggestion)}>
                    Usar este ARV en el deal
                  </button>
                )}
              </div>
            )}
          </section>

          {result.relaxed && (
            <p className="comps-relaxed">
              No había suficientes con las condiciones exactas: mostramos las más parecidas.
            </p>
          )}
          <p className="comps-count">
            {result.comps.length} {result.comps.length === 1 ? "comparable" : "comparables"}
            {" · "}{result.counts.sold || 0} vendidas · {result.counts.for_sale || 0} en venta
          </p>

          {result.comps.length === 0 ? (
            <div className="comps-empty">
              No se encontraron comparables. Ampliá el radio o aflojá los filtros.
            </div>
          ) : (
            <div className="comps-grid">
              {result.comps.map((c) => {
                const e = etiquetaEstado(c.status);
                return (
                  <article className="comps-card" key={c.zpid}>
                    <div className="comps-thumb">
                      {c.image
                        ? <img src={c.image} alt="" loading="lazy" referrerPolicy="no-referrer" />
                        : <span className="comps-noimg" aria-hidden="true">🏠</span>}
                      <span className={"comps-chip " + e.cls}>{e.txt}</span>
                    </div>
                    <div className="comps-card-body">
                      <div className="comps-card-head">
                        <strong className="comps-price">{c.price ? formatMoney(c.price) : "Consultar"}</strong>
                        {c.distance_mi != null && <span className="comps-dist">{c.distance_mi} mi</span>}
                      </div>
                      <p className="comps-attrs">{resumenAtributos(c) || "—"}</p>
                      <div className="comps-card-foot">
                        {c.price_per_sqft && <span>{formatMoney(c.price_per_sqft)}/ft²</span>}
                        {c.status === "sold" && c.date_sold && <span>Vendida {fechaVenta(c.date_sold)}</span>}
                      </div>
                      <span className="comps-addr">{c.address}</span>
                      <a className="comps-link" href={c.url} target="_blank" rel="noopener noreferrer">
                        Ver en Zillow <span aria-hidden="true">↗</span>
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {!result && !loading && !error && (
        <div className="comps-empty comps-empty-start">
          {esDireccionPlausible(address) ? (
            <>Tocá <b>“Buscar comparables”</b> para ver propiedades parecidas.</>
          ) : (
            <>Abrí un deal con una <b>dirección real</b> (importá de Zillow o escribila arriba) para ver comparables.</>
          )}
        </div>
      )}
    </main>
  );
}
