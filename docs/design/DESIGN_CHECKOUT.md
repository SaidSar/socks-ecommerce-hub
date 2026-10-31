# DESIGN_CHECKOUT.md — Checkout y pedidos · SOKKO (ソッコ)

> **Propósito:** definir las pantallas y el contrato de `/checkout`, `/checkout/confirmacion/{folio}` y "Mis pedidos".
> **Hereda:** tokens y reglas de `DESIGN.md` §1 y §4.4; biombo, campos y tono de voz (usted) de `DESIGN_AUTH.md` §2, §4 y §5; reglas de datos de `DESIGN_DB.md` §3.8–§3.10, §4 y §4.1.
> **Estado:** ✅ Implementado con pasarela simulada. Falta elegir la pasarela real (§6.3).

---

## 1. Rutas

| Ruta | Vista | Acceso |
|---|---|---|
| `/checkout` | Datos, entrega, pago y resumen | Invitado o sesión. Con la bolsa vacía muestra el estado vacío (§3.7) |
| `/checkout/confirmacion/:folio` | Pedido confirmado | Su dueño, o el invitado que acaba de comprar (folio + correo guardados en la pestaña) |
| `/cuenta/pedidos` | Mis pedidos | Solo con sesión; sin ella va a `/cuenta?redirect=/cuenta/pedidos` |

El botón "Proceder al Pago Seguro" de la bolsa cierra el panel y lleva a `/checkout`. El menú de cuenta enlaza "Mis pedidos", y la bienvenida muestra el número real de pedidos.

---

## 2. Composición (biombo de dos hojas)

```text
CheckoutLayout  grid lg:[7fr_5fr], min-h-screen
├── main (linen-tex)
│   ├── barra: Logo → "/" · "← Volver a la tienda"
│   ├── eyebrow + h1
│   └── formulario, columna max-w-[620px]
└── aside "Su pedido" (bg-sand linen-tex, sticky en lg)
    └── kanji de fondo 包 (ink/5 %, aria-hidden), líneas, furoshiki y totales
```

- En móvil el resumen va **después** del formulario y el botón de pago queda al final de la página.
- Sin encabezado de líneas ni pie de la tienda: el biombo concentra la compra, igual que el acceso.
- **Regla del rojo:** `laca` solo en el botón de pago, los errores y el sello de confirmación. Los totales van en `ink`.
- Esquinas rectas, sin sombras; campos con línea inferior (`AuthField`); etiquetas en versalitas; radios con `accent-matcha`.
- Tono: usted, frases cortas, sin tecnicismos de pago.

---

## 3. `/checkout`

Eyebrow "Último paso" · H1 "Complete su pedido".

### 3.1 Sesión

- **Invitado:** bajo el H1, "¿Ya tiene cuenta? [Iniciar sesión]" → `/cuenta?redirect=/checkout`. No es obligatorio.
- **Con sesión:** nombre, apellido y correo se prellenan y se pueden editar; el texto dice "Comprando como {nombre}". La dirección no se guarda en v1 (no hay tabla de direcciones): se captura en cada compra.

### 3.2 Secciones del formulario

| # | Título | Campos (P-05) |
|---|---|---|
| 1 | Sus datos | Nombre · Apellido · Correo electrónico (hint "Aquí recibirá la confirmación de su pedido.") · Teléfono (hint "10 dígitos, para coordinar la entrega.") |
| 2 | Dirección de entrega | Calle y número · Colonia · Código postal · Ciudad · Estado · Referencias, opcional (hint "Entre calles, color de la casa.") |
| 3 | Método de entrega | Se calcula con el CP; no se elige (§3.3) |
| 4 | Forma de pago | Radios "Tarjeta" y "OXXO Pay" (§3.4) |

El furoshiki se marca en el resumen, con el mismo texto de la bolsa: "Envolver en furoshiki de lino reutilizable" / "Sin costo. Sin plásticos; el paño sirve después como pañuelo o bolsa." Es verdadero por defecto y comparte el valor de la bolsa.

### 3.3 Cotización por CP en vivo

Al completar 5 dígitos se llama a `POST /api/shipping/quote` con el subtotal de la bolsa. La sección 3 y el resumen se actualizan.

