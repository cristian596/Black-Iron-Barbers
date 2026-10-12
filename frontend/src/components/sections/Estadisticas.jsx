import { ESTADISTICAS } from '../../data/negocio'
import useCantidadBarberos from '../../hooks/useCantidadBarberos'
import useVisible from '../../hooks/useVisible'
import CifraAnimada from '../ui/CifraAnimada'

const ITEM = 'w-1/2 lg:w-1/4'
const ESCALONADO_MS = 120

const Estadisticas = () => {
  const [ref, visible] = useVisible(0.3)
  const barberos = useCantidadBarberos()

  // barberos: null mientras carga (se reserva su hueco), 0 si no hay dato (se omite)
  const cifras = ESTADISTICAS.map((cifra) =>
    cifra.desdeApi ? { ...cifra, valor: barberos } : cifra
  ).filter((cifra) => cifra.valor !== 0)

  return (
    <section
      ref={ref}
      aria-label='Cifras de la barbería'
      className='bg-[#0f0f0f] border-y border-zinc-800 px-4 py-10'
    >
      <ul className='mx-auto flex max-w-6xl flex-wrap justify-center gap-y-8'>
        {cifras.map(({ id, etiqueta, valor, prefijo, sufijo }, indice) =>
          valor === null ? (
            <li key={id} aria-hidden='true' className={`${ITEM} invisible`}>
              <CifraAnimada etiqueta={etiqueta} valor={0} />
            </li>
          ) : (
            <li key={id} className={ITEM}>
              <CifraAnimada
                etiqueta={etiqueta}
                valor={valor}
                prefijo={prefijo}
                sufijo={sufijo}
                activo={visible}
                retraso={indice * ESCALONADO_MS}
              />
            </li>
          )
        )}
      </ul>
    </section>
  )
}

export default Estadisticas
