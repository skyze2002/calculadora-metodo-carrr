// Buscador de básicos: independiente del precio, rehab y gastos de las casas.

import { useEffect, useRef, useState } from "react";
import { searchRehabProducts } from "../api.js";
import { INITIAL_PRODUCT_SEARCH, PRODUCT_CATEGORIES, PRODUCT_MARKETS, productPrice, validateProductSearch } from "../rehabProducts.js";
import "../rehabProducts.css";

function ProductIcon({ category, size = 26 }) {
  const shapes = {
    mirrors: <><circle cx="12" cy="10" r="7" /><path d="M12 17v4m-4 0h8M9 8l3-3" /></>,
    lighting: <><path d="M8 16c0-2-3-3-3-7a7 7 0 0 1 14 0c0 4-3 5-3 7H8Zm1 3h6m-5 3h4" /><path d="M12 5v4m-3-2 3 2 3-2" /></>,
    faucets: <><path d="M4 21h16M9 21V10h7a4 4 0 0 1 4 4v2h-4v-2h-3v7M6 6h10m-5-3v7" /></>,
    handles: <><path d="M5 7h14v10H5zM8 10h8v4H8z" /><circle cx="3" cy="12" r="1" /><circle cx="21" cy="12" r="1" /></>,
    bathroom: <><path d="M4 6h16M6 6v14h12V6M9 10v7m3-7v7m3-7v7" /></>,
    other: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><path d="M17 14v6m-3-3h6" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[category] ?? shapes.other}</svg>;
}

