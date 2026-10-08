const CAMPO =
  'h-11 w-full min-w-0 rounded-lg border border-white/15 bg-black px-3 text-sm text-white placeholder:text-zinc-500 focus-visible:border-oro focus-visible:outline-2 focus-visible:outline-oro'

// Buscador, barbero y rango de fechas (desde/hasta) de las listas de citas. Es controlado: el estado vive en la URL.
// Sin `barberos` no hay selector de barbero (en /panel/citas todas las citas son del propio barbero). Sin `alCambiarArea`
// no hay selector de área (Todas / Barbería / Asesoría); solo lo usa /admin/citas.
const FiltrosCitasAdmin = ({
  texto,
  desde,
  hasta,
  barbero,
  barberos,
  area,
  hayFiltros,
  alCambiarTexto,
  alCambiarDesde,
  alCambiarHasta,
  alCambiarBarbero,
  alCambiarArea,
  alLimpiar,
  placeholder = 'Cliente, servicio o barbero',
}) => (
  <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${(barberos ? 1 : 0) + (alCambiarArea ? 1 : 0) === 2 ? 'lg:grid-cols-3 xl:grid-cols-5' : barberos || alCambiarArea ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor="citas-buscar" className="text-sm font-medium text-zinc-300">Buscar</label>
      <input
        id="citas-buscar"
        type="search"
        value={texto}
        maxLength={100}
        onChange={(e) => alCambiarTexto(e.target.value)}
        placeholder={placeholder}
        className={CAMPO}
      />
    </div>

    {barberos && (
      <div className="flex min-w-0 flex-col gap-1">
        <label htmlFor="citas-barbero" className="text-sm font-medium text-zinc-300">Barbero</label>
        <select id="citas-barbero" value={barbero} onChange={(e) => alCambiarBarbero(e.target.value)} className={CAMPO}>
          <option value="">Todos los barberos</option>
          {barberos.map((b) => (
            <option key={b.id} value={b.id}>{b.nombre}</option>
          ))}
        </select>
      </div>
    )}

    {alCambiarArea && (
      <div className="flex min-w-0 flex-col gap-1">
        <label htmlFor="citas-area" className="text-sm font-medium text-zinc-300">Área</label>
        <select id="citas-area" value={area ?? ''} onChange={(e) => alCambiarArea(e.target.value)} className={CAMPO}>
          <option value="">Todas las áreas</option>
          <option value="barberia">Barbería</option>
          <option value="asesoria">Asesoría</option>
        </select>
      </div>
    )}

    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor="citas-desde" className="text-sm font-medium text-zinc-300">Desde</label>
      <input
        id="citas-desde"
        type="date"
        value={desde}
        max={hasta || undefined}
        onChange={(e) => alCambiarDesde(e.target.value)}
        className={CAMPO}
      />
    </div>

    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor="citas-hasta" className="text-sm font-medium text-zinc-300">Hasta</label>
      <input
        id="citas-hasta"
        type="date"
        value={hasta}
        min={desde || undefined}
        onChange={(e) => alCambiarHasta(e.target.value)}
        className={CAMPO}
      />
    </div>

    {hayFiltros && (
      <div className="sm:col-span-2 lg:col-span-full">
        <button
          type="button"
          onClick={alLimpiar}
          className="min-h-11 cursor-pointer rounded-lg border border-white/15 px-4 text-sm font-medium text-zinc-300 hover:border-white/40 hover:text-white focus-visible:outline-2 focus-visible:outline-oro motion-safe:transition-colors motion-safe:duration-200"
        >
          Limpiar filtros
        </button>
      </div>
    )}
  </div>
)

export default FiltrosCitasAdmin
