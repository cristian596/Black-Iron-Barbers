const ESTADOS = [
  { value: '', label: 'Todos los estados' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'completada', label: 'Completada' },
  { value: 'cancelada', label: 'Cancelada' },
]

const FiltrosCitas = ({ estado, fecha, onCambiarEstado, onCambiarFecha }) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
    <div className="flex flex-col gap-1">
      <label htmlFor="filtro-estado" className="text-sm font-medium text-gray-300">
        Estado
      </label>
      <select
        id="filtro-estado"
        value={estado}
        onChange={(e) => onCambiarEstado(e.target.value)}
        className="rounded-lg border border-white/20 bg-[#1a1a1a] p-2 text-white"
      >
        {ESTADOS.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>
    </div>

    <div className="flex flex-col gap-1">
      <label htmlFor="filtro-fecha" className="text-sm font-medium text-gray-300">
        Fecha
      </label>
      <input
        id="filtro-fecha"
        type="date"
        value={fecha}
        onChange={(e) => onCambiarFecha(e.target.value)}
        className="rounded-lg border border-white/20 bg-[#1a1a1a] p-2 text-white"
      />
    </div>

    {(estado || fecha) && (
      <button
        type="button"
        onClick={() => {
          onCambiarEstado('')
          onCambiarFecha('')
        }}
        className="cursor-pointer rounded-lg border border-white/20 px-3 py-2 text-sm text-gray-300 duration-200 hover:bg-white/10 active:scale-95"
      >
        Limpiar filtros
      </button>
    )}
  </div>
)

export default FiltrosCitas
