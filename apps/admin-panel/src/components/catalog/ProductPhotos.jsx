import { useEffect, useId, useRef, useState } from 'react'
import { altFromFileName, fileError, IMAGE_MSG, MAX_ALT, MAX_BYTES, MAX_IMAGES, moveItem, roomFor } from '../../domain/images'
import { useAdminData } from '../../hooks/useAdminData'
import { resizeImage } from '../../services/resizeImage'
import Button from '../ui/Button'
import Icon from '../ui/Icon'

const ACCEPT = 'image/jpeg,image/png,image/webp'
const REORDER_TYPE = 'application/x-sokko-photo'

/** Texto alternativo: se guarda al salir del campo, solo si cambió. Su `key` lleva el texto guardado: si cambia, se reinicia. */
function AltField({ image, index, disabled, onSave }) {
  const [draft, setDraft] = useState(image.altText ?? '')
  const id = useId()
  const commit = () => {
    const next = draft.trim()
    if (next !== (image.altText ?? '')) onSave(image, next)
  }
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[11.5px] text-ink-soft">
        Texto alternativo · foto {index + 1}
      </label>
      <input
        id={id}
        value={draft}
        maxLength={MAX_ALT}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), e.currentTarget.blur())}
        placeholder="Qué se ve en la foto"
        className="h-8 max-lg:h-11 w-full rounded-md border border-line bg-paper px-2 text-[12.5px] outline-none focus:border-ai disabled:bg-linen"
      />
    </div>
  )
}

/**
 * Sección Fotos del formulario de producto: subir (arrastrar o elegir), vista previa, reordenar, texto alternativo y borrar.
 * Cada foto se reduce en el navegador a 1600 px por lado largo y WebP antes de subirla. La primera es la portada de la tienda.
 * Cada respuesta trae el RowVersion nuevo del producto; `onRowVersion` lo pasa al formulario para que guardar no dé 409.
 */
