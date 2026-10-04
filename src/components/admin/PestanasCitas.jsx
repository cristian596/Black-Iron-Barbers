import { PESTANAS_CITAS } from '../../data/periodos'

// Misma convención de los demás filtros: botones con aria-pressed dentro de un role="group".
const PestanasCitas = ({ valor, alCambiar }) => (
  <div role="group" aria-label="Filtrar citas" className="flex flex-wrap gap-2">
    {PESTANAS_CITAS.map(({ id, etiqueta }) => (
      <button
        key={id}
        type="button"
        aria-pressed={valor === id}
        onClick={() => alCambiar(id)}
        className={`min-h-11 cursor-pointer rounded-lg border px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-oro motion-safe:transition-colors motion-safe:duration-200 ${
          valor === id
            ? 'border-oro bg-oro text-black'
            : 'border-white/15 text-zinc-300 hover:border-white/40 hover:text-white'
        }`}
      >
        {etiqueta}
      </button>
    ))}
  </div>
)

export default PestanasCitas
