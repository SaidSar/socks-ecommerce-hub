# Infraestructura de SOKKO en Azure

`main.bicep` despliega la API y lo que necesita dentro de un grupo de recursos que ya existe, `rg-sokko-prod`, en `westus`. No crea el grupo, y todas sus asignaciones de roles son sobre recursos de ese grupo. La tienda y el panel van en Vercel (ver abajo).

La suscripción (Azure for Students), sus regiones permitidas y el MFA obligatorio están en [`docs/infra/AZURE.md`](../docs/infra/AZURE.md).

**Estado:** los recursos ya existen en `rg-sokko-prod` (`westus`). La API se publica con el workflow `deploy.yml`.

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

El workflow se activa con una variable **de repositorio** (*Settings → Secrets and variables → Actions → Variables*), no de ambiente:

| Variable | Valor |
|---|---|
| `DEPLOY_ENABLED` | `true` |

Tiene que ser del repositorio porque el `if` del job se evalúa antes de cargar el ambiente, y ahí las variables de `production` todavía no existen. Sin ella, o con otro valor, el job se salta y no falla.

Además, el ambiente `production` (*Settings → Environments*) lleva estas variables, que usan los pasos. No son secretos: el workflow entra por OIDC.

| Variable | De dónde sale |
|---|---|
| `AZURE_CLIENT_ID` | salida `deployerClientId` |
| `AZURE_TENANT_ID` | `az account show --query tenantId` |
| `AZURE_SUBSCRIPTION_ID` | `az account show --query id` |
| `API_NAME` | salida `apiName` |
| `API_URL` | salida `apiUrl` |
| `SQL_SERVER_FQDN` | salida `sqlServerFqdn` |

### Subject de OIDC

La credencial federada de `id-sokko-deploy` acepta un solo *subject*, que debe coincidir exactamente con el que manda GitHub (parámetro `githubOidcSubject`):

```
repo:SaidSar@159501332/socks-ecommerce-hub@1420135878:environment:production
```

No es el formato corto (`repo:SaidSar/socks-ecommerce-hub:...`): este repositorio manda el subject con el ID numérico del dueño (`159501332`) y del repositorio (`1420135878`). Así, si alguien renombra la cuenta o el repositorio, o crea otro con el mismo nombre, su token no sirve para desplegar. Con el formato corto, `azure/login` falla con `AADSTS700213` (no hay credencial que coincida). Si el repositorio cambia de dueño o se vuelve a crear, cambian los ID: copie el subject nuevo del error de `azure/login` y actualice el parámetro.

El workflow corre solo después de que CI pasa en un push a `main`. También se puede lanzar a mano, solo desde `main`:

```bash
gh workflow run deploy.yml --ref main
```

## Carga inicial de producción (bootstrap)

Producción no lleva la semilla de Development. Después del primer despliegue, desde una máquina con `az login` (con MFA) y una regla de firewall temporal con su IP:

```bash
cd apps/api-service
ASPNETCORE_ENVIRONMENT=Production \
ConnectionStrings__Sokko="Server=tcp:<sqlServerFqdn>,1433;Database=Sokko;Authentication=Active Directory Default;Encrypt=True" \
dotnet run -c Release -- bootstrap
```

Sobre una publicación ya compilada es `dotnet Sokko.Api.dll bootstrap`. El comando:

- **Catálogo:** carga los 24 productos y 120 variantes de `DevelopmentSeed`, con su stock inicial y su kárdex (`InventarioInicial`). Es el mismo código que la semilla de Development.
- **Cuentas:** crea al Dueño (pregunta su correo y nombre), a `daniel@sokko.mx` y `kevin@sokko.mx` (Operaciones) y a `cliente@sokko.mx` ("Cliente Demo", cliente de la tienda).
- **Contraseñas:** las pide en la terminal, sin eco, y no las escribe en ningún lado. Siguen la política de la API: 8 caracteres o más, con mayúsculas, minúsculas y un número. La del Dueño necesita además 12 caracteres o más.
- **Lo que no hace:** no crea pedidos ni las cuentas demo de Development.
- **Es idempotente:** correrlo otra vez no duplica productos y no cambia la contraseña ni el rol de una cuenta que ya existe. Solo vuelve a preguntar el correo del Dueño.

Al terminar, borre la regla de firewall temporal.

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
