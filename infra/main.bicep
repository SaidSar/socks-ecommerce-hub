// Infraestructura de SOKKO en Azure. Se despliega dentro de un grupo de recursos que ya existe (rg-sokko-prod): no crea el grupo
// y no toca nada de la suscripción. Todas las asignaciones de roles son sobre recursos de ese grupo.
// Ningún secreto vive en este archivo ni en el repo: la clave JWT llega como parámetro seguro y queda en Key Vault.
targetScope = 'resourceGroup'

@description('Región de la API, la BD y la observabilidad.')
param location string = 'mexicocentral'

@description('Región de los metadatos de Static Web Apps; el contenido se sirve global. Este servicio solo admite algunas regiones.')
@allowed(['centralus', 'eastus2', 'westus2', 'westeurope', 'eastasia'])
param staticWebAppLocation string = 'centralus'

@description('Ubicación de los datos de Communication Services.')
param communicationDataLocation string = 'United States'

@description('Prefijo de los nombres de los recursos.')
param namePrefix string = 'sokko'

@description('Administrador de Microsoft Entra del servidor SQL: su nombre de inicio de sesión.')
param sqlAdminLogin string

@description('Administrador de Microsoft Entra del servidor SQL: su Object ID.')
param sqlAdminObjectId string

@description('Usa la oferta gratuita de Azure SQL. Solo la admiten algunas suscripciones.')
param useSqlFreeOffer bool = true

@description('Ruta que sondea App Service cada minuto. /api/health/live no toca la BD; /api/health sí, e impediría su autopausa.')
param healthCheckPath string = '/api/health/live'

@description('Repositorio de GitHub que puede desplegar con OIDC.')
param githubRepository string = 'SaidSar/socks-ecommerce-hub'

@description('Ambiente de GitHub del workflow de despliegue.')
param githubEnvironment string = 'production'

@description('Cada cuántos minutos se buscan pedidos OXXO vencidos. Cada búsqueda despierta la BD: una vez al día, un pedido vencido puede cancelarse hasta 24 h tarde.')
param oxxoExpiryCheckMinutes int = 1440

@description('Tienda de demostración: el checkout avisa que no hay cobros reales.')
param paymentsDemoMode bool = true

@description('Clave de firma de los JWT. Solo en el primer despliegue o al rotarla; vacía conserva la que ya está en Key Vault.')
@secure()
param jwtSigningKey string = ''

var suffix = uniqueString(resourceGroup().id)
var databaseName = 'Sokko'
var keyVaultSecretsUserRole = '4633458b-17de-408a-b874-0445c86b69e6'
var websiteContributorRole = 'de139f84-1756-47ae-9be6-808fbbe84772'
var contributorRole = 'b24988ac-6180-42a0-ab88-20f7382dd24c'

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'log-${namePrefix}-prod'
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
    workspaceCapping: { dailyQuotaGb: 1 }
  }
}

resource insights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'appi-${namePrefix}-prod'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logs.id
  }
}

resource plan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: 'asp-${namePrefix}-prod'
  location: location
  kind: 'linux'
  sku: { name: 'B1', tier: 'Basic' }
  properties: { reserved: true }
}

resource storeSite 'Microsoft.Web/staticSites@2024-04-01' = {
  name: 'stapp-${namePrefix}-tienda'
  location: staticWebAppLocation
  sku: { name: 'Free', tier: 'Free' }
  properties: {}
}

resource panelSite 'Microsoft.Web/staticSites@2024-04-01' = {
  name: 'stapp-${namePrefix}-panel'
  location: staticWebAppLocation
  sku: { name: 'Free', tier: 'Free' }
  properties: {}
}

resource sqlServer 'Microsoft.Sql/servers@2023-08-01-preview' = {
  name: 'sql-${namePrefix}-${suffix}'
  location: location
  properties: {
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
    administrators: {
      administratorType: 'ActiveDirectory'
      azureADOnlyAuthentication: true
      login: sqlAdminLogin
      sid: sqlAdminObjectId
      tenantId: tenant().tenantId
      principalType: 'User'
    }
  }
}

