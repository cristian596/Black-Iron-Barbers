import { useLayoutEffect, useRef, useState } from 'react'
import { puedeAnimar } from '../../utils/conteo'
import { observarUnaVez } from '../../utils/observarUnaVez'

// Umbral bajo y margen negativo: dispara un poco antes de entrar del todo y
// no depende de que una sección muy alta (móvil) llegue a verse completa.
const UMBRAL = 0.05
const MARGEN = '0px 0px -8% 0px'

// Desplazamiento inicial por variante (clases literales para que Tailwind las vea).
// Las laterales desplazan 16 px: el contenedor debe llevar overflow-x-clip.
const OCULTO = {
  arriba: 'translate-y-6',
  izquierda: '-translate-x-4',
  derecha: 'translate-x-4',
}

const TRANSICION =
  'transition-[opacity,translate] duration-600 ease-out motion-reduce:transition-none'

// Estados:
//  - oculto:   aún no llegó a pantalla (solo si se puede animar).
//  - revelado: entró al hacer scroll; anima con transición.
//  - directo:  se muestra tal cual, sin animar (ya visible o por encima del
//              viewport al montar, sin IntersectionObserver o con movimiento reducido).
// El estado final usa translate-none (no translate-y-0) para no dejar contexto de
// apilamiento ni bloque contenedor para hijos fixed/sticky.
const CLASES = {
  oculto: (variante) =>
    `${TRANSICION} opacity-0 ${OCULTO[variante] ?? OCULTO.arriba} motion-reduce:opacity-100 motion-reduce:translate-none`,
  revelado: () => `${TRANSICION} opacity-100 translate-none`,
  directo: () => 'opacity-100 translate-none',
}

const Revelar = ({
  retraso = 0,
  variante = 'arriba',
  como: Etiqueta = 'div',
  className = '',
  children,
  ...resto
}) => {
  const ref = useRef(null)
  const [estado, setEstado] = useState(() => (puedeAnimar() ? 'oculto' : 'directo'))

  // Layout effect: decide antes del primer pintado si el elemento ya está a la
  // vista (o más arriba), para que nunca llegue a verse oculto.
  useLayoutEffect(() => {
    const elemento = ref.current
    if (estado !== 'oculto' || !elemento) return undefined

    if (elemento.getBoundingClientRect().top < window.innerHeight) {
      setEstado('directo')
      return undefined
    }

    return observarUnaVez(elemento, () => setEstado('revelado'), {
      umbral: UMBRAL,
      margen: MARGEN,
    })
  }, [estado])

  // Un elemento oculto que recibe foco con teclado se muestra
  const alRecibirFoco = () => setEstado((actual) => (actual === 'oculto' ? 'revelado' : actual))

  return (
    <Etiqueta
      {...resto}
      ref={ref}
      onFocusCapture={alRecibirFoco}
      style={estado !== 'directo' && retraso > 0 ? { transitionDelay: `${retraso}ms` } : undefined}
      className={`${CLASES[estado](variante)} ${className}`.trim()}
    >
      {children}
    </Etiqueta>
  )
}

export default Revelar
