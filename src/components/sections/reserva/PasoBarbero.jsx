import { FaRandom } from 'react-icons/fa'

const PasoBarbero = ({ barberos, barberoIdSeleccionado, onSeleccionar }) => {
  return (
    <div>
      <h2 className="sr-only">Elige un barbero</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <button
          type="button"
          aria-pressed={barberoIdSeleccionado === null}
          onClick={() => onSeleccionar(null)}
          className={`relative flex items-center gap-4 rounded-2xl border p-4 text-left shadow-sm motion-safe:transition-all motion-safe:duration-200 hover:-translate-y-0.5 hover:shadow-md sm:col-span-2 ${
            barberoIdSeleccionado === null
              ? 'border-[#D4AF37] bg-[#FFFBF0] ring-2 ring-[#D4AF37]'
              : 'border-zinc-300 bg-white'
          }`}
        >
          {barberoIdSeleccionado === null && (
            <span
              aria-hidden="true"
              className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[#D4AF37] text-sm font-bold text-black"
            >
              ✓
            </span>
          )}
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-black text-[#D4AF37]">
            <FaRandom size={22} />
          </span>
          <span>
            <h3 className="font-cinzel text-lg font-bold text-black">Cualquier barbero</h3>
            <span className="block font-poppins text-sm text-zinc-600">Disponibilidad máxima</span>
          </span>
        </button>

        {barberos.map((barbero) => {
          const seleccionado = barbero.id === barberoIdSeleccionado

          return (
            <button
              key={barbero.id}
              type="button"
              aria-pressed={seleccionado}
              onClick={() => onSeleccionar(barbero.id)}
              className={`relative flex items-center gap-4 rounded-2xl border p-4 text-left shadow-sm motion-safe:transition-all motion-safe:duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                seleccionado ? 'border-[#D4AF37] bg-[#FFFBF0] ring-2 ring-[#D4AF37]' : 'border-zinc-300 bg-white'
              }`}
            >
              {seleccionado && (
                <span
                  aria-hidden="true"
                  className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[#D4AF37] text-sm font-bold text-black"
                >
                  ✓
                </span>
              )}
              <img
                src={barbero.foto}
                alt={`Foto de ${barbero.nombre}, barbero en Black Iron Barbers`}
                className="h-14 w-14 shrink-0 rounded-full object-cover"
                loading="lazy"
              />
              <span>
                <h3 className="font-cinzel text-lg font-bold text-black">{barbero.nombre}</h3>
                <span className="block font-poppins text-sm text-zinc-600">{barbero.especialidad}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default PasoBarbero
