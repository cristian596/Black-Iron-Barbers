import { PESTANAS_CITAS } from '../../data/periodos'

// Misma convención de los demás filtros: botones con aria-pressed dentro de un role="group" (se alcanzan con Tab y se
// activan con Enter o Espacio). `pestanas` por defecto son las del admin; `conteos` ({ id: número }) añade el total
// de cada pestaña (con `destacar`, la insignia resalta cuando es > 0).
const PestanasCitas = ({ valor, alCambiar, pestanas = PESTANAS_CITAS, conteos }) => (
  <div role="group" aria-label="Filtrar citas" className="flex flex-wrap gap-2">
    {pestanas.map(({ id, etiqueta, destacar }) => (
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
        {conteos && typeof conteos[id] === 'number' && (
          <span
            className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${
              destacar && conteos[id] > 0
                ? 'bg-orange-500 text-black'
                : valor === id
                  ? 'bg-black/15 text-black'
                  : 'bg-white/10 text-zinc-300'
            }`}
          >
            <span className="sr-only">: </span>
            {conteos[id]}
          </span>
        )}
      </button>
    ))}
  </div>
)

export default PestanasCitas
