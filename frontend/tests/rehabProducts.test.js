import test from "node:test";
import assert from "node:assert/strict";
import { INITIAL_PRODUCT_SEARCH, PRODUCT_CATEGORIES, PRODUCT_MARKETS, productPrice, safeProductUrl,
  validateProductResults, validateProductSearch } from "../src/rehabProducts.js";

const form = { category: "mirrors", country: "US", city: " Miami ", region: " Florida ", budget: "25,50", details: " Redondo " };
const product = { title: "Espejo de ejemplo", store: "Tienda de ejemplo", price: "25.50", currency: "USD",
  url: "https://tienda.example/espejo", price_note: "Por unidad", shipping_note: "No confirmado", reason: "Medida pedida" };
const result = { products: [product], sources: [{ title: "Fuente", url: product.url }], country: "US",
  currency: "USD", searched_at: "2026-10-03T12:00:00+00:00", message: "Opciones encontradas" };

test("el buscador acepta filtros y presupuesto opcional sin enviar datos de la casa", () => {
  assert.deepEqual(validateProductSearch({ ...form, purchase_price: "100000", payer: "No enviar" }), {
    category: "mirrors", country: "US", city: "Miami", region: "Florida", budget: "25.50", details: "Redondo" });
  assert.equal(validateProductSearch({ ...form, budget: "" }).budget, null);
});

test("el país es obligatorio y no se asume una moneda por la ubicación del usuario", () => {
  assert.throws(() => validateProductSearch({ ...form, country: "" }));
  assert.throws(() => validateProductSearch({ ...form, category: "structural" }));
  assert.equal(PRODUCT_MARKETS.find((item) => item.country === "PE").currency, "PEN");
  assert.ok(PRODUCT_CATEGORIES.some((item) => item.id === "lighting"));
});

test("Estados Unidos es el mercado inicial confirmado y ciudad y estado son opcionales", () => {
  const request = validateProductSearch(INITIAL_PRODUCT_SEARCH);
  assert.equal(request.country, "US");
  assert.equal(PRODUCT_MARKETS.find((item) => item.country === request.country).currency, "USD");
  assert.equal(request.city, "");
  assert.equal(request.region, "");
  assert.throws(() => validateProductSearch({ ...form, region: "a".repeat(81) }));
});

test("presupuestos negativos, cero, con miles o demasiados decimales no se envían", () => {
  for (const budget of ["0", "0,00", "-20", "1.000,50", "1e3", "NaN", "12.345"]) {
    assert.throws(() => validateProductSearch({ ...form, budget }));
  }
});

test("sólo se permiten enlaces públicos web sin credenciales", () => {
  for (const url of ["javascript:alert(1)", "http://127.0.0.1/x", "http://localhost/x", "https://internal/x",
    "https://foo.local/x", "https://u:p@example.com/x", "https://example.com:8000/x", "file:///etc/passwd"]) {
    assert.equal(safeProductUrl(url), null);
  }
  assert.equal(safeProductUrl(product.url), product.url);
});

test("las tarjetas requieren precio string, misma moneda y enlace en las fuentes", () => {
  assert.equal(validateProductResults(result, "US").products[0].price, "25.50");
  assert.throws(() => validateProductResults({ ...result, sources: [] }, "US"));
  assert.throws(() => validateProductResults(result, "PE"));
  for (const price of [25.50, "25,50", "NaN", "0.00", "-20.00"]) {
    assert.throws(() => validateProductResults({ ...result, products: [{ ...product, price }] }, "US"));
  }
  assert.equal(validateProductResults({ ...result, products: [{ ...product, price: null }] }, "US").products[0].price, null);
});

test("un precio ausente no se muestra como oferta gratis y el formato conserva centavos", () => {
  assert.equal(productPrice(product), "USD 25.50");
  assert.equal(productPrice({ ...product, price: "123456789.99" }), "USD 123,456,789.99");
  assert.equal(productPrice({ ...product, currency: "PEN" }), "PEN 25,50");
  assert.equal(productPrice({ ...product, price: null }), "Consultar precio");
});
