import { PASOS_RESERVA } from './pasos'

// `etiquetaProfesional`: cómo se llama el paso de profesionales según la reserva (Barbero / Asesor/a / Profesionales).
const IndicadorProgreso = ({ pasoActual, etiquetaProfesional }) => {
  const indiceActual = PASOS_RESERVA.findIndex((paso) => paso.key === pasoActual)

  return (
    <ol className="mx-auto flex w-full max-w-2xl items-start" aria-label="Progreso de la reserva">
      {PASOS_RESERVA.map((paso, indice) => {
        const completado = indice < indiceActual
        const activo = indice === indiceActual

        return (
          <li key={paso.key} className="flex flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              {indice > 0 && (
                <span
                  aria-hidden="true"
                  className={`h-0.5 flex-1 motion-safe:transition-colors motion-safe:duration-300 ${
                    indice <= indiceActual ? 'bg-[#D4AF37]' : 'bg-zinc-300'
                  }`}
                />
              )}
              <span
                aria-current={activo ? 'step' : undefined}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 font-poppins text-sm font-semibold motion-safe:transition-colors motion-safe:duration-300 ${
                  completado
                    ? 'border-[#D4AF37] bg-[#D4AF37] text-black'
                    : activo
                      ? 'border-[#D4AF37] text-[#D4AF37]'
                      : 'border-zinc-300 text-zinc-400'
                }`}
              >
                {completado ? '✓' : indice + 1}
              </span>
            </div>
            <span
              className={`mt-1 text-center font-poppins text-[11px] sm:text-sm ${
                activo ? 'font-semibold text-black' : 'text-zinc-500'
              }`}
            >
              {paso.key === 'barbero' && etiquetaProfesional ? etiquetaProfesional : paso.etiqueta}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export default IndicadorProgreso