| Estado | Texto de la sección |
|---|---|
| Sin CP | "Escriba su código postal para calcular la entrega." |
| Cotizando | "Calculando su entrega…" |
| Local, con costo | **Entrega local** "Los Mochis y ejidos vecinos, con repartidor." · $49.00 |
| Local, gratis | **Entrega local** "Los Mochis y ejidos vecinos, con repartidor." · Cortesía |
| Paquetería, con costo | **Paquetería** "A cualquier punto de México." · $99.00 |
| Paquetería, gratis | **Paquetería** "A cualquier punto de México." · Cortesía |
| Falla la cotización | "No pudimos calcular la entrega. Se confirmará al pagar." El pago no se bloquea: el servidor siempre recalcula |

Mientras no haya cotización, el resumen muestra el envío como "—" y el total sin envío.

### 3.4 Forma de pago

- **Tarjeta:** Número de tarjeta · Nombre en la tarjeta · Vencimiento (MM/AA) · CVC.
- **OXXO Pay:** "Le daremos una referencia para pagar en cualquier OXXO. Tiene 72 horas; después el pedido se cancela y las piezas vuelven al atelier."
- **Aviso de pasarela simulada,** visible siempre sobre los campos de tarjeta: "Modo de prueba: no escriba los datos de una tarjeta real."

**El número de tarjeta nunca llega al servidor.** El navegador lo cambia por un token (`services/paymentToken.js`), como hará el SDK de una pasarela real.

| Número de prueba | Resultado | Token |
|---|---|---|
| `4242 4242 4242 4242` y cualquier otro válido | Aprobada | `tok_fake_approved` |
| `4000 0000 0000 0002` | Rechazada | `tok_fake_declined` |
| `4000 0000 0000 9995` | Fondos insuficientes | `tok_fake_insufficient_funds` |

### 3.5 Resumen

- Líneas: ilustración, nombre, unidad, "{color} · {talla}", cantidad e importe. Los descuentos de temporada (R-29) muestran el precio anterior tachado.
- Totales: Subtotal · Envío · IVA incluido (16 %) · **Total** MXN. El IVA es informativo: `total − total / (1 + tasa)`.
- Botón: "Pagar {total}" con Tarjeta, "Generar referencia OXXO" con OXXO Pay. Cargando: "Procesando su pago…" o "Generando su referencia…".
- Bajo el botón: "Al confirmar acepta los términos y el aviso de privacidad."

### 3.6 Validación y errores (mensajes exactos)

| Caso | Mensaje |
|---|---|
| Nombre / Apellido vacío | Escriba su nombre. / Escriba su apellido. |
| Correo vacío / inválido | Escriba su correo electrónico. / Revise el formato del correo, por ejemplo nombre@dominio.com. |
| Teléfono | Escriba un teléfono de 10 dígitos. |
| Calle / Colonia / Ciudad / Estado | Escriba la calle y el número. / Escriba la colonia. / Escriba la ciudad. / Escriba el estado. |
| CP | El código postal debe tener 5 dígitos. |
| Número de tarjeta | Revise el número de la tarjeta. |
| Nombre en la tarjeta | Escriba el nombre como aparece en la tarjeta. |
| Vencimiento | Revise el vencimiento, por ejemplo 08/29. |
| CVC | Revise el código de seguridad. |
| Más de un error | Hay {n} campos por revisar. |
| Tarjeta rechazada (`402`) | Su banco rechazó la tarjeta. Pruebe con otra o elija OXXO Pay. |
| Fondos insuficientes (`402`) | La tarjeta no tiene fondos suficientes. Pruebe con otra o elija OXXO Pay. |
| Sin existencias (`409`) | Por línea: "{nombre}: {solo quedan n \| ya no hay piezas}". Botón "Ajustar mi bolsa" |
| Precio cambió (`409`) | El total de su pedido cambió a {total}. Revíselo y confirme de nuevo. |
| Red o `5xx` | No pudimos conectar con el atelier. Intente de nuevo en un momento. |
| Demasiados intentos (`429`) | Demasiados intentos. Espere un momento e inténtelo de nuevo. |

- Se valida al enviar, y el correo también al salir del campo. Al editar un campo se limpia su error.
- Al fallar: `shake`, foco al primer campo con error y alerta con `role="alert"`.
- El botón no se deshabilita mientras carga: conserva el foco e ignora clics repetidos. Cada intento lleva su `Idempotency-Key`, y se conserva al reintentar el mismo pedido.
- La bolsa **solo se vacía al confirmar**. Con un rechazo o sin existencias se queda igual, salvo que el cliente pulse "Ajustar mi bolsa".

