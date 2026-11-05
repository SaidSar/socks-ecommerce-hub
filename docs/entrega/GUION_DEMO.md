# Guion de la demostración · SOKKO

Duración objetivo: **12 minutos**. Reparto propuesto por bloque; el equipo lo ajusta.

| Bloque | Tiempo | Quién | Contenido |
|---|---|---|---|
| 0 | 0:00–0:45 | Said | Presentación del equipo, el problema y lo que se va a ver |
| 1 | 0:45–3:45 | Jesús | Tienda como invitado: catálogo, ficha, favoritos, bolsa, cupón, pago y correo |
| 2 | 3:45–5:15 | Lucio | Panel del Dueño: el pedido llega, se prepara y se envía con guía |
| 3 | 5:15–6:00 | Jesús | Tienda: rastreo con la guía |
| 4 | 6:00–7:15 | Carlos | Operaciones: lo que ve y lo que no (sin pesos) |
| 5 | 7:15–10:00 | Lucio | Dueño: Reportes y CSV, Clientes, Mensajes y Promociones |
| 6 | 10:00–12:00 | Said | Cierre técnico: arquitectura, principios SOA, CI/CD y costo $0 |

## Preparación (10 minutos antes)

1. **Despertar la BD.** Abrir https://app-sokko-qifdnnh6tfjpc.azurewebsites.net/api/health y esperar `"status": "OK"`. Azure SQL serverless se pausa sin uso; la primera petición tarda alrededor de un minuto. Después abrir la tienda (https://sokko-tienda.vercel.app) y navegar el catálogo una vez.
2. **Panel con dos sesiones.** Ventana normal: panel (https://sokko-panel.vercel.app) con la cuenta del Dueño. Ventana de incógnito: panel con `daniel@sokko.mx` (Operaciones).
3. **Cupón de demo.** En el panel del Dueño, *Promociones*: crear `DEMO10`, porcentaje 10 %, activo, sin fecha de fin. Verificar que aparezca activo.
4. **Pedido de respaldo ya pagado.** Hacer antes una compra con tarjeta `4242 4242 4242 4242` y dejarla en *Por preparar*. Sirve si la compra en vivo falla y para mostrar Operaciones sin esperar.
5. **Correo abierto.** Un buzón real en otra pestaña para recibir la confirmación del pedido en vivo; usar ese correo en el checkout.
6. **Mensaje de contacto.** Enviar uno desde *Contacto* en la tienda para que la bandeja del panel no esté vacía.
7. **Pestañas listas:** tienda, panel Dueño, panel Operaciones (incógnito), correo, `README.md` del repo (diagrama de arquitectura) y la pestaña *Actions* de GitHub.

## Recorrido

### 1. Tienda como invitado (Jesús, 3:00)

- Home: las cuatro líneas y la estética Kyoto Artisan. Abrir una línea, aplicar un filtro y entrar a una ficha.
- Ficha: galería, talla por sistema, unidad. Agregar a **favoritos** (corazón) y a la **bolsa**.
- Bolsa → checkout como invitado: datos de envío con un CP de Los Mochis (entrega local) para mostrar la cotización.
- Escribir el cupón `DEMO10`: el total baja y lo calcula el servidor.
- Pagar con `4242 4242 4242 4242`. Mostrar la confirmación con el folio `SKK-####`.
- Cambiar a la pestaña del correo: llega la confirmación del pedido.
- *Qué decir:* "El navegador no envía el número de tarjeta; manda un token. La API recalcula precio, cupón y envío, aparta las piezas y cobra en una sola transacción."

### 2. Panel del Dueño (Lucio, 1:30)

- Dashboard: el pedido nuevo aparece en los indicadores.
- *Pedidos* → abrir el folio → **Preparar** → **Enviar**: elegir paquetería y escribir una guía de 10 dígitos (o, si fue entrega local, elegir repartidor y **En ruta**).
- Mostrar el kárdex del SKU en *Inventario*: el movimiento "Venta · Pedido SKK-####" bajó el stock.

### 3. Rastreo (Jesús, 0:45)

- En la tienda, *Rastrear pedido*: folio y correo. Se ve el estado, la paquetería y la guía.

### 4. Operaciones (Carlos, 1:15)

- En la ventana de incógnito: dashboard sin montos, pedidos sin columna Total, inventario con ajustes y kárdex, catálogo de solo lectura sin costos.
- Abrir *Reportes* o *Configuración*: "Esta sección es solo para el Dueño".
- *Qué decir:* "No es solo la interfaz: la API responde 403 a esas rutas y los DTOs de Operaciones no tienen campos de dinero."

### 5. Dueño: gestión (Lucio, 2:45)

- *Reportes*: ventas del periodo y **Exportar CSV** (abrirlo en Excel).
- *Clientes*: buscar al cliente del pedido en vivo (invitado) y ver su historial.
- *Mensajes*: abrir el mensaje de contacto, **Responder por correo** (abre el cliente de correo con la respuesta prellenada) y archivarlo.
- *Promociones*: mostrar `DEMO10` con su uso registrado; desactivarlo.

### 6. Cierre técnico (Said, 2:00)

- **Arquitectura:** diagrama del `README.md`. Un proveedor (API REST en App Service) y dos consumidores (tienda y panel en Vercel); Azure SQL, Blob Storage, Communication Services, Key Vault y Application Insights.
- **Principios SOA:** contrato con DTOs, ProblemDetails y OpenAPI; bajo acoplamiento con interfaces (`IPaymentGateway`, `IEmailSender`, `IImageStorage`); reutilización (una API para dos consumidores); composición (el checkout); servicios de entidad, tarea y utilidad según Erl.
- **CI/CD:** cada PR corre lint, pruebas y build; 1,304 pruebas en verde. Al fusionar, `deploy.yml` entra a Azure por OIDC sin secretos, migra con un *bundle* y publica.
- **Costo $0:** oferta gratuita de Azure SQL con AutoPause, plan B1 en oferta gratuita, tope de Log Analytics y sondeo de salud que no despierta la BD.

## Plan B

| Si falla… | Qué hacer | Qué decir |
|---|---|---|
| La API tarda o responde 500 al inicio | Recargar `/api/health` y esperar un minuto | "La base de datos estaba en pausa para no generar costo; tarda un minuto en despertar." |
| Azure no responde | Abrir un Preview de Vercel con `VITE_USE_MOCKS=true` (o `npm run dev` local sin `VITE_API_URL`) y seguir el mismo recorrido | "La tienda y el panel funcionan con datos simulados detrás de la misma capa de servicios: así probamos el frontend sin depender de la API." |
| No llega el correo | Mostrar el pedido en el panel y seguir | "El correo sale por Azure Communication Services de forma asíncrona; puede tardar." |
| Falla la compra en vivo | Usar el pedido de respaldo preparado | — |
| Falla todo | Capturas de `docs/design/screenshots/` (checkout, cupones, panel por rol) | Recorrer las capturas con el mismo guion |

## Preguntas probables del docente

**¿Por qué REST y no SOAP?** Los dos consumidores son aplicaciones en el navegador; REST con JSON es nativo para ellos, ligero y se documenta con OpenAPI. Las garantías que daría WS-AtomicTransaction no hacen falta: hay una sola base de datos y las transacciones son locales dentro del servicio.

**¿Cómo garantizan que no se cobre dos veces?** Cada compra lleva un encabezado `Idempotency-Key`. Si llega otra vez la misma llave con los mismos datos, la API devuelve el mismo pedido sin cobrar; con otros datos responde 422. La llave también va a la pasarela, y si el pedido no se confirma después de un cobro aprobado, se anula el cobro.

**¿Cómo se protegen los permisos?** En el servidor: cada controlador del panel tiene `[Authorize(Policy = …)]` con 17 permisos, y el rol viaja firmado en el JWT. El panel solo decide qué mostrar; si alguien llama la API directamente sin el permiso recibe 403. Operaciones recibe DTOs sin campos de dinero.

**¿Qué pasa si dos personas compran la última pieza?** Apartar es un `UPDATE` atómico condicionado a que haya disponible (`Stock - Reserved >= cantidad`) y la BD tiene `CHECK Reserved <= Stock`. Solo una de las dos transacciones lo logra; la otra recibe 409 "No hay pares suficientes" y no se le cobra.

**¿Cómo se despliega?** Un PR pasa CI; al fusionarlo a `main`, CI vuelve a correr y, si pasa, `deploy.yml` entra a Azure por OIDC, aplica las migraciones con un bundle de EF Core y publica la API en App Service. Vercel publica la tienda y el panel desde GitHub. La infraestructura está en Bicep (`infra/`).
