import { TIPOS_SERVICIO, TIPO_TODOS } from '../../data/tiposServicio'
import { CATEGORIA_TODAS } from '../../utils/servicios'

// Misma barra para el catálogo (fondo oscuro) y el paso 1 de la reserva (fondo claro).
const ESTILOS = {
  claro: {
    activo: 'border-black bg-black text-white',
    inactivo: 'border-zinc-300 bg-white text-zinc-700 hover:border-black',
    etiqueta: 'text-zinc-700',
    nota: 'text-zinc-600',
  },
  oscuro: {
    activo: 'border-black bg-black text-oro',
    inactivo: 'border-white bg-white text-black hover:border-oro hover:bg-oro',
    etiqueta: 'text-white',
    nota: 'text-zinc-200',
  },
}

const BASE_CHIP =
  'inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-4 py-1.5 font-poppins text-sm font-semibold active:scale-95 motion-safe:transition-colors motion-safe:duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4AF37]'

// En móvil las categorías se desplazan en horizontal (son muchas para envolverlas); desde sm se envuelven.
const FILA_CHIPS = 'flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:justify-center sm:overflow-visible'

const Chip = ({ activo, estilos, onClick, children }) => (
  <button
    type="button"
    aria-pressed={activo}
    onClick={onClick}
    className={`${BASE_CHIP} ${activo ? estilos.activo : estilos.inactivo}`}
  >
    {children}
  </button>
)

const FiltrosServicios = ({ filtro, conBusqueda = false, variante = 'claro' }) => {
  const estilos = ESTILOS[variante]
  const { categorias, categoriaActiva, setCategoria, tipo, setTipo, busqueda, setBusqueda, buscando } = filtro

  return (
    <div className="flex flex-col gap-4">
      {conBusqueda && (
        <div>
          <label htmlFor="buscar-servicio" className={`mb-1 block font-poppins text-sm font-semibold ${estilos.etiqueta}`}>
            Buscar servicio
          </label>
          <div className="relative">
            <input
              id="buscar-servicio"
              type="text"
              inputMode="search"
              autoComplete="off"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              placeholder="Ej: corte, barba, keratina"
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 pr-11 font-poppins text-base text-black placeholder:text-zinc-500 focus-visible:border-[#D4AF37] focus-visible:outline-2 focus-visible:outline-[#D4AF37]"
            />
            {busqueda && (
              <button
                type="button"
                aria-label="Borrar búsqueda"
                onClick={() => setBusqueda('')}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-lg text-zinc-600 hover:bg-zinc-100 hover:text-black focus-visible:outline-2 focus-visible:outline-[#D4AF37]"
              >
                <span aria-hidden="true">×</span>
              </button>
            )}
          </div>
        </div>
      )}

      <div role="group" aria-label="Tipo de servicio" className={FILA_CHIPS}>
        <Chip activo={tipo === TIPO_TODOS} estilos={estilos} onClick={() => setTipo(TIPO_TODOS)}>
          Todos
        </Chip>
        {TIPOS_SERVICIO.map(({ valor, etiqueta, Icono }) => (
          <Chip key={valor} activo={tipo === valor} estilos={estilos} onClick={() => setTipo(valor)}>
            <Icono aria-hidden="true" size={12} />
            {etiqueta}
          </Chip>
        ))}
      </div>

      <div role="group" aria-label="Categoría" className={FILA_CHIPS}>
        <Chip
          activo={!buscando && categoriaActiva === CATEGORIA_TODAS}
          estilos={estilos}
          onClick={() => setCategoria(CATEGORIA_TODAS)}
        >
          Todos
        </Chip>
        {categorias.map(({ slug, nombre }) => (
          <Chip key={slug} activo={!buscando && categoriaActiva === slug} estilos={estilos} onClick={() => setCategoria(slug)}>
            {nombre}
          </Chip>
        ))}
      </div>

      {buscando && (
        <p className={`text-center font-poppins text-sm ${estilos.nota}`}>Buscando en todas las categorías</p>
      )}
    </div>
  )
}

export default FiltrosServicios
