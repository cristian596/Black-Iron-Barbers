import { useEffect, useRef, useState } from 'react'

// Pasa a true la primera vez que el elemento entra en pantalla y ya no vuelve
// a false: el observer se desconecta tras la primera intersección.
// Sin IntersectionObserver devuelve true desde el inicio.
const useVisible = (umbral = 0.3) => {
  const ref = useRef(null)
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined')

  useEffect(() => {
    const elemento = ref.current
    if (visible || !elemento) return undefined

    const observer = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((entrada) => entrada.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: umbral }
    )
    observer.observe(elemento)
    return () => observer.disconnect()
  }, [visible, umbral])

  return [ref, visible]
}

export default useVisible