resource allowAzureServices 'Microsoft.Sql/servers/firewallRules@2023-08-01-preview' = {
  parent: sqlServer
  name: 'AllowAllWindowsAzureIps'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource database 'Microsoft.Sql/servers/databases@2023-08-01-preview' = {
  parent: sqlServer
  name: databaseName
  location: location
  sku: {
    name: 'GP_S_Gen5'
    tier: 'GeneralPurpose'
    family: 'Gen5'
    capacity: 1
  }
  properties: {
    // La misma intercalación que fija el modelo de EF (DESIGN_DB §1.2): la búsqueda sin acentos depende de ella.
    collation: 'Modern_Spanish_100_CI_AI'
    autoPauseDelay: 60
    minCapacity: json('0.5')
    maxSizeBytes: 34359738368
    requestedBackupStorageRedundancy: 'Local'
    useFreeLimit: useSqlFreeOffer
    freeLimitExhaustionBehavior: useSqlFreeOffer ? 'AutoPause' : null
  }
}

resource emailService 'Microsoft.Communication/emailServices@2023-04-01' = {
  name: 'email-${namePrefix}-${suffix}'
  location: 'global'
  properties: { dataLocation: communicationDataLocation }
}

resource emailDomain 'Microsoft.Communication/emailServices/domains@2023-04-01' = {
  parent: emailService
  name: 'AzureManagedDomain'
  location: 'global'
  properties: {
    domainManagement: 'AzureManaged'
    userEngagementTracking: 'Disabled'
  }
}

resource communication 'Microsoft.Communication/communicationServices@2023-04-01' = {
  name: 'acs-${namePrefix}-${suffix}'
  location: 'global'
  properties: {
    dataLocation: communicationDataLocation
    linkedDomains: [emailDomain.id]
  }
}

resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: 'kv-${namePrefix}-${take(suffix, 10)}'
  location: location
  properties: {
    tenantId: tenant().tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
  }
}

resource jwtSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(jwtSigningKey)) {
  parent: vault
  name: 'Jwt-SigningKey'
  properties: { value: jwtSigningKey }
}

resource emailSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'Email-ConnectionString'
  properties: { value: communication.listKeys().primaryConnectionString }
}

resource api 'Microsoft.Web/sites@2024-04-01' = {
  name: 'app-${namePrefix}-${suffix}'
  location: location
  kind: 'app,linux'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOTNETCORE|10.0'
      alwaysOn: true
      healthCheckPath: healthCheckPath
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
    }
  }
}

resource vaultReader 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: vault
  name: guid(vault.id, api.id, keyVaultSecretsUserRole)
  properties: {
    principalId: api.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRole)
  }
}

// Identidad del workflow de GitHub. Es administrada, no una app de Entra: crearla solo requiere permisos sobre este grupo.
resource deployer 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-${namePrefix}-deploy'
  location: location
}

resource deployerGitHub 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = {
  parent: deployer
  name: 'github-${githubEnvironment}'
  properties: {
    issuer: 'https://token.actions.githubusercontent.com'
    subject: 'repo:${githubRepository}:environment:${githubEnvironment}'
    audiences: ['api://AzureADTokenExchange']
  }
}

resource deployerApi 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: api
  name: guid(api.id, deployer.id, websiteContributorRole)
  properties: {
    principalId: deployer.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', websiteContributorRole)
  }
}

resource deployerStore 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: storeSite
  name: guid(storeSite.id, deployer.id, contributorRole)
  properties: {
    principalId: deployer.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', contributorRole)
  }
}

resource deployerPanel 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: panelSite
  name: guid(panelSite.id, deployer.id, contributorRole)
  properties: {
    principalId: deployer.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', contributorRole)
  }
}

resource apiSettings 'Microsoft.Web/sites/config@2024-04-01' = {
  parent: api
  name: 'appsettings'
  dependsOn: [vaultReader, emailSecret, jwtSecret]
  properties: {
    ASPNETCORE_ENVIRONMENT: 'Production'
    APPLICATIONINSIGHTS_CONNECTION_STRING: insights.properties.ConnectionString
    ApplicationInsightsAgent_EXTENSION_VERSION: '~3'
    // Sin contraseña: la API entra a la BD con su identidad administrada.
    ConnectionStrings__Sokko: 'Server=tcp:${sqlServer.properties.fullyQualifiedDomainName},1433;Database=${databaseName};Authentication=Active Directory Managed Identity;Encrypt=True;TrustServerCertificate=False;Connection Timeout=60'
    Jwt__SigningKey: '@Microsoft.KeyVault(VaultName=${vault.name};SecretName=Jwt-SigningKey)'
    Email__Provider: 'Azure'
    Email__ConnectionString: '@Microsoft.KeyVault(VaultName=${vault.name};SecretName=Email-ConnectionString)'
    Email__SenderAddress: 'DoNotReply@${emailDomain.properties.mailFromSenderDomain}'
    Frontend__WebStoreUrl: 'https://${storeSite.properties.defaultHostname}'
    Frontend__AdminPanelUrl: 'https://${panelSite.properties.defaultHostname}'
    Payments__DemoMode: string(paymentsDemoMode)
    Orders__OxxoExpiryCheckMinutes: string(oxxoExpiryCheckMinutes)
  }
}

output apiName string = api.name
output apiUrl string = 'https://${api.properties.defaultHostName}'
output apiPrincipalId string = api.identity.principalId
output storeUrl string = 'https://${storeSite.properties.defaultHostname}'
output storeSiteName string = storeSite.name
output panelUrl string = 'https://${panelSite.properties.defaultHostname}'
output panelSiteName string = panelSite.name
output sqlServerName string = sqlServer.name
output sqlServerFqdn string = sqlServer.properties.fullyQualifiedDomainName
output databaseName string = databaseName
output keyVaultName string = vault.name
output deployerClientId string = deployer.properties.clientId
output deployerName string = deployer.name
