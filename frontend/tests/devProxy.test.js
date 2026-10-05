import test from "node:test";
import assert from "node:assert/strict";
import { createDevApiProxy } from "../devProxy.js";

const productionUrl = "https://backend.example";

test("la vista previa usa el backend publicado con la llave de app, no la de OpenAI", () => {
  const proxy = createDevApiProxy({ productionUrl, appKey: "test-app-key" });
  assert.equal(proxy.target, productionUrl);
  assert.deepEqual(proxy.headers, { "X-App-Key": "test-app-key" });
  assert.equal(proxy.changeOrigin, true);
  assert.equal(proxy.proxyTimeout, 180000);
});

test("el override permite probar localmente sin reenviar la llave a otro servidor", () => {
  const proxy = createDevApiProxy({ productionUrl, appKey: "test-app-key", override: "http://localhost:8001" });
  assert.equal(proxy.target, "http://localhost:8001");
  assert.equal(proxy.headers, undefined);
});

test("sin configuración remota sigue funcionando el backend local", () => {
  assert.equal(createDevApiProxy().target, "http://localhost:8000");
});

test("sólo se aceptan URLs HTTP y no se admiten credenciales dentro del enlace", () => {
  assert.throws(() => createDevApiProxy({ override: "file:///etc/passwd" }));
  assert.throws(() => createDevApiProxy({ override: "https://user:password@backend.example" }));
});
