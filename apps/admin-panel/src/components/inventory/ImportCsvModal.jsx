import { useId, useRef, useState } from 'react'
import { COLUMNS } from '../../domain/importCsv'
import { useAdminData } from '../../hooks/useAdminData'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import Modal from '../ui/Modal'

function download(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Archivo de ejemplo (solo DEV): la plantilla actual con dos filas erróneas al final. */
function demoCsv(template) {
  const lines = template.replace(/^﻿/, '').trim().split(/\r?\n/)
  const [header, ...rows] = lines
  const edited = rows.slice(0, 12).map((l) => {
    const cells = l.split(',')
    cells[4] = String((Number(cells[4]) + 5) % 26)
    return cells.join(',')
  })
  const bad = rows[Math.min(rows.length - 1, 20)].split(',')
  bad[4] = '-2'
  return [header, ...edited, 'SKK-099-AZU-M,Modelo desconocido,Azul,M,10', bad.join(',')].join('\n')
}

/**
 * Importación inicial desde CSV (DESIGN_ADMIN.md §5.4): plantilla, vista previa con válidas y con error,
 * y "Aplicar N filas" que solo aplica las válidas. TODO(design): .xlsx en P1 (SheetJS desde cdn.sheetjs.com).
 */
export default function ImportCsvModal({ onClose }) {
  const { api } = useAdminData()
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [readError, setReadError] = useState('')
  const inputRef = useRef(null)
  const fileId = useId()

  const loadText = async (name, text) => {
    setBusy(true)
    setFileName(name)
    setReadError('')
    try {
      setPreview(await api.previewImport(text))
    } finally {
      setBusy(false)
    }
  }

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!/\.csv$/i.test(file.name)) {
      setReadError('Guarde el Excel como “CSV UTF-8 (delimitado por comas)” y elija ese archivo.')
      setPreview(null)
      setFileName(file.name)
      return
    }
    await loadText(file.name, await file.text())
  }

  const reset = () => {
    setPreview(null)
    setFileName('')
    setReadError('')
    if (inputRef.current) inputRef.current.value = ''
  }

  const apply = async () => {
    setBusy(true)
    try {
      const { applied } = await api.applyImport(preview.valid)
      setResult({ applied, skipped: preview.invalid.length })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Importar inventario desde CSV" sub="Pasa el control actual del cliente al panel en una sola carga." onClose={onClose}>
      {result ? (
        <div className="rounded-lg bg-ok-bg p-5 animate-fade" role="status">
          <p className="text-[15px] font-semibold flex items-center gap-2">
            <Icon name="check" />
            {result.applied} SKU actualizados
          </p>
          <p className="text-[13px] mt-1">
            Cada uno quedó en el kárdex como “Inventario inicial · Importado desde CSV”. {result.skipped}{' '}
            {result.skipped === 1 ? 'fila se omitió' : 'filas se omitieron'} por errores.
          </p>
          <Button variant="dark" className="mt-4" onClick={onClose}>
            Ver inventario
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <p className="text-[13px]">
              <b className="font-semibold">1.</b> El archivo necesita estas columnas, en este orden. En Excel use “Guardar como → CSV UTF-8”.
            </p>
            <div className="mt-2 overflow-x-auto rounded-md border border-line">
              <table className="w-full text-[12.5px] min-w-[460px]">
                <caption className="sr-only">Formato del archivo</caption>
                <thead className="bg-linen text-ink-soft">
                  <tr>
                    {COLUMNS.map((h) => (
                      <th key={h} scope="col" className="text-left px-3 py-2 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="tnum">
                    <td className="px-3 py-2">SKK-007-SUM-M</td>
                    <td className="px-3 py-2">Tabi Origami Noche</td>
                    <td className="px-3 py-2">Tinta Sumi</td>
                    <td className="px-3 py-2">M</td>
                    <td className="px-3 py-2">12</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <Button variant="outline" size="sm" className="mt-2" onClick={async () => download('plantilla-inventario-sokko.csv', await api.getTemplateCsv())}>
              <Icon name="download" className="w-4 h-4" />
              Descargar plantilla
            </Button>
          </div>

          <div>
            <p className="text-[13px]">
              <b className="font-semibold">2.</b> Elija el archivo (.csv):
            </p>
            <label
              htmlFor={fileId}
              className="mt-2 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-line bg-linen hover:bg-sand px-4 py-7 text-center focus-within:outline-2 focus-within:outline-ai"
            >
              <Icon name="inv" className="w-6 h-6 text-ink-soft" />
              <span className="text-[13.5px] font-medium break-all">{fileName || 'Haga clic para elegir el archivo'}</span>
              <span className="text-[12px] text-ink-soft">CSV con separador coma o punto y coma</span>
            </label>
            <input ref={inputRef} id={fileId} type="file" accept=".csv,text/csv" className="sr-only" onChange={onFile} />
            {import.meta.env.DEV && !preview && (
              <button
                type="button"
                onClick={async () => loadText('inventario-sokko-octubre.csv', demoCsv(await api.getTemplateCsv()))}
                className="mt-2 text-[12.5px] text-ai hover:underline min-h-11 lg:min-h-0"
              >
                Probar con un archivo de ejemplo
              </button>
            )}
            {readError && (
              <p className="text-[12.5px] text-laca mt-2" role="alert">
                {readError}
              </p>
            )}
            {busy && !preview && (
              <p className="text-[12.5px] text-ink-soft mt-2" role="status">
                Revisando el archivo…
              </p>
            )}
          </div>

          {preview && (
            <div className="animate-fade">
              {preview.error ? (
                <p className="text-[13px] text-laca" role="alert">
                  {preview.error}
                </p>
              ) : (
                <>
                  <p className="text-[13px]" role="status">
                    <b className="font-semibold">3.</b> Revise antes de aplicar: <span className="text-matcha font-medium">{preview.valid.length} filas válidas</span> ·{' '}
                    <span className="text-laca font-medium">{preview.invalid.length} con error</span>
                  </p>
                  <div className="mt-2 overflow-x-auto rounded-md border border-line max-h-56 overflow-y-auto" tabIndex={0} aria-label="Vista previa del archivo">
                    <table className="w-full text-[12.5px] min-w-[560px]">
                      <caption className="sr-only">Vista previa: primero las filas con error</caption>
                      <thead className="bg-linen text-ink-soft sticky top-0">
                        <tr className="text-left">
                          <th scope="col" className="px-3 py-2 font-medium">
                            Fila
                          </th>
                          <th scope="col" className="px-3 py-2 font-medium">
                            SKU
                          </th>
                          <th scope="col" className="px-3 py-2 font-medium">
                            Pieza
                          </th>
                          <th scope="col" className="px-3 py-2 font-medium">
                            Talla
                          </th>
                          <th scope="col" className="px-3 py-2 font-medium text-right">
                            Stock
                          </th>
                          <th scope="col" className="px-3 py-2 font-medium">
                            Resultado
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {[...preview.invalid, ...preview.valid.slice(0, 6)].map((r) => (
                          <tr key={r.line} className={r.error ? 'bg-crit-bg/60' : ''}>
                            <td className="px-3 py-2 tnum text-ink-soft">{r.line}</td>
                            <td className="px-3 py-2 tnum">{r.sku}</td>
                            <td className="px-3 py-2">{r.piece}</td>
                            <td className="px-3 py-2">{r.size}</td>
                            <td className="px-3 py-2 tnum text-right">{r.stock}</td>
                            <td className="px-3 py-2 text-[12px]">{r.error ? <span className="text-laca">{r.error}</span> : <span className="text-matcha">Lista</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[12px] text-ink-soft mt-2">Las filas con error se omiten; corríjalas en el archivo y vuelva a importar solo esas.</p>
                </>
              )}
              <div className="flex flex-wrap gap-2 mt-4">
                {!preview.error && (
                  <Button onClick={apply} disabled={busy || !preview.valid.length}>
                    <Icon name="check" className="w-4 h-4" />
                    Aplicar {preview.valid.length} filas
                  </Button>
                )}
                <Button variant="outline" onClick={reset} disabled={busy}>
                  Elegir otro archivo
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
