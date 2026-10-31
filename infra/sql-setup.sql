-- Permisos en la BD Sokko, una sola vez después de crear la infraestructura. Lo corre el administrador de Entra del servidor:
--   sqlcmd -S <sqlServerFqdn> -d Sokko -G -v ApiName="<apiName>" DeployerName="<deployerName>" -i infra/sql-setup.sql
-- Las dos identidades entran sin contraseña.

-- La API lee y escribe, pero no cambia el esquema.
CREATE USER [$(ApiName)] FROM EXTERNAL PROVIDER;
ALTER ROLE db_datareader ADD MEMBER [$(ApiName)];
ALTER ROLE db_datawriter ADD MEMBER [$(ApiName)];

-- El workflow aplica las migraciones.
CREATE USER [$(DeployerName)] FROM EXTERNAL PROVIDER;
ALTER ROLE db_owner ADD MEMBER [$(DeployerName)];
