import { useEffect } from 'react'

// Título de la pestaña y meta description de la página mientras el componente está montado; al salir se
// restauran los anteriores (y se quita el meta si lo creó este hook).
export const useTitulo = (titulo, descripcion) => {
  useEffect(() => {
    const tituloPrevio = document.title
    document.title = titulo

    let meta = null
    let creado = false
    let descripcionPrevia = null
    if (descripcion) {
      meta = document.head.querySelector('meta[name="description"]')
      if (!meta) {
        meta = document.createElement('meta')
        meta.name = 'description'
        document.head.appendChild(meta)
        creado = true
      }
      descripcionPrevia = meta.getAttribute('content')
      meta.setAttribute('content', descripcion)
    }

    return () => {
      document.title = tituloPrevio
      if (!meta) return
      if (creado) meta.remove()
      else if (descripcionPrevia === null) meta.removeAttribute('content')
      else meta.setAttribute('content', descripcionPrevia)
    }
  }, [titulo, descripcion])
}