### 3.7 Bolsa vacía

Kanji 空 · "Su bolsa aún está vacía" · "Elija una pieza en el atelier." · botón "Volver al atelier". Tras confirmar no se muestra: se navega antes a la confirmación.

---

## 4. `/checkout/confirmacion/:folio`

Sello cuadrado de `DESIGN_AUTH` §4.5 con 済 (pagado) o 待 (por pagar). Enfoca el H1 al cargar.

| | Tarjeta (pagada) | OXXO Pay (pendiente) |
|---|---|---|
| Eyebrow | Pedido confirmado | Pedido apartado |
| H1 | Gracias, *{nombre}*. | Falta un paso, *{nombre}*. |
| Texto | "Su pago se registró. Prepararemos su pedido en el atelier." | "Pague en cualquier OXXO con esta referencia. Sus piezas quedan apartadas hasta el {fecha y hora}." |
| Bloque | Folio | Folio · Referencia en cifras grandes · Total a pagar · Vence |

- OXXO pagado después: se muestra como Tarjeta. OXXO vencido: eyebrow "Pedido cancelado", H1 "Este pedido venció.", texto "La referencia ya no es válida y las piezas volvieron al atelier."
- Debajo: líneas, dirección, método de entrega, furoshiki y totales con IVA incluido.
- Botones: "Volver al atelier" y, con sesión, "Ver mis pedidos". No se promete un correo: todavía no hay proveedor. El texto de apoyo es "Guarde su folio para consultar el pedido."
- Sin acceso o sin datos: "No encontramos este pedido." con "Volver al atelier". El `404` no distingue un folio inexistente de uno ajeno.
- **Solo en Development,** con OXXO pendiente: botón "Simular pago en OXXO".

---

## 5. Mis pedidos (`/cuenta/pedidos`)

Usa el biombo de `AuthLayout` con el panel de bienvenida. Eyebrow "Su cuenta" · H1 "Mis pedidos".

- Cada pedido, del más reciente al más antiguo: folio, fecha, estado, número de piezas, total y enlace "Ver detalle" a la confirmación.
- Estado (etiquetas de `DESIGN_DB` §1.6), con prioridad para el pago: "OXXO por pagar" si está pendiente; si no, Por preparar · Preparando · Enviado · En ruta local · Entregado · Cancelado.
- Vacío: kanji 空 · "Aún no tiene pedidos" · "Cuando compre, los verá aquí." · "Volver al atelier".
- Error: "No pudimos cargar sus pedidos." con "Reintentar". Un `401` cierra la sesión.

---

## 6. Contrato de la API

Errores con `ProblemDetails`. Los códigos de enum son los de `DESIGN_DB` §1.6.

### 6.1 `POST /api/orders`

Invitado o `Authorization: Bearer`. Encabezado `Idempotency-Key` (opcional, hasta 64 caracteres; la tienda siempre lo envía).

```json
{
  "firstName": "Ana", "lastName": "López", "email": "ana@correo.mx", "phone": "6681234567",
  "street": "Blvd. Rosales 100", "neighborhood": "Centro", "city": "Los Mochis", "state": "Sinaloa",
  "postalCode": "81200", "references": null, "giftWrap": true,
  "paymentMethod": "tarjeta", "paymentToken": "tok_fake_approved", "expectedTotal": 468.00,
  "items": [{ "sku": "SKK-007-SUM-M", "quantity": 1 }]
}
```

| Código | Cuándo | Cuerpo |
|---|---|---|
| `201` | Pedido creado, o repetición con la misma llave y los mismos datos (`Idempotency-Replayed: true`) | El pedido (§6.2) |
| `400` | Validación | `errors` por campo |
| `401` | Trae `Authorization` pero el token no vale: no se compra como invitado por una sesión vencida | — |
| `402` | Tarjeta rechazada; se revierte todo | `declineCode`: `declined`, `insufficient_funds` |
| `409` | Sin existencias | `code: "out_of_stock"`, `lines: [{ sku, requested, available, message }]` |
| `409` | `expectedTotal` no coincide | `code: "price_changed"`, `total`: el del servidor |
| `422` | Misma llave con otros datos | — |
| `429` | Límite de intentos | — |

