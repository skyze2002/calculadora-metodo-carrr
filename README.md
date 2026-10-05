# calculadora-metodo-carrr

## Deals en progreso

El menú **En progreso** permite agregar gastos adicionales a una casa guardada.
Se puede elegir un deal o usar **Registrar gastos** desde la lista de guardados.
El nombre, precio, rehab, ARV y términos del préstamo se copian al iniciar el
seguimiento y quedan fijos. No cambian al modificar el deal en la calculadora.

Cada gasto adicional registra concepto, monto, fecha y categoría (agua, luz,
gas y otros pagos), con **quién pagó**, proveedor y nota opcionales. El historial
permite corregir, eliminar con confirmación y filtrar sólo estos gastos.
Se muestran el costo base (compra + rehab original), los adicionales y la suma
de ambos. Registrar un pago no modifica los montos originales de la casa.

Los seguimientos y pagos anteriores se conservan. Los datos originales faltantes
se toman del deal vinculado si sigue guardado; si no están disponibles, se muestran
como **Sin dato**, sin inventar un precio ni un total. Los pagos anteriores sin
pagador mantienen ese campo vacío.

Los datos quedan guardados en el navegador o dispositivo, sin sincronización en
la nube. Los montos se ingresan sin separador de miles y admiten coma o punto para
los centavos. Un error de guardado se informa y conserva el formulario.

Pruebas del registro de gastos: `cd frontend` y `npm test`. Compilación:
`npm run build`.

## Productos rehab con IA

El menú **Productos rehab** busca básicos económicos: espejos, luces, grifos,
tiradores y accesorios de baño. Empieza en **Estados Unidos / USD**, el mercado
confirmado para esta app. Ciudad, estado, detalle y presupuesto máximo por artículo
o paquete son opcionales. El país puede cambiarse y la moneda depende del país
seleccionado; USD se muestra con formato estadounidense (por ejemplo USD 25.50).
La ciudad y el estado se envían como ubicación aproximada, no como dirección de
la propiedad. Los resultados se ordenan por el precio publicado, no por un
supuesto precio unitario cuando hay paquetes. Envío e instalación no están incluidos
en el tope. No se promete encontrar el menor precio de todo el mercado.

El servidor usa Responses con `web_search` obligatorio y luego extrae los productos
del informe con un esquema validado. Sólo admite enlaces presentes en las fuentes,
precios en la moneda elegida y dentro del tope si se especificó. Los precios sin
confirmar aparecen como **Consultar precio** y se excluyen si hay un tope. La app
no realiza compras, no registra gastos y no cambia los datos originales del deal.

Para activarlo, configurar `OPENAI_API_KEY` en el **backend**, nunca en el frontend.
`OPENAI_PRODUCTS_MODEL` es independiente del análisis de deals y usa
`gpt-4.1-mini` por defecto; el modelo elegido debe soportar Responses, búsqueda web
y salidas estructuradas. Ejecutar `uvicorn api.main:app --reload` en el puerto 8000
y `npm run dev` desde `frontend`. En producción se usa la misma `VITE_API_URL` y
`VITE_APP_KEY` que el resto de la IA. Requiere conexión, saldo API y admite 5 búsquedas
por minuto por IP. Cada búsqueda hace una consulta web y una extracción con IA;
no se envían propiedades ni gastos, sólo los filtros introducidos por el usuario.
Si falta configuración o falla el servicio se muestra un error, sin ofertas ficticias.
Reiniciar o desplegar el backend después de añadir el nuevo endpoint. En desarrollo,
Vite usa el backend de `frontend/.env.production` cuando existe y toma la llave de
app de `frontend/.env.production.local` para el proxy, sin copiar la clave de OpenAI.
La llave sólo se reenvía al backend de producción configurado. Sin esa configuración
usa localhost:8000. Para probar un backend local explícitamente, arrancar Vite con
`DEV_API_PROXY_URL=http://127.0.0.1:8001 npm run dev` (sólo desarrollo).

Pruebas sin llamadas reales ni gasto de API: `.venv/bin/pytest -q` y
`cd frontend` seguido de `npm test`.
