# Infraestructura en Azure — SOKKO

> Estado al 4 de noviembre de 2026. Este documento describe la **base** de la cuenta de Azure
> (suscripción, grupo de recursos, permisos y proveedores) y los recursos desplegados en
> `rg-sokko-prod` (§7). Cómo se despliegan: [`infra/README.md`](../../infra/README.md).

## 1. Resumen

| Elemento | Valor |
|---|---|
| Suscripción | **Azure for Students** |
| ID de suscripción | `24dec6f4-999d-4bf4-a4a1-8dda7e9c3ae5` |
| Tenant (directorio) | `5fdc35e0-3fa0-4913-8db6-53b8535cb098` (UAdeO) |
| Cuenta dueña de la suscripción | `23020117@uadeo.mx` |
| Grupo de recursos | `rg-sokko-prod` |
| Región | Grupo en **West US 2** (`westus2`); recursos en **West US** (`westus`), ver §2.1 |
| Permisos adicionales | `23020667@uadeo.mx` con rol **Owner (Propietario)**, solo en `rg-sokko-prod` |

Los ID de suscripción y de tenant no son secretos (no dan acceso por sí solos), pero **ninguna
credencial, cadena de conexión o clave** debe entrar al repositorio. Esas irán en Key Vault o en la
configuración de App Service (ver §6).

## 2. Restricciones de la suscripción

### 2.1 Regiones permitidas

Azure for Students aplica una directiva que limita el despliegue a **5 regiones**:

| Región | Nombre en CLI |
|---|---|
| West US 2 | `westus2` |
| West US | `westus` |
| Canada Central | `canadacentral` |
| Brazil South | `brazilsouth` |
| Norway East | `norwayeast` |

**México Central (`mexicocentral`) no está permitida**: la creación del grupo falla con
`RequestDisallowedByAzure`. El grupo se creó en **West US 2**.

**Los recursos se crean en West US (`westus`)**: en `westus2` la suscripción tiene **cuota 0 de App
Service**, para B1 y también para F1 (el what-if falla con `Current Limit (B1 VMs): 0`). Las otras
cuatro regiones permitidas sí tienen cuota, y `westus` es la más cercana a México. La región del
grupo no limita la de sus recursos.

Para consultar las regiones permitidas:

```bash
az policy assignment list --query "[].{nombre:displayName, regiones:parameters.listOfAllowedLocations.value}" -o json
```

### 2.2 MFA obligatorio

El tenant exige **autenticación multifactor (MFA)** para crear o modificar recursos. Un inicio de
sesión sin MFA puede leer (listar grupos, registrar proveedores) pero las escrituras se rechazan; el
motivo aparece en el **Registro de actividad** del portal.

En Windows, `az login` puede reutilizar una sesión guardada sin pedir el segundo paso. Si un comando
de escritura falla por MFA:

