import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'

const BOTON =
  'inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-white/15 text-zinc-200 hover:border-white/40 hover:text-white focus-visible:outline-2 focus-visible:outline-oro disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-white/15 disabled:hover:text-zinc-200'

// Selector de un día: anterior, calendario y siguiente. `max` es el último día elegible (hoy en Bogotá): el
// calendario no pasa de ahí y "Día siguiente" se deshabilita en ese día. Entrega siempre una fecha AAAA-MM-DD válida.
const SelectorDia = ({ fecha, max, alCambiar, anterior, siguiente }) => {
  const elegir = (valor) => {
    if (!valor) return // el calendario vacío (campo borrado) no cambia el día
    alCambiar(valor > max ? max : valor)
  }

  return (
    <div role="group" aria-label="Día del reporte" className="flex min-w-0 items-end gap-2">
      <button type="button" onClick={() => alCambiar(anterior)} aria-label="Día anterior" className={BOTON}>
        <FiChevronLeft aria-hidden="true" />
      </button>
      <div className="flex min-w-0 flex-col gap-1">
        <label htmlFor="reporte-fecha" className="text-sm font-medium text-zinc-300">Día</label>
        <input
          id="reporte-fecha"
          type="date"
          value={fecha}
          max={max}
          onChange={(e) => elegir(e.target.value)}
          className="h-11 min-w-0 rounded-lg border border-white/15 bg-black px-3 text-sm text-white [color-scheme:dark] focus-visible:border-oro focus-visible:outline-2 focus-visible:outline-oro"
        />
      </div>
      <button
        type="button"
        onClick={() => alCambiar(siguiente)}
        disabled={fecha >= max}
        aria-label="Día siguiente"
        className={BOTON}
      >
        <FiChevronRight aria-hidden="true" />
      </button>
    </div>
  )
}

export default SelectorDia
