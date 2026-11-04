import { useEffect } from 'react'

/** Meta description del index.html; las páginas la cambian mientras están montadas. */
function descriptionTag() {
  let tag = document.querySelector('meta[name="description"]')
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute('name', 'description')
    document.head.appendChild(tag)
  }
  return tag
}

/**
 * <title> "{title} · SOKKO" y meta description de la vista, como Account y CheckoutLayout.
 * Al desmontar regresan los valores anteriores.
 */
export function usePageMeta(title, description) {
  useEffect(() => {
    const previousTitle = document.title
    document.title = `${title} · SOKKO`
    const tag = description ? descriptionTag() : null
    const previousDescription = tag?.getAttribute('content')
    if (tag) tag.setAttribute('content', description)
    return () => {
      document.title = previousTitle
      if (tag && previousDescription != null) tag.setAttribute('content', previousDescription)
    }
  }, [title, description])
}
