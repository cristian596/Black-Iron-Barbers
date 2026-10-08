import { FaRandom } from 'react-icons/fa'
import AvatarBarbero from '../../ui/AvatarBarbero'

// Una lista de profesionales con su opción "Cualquier …" (null = cualquiera, que es la opción por defecto). Sirve para
// barberos y para asesores: solo cambian los textos.
const SelectorProfesional = ({ Titulo = 'h3', etiquetaCualquiera, idSeleccionado, profesionales, onSeleccionar }) => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
    <button
      type="button"
      aria-pressed={idSeleccionado === null}
      onClick={() => onSeleccionar(null)}
      className={`relative flex min-h-11 items-center gap-4 rounded-2xl border p-4 text-left shadow-sm motion-safe:transition-all motion-safe:duration-200 hover:-translate-y-0.5 hover:shadow-md sm:col-span-2 ${
        idSeleccionado === null ? 'border-oro bg-[#FFFBF0] ring-2 ring-oro' : 'border-zinc-300 bg-white'
      }`}
    >
      {idSeleccionado === null && (
        <span
          aria-hidden="true"
          className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-oro text-sm font-bold text-black"
        >
          ✓
        </span>
      )}
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-black text-oro">
        <FaRandom size={22} />
      </span>
      <span>
        <Titulo className="font-cinzel text-lg font-bold text-black">{etiquetaCualquiera}</Titulo>
        <span className="block font-poppins text-sm text-zinc-600">Disponibilidad máxima</span>
      </span>
    </button>

    {profesionales.map((profesional) => {
      const seleccionado = profesional.id === idSeleccionado

      return (
        <button
          key={profesional.id}
          type="button"
          aria-pressed={seleccionado}
          onClick={() => onSeleccionar(profesional.id)}
          className={`relative flex min-h-11 items-center gap-4 rounded-2xl border p-4 text-left shadow-sm motion-safe:transition-all motion-safe:duration-200 hover:-translate-y-0.5 hover:shadow-md ${
            seleccionado ? 'border-oro bg-[#FFFBF0] ring-2 ring-oro' : 'border-zinc-300 bg-white'
          }`}
        >
          {seleccionado && (
            <span
              aria-hidden="true"
              className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-oro text-sm font-bold text-black"
            >
              ✓
            </span>
          )}
          <AvatarBarbero barbero={profesional} className="h-14 w-14 rounded-full" textoClase="text-lg" />
          <span>
            <Titulo className="font-cinzel text-lg font-bold text-black">{profesional.nombre}</Titulo>
            <span className="block font-poppins text-sm text-zinc-600">{profesional.especialidad}</span>
          </span>
        </button>
      )
    })}
  </div>
)

// Paso de profesionales. Solo barbería: la lista de barberos de siempre. Solo asesoría: "Tu asesor/a". Las dos cosas
// (asesoría + corte): dos bloques, "Tu asesor/a" y "Tu barbero", que se eligen por separado (son dos personas).
// `barberos` y `asesores` ya vienen separados por área; `barberoIdSeleccionado` / `asesorIdSeleccionado`: null = cualquiera.
const PasoBarbero = ({
  barberos = [],
  asesores = [],
  tieneBarberia = true,
  tieneAsesoria = false,
  barberoIdSeleccionado,
  asesorIdSeleccionado = null,
  onSeleccionar,
  onSeleccionarAsesor,
}) => {
  const ambos = tieneBarberia && tieneAsesoria

  const bloqueAsesor = (
    <SelectorProfesional
      Titulo={ambos ? 'h4' : 'h3'}
      etiquetaCualquiera="Cualquier asesor"
      idSeleccionado={asesorIdSeleccionado}
      profesionales={asesores}
      onSeleccionar={onSeleccionarAsesor}
    />
  )
  const bloqueBarbero = (
    <SelectorProfesional
      Titulo={ambos ? 'h4' : 'h3'}
      etiquetaCualquiera="Cualquier barbero"
      idSeleccionado={barberoIdSeleccionado}
      profesionales={barberos}
      onSeleccionar={onSeleccionar}
    />
  )

  if (!ambos) {
    return (
      <div>
        <h2 className="sr-only">{tieneAsesoria ? 'Elige tu asesor/a' : 'Elige un barbero'}</h2>
        {tieneAsesoria ? bloqueAsesor : bloqueBarbero}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <h2 className="sr-only">Elige a tus profesionales</h2>
      <p className="text-center font-poppins text-sm text-zinc-600">
        Tu asesoría y tu corte los atienden dos personas distintas, una después de la otra.
      </p>
      <section aria-labelledby="titulo-tu-asesor">
        <h3 id="titulo-tu-asesor" className="mb-3 font-cinzel text-xl font-bold text-black">
          Tu asesor/a
        </h3>
        {bloqueAsesor}
      </section>
      <section aria-labelledby="titulo-tu-barbero">
        <h3 id="titulo-tu-barbero" className="mb-3 font-cinzel text-xl font-bold text-black">
          Tu barbero
        </h3>
        {bloqueBarbero}
      </section>
    </div>
  )
}

export default PasoBarbero