export default function ProductPhotos({ product, canEdit, onRowVersion }) {
  const { api, usesApi } = useAdminData()
  const [images, setImages] = useState(product?.images ?? [])
  const [pending, setPending] = useState([]) // { key, preview, name }
  const [message, setMessage] = useState('')
  const [confirming, setConfirming] = useState(null)
  const [dropping, setDropping] = useState(false)
  const dragFrom = useRef(null)
  const inputRef = useRef(null)
  const hintId = useId()

  const previews = useRef(new Set())
  useEffect(() => () => previews.current.forEach((url) => URL.revokeObjectURL(url)), [])

  if (!product) return <p className="text-[12.5px] text-ink-soft">Guarda el producto para agregarle fotos.</p>
  if (!usesApi) return <p className="text-[12.5px] text-ink-soft">Las fotos se guardan en la API: sin VITE_API_URL el panel no puede subirlas.</p>

  const busy = pending.length > 0
  const editable = canEdit && !busy
  const apply = (result) => {
    setImages(result.images)
    onRowVersion(result.rowVersion)
  }
  const fail = (ex) => setMessage(ex.errors ? Object.values(ex.errors)[0] : ex.message)

  const upload = async (files) => {
    setMessage('')
    const list = Array.from(files ?? [])
    const room = roomFor(images.length, list.length)
    const skipped = []
    if (room < list.length) skipped.push(IMAGE_MSG.full)
    const accepted = list.slice(0, room).filter((f) => {
      const err = fileError(f)
      if (err) skipped.push(`${f.name}: ${err}`)
      return !err
    })
    // En orden, una por una: así el orden de las fotos es el de la selección.
    for (const file of accepted) {
      const item = { key: `${file.name}-${file.lastModified}-${Math.random()}`, preview: URL.createObjectURL(file), name: file.name }
      previews.current.add(item.preview)
      setPending((p) => [...p, item])
      try {
        const blob = await resizeImage(file)
        if (blob.size > MAX_BYTES) throw new Error(IMAGE_MSG.tooBig)
        apply(await api.uploadProductImage(product.id, blob, altFromFileName(file.name)))
      } catch (ex) {
        skipped.push(`${file.name}: ${ex.errors ? Object.values(ex.errors)[0] : ex.message}`)
      } finally {
        setPending((p) => p.filter((x) => x.key !== item.key))
        URL.revokeObjectURL(item.preview)
        previews.current.delete(item.preview)
      }
    }
    setMessage(skipped.length ? skipped.join(' ') : accepted.length ? `${accepted.length === 1 ? 'Foto subida' : `${accepted.length} fotos subidas`}.` : '')
  }

  const reorder = async (from, to) => {
    const next = moveItem(images, from, to)
    if (next === images) return
    const previous = images
    setImages(next)
    setMessage('')
    try {
      apply(await api.reorderProductImages(product.id, next.map((i) => i.id)))
      setMessage(from === 0 || to === 0 ? 'Nueva portada guardada.' : 'Orden guardado.')
    } catch (ex) {
      setImages(previous)
      fail(ex)
    }
  }

  const remove = async (image) => {
    setConfirming(null)
    setMessage('')
    try {
      apply(await api.deleteProductImage(product.id, image.id))
      setMessage('Foto borrada.')
    } catch (ex) {
      fail(ex)
    }
  }

  const saveAlt = async (image, altText) => {
    setMessage('')
    try {
      apply(await api.setProductImageAlt(product.id, image.id, altText))
    } catch (ex) {
      fail(ex)
    }
  }

  const isFileDrag = (e) => Array.from(e.dataTransfer?.types ?? []).includes('Files')

  return (
    <section className="flex min-w-0 flex-col gap-3" aria-labelledby={`${hintId}-title`}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 id={`${hintId}-title`} className="text-[12px] font-medium text-ink-soft">
          Fotos · {images.length} de {MAX_IMAGES}
        </h3>
        <span className="text-[12px] text-ink-soft">La primera es la portada</span>
      </div>

      {(images.length > 0 || pending.length > 0) && (
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((image, i) => (
            <li
              key={image.id}
              draggable={editable}
              onDragStart={(e) => {
                dragFrom.current = i
                e.dataTransfer.setData(REORDER_TYPE, String(i))
                e.dataTransfer.effectAllowed = 'move'
              }}
              onDragOver={(e) => editable && dragFrom.current != null && !isFileDrag(e) && e.preventDefault()}
              onDrop={(e) => {
                if (dragFrom.current == null || isFileDrag(e)) return
                e.preventDefault()
                e.stopPropagation()
                reorder(dragFrom.current, i)
                dragFrom.current = null
              }}
              onDragEnd={() => (dragFrom.current = null)}
              className="flex min-w-0 flex-col gap-2 rounded-md border border-line bg-paper p-2"
            >
              <div className="relative aspect-square overflow-hidden rounded bg-sand">
                <img src={image.url} alt={image.altText ?? ''} loading="lazy" className="h-full w-full object-cover" />
                {i === 0 && <span className="absolute top-1.5 left-1.5 rounded-full bg-ink px-2 py-0.5 text-[11px] text-linen">Portada</span>}
              </div>
              <AltField key={image.altText ?? ''} image={image} index={i} disabled={!editable} onSave={saveAlt} />
              {canEdit && (
                <div className="flex flex-wrap items-center gap-1">
                  <Button variant="ghost" size="sm" className="px-2" disabled={!editable || i === 0} onClick={() => reorder(i, i - 1)} aria-label={`Mover la foto ${i + 1} antes`}>
                    <Icon name="left" className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="px-2"
                    disabled={!editable || i === images.length - 1}
                    onClick={() => reorder(i, i + 1)}
                    aria-label={`Mover la foto ${i + 1} después`}
                  >
                    <Icon name="right" className="h-4 w-4" />
                  </Button>
                  {confirming === image.id ? (
                    <Button variant="outline" size="sm" className="ml-auto border-laca text-laca" disabled={!editable} onClick={() => remove(image)}>
                      ¿Borrar?
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" className="ml-auto px-2" disabled={!editable} onClick={() => setConfirming(image.id)} aria-label={`Borrar la foto ${i + 1}`}>
                      <Icon name="x" className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
            </li>
          ))}
          {pending.map((p) => (
            <li key={p.key} className="flex min-w-0 flex-col gap-2 rounded-md border border-dashed border-line bg-paper p-2" aria-busy="true">
              <div className="relative aspect-square overflow-hidden rounded bg-sand">
                <img src={p.preview} alt="" className="h-full w-full object-cover opacity-60" />
                <span className="absolute inset-x-0 bottom-0 bg-paper/85 px-2 py-1 text-[11.5px]">Reduciendo y subiendo…</span>
              </div>
              <p className="truncate text-[11.5px] text-ink-soft">{p.name}</p>
            </li>
          ))}
        </ol>
      )}

      {canEdit && images.length + pending.length < MAX_IMAGES && (
        <div
          onDragOver={(e) => {
            if (!isFileDrag(e)) return
            e.preventDefault()
            setDropping(true)
          }}
          onDragLeave={() => setDropping(false)}
          onDrop={(e) => {
            if (!isFileDrag(e)) return
            e.preventDefault()
            setDropping(false)
            upload(e.dataTransfer.files)
          }}
          className={`flex flex-col items-center gap-2 rounded-md border border-dashed px-4 py-5 text-center ${dropping ? 'border-ai bg-info-bg' : 'border-line bg-linen'}`}
        >
          <p className="text-[13px]">Arrastra fotos aquí o</p>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()} aria-describedby={hintId}>
            <Icon name="plus" className="h-4 w-4" />
            Elegir fotos
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              upload(e.target.files)
              e.target.value = ''
            }}
          />
          <p id={hintId} className="text-[12px] text-ink-soft">
            JPG, PNG o WebP. Se reducen a 1600 px y se guardan como WebP.
          </p>
        </div>
      )}

      {!images.length && !canEdit && <p className="text-[12.5px] text-ink-soft">Sin fotos: la tienda muestra la ilustración.</p>}
      <p className="text-[12.5px] text-ink-soft" role="status">
        {message}
      </p>
    </section>
  )
}
