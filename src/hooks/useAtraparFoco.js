import { useEffect, useRef } from 'react'

const FOCALIZABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Mientras `activo`: el foco se queda dentro de `ref` (Tab y Shift+Tab dan la vuelta), Escape llama a
// `alCerrar`, el scroll de la página se bloquea y, al terminar, el foco vuelve a donde estaba.
export const useAtraparFoco = (ref, activo, alCerrar) => {
  const cerrarRef = useRef(alCerrar)
  useEffect(() => {
    cerrarRef.current = alCerrar
  })

  useEffect(() => {
    const contenedor = ref.current
    if (!activo || !contenedor) return undefined

    const anterior = document.activeElement
    const focalizables = () => [...contenedor.querySelectorAll(FOCALIZABLES)]
    focalizables()[0]?.focus()
    document.body.classList.add('overflow-hidden')

    const alPulsar = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        cerrarRef.current?.()
        return
      }
      if (e.key !== 'Tab') return
      const lista = focalizables()
      if (lista.length === 0) {
        e.preventDefault()
        return
      }
      const primero = lista[0]
      const ultimo = lista[lista.length - 1]
      if (!contenedor.contains(document.activeElement)) {
        e.preventDefault()
        primero.focus()
      } else if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault()
        primero.focus()
      }
    }

    document.addEventListener('keydown', alPulsar)
    return () => {
      document.removeEventListener('keydown', alPulsar)
      document.body.classList.remove('overflow-hidden')
      anterior?.focus?.()
    }
  }, [ref, activo])
}
