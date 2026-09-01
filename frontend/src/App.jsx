// Cascaron de la app. El frontend NO hace aritmetica (regla 4): arma el
// formulario, manda los datos a la API y muestra tal cual lo que devuelve.
// Los montos llegan como string y se muestran como string.

export default function App() {
  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 640, margin: "2rem auto" }}>
      <h1>Calculadora BRRRR</h1>
      <p>
        Andamiaje inicial. Falta el formulario del deal y la vista de
        resultados; se conectan a <code>POST /deals/evaluate</code> una vez que
        el calculo este implementado.
      </p>
    </main>
  );
}
