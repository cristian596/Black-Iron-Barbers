import { useSyncExternalStore } from 'react'

const coincide = (consulta) =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(consulta).matches
    : false

export const useMediaQuery = (consulta) =>
  useSyncExternalStore(
    (avisar) => {
      if (typeof window.matchMedia !== 'function') return () => {}
      const lista = window.matchMedia(consulta)
      lista.addEventListener('change', avisar)
      return () => lista.removeEventListener('change', avisar)
    },
    () => coincide(consulta),
    () => false
  )
