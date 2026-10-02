// Anima un numero entre el valor anterior y el nuevo (tween con easeOutCubic).
// Es SOLO display: el valor final sigue siendo el de la API. Lo usa el monto
// de dinero atrapado para que cambie suave al recalcular.

import { useEffect, useRef, useState } from "react";

export function useAnimatedNumber(target, duration = 520) {
  const destino = Number(target) || 0;
  const [valor, setValor] = useState(destino);
  const actual = useRef(destino); // ultimo valor mostrado
  const raf = useRef(0);

  useEffect(() => {
    const desde = actual.current;
    if (desde === destino) {
      actual.current = destino;
      setValor(destino);
      return;
    }
    const inicio = performance.now();
    cancelAnimationFrame(raf.current);
    const paso = (ahora) => {
      const t = Math.min(1, (ahora - inicio) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const v = desde + (destino - desde) * eased;
      actual.current = v;
      setValor(v);
      if (t < 1) raf.current = requestAnimationFrame(paso);
    };
    raf.current = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf.current);
  }, [destino, duration]);

  return valor;
}
