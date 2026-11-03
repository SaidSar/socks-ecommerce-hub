// Fotos de producto de SOKKO: una cuenta de Storage con un contenedor de lectura pública solo de blobs.
// Va aparte de main.bicep para no volver a desplegar el plan ni la BD (que usan la oferta gratuita).
// Requiere Microsoft.Storage registrado en la suscripción. La API ya debe existir: se le da permiso sobre la cuenta.
// Sin claves: la API escribe con su identidad administrada y la cuenta no acepta Shared Key.
targetScope = 'resourceGroup'

@description('Región de la cuenta. La misma que la API (infra/README.md §Región).')
@allowed(['westus2', 'westus', 'canadacentral', 'brazilsouth', 'norwayeast'])
param location string = 'westus'

@description('Prefijo de los nombres de los recursos.')
param namePrefix string = 'sokko'

@description('Nombre de la Web App de la API (salida apiName de main.bicep).')
param apiName string = 'app-${namePrefix}-${uniqueString(resourceGroup().id)}'

@description('Contenedor de las fotos; la API lo lee de Images:Container (por omisión, product-images).')
param containerName string = 'product-images'

// Mismo sufijo que main.bicep: el nombre sale igual en cada despliegue y la CSP de vercel.json lo puede fijar.
var accountName = 'st${namePrefix}${uniqueString(resourceGroup().id)}'
var storageBlobDataContributorRole = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'

resource api 'Microsoft.Web/sites@2024-04-01' existing = {
  name: apiName
}

resource account 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: accountName
  location: location
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  properties: {
    accessTier: 'Hot'
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    // Necesario para que el contenedor pueda ser público; cada contenedor sigue privado salvo que lo diga.
    allowBlobPublicAccess: true
    allowSharedKeyAccess: false
    defaultToOAuthAuthentication: true
    allowCrossTenantReplication: false
    publicNetworkAccess: 'Enabled'
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: account
  name: 'default'
}

resource container 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: containerName
  properties: {
    // Cualquiera puede leer una foto si sabe su URL; nadie puede listar el contenedor.
    publicAccess: 'Blob'
  }
}

resource apiBlobWriter 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: account
  name: guid(account.id, api.id, storageBlobDataContributorRole)
  properties: {
    principalId: api.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataContributorRole)
  }
}

output storageAccountName string = account.name
// Valor de la app setting Images__BlobServiceUrl de la API.
output blobServiceUrl string = account.properties.primaryEndpoints.blob
output containerName string = container.name
