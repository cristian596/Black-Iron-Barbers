// Completar y Cancelar de una cita pendiente (el barbero cierra sus propias citas). 44 px de alto mínimo.
const AccionesCita = ({ cita, ocupado, alCompletar, alCancelar }) => (
  <div className="mt-3 flex flex-wrap gap-2">
    <button
      type="button"
      disabled={ocupado}
      onClick={() => alCompletar(cita)}
      aria-label={`Completar la cita de ${cita.cliente}`}
      className="min-h-11 cursor-pointer rounded-lg bg-green-600 px-4 text-sm font-semibold text-white duration-200 hover:bg-green-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oro active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
    >
      Completar
    </button>
    <button
      type="button"
      disabled={ocupado}
      onClick={() => alCancelar(cita)}
      aria-label={`Cancelar la cita de ${cita.cliente}`}
      className="min-h-11 cursor-pointer rounded-lg border border-red-500/60 px-4 text-sm font-semibold text-red-300 duration-200 hover:bg-red-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oro active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
    >
      Cancelar
    </button>
  </div>
)

export default AccionesCita
