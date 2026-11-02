# Infraestructura de SOKKO en Azure

`main.bicep` despliega la API y lo que necesita dentro de un grupo de recursos que ya existe, `rg-sokko-prod`, en `westus`. No crea el grupo, y todas sus asignaciones de roles son sobre recursos de ese grupo. La tienda y el panel van en Vercel (ver abajo).

La suscripción (Azure for Students), sus regiones permitidas y el MFA obligatorio están en [`docs/infra/AZURE.md`](../docs/infra/AZURE.md).

**Estado:** nada de esto se ha desplegado ni probado en Azure. Falta el what-if, la aprobación de costos y la creación de recursos.

## Lo que necesita el dueño de la suscripción

Propietario sobre `rg-sokko-prod` alcanza para desplegar. Los proveedores de recursos ya están registrados (`docs/infra/AZURE.md` §3). La oferta gratuita de Azure SQL depende de la suscripción: si no la admite, se despliega con `useSqlFreeOffer=false`, que tiene costo.

## Despliegue

Pasos previstos, en este orden:

```bash
az deployment group what-if -g rg-sokko-prod -f infra/main.bicep \
  -p sqlAdminLogin="<correo>" sqlAdminObjectId="<object-id>" jwtSigningKey="$(openssl rand -base64 64)"
```

Después de aprobar costos, se repite con `az deployment group create`. Luego, una sola vez, se corre `infra/sql-setup.sql` (los nombres salen de las salidas del despliegue) y se crean las variables de GitHub.

Sin `jwtSigningKey`, un despliegue posterior conserva la clave que ya está en Key Vault.

## GitHub

Crear el ambiente `production` en *Settings → Environments* y, dentro de él, estas variables (no son secretos; el workflow entra por OIDC):

| Variable | De dónde sale |
|---|---|
| `AZURE_CLIENT_ID` | salida `deployerClientId` |
| `AZURE_TENANT_ID` | `az account show --query tenantId` |
| `AZURE_SUBSCRIPTION_ID` | `az account show --query id` |
| `API_NAME` | salida `apiName` |
| `API_URL` | salida `apiUrl` |
| `SQL_SERVER_FQDN` | salida `sqlServerFqdn` |

Sin `AZURE_CLIENT_ID`, el workflow se salta y no falla.

## Tienda y panel en Vercel

Cada app es un proyecto de Vercel conectado a este repositorio:

| Proyecto | Root Directory | URL | Variable de entorno |
|---|---|---|---|
| `sokko-tienda` | `apps/web-store` | `https://sokko-tienda.vercel.app` | `VITE_API_URL` = salida `apiUrl` |
| `sokko-panel` | `apps/admin-panel` | `https://sokko-panel.vercel.app` | `VITE_API_URL` = salida `apiUrl` |

- Framework *Vite*: Vercel corre `npm run build` y publica `dist`. `vercel.json` manda todas las rutas a `index.html` y agrega los encabezados de seguridad.
- La API solo acepta esas dos URLs (`webStoreUrl` y `adminPanelUrl` en el Bicep). Las vistas previas de Vercel tienen otra URL, así que CORS las rechaza. Para probarlas, agregue su URL al parámetro, separada por coma.
- Si cambia la URL de un proyecto, actualice el parámetro y vuelva a desplegar el Bicep.
- **CSP:** `connect-src` permite `https://*.azurewebsites.net`, porque el nombre de la API se conoce hasta desplegar. Cuando exista, conviene cambiarlo por el origen exacto de la API.

## Región

Los recursos van en `westus` (California), aunque el grupo está en `westus2`. En `westus2` la suscripción tiene **cuota 0 de App Service**, para B1 y también para F1: el what-if falla con `Current Limit (B1 VMs): 0`. Las demás regiones permitidas sí tienen cuota, y `westus` es la más cercana a México. La región del grupo no limita la de sus recursos.

## Decisiones que afectan el costo

- **Sondeo de App Service en `/api/health/live`:** no toca la BD, así que la BD puede pausarse. `/api/health` sí la revisa y la despierta; úsela para verificar a mano.
- **Tope de Log Analytics en 0.16 GB al día**, unos 5 GB al mes, que es la ingesta gratuita. Si se llena, se dejan de guardar registros hasta el día siguiente.
- **Vencimiento de OXXO una vez al día:** cada revisión despierta la BD. Un pedido vencido puede cancelarse hasta 24 h después de sus 72 h, y sus piezas siguen apartadas en ese tiempo. Si la API se reinicia, también se revisa al arrancar.

## Puntos sin comprobar

- Que la suscripción admita la oferta gratuita de Azure SQL y que su política permita cada recurso en `westus`. El what-if no lo comprueba; se ve al crear.
- Que los runners de GitHub alcancen Azure SQL con la regla "servicios de Azure". Si no, el paso de migraciones falla y hay que agregar una regla temporal con la IP del runner.
- Que el rol de la identidad del workflow alcance para publicar la API.
