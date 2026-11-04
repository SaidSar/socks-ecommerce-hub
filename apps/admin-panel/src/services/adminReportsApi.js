// Reportes de ventas contra apps/api-service (/api/admin/reports). Solo el Dueño (finance.view).
import { salesCsvName } from '../domain/reports'
import { request } from './adminCatalogApi'
import { downloadFile } from './download'

const range = (from, to) => `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`

export const getSalesReport = ({ from, to }) => request('GET', `/api/admin/reports/sales${range(from, to)}`)

export const downloadSalesCsv = ({ from, to }) => downloadFile(`/api/admin/reports/sales.csv${range(from, to)}`, salesCsvName(from, to))