export default function RehabProducts({ hidden }) {
  const [form, setForm] = useState(() => ({ ...INITIAL_PRODUCT_SEARCH }));
  const [result, setResult] = useState(null);
  const [searched, setSearched] = useState(null);
  const [error, setError] = useState(null);
  const [searching, setSearching] = useState(false);
  const controller = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);
  const category = PRODUCT_CATEGORIES.find((item) => item.id === form.category);
  const market = PRODUCT_MARKETS.find((item) => item.country === form.country);
  const change = (key, value) => { setForm((previous) => ({ ...previous, [key]: value })); setError(null); };

  async function submit(event) {
    event.preventDefault();
    setError(null);
    let payload;
    try { payload = validateProductSearch(form); } catch (err) { setError(err.message); return; }
    const request = new AbortController();
    controller.current = request;
    setSearching(true);
    setResult(null);
    setSearched(payload);
    const timeout = setTimeout(() => request.abort("timeout"), 180000);
    try {
      const response = await searchRehabProducts(payload, { signal: request.signal });
      if (!request.signal.aborted) setResult(response);
    } catch (err) {
      if (request.signal.aborted) {
        setError(request.signal.reason === "timeout" ? "La búsqueda tardó demasiado. Intentá nuevamente." : "Búsqueda cancelada.");
      } else setError(err.message);
    } finally {
      clearTimeout(timeout);
      setSearching(false);
      controller.current = null;
    }
  }

  const resultCategory = PRODUCT_CATEGORIES.find((item) => item.id === searched?.category);
  const resultMarket = PRODUCT_MARKETS.find((item) => item.country === searched?.country);
  return (
    <main className="products-view" hidden={hidden}>
      <div className="products-heading">
        <div><span className="products-kicker">Compras inteligentes para el rehab</span>
          <h1>Pequeños cambios.<br /><span>Mejores precios.</span></h1>
          <p>Buscá básicos económicos {form.country === "US" ? "en Estados Unidos " : ""}para renovar una casa, sin tocar sus números originales.</p>
        </div>
        <span className="products-ai-badge"><span aria-hidden="true">✦</span> IA + búsqueda web</span>
      </div>
      <div className="products-categories" role="group" aria-label="Tipo de producto">
        {PRODUCT_CATEGORIES.map((item) => <button key={item.id} type="button" aria-pressed={form.category === item.id}
          disabled={searching} className={"products-category" + (form.category === item.id ? " selected" : "")}
          onClick={() => change("category", item.id)}>
          <ProductIcon category={item.id} /><strong>{item.label}</strong><small>{item.hint}</small>
        </button>)}
      </div>
      <div className="products-workspace">
        <form className="products-card products-form" onSubmit={submit} noValidate>
          <div className="products-form-title"><ProductIcon category={form.category} /><h2>Buscá {category.label.toLowerCase()}</h2></div>
          <fieldset disabled={searching}>
            <label className="field"><span className="field-label">País de compra *</span>
              <select value={form.country} onChange={(event) => { setForm((previous) => ({ ...previous, country: event.target.value, budget: "" })); setError(null); }}>
                <option value="">Elegí dónde comprarías</option>
                {PRODUCT_MARKETS.map((item) => <option key={item.country} value={item.country}>{item.label} · {item.currency}</option>)}
              </select>
            </label>
            <label className="field"><span className="field-label">Ciudad (opcional)</span>
              <input value={form.city} maxLength={80} placeholder="Ej. Miami" onChange={(event) => change("city", event.target.value)} />
            </label>
            <label className="field"><span className="field-label">Estado (opcional)</span>
              <input value={form.region} maxLength={80} placeholder="Ej. Florida" onChange={(event) => change("region", event.target.value)} />
            </label>
            <label className="field"><span className="field-label">Máximo por producto {market ? `(${market.currency})` : ""} (opcional)</span>
              <input inputMode="decimal" value={form.budget} placeholder="Sin límite si lo dejás vacío" onChange={(event) => change("budget", event.target.value)} />
              <span className="field-help">Sin separador de miles. Tope del artículo o paquete, sin envío.</span>
            </label>
            <label className="field"><span className="field-label">¿Qué estás buscando? (opcional)</span>
              <textarea rows={3} maxLength={400} value={form.details} placeholder={category.example} onChange={(event) => change("details", event.target.value)} />
              <span className="field-help">Medida, color o tipo. No hace falta la dirección de la casa.</span>
            </label>
          </fieldset>
          <button className="products-search" type="submit" disabled={searching}>
            <span aria-hidden="true">✦</span> {searching ? "Buscando en la web…" : "Buscar opciones económicas"}
          </button>
          {searching && <button className="products-cancel" type="button" onClick={() => controller.current?.abort()}>Cancelar búsqueda</button>}
          <p className="products-privacy">Se envían sólo los filtros de esta búsqueda a la IA. No se envían tus deals ni gastos.</p>
          {error && <p className="products-error" role="alert">{error}</p>}
        </form>
        <section className="products-results" aria-label="Resultados de productos" aria-busy={searching}>
          {searching ? <div className="products-card products-empty" role="status">
            <span className="products-empty-icon products-searching" aria-hidden="true">✦</span>
            <h2>Buscando opciones para tu rehab</h2><p>La IA consulta la web y organiza productos con sus fuentes. Puede tardar alrededor de un minuto.</p>
          </div> : result ? <>
            <div className="products-results-heading"><div><span className="products-kicker">{resultMarket.label} · {result.currency}</span>
              <h2>{resultCategory.label}: {result.products.length} {result.products.length === 1 ? "opción" : "opciones"}</h2></div></div>
            <p className="products-result-note">{result.message}</p>
            <p className="products-search-context">Búsqueda: {searched.details || resultCategory.hint}{searched.city ? ` · ${searched.city}` : ""}{searched.region ? ` · ${searched.region}` : ""}{searched.budget ? ` · Tope ${result.currency} ${searched.budget}` : " · Sin tope de precio"}</p>
            {result.products.length === 0 ? <div className="products-card products-empty"><ProductIcon category={searched.category} size={40} />
              <h3>No hay coincidencias respaldadas</h3><p>Probá otra medida o un presupuesto más amplio.</p></div> :
              <div className="products-result-grid">{result.products.map((product) => <article className="products-card products-item" key={product.url}>
                <div className="products-thumb">
                  {product.image
                    ? <img src={product.image} alt="" loading="lazy" referrerPolicy="no-referrer" />
                    : <ProductIcon category={searched.category} size={38} />}
                </div>
                <div className="products-item-body">
                  <div className="products-item-head">
                    <span className="products-store">{product.store.split(/\s[–—-]\s/)[0]}</span>
                    {product.rating != null && <span className="products-rating">★ {product.rating.toFixed(1)}</span>}
                  </div>
                  <h3>{product.title}</h3>
                  <div className="products-item-foot">
                    <strong className="products-price">{productPrice(product)}</strong>
                    {product.delivery && <span className="products-delivery">{product.delivery}</span>}
                  </div>
                  <a className="products-store-link" href={product.url} target="_blank" rel="noopener noreferrer">Ver en la tienda <span aria-hidden="true">↗</span></a>
                </div>
              </article>)}</div>}
            <p className="products-disclaimer">Consultado el {new Date(result.searched_at).toLocaleString("es")}. Precios, stock y envío pueden cambiar. Revisá medidas, formato de venta, compatibilidad y total en la tienda antes de comprar.</p>
          </> : <div className="products-card products-empty">
            <div className="products-empty-icon"><ProductIcon category={form.category} size={40} /></div>
            <span className="products-kicker">Básicos, no grandes obras</span><h2>Encontrá ese detalle<br />que le falta a la casa</h2>
            <p>Elegí una categoría, indicá el país y dejá que la IA busque opciones económicas con enlaces a las tiendas.</p>
            <div className="products-empty-features"><span>01 · Precio publicado</span><span>02 · Enlace de la tienda</span><span>03 · Envío por confirmar</span></div>
            <small>No se realiza ninguna compra ni se registra un gasto automáticamente.</small>
          </div>}
        </section>
      </div>
    </main>
  );
}
