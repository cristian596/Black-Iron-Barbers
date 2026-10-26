import { useState } from 'react'
import { useConsentimiento } from '../../hooks/useConsentimiento'
import { guardarConsentimiento } from '../../utils/consentimiento'
import { BOTON_PRIMARIO, BOTON_SECUNDARIO, FOCO } from './estilosCookies'

const Interruptor = ({ activo, deshabilitado = false, idTitulo, idDescripcion, alCambiar }) => (
  <button
    type="button"
    role="switch"
    aria-checked={activo}
    aria-labelledby={idTitulo}
    aria-describedby={idDescripcion}
    disabled={deshabilitado}
    onClick={alCambiar}
    className={`flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-lg px-1 disabled:cursor-not-allowed disabled:opacity-60 ${FOCO}`}
  >
    <span
      aria-hidden="true"
      className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 motion-safe:transition-colors motion-safe:duration-200 ${
        activo ? 'bg-oro' : 'bg-zinc-600'
      }`}
    >
      <span
        className={`size-5 rounded-full motion-safe:transition-transform motion-safe:duration-200 ${
          activo ? 'translate-x-5 bg-black' : 'translate-x-0 bg-zinc-200'
        }`}
      />
    </span>
    <span className={`w-28 text-left text-sm font-medium ${activo ? 'text-oro' : 'text-zinc-300'}`}>
      {deshabilitado ? 'Siempre activas' : activo ? 'Activadas' : 'Desactivadas'}
    </span>
  </button>
)

const CATEGORIAS = [
  {
    id: 'necesarias',
    titulo: 'Necesarias',
    descripcion:
      'Hacen que el sitio funcione: guardan tu selección de servicios mientras reservas, la sesión del personal y tu decisión sobre las cookies. No se pueden desactivar.',
  },
  {
    id: 'analiticas',
    titulo: 'Analíticas',
    descripcion:
      'Google Analytics nos dice, de forma agregada, qué páginas se visitan para mejorar el sitio. Solo se activan si las aceptas.',
  },
]

const textoDecision = (decision) => {
  if (!decision) return 'Aún no has elegido: por ahora solo están activas las cookies necesarias.'
  const fecha = new Date(decision.fecha).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Bogota',
  })
  return `Tu decisión actual: cookies analíticas ${decision.analiticas ? 'aceptadas' : 'rechazadas'} (${fecha}).`
}

const FormularioCookies = ({ idBase, alTerminar }) => {
  const { decision } = useConsentimiento()
  const [analiticas, setAnaliticas] = useState(decision?.analiticas ?? false)

  const guardar = (valor) => {
    guardarConsentimiento({ analiticas: valor })
    alTerminar?.()
  }

  return (
    <div className="space-y-3">
      {CATEGORIAS.map(({ id, titulo, descripcion }) => {
        const necesaria = id === 'necesarias'
        return (
          <div
            key={id}
            className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
          >
            <div className="min-w-0">
              <h3 id={`${idBase}-${id}`} className="font-poppins text-base font-semibold text-white">
                {titulo}
              </h3>
              <p id={`${idBase}-${id}-desc`} className="mt-1 font-poppins text-sm text-zinc-300">
                {descripcion}
              </p>
            </div>
            <Interruptor
              activo={necesaria ? true : analiticas}
              deshabilitado={necesaria}
              idTitulo={`${idBase}-${id}`}
              idDescripcion={`${idBase}-${id}-desc`}
              alCambiar={necesaria ? undefined : () => setAnaliticas((valor) => !valor)}
            />
          </div>
        )
      })}

      <p role="status" aria-live="polite" className="font-poppins text-sm text-zinc-300">
        {textoDecision(decision)}
      </p>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button type="button" onClick={() => guardar(analiticas)} className={BOTON_PRIMARIO}>
          Guardar preferencias
        </button>
        <button type="button" onClick={() => guardar(true)} className={BOTON_SECUNDARIO}>
          Aceptar todas
        </button>
        <button type="button" onClick={() => guardar(false)} className={BOTON_SECUNDARIO}>
          Rechazar todas
        </button>
      </div>
    </div>
  )
}

// Categorías de cookies con sus interruptores y los botones Guardar / Aceptar todas / Rechazar todas. Lo usan el
// diálogo (PanelCookies) y la página de la política de cookies. `idBase` evita ids repetidos si hay dos a la vez.
// Si la decisión cambia desde otro sitio (p. ej. el banner), el formulario se reinicia con el valor guardado.
const OpcionesCookies = ({ idBase, alTerminar }) => {
  const { decision } = useConsentimiento()
  return <FormularioCookies key={decision?.fecha ?? 'sin-decision'} idBase={idBase} alTerminar={alTerminar} />
}

export default OpcionesCookies