1. Cierre la sesión e inicie de nuevo: `az logout` y luego `az login --tenant 5fdc35e0-3fa0-4913-8db6-53b8535cb098`.
2. Si sigue fallando, haga el paso desde [portal.azure.com](https://portal.azure.com), que siempre
   pide MFA. Así se creó el grupo y se asignó el rol en esta configuración inicial.

## 3. Proveedores de recursos registrados

Los ocho quedan en estado `Registered` en la suscripción:

| Proveedor | Para qué |
|---|---|
| `Microsoft.Web` | App Service (`api-service`). La tienda y el panel van en Vercel, fuera de Azure (ver §6) |
| `Microsoft.Sql` | Azure SQL Database (BD `Sokko`, ver `docs/design/DESIGN_DB.md`) |
| `Microsoft.Communication` | Azure Communication Services (correos transaccionales) |
| `Microsoft.KeyVault` | Key Vault (secretos y cadenas de conexión) |
| `Microsoft.Insights` | Application Insights y alertas |
| `Microsoft.OperationalInsights` | Log Analytics (espacio de trabajo de registros) |
| `Microsoft.ManagedIdentity` | Identidades administradas (acceso de la API a Key Vault y SQL sin contraseñas) |
| `Microsoft.Storage` | Cuenta de Storage de las fotos de producto (`infra/storage.bicep`). Se registró después que los otros siete |

## 4. Reproducir la configuración con Azure CLI

Requisitos: [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) 2.60+ y la cuenta
`23020117@uadeo.mx` con MFA configurado.

```bash
# 1. Iniciar sesión y fijar la suscripción
az login --tenant 5fdc35e0-3fa0-4913-8db6-53b8535cb098
az account set --subscription 24dec6f4-999d-4bf4-a4a1-8dda7e9c3ae5
az account show --query "{suscripcion:name, id:id, usuario:user.name}" -o table

# 2. Grupo de recursos (requiere MFA)
az group create --name rg-sokko-prod --location westus2

# 3. Owner para 23020667@uadeo.mx, solo en el grupo (requiere MFA)
RG_ID=$(az group show --name rg-sokko-prod --query id -o tsv)
az role assignment create \
  --assignee 23020667@uadeo.mx \
  --role Owner \
  --scope "$RG_ID"

# 4. Proveedores de recursos
for p in Microsoft.Web Microsoft.Sql Microsoft.Communication Microsoft.KeyVault \
         Microsoft.Insights Microsoft.OperationalInsights Microsoft.ManagedIdentity Microsoft.Storage; do
  az provider register --namespace "$p"
done
```

En PowerShell, los pasos 3 y 4 quedan así:

```powershell
$rgId = az group show --name rg-sokko-prod --query id -o tsv
az role assignment create --assignee 23020667@uadeo.mx --role Owner --scope $rgId

"Microsoft.Web","Microsoft.Sql","Microsoft.Communication","Microsoft.KeyVault",
"Microsoft.Insights","Microsoft.OperationalInsights","Microsoft.ManagedIdentity","Microsoft.Storage" |
  ForEach-Object { az provider register --namespace $_ }
```

Si `--assignee` no encuentra el correo (por ejemplo, porque la cuenta es invitada en el tenant), use
su ID de objeto: `az ad user show --id 23020667@uadeo.mx --query id -o tsv` y páselo con
`--assignee-object-id <id> --assignee-principal-type User`.

### 4.1 Desde el portal (alternativa con MFA)

1. **Grupos de recursos → Crear**: suscripción *Azure for Students*, nombre `rg-sokko-prod`, región
   *(US) West US 2* → **Revisar y crear**.
2. En el grupo: **Control de acceso (IAM) → Agregar → Agregar asignación de roles**.
   - Pestaña **Rol** → *Roles de administrador con privilegios* → **Propietario**.
   - Pestaña **Miembros** → **Seleccionar miembros** → `23020667@uadeo.mx` → **Seleccionar**.
   - **Revisar y asignar** dos veces (en *Condiciones*, permitir asignar todos los roles).

## 5. Verificación

```bash
# Grupo y región
az group show --name rg-sokko-prod --query "{nombre:name, region:location, estado:properties.provisioningState}" -o table

# Asignación de Owner en el grupo
az role assignment list --resource-group rg-sokko-prod \
  --query "[].{usuario:principalName, rol:roleDefinitionName, alcance:scope}" -o table

# Estado de los proveedores
az provider list \
  --query "[?contains('Microsoft.Web Microsoft.Sql Microsoft.Communication Microsoft.KeyVault Microsoft.Insights Microsoft.OperationalInsights Microsoft.ManagedIdentity Microsoft.Storage', namespace)].{proveedor:namespace, estado:registrationState}" \
  -o table
```

Resultado esperado: `rg-sokko-prod` en `westus2` con estado `Succeeded`; `23020667@uadeo.mx` como
`Owner` con alcance `/subscriptions/24dec6f4-…/resourceGroups/rg-sokko-prod`; los 8 proveedores en
`Registered`.

## 6. Estado y siguientes pasos

**Todo está desplegado** (§7): la API, la BD, Key Vault, el correo, la observabilidad y la cuenta de
las fotos. Cómo se despliega cada parte: [`infra/README.md`](../../infra/README.md).

- **La tienda (`web-store`) y el panel (`admin-panel`) se publican en Vercel**, no en Azure:
  `https://sokko-tienda.vercel.app` y `https://sokko-panel.vercel.app`. Esas dos URLs son los
  parámetros `webStoreUrl` y `adminPanelUrl` de `main.bicep`, que la API usa para CORS y para los
  enlaces de los correos.
- **Sin secretos en el repositorio ni en las app settings:** la API entra a Azure SQL y a Storage con
  su identidad administrada. La clave JWT y la cadena de Communication Services están en Key Vault.
- **Las migraciones** las aplica el workflow `deploy.yml` con un *migrations bundle*, no la API al
  arrancar.

### Pendiente

1. **Subir las fotos reales de los productos** desde el panel (*Catálogo → Productos → Fotos*, solo el
   Dueño). Los productos sin fotos siguen mostrando su ilustración. Pasos en
   [`infra/README.md`](../../infra/README.md#subir-fotos-desde-el-panel).

### A futuro

- **Rotar la clave JWT:** redesplegar `main.bicep` con un `jwtSigningKey` nuevo, que reemplaza el
  secreto `Jwt-SigningKey` de Key Vault. Al reiniciar la API, todas las sesiones abiertas se cierran
  y hay que volver a iniciar sesión. Ese redespliegue sigue la regla de abajo.
- **Antes de cualquier redespliegue de `main.bicep`, revisar el what-if.** Solo debe cambiar lo que se
  quiere cambiar. El plan B1 está en la oferta gratuita hasta el **2 de mayo de 2027**, así que un
  cambio que lo recree o le cambie el SKU puede empezar a cobrarse. Además, el despliegue
  **reemplaza todas las app settings**: pase `imagesBlobServiceUrl` para no borrar
  `Images__BlobServiceUrl` (ver `infra/README.md`).
- Si se crea un recurso nuevo, agregarlo a la tabla de §7.

## 7. Recursos desplegados

Todos en `rg-sokko-prod`. `main.bicep` crea los de la API y `storage.bicep`, la cuenta de las fotos.

| Recurso | Nombre | SKU / tipo | Región |
|---|---|---|---|
| Plan de App Service | `asp-sokko-prod` | B1 (Basic), Linux | `westus` |
| App Service (API) | `app-sokko-qifdnnh6tfjpc` | .NET 10, identidad administrada del sistema | `westus` |
| Servidor SQL | `sql-sokko-qifdnnh6tfjpc` | Solo autenticación de Microsoft Entra | `westus` |
| Base de datos | `Sokko` | GP_S_Gen5, 1 vCore serverless, oferta gratuita | `westus` |
| Key Vault | `kv-sokko-qifdnnh6tf` | Standard, RBAC | `westus` |
| Communication Services | `acs-sokko-qifdnnh6tfjpc` y `email-sokko-qifdnnh6tfjpc` | Dominio administrado por Azure | `global` |
| Application Insights | `appi-sokko-prod` | Sobre Log Analytics | `westus` |
| Log Analytics | `log-sokko-prod` | PerGB2018, tope de 0.16 GB al día | `westus` |
| Identidad del workflow | `id-sokko-deploy` | Identidad administrada asignada por el usuario (OIDC de GitHub) | `westus` |
| Cuenta de Storage (fotos) | `stsokkoqifdnnh6tfjpc` | StorageV2, Standard_LRS, Hot, TLS 1.2, **sin Shared Key** | `westus` |
| Contenedor | `product-images` (en `stsokkoqifdnnh6tfjpc`) | Lectura pública **solo de blobs**: se abre una foto con su URL, pero no se puede listar el contenedor | `westus` |

La cuenta de Storage se creó el 4 de noviembre de 2026. La API escribe en ella con su identidad
administrada (rol **Storage Blob Data Contributor** sobre la cuenta), sin claves. Su URL llega a la
API por la app setting **`Images__BlobServiceUrl`** = `https://stsokkoqifdnnh6tfjpc.blob.core.windows.net/`.
Sin esa setting, la API arranca igual, pero subir y borrar fotos responden 503.
