// Interruptor Activo/Inactivo (role="switch"). El estado siempre se lee también como texto, no solo por color.
// `etiqueta` nombra lo que se enciende o apaga (para lectores de pantalla).
const InterruptorActivo = ({ activo, etiqueta, alCambiar, deshabilitado = false }) => (
  <button
    type="button"
    role="switch"
    aria-checked={activo}
    aria-label={etiqueta}
    disabled={deshabilitado}
    onClick={alCambiar}
    className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-1 focus-visible:outline-2 focus-visible:outline-oro disabled:cursor-not-allowed disabled:opacity-50"
  >
    <span
      aria-hidden="true"
      className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 motion-safe:transition-colors motion-safe:duration-200 ${
        activo ? 'bg-oro' : 'bg-zinc-700'
      }`}
    >
      <span
        className={`size-5 rounded-full motion-safe:transition-transform motion-safe:duration-200 ${
          activo ? 'translate-x-5 bg-black' : 'translate-x-0 bg-zinc-300'
        }`}
      />
    </span>
    <span className={`text-sm font-medium ${activo ? 'text-oro' : 'text-zinc-400'}`}>{activo ? 'Activo' : 'Inactivo'}</span>
  </button>
)

export default InterruptorActivo
