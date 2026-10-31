# Infraestructura de SOKKO en Azure

`main.bicep` despliega dentro de un grupo de recursos que ya existe, `rg-sokko-prod`. No crea el grupo, y todas sus asignaciones de roles son sobre recursos de ese grupo.

**Estado:** nada de esto se ha desplegado ni probado en Azure. Falta el what-if, la aprobación de costos y la creación de recursos.

## Lo que necesita el dueño de la suscripción

Propietario sobre `rg-sokko-prod` alcanza para desplegar, salvo por dos cosas que son de la suscripción:

1. **Proveedores de recursos registrados.** Registrarlos requiere permisos sobre la suscripción:

   ```bash
   for p in Microsoft.Web Microsoft.Sql Microsoft.Communication Microsoft.KeyVault Microsoft.Insights Microsoft.OperationalInsights Microsoft.ManagedIdentity; do az provider register --namespace $p; done
   ```

2. **Oferta gratuita de Azure SQL.** Depende de la suscripción. Si no la admite, se despliega con `useSqlFreeOffer=false`, que tiene costo.

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
| `STORE_SITE_NAME` | salida `storeSiteName` |
| `PANEL_SITE_NAME` | salida `panelSiteName` |

Sin `AZURE_CLIENT_ID`, el workflow se salta y no falla.

## Decisiones que afectan el costo

- **Sondeo de App Service en `/api/health/live`:** no toca la BD, así que la BD puede pausarse. `/api/health` sí la revisa y la despierta; úsela para verificar a mano.
- **Vencimiento de OXXO una vez al día:** cada revisión despierta la BD. Un pedido vencido puede cancelarse hasta 24 h después de sus 72 h, y sus piezas siguen apartadas en ese tiempo. Si la API se reinicia, también se revisa al arrancar.

## Puntos sin comprobar

- Que `mexicocentral` tenga todos los servicios; si no, se usa `location=southcentralus`.
- Que los runners de GitHub alcancen Azure SQL con la regla "servicios de Azure". Si no, el paso de migraciones falla y hay que agregar una regla temporal con la IP del runner.
- Que los roles de la identidad del workflow alcancen para publicar la API y las Static Web Apps.
