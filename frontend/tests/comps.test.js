import test from "node:test";
import assert from "node:assert/strict";
import {
  esDireccionPlausible,
  mapHomeType,
  resumenAtributos,
  validateCompsResult,
} from "../src/comps.js";

const subject = {
  address: "171 Main St, Lexington, VA",
  url: "https://www.zillow.com/homedetails/x/100_zpid/",
  image: "https://photos.zillowstatic.com/a.jpg",
  beds: 3, baths: 2, sqft: 2000, home_type: "SINGLE_FAMILY", zestimate: "405000",
};
const comp = {
  zpid: "200", address: "200 Oak St", url: "https://www.zillow.com/homedetails/y/200_zpid/",
  image: "https://photos.zillowstatic.com/p.jpg", price: "200000", status: "sold",
  beds: 3, baths: 2, sqft: 1500, price_per_sqft: "133", date_sold: "2026-09-01", distance_mi: 0.4,
};
const result = {
  subject, comps: [comp], relaxed: false, arv_suggestion: "400000",
  message: "ok", counts: { sold: 1, for_sale: 0 },
};

test("una dirección sirve si tiene número y texto", () => {
  assert.ok(esDireccionPlausible("171 Little House Ln, Lexington, VA"));
  assert.ok(!esDireccionPlausible("Casa ejemplo"));
  assert.ok(!esDireccionPlausible(""));
});

test("el resumen de atributos tolera valores faltantes", () => {
  assert.match(resumenAtributos({ beds: 3, baths: 2, sqft: 1500 }), /3 dorm · 2 baños · .*ft²/);
  assert.equal(resumenAtributos({ beds: 3 }), "3 dorm");
  assert.equal(resumenAtributos({}), "");
});

test("mapHomeType traduce el tipo de Zillow al del filtro", () => {
  assert.equal(mapHomeType("SINGLE_FAMILY"), "house");
  assert.equal(mapHomeType("CONDO"), "condo");
  assert.equal(mapHomeType("algo raro"), "");
});

test("validateCompsResult limpia enlaces, dedup y no rompe con foto insegura", () => {
  const v = validateCompsResult(result);
  assert.equal(v.comps[0].url, comp.url);
  assert.equal(v.subject.url, subject.url);
  assert.throws(() => validateCompsResult({ subject, comps: [{ ...comp, url: "javascript:alert(1)" }] }));
  assert.throws(() => validateCompsResult({ subject, comps: "x" }));
  assert.throws(() => validateCompsResult({ subject, comps: [comp, comp] })); // zpid duplicado
  assert.equal(
    validateCompsResult({ subject, comps: [{ ...comp, image: "javascript:x" }] }).comps[0].image,
    null,
  );
});
