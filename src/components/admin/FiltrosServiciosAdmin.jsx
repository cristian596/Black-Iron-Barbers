import { TIPOS_SERVICIO, TIPO_TODOS } from '../../data/tiposServicio'
import { CATEGORIA_TODAS } from '../../utils/servicios'
import { ESTADO_TODOS } from '../../hooks/useFiltroServiciosAdmin'

const CHIP =
  'inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-oro motion-safe:transition-colors motion-safe:duration-200'
const CHIP_ACTIVO = 'border-oro bg-oro text-black'
const CHIP_INACTIVO = 'border-white/15 text-zinc-300 hover:border-white/40 hover:text-white'
const CAMPO =
  'h-11 w-full min-w-0 rounded-lg border border-white/15 bg-black px-3 text-sm text-white placeholder:text-zinc-500 focus-visible:border-oro focus-visible:outline-2 focus-visible:outline-oro'
// En móvil las categorías se desplazan en horizontal (son muchas para envolverlas); desde sm se envuelven.
const FILA_CHIPS = 'flex min-w-0 gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible'

const Chip = ({ activo, alPulsar, children }) => (
  <button type="button" aria-pressed={activo} onClick={alPulsar} className={`${CHIP} ${activo ? CHIP_ACTIVO : CHIP_INACTIVO}`}>
    {children}
  </button>
)

const ESTADOS = [
  { valor: ESTADO_TODOS, etiqueta: 'Todos' },
  { valor: 'activos', etiqueta: 'Activos' },
  { valor: 'inactivos', etiqueta: 'Inactivos' },
]

// Categoría (chips con "Todas"), tipo, estado y buscador de /admin/servicios.
const FiltrosServiciosAdmin = ({ filtro }) => {
  const { chips, categoriaActiva, setCategoria, tipo, setTipo, estado, setEstado, busqueda, setBusqueda, buscando, hayFiltros, limpiar } = filtro

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div role="group" aria-label="Categoría" className={FILA_CHIPS}>
        <Chip activo={!buscando && categoriaActiva === CATEGORIA_TODAS} alPulsar={() => setCategoria(CATEGORIA_TODAS)}>
          Todas
        </Chip>
        {chips.map(({ slug, nombre, activa }) => (
          <Chip key={slug} activo={!buscando && categoriaActiva === slug} alPulsar={() => setCategoria(slug)}>
            {nombre}
            {!activa && <span className="text-xs opacity-70">(inactiva)</span>}
          </Chip>
        ))}
      </div>
      {buscando && <p className="text-sm text-zinc-400">Buscando en todas las categorías</p>}

      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-1 sm:col-span-2 xl:col-span-1">
          <label htmlFor="servicios-buscar" className="text-sm font-medium text-zinc-300">Buscar</label>
          <input
            id="servicios-buscar"
            type="search"
            value={busqueda}
            maxLength={100}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Nombre del servicio"
            className={CAMPO}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor="servicios-tipo" className="text-sm font-medium text-zinc-300">Tipo</label>
          <select id="servicios-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className={CAMPO}>
            <option value={TIPO_TODOS}>Todos los tipos</option>
            {TIPOS_SERVICIO.map(({ valor, etiqueta }) => (
              <option key={valor} value={valor}>{etiqueta}</option>
            ))}
          </select>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor="servicios-estado" className="text-sm font-medium text-zinc-300">Estado</label>
          <select id="servicios-estado" value={estado} onChange={(e) => setEstado(e.target.value)} className={CAMPO}>
            {ESTADOS.map(({ valor, etiqueta }) => (
              <option key={valor} value={valor}>{etiqueta}</option>
            ))}
          </select>
        </div>
      </div>

      {hayFiltros && (
        <div>
          <button
            type="button"
            onClick={limpiar}
            className="min-h-11 cursor-pointer rounded-lg border border-white/15 px-4 text-sm font-medium text-zinc-300 hover:border-white/40 hover:text-white focus-visible:outline-2 focus-visible:outline-oro"
          >
            Limpiar filtros
          </button>
        </div>
      )}
    </div>
  )
}

export default FiltrosServiciosAdmin
