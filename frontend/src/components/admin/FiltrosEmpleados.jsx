const CHIP =
  'inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-oro motion-safe:transition-colors motion-safe:duration-200'
const CHIP_ACTIVO = 'border-oro bg-oro text-black'
const CHIP_INACTIVO = 'border-white/15 text-zinc-300 hover:border-white/40 hover:text-white'
const CAMPO =
  'h-11 w-full min-w-0 rounded-lg border border-white/15 bg-black px-3 text-sm text-white placeholder:text-zinc-500 focus-visible:border-oro focus-visible:outline-2 focus-visible:outline-oro'

// El filtro por estado va con el total entre paréntesis para que se vea de un vistazo cuántos hay de cada uno.
const ESTADOS = [
  { valor: 'activos', etiqueta: 'Activos' },
  { valor: 'inactivos', etiqueta: 'Inactivos' },
  { valor: 'todos', etiqueta: 'Todos' },
]

// Estado (Activos por defecto) y buscador de /admin/empleados.
const FiltrosEmpleados = ({ filtro }) => {
  const { estado, setEstado, busqueda, setBusqueda, conteos, hayFiltros, limpiar } = filtro
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div role="group" aria-label="Estado" className="flex min-w-0 flex-wrap gap-2">
        {ESTADOS.map(({ valor, etiqueta }) => (
          <button
            key={valor}
            type="button"
            aria-pressed={estado === valor}
            onClick={() => setEstado(valor)}
            className={`${CHIP} ${estado === valor ? CHIP_ACTIVO : CHIP_INACTIVO}`}
          >
            {etiqueta}
            <span className="text-xs opacity-70">({conteos[valor]})</span>
          </button>
        ))}
      </div>

      <div className="flex min-w-0 flex-col gap-1 sm:max-w-md">
        <label htmlFor="empleados-buscar" className="text-sm font-medium text-zinc-300">Buscar</label>
        <input
          id="empleados-buscar"
          type="search"
          value={busqueda}
          maxLength={100}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Nombre, cargo o usuario"
          className={CAMPO}
        />
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

export default FiltrosEmpleados
