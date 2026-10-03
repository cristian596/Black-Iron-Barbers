import { useEffect, useRef, useState } from 'react'
import { observarUnaVez } from '../utils/observarUnaVez'

// Pasa a true la primera vez que el elemento entra en pantalla y ya no vuelve
// a false: el elemento se libera del observer compartido tras la primera
// intersección y también al desmontar.
// Sin IntersectionObserver devuelve true desde el inicio.
const useVisible = (umbral = 0.3) => {
  const ref = useRef(null)
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined')

  useEffect(() => {
    const elemento = ref.current
    if (visible || !elemento) return undefined

    return observarUnaVez(elemento, () => setVisible(true), { umbral })
  }, [visible, umbral])

  return [ref, visible]
}

export default useVisible