- **El servidor recalcula todo** (R-13): precio con R-29, envío con `IQuoteShipping`, IVA de `Settings`. `expectedTotal` nunca se cobra: solo evita cobrar algo distinto de lo que el cliente vio.
- Un SKU repetido se suma en una línea. Un SKU inexistente o inactivo cuenta como sin existencias.

### 6.2 Consulta

- `GET /api/orders/{folio}`: con Bearer, solo si es del usuario. Invitado: encabezado `X-Customer-Email` (no va en la URL) y pedido sin usuario. En cualquier otro caso, `404`. Tiene límite de intentos por IP, porque los folios son consecutivos.
- `GET /api/orders/mine` (Bearer): los últimos 50 pedidos.
- `POST /api/orders/{folio}/oxxo/simulate-payment`: solo en Development; en otro ambiente, `404`.
- **Pedido:** `folio, status, paymentMethod, paymentStatus, paymentReference, oxxoExpiresAt, paidAt, deliveryMethod, firstName, lastName, email, phone, street, neighborhood, city, state, postalCode, references, giftWrap, subtotal, shippingCost, total, taxRate, taxIncluded, createdAt, items[{ sku, name, color, size, quantity, unitPrice, lineTotal }], timeline[{ status, at }]`. Nunca lleva `InternalNote` ni costos.

### 6.3 Transacción y pasarela

`ICheckoutOrder`, en una sola transacción (`DESIGN_DB` §4.1): aparta en orden ascendente de `VariantId` → crea el pedido con el folio → cobra → escribe el historial → confirma. Si el pago falla, `ROLLBACK`: nada queda apartado.

- `IPaymentGateway.ChargeAsync` recibe método, importe, token y una llave de idempotencia; `VoidAsync` anula un cobro aprobado si la confirmación en BD falla. Una pasarela real se conecta implementando esta interfaz, sin tocar `CheckoutOrder`.
- **Pendiente con una pasarela real:** cobrar dentro de la transacción retiene los bloqueos durante la llamada de red. Conviene separar autorización y captura al conectarla.

### 6.4 Vencimiento de OXXO (P-03)

`OxxoExpiryJob` (`BackgroundService`) cancela cada `Orders:OxxoExpiryCheckMinutes` (5) los pedidos OXXO sin pagar con más de `Orders:OxxoExpiryHours` (72) horas, usando `IClock`. Libera lo apartado (R-10) y escribe el historial con la nota "Referencia OXXO vencida". Cada pedido va en su propia transacción, y la cancelación se condiciona a que siga sin pagar, así que no choca con un pago simultáneo. P-03 sigue por confirmar con el cliente.

### 6.5 Esquema (`DESIGN_DB` v0.4.5)

`Orders.IdempotencyKey VARCHAR(64) NULL` con índice único filtrado y `Orders.IdempotencyHash BINARY(32) NULL` (SHA-256 de los datos del pedido). La referencia OXXO ya tiene columna (`PaymentReference`).

---

## 7. Sin API (mock)

Sin `VITE_API_URL`, `services/orderService.js` simula lo mismo con el catálogo de `catalogSeed.js`: cotización con las zonas 81200–81399, tarjetas de prueba, sin existencias según el stock de la variante, referencia OXXO y pedidos en `localStorage` (`sokko.orders.v1`). El pedido queda ligado al usuario si hay sesión.

---

## 8. Definición de terminado

- [ ] Compra como invitado con tarjeta: pedido `Pagado`, apartado y bolsa vacía.
- [ ] Compra con sesión por OXXO: datos prellenados, referencia, vencimiento y pago simulado.
- [ ] Tarjeta rechazada: mensaje, bolsa intacta y nada apartado.
- [ ] Sin existencias a mitad del checkout: mensaje por línea y "Ajustar mi bolsa".
- [ ] Doble clic: un solo pedido.
- [ ] Dos compras por la última unidad: solo una gana; `Reserved` y el kárdex cuadran.
- [ ] Un OXXO vencido se cancela y libera lo apartado.
- [ ] Mis pedidos muestra los pedidos del usuario y nunca los de otro.
- [ ] Sin errores en consola en los flujos correctos; capturas a 1440 y 390 px en `docs/design/screenshots/checkout/`.
- [ ] Teclado y lector de pantalla: foco visible, errores asociados con `aria-describedby`, objetivos de 44 px.
