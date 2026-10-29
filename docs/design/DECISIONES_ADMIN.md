# Decisiones del panel administrativo — SOKKO

> Respuestas del cliente al cuestionario de alcance del backoffice (19 oct 2026). Base para `DESIGN_ADMIN.md` y para el esquema de SQL Server.

| Tema | Respuesta del cliente | Decisión de diseño |
|---|---|---|
| Roles | Dueño + Operaciones (confirmado) | Dueño: todo. Operaciones: pedidos, envíos e inventario, sin cifras en pesos, catálogo ni configuración. Contabilidad y Atención a clientes quedan fuera de v1 |
| Usuarios iniciales | Dueño y 1–2 ayudantes | Alta de usuarios internos solo por el Dueño; sin registro público |
| Inventario actual | Excel | Importación inicial desde Excel (plantilla SKU, pieza, tono, talla, stock) → movimiento "Inventario inicial" en kárdex; filas con error se omiten y se reportan |
| Facturación | Contador externo, sin CFDI en la tienda | Finanzas: ventas, IVA y envíos por periodo + exportación mensual a Excel. CFDI en P2 |
| Entregas | Paquetería Estafeta/DHL y entrega local | Pedido con `DeliveryMethod` (Paqueteria / Local). Local: estado "En ruta local" con repartidor en lugar de guía |
| Zona local | Los Mochis y ejidos vecinos | Lista configurable de CP/rangos. Semilla: 81200–81299 (Los Mochis) y 81300–81399 (ejidos de Ahome, **por confirmar con el cliente**) |
| Tarifas | Local menor (ej. $49); envío local gratis desde $799 (confirmado) | Configuración: `FreeShippingThreshold` 799 (aplica a local y paquetería), `ParcelShippingCost` 99, `LocalShippingCost` 49 |
| Costo por par | No lo tiene | Sin margen/utilidad en v1; sin "Valor a costo". Campo Costo opcional en Catálogo para habilitar margen después |
| KPI principal | Ventas del día / semana | Dashboard abre en "Hoy", Ventas primero, comparación contra el mismo día de la semana anterior; cola de trabajo en segunda fila (por preparar, en preparación, atrasados, en ruta local) |
