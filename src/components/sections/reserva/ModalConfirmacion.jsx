import { useEffect, useRef, useState } from 'react'
import { formatearFechaLegible } from '../../../utils/fechas'
import { esTelefonoValido } from '../../../utils/telefono'
import { formatearDuracion, formatearPrecio } from '../../../utils/formato'
import { duracionTotal, precioTotal } from '../../../utils/carrito'
import { TITULO_CITA, esAsesoriaGratis, planCitas, separarPorArea } from '../../../utils/reservaAsesoria'
import { useComprobarGratis } from '../../../hooks/useComprobarGratis'
import ListaServiciosReserva from './ListaServiciosReserva'

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const CODIGO_GRATIS_YA_USADA = 'ASESORIA_GRATIS_YA_USADA'

const mensajeParaError = (err) => {
  if (err.status === 429) return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'
  if (err.status === 400) return err.message
  if (!err.status) return 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.'
  return err.message || 'Ocurrió un error inesperado. Inténtalo de nuevo.'
}

const FOCUSABLES = 'button, input, [href], select, textarea, [tabindex]:not([tabindex="-1"])'

const botonAviso =
  'min-h-11 w-full rounded-xl border border-black px-4 py-2 font-poppins text-sm font-semibold text-black duration-200 hover:bg-black hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black'

const Fila = ({ etiqueta, children, fuerte = false }) => (
  <div className="flex justify-between gap-2">
    <dt className="shrink-0 text-zinc-500">{etiqueta}</dt>
    <dd className={`min-w-0 text-right text-black wrap-anywhere ${fuerte ? 'font-bold' : 'font-semibold'}`}>{children}</dd>
  </div>
)

// `servicios`: los servicios elegidos (1 a 3, con a lo sumo una asesoría). Con uno solo el resumen es el de siempre; con
// varios se listan y se muestra la duración total; con asesoría + barbería son DOS citas y cada una lleva su profesional
// y su horario. Si la reserva incluye la asesoría gratuita y esa persona ya la usó (comprobación temprana o 409 del
// servidor) se avisa, se bloquea confirmar y se ofrece quitarla (`onQuitarGratis`) o elegir otra asesoría
// (`onElegirOtraAsesoria`); ambos reciben el id de la asesoría gratuita.
const ModalConfirmacion = ({
  servicios,
  barbero,
  asesor = null,
  fecha,
  hora,
  onClose,
  onConfirmar,
  onQuitarGratis,
  onElegirOtraAsesoria,
}) => {
  const [cliente, setCliente] = useState('')
  const [correo, setCorreo] = useState('')
  const [telefono, setTelefono] = useState('')
  const [consentimiento, setConsentimiento] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  // Datos (correo + teléfono) con los que el servidor ya respondió 409 ASESORIA_GRATIS_YA_USADA.
  const [datosRechazados, setDatosRechazados] = useState('')

  const gratis = servicios.find(esAsesoriaGratis) ?? null
  const disponibleGratis = useComprobarGratis({ activo: Boolean(gratis), correo, telefono })
  const claveDatos = `${correo}\n${telefono}`
  // El aviso nunca dice qué dato coincidió. Si el cliente cambia sus datos, se vuelve a evaluar.
  const gratisUsada = Boolean(gratis) && (disponibleGratis === false || datosRechazados === claveDatos)

  const { asesoria, barberia } = separarPorArea(servicios)
  const soloAsesoria = Boolean(asesoria) && barberia.length === 0
  const plan = planCitas(servicios, hora)
  const combinada = plan.length === 2

  const dialogRef = useRef(null)
  const primerCampoRef = useRef(null)

  useEffect(() => {
    primerCampoRef.current?.focus()

    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const manejarTeclado = (evento) => {
      if (evento.key === 'Escape') {
        onClose()
        return
      }
      if (evento.key !== 'Tab' || !dialogRef.current) return

      const focusables = dialogRef.current.querySelectorAll(FOCUSABLES)
      if (focusables.length === 0) return

      const primero = focusables[0]
      const ultimo = focusables[focusables.length - 1]

      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault()
        ultimo.focus()
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault()
        primero.focus()
      }
    }

    document.addEventListener('keydown', manejarTeclado)
    return () => {
      document.removeEventListener('keydown', manejarTeclado)
      document.body.style.overflow = overflowPrevio
    }
  }, [onClose])

  const validar = () => {
    if (!cliente.trim()) return 'El nombre es obligatorio'
    if (!REGEX_CORREO.test(correo)) return 'El correo no es válido'
    if (!esTelefonoValido(telefono)) {
      return 'El teléfono debe ser un celular colombiano válido (10 dígitos, inicia en 3)'
    }
    if (!consentimiento) return 'Debes aceptar el tratamiento de datos personales para continuar'
    return ''
  }

  const handleSubmit = async (evento) => {
    evento.preventDefault()
    if (gratisUsada) return

    const mensajeValidacion = validar()
    if (mensajeValidacion) {
      setError(mensajeValidacion)
      return
    }

    setEnviando(true)
    setError('')
    try {
      await onConfirmar({ cliente: cliente.trim(), correo, telefono, consentimiento })
    } catch (err) {
      if (err.codigo === CODIGO_GRATIS_YA_USADA) {
        // No se creó nada (tampoco el corte de una combinada): se muestra el aviso con sus dos salidas.
        setDatosRechazados(claveDatos)
      } else {
        setError(mensajeParaError(err))
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-confirmacion-reserva"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="titulo-confirmacion-reserva" className="font-cinzel text-2xl font-bold text-black">
            Confirma tu reserva
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-xl text-zinc-500 duration-150 hover:bg-zinc-100 hover:text-black"
          >
            ✕
          </button>
        </div>

        {combinada ? (
          <div className="mt-4 space-y-3 rounded-xl bg-zinc-50 p-4 font-poppins text-sm">
            {plan.map((cita) => {
              const esAsesoria = cita.clave === 'asesoria'
              const profesional = esAsesoria ? asesor : barbero
              return (
                <section
                  key={cita.clave}
                  aria-label={TITULO_CITA[cita.clave]}
                  className="rounded-lg border border-zinc-200 bg-white p-3"
                >
                  <h3 className="font-cinzel text-base font-bold text-black">
                    {TITULO_CITA[cita.clave]} · {cita.inicio} – {cita.fin}
                  </h3>
                  <dl className="mt-2 space-y-1">
                    <div>
                      <dt className="text-zinc-500">{cita.servicios.length > 1 ? 'Servicios' : 'Servicio'}</dt>
                      <dd className="mt-1 font-semibold text-black">
                        <ListaServiciosReserva servicios={cita.servicios} conPrecio />
                      </dd>
                    </div>
                    <Fila etiqueta={esAsesoria ? 'Asesor/a' : 'Barbero'}>
                      {profesional
                        ? profesional.nombre
                        : esAsesoria
                          ? 'Cualquier asesor disponible'
                          : 'Cualquier barbero disponible'}
                    </Fila>
                  </dl>
                </section>
              )
            })}
            <dl className="space-y-1">
              <Fila etiqueta="Fecha">{formatearFechaLegible(fecha)}</Fila>
              <Fila etiqueta="Duración total">{formatearDuracion(duracionTotal(servicios))}</Fila>
              <div className="mt-1 border-t border-zinc-200 pt-2">
                <Fila etiqueta="Total" fuerte>
                  {formatearPrecio(precioTotal(servicios))}
                </Fila>
              </div>
            </dl>
          </div>
        ) : (
          <dl className="mt-4 space-y-1 rounded-xl bg-zinc-50 p-4 font-poppins text-sm">
            {servicios.length > 1 ? (
              <div>
                <dt className="text-zinc-500">Servicios</dt>
                <dd className="mt-1 font-semibold text-black">
                  <ListaServiciosReserva servicios={servicios} conPrecio />
                </dd>
              </div>
            ) : (
              <Fila etiqueta="Servicio">{servicios[0]?.nombre}</Fila>
            )}
            {soloAsesoria ? (
              <Fila etiqueta="Asesor/a">{asesor ? asesor.nombre : 'Cualquier asesor disponible'}</Fila>
            ) : (
              <Fila etiqueta="Barbero">{barbero ? barbero.nombre : 'Cualquier barbero disponible'}</Fila>
            )}
            <Fila etiqueta="Fecha">{formatearFechaLegible(fecha)}</Fila>
            <Fila etiqueta="Hora">{hora}</Fila>
            <Fila etiqueta="Duración">
              {servicios.length > 1 ? formatearDuracion(duracionTotal(servicios)) : `${servicios[0]?.duracion_min} min`}
            </Fila>
            <div className="mt-1 border-t border-zinc-200 pt-2">
              <Fila etiqueta="Total" fuerte>
                {servicios.length > 0 ? formatearPrecio(precioTotal(servicios)) : '—'}
              </Fila>
            </div>
          </dl>
        )}

        <form className="mt-4 space-y-3" onSubmit={handleSubmit} noValidate>
          <div>
            <label htmlFor="reserva-cliente" className="block font-poppins text-sm font-medium text-zinc-700">
              Nombre
            </label>
            <input
              ref={primerCampoRef}
              id="reserva-cliente"
              name="cliente"
              type="text"
              value={cliente}
              onChange={(evento) => setCliente(evento.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border border-zinc-300 p-2 font-poppins focus:border-oro focus:outline-none focus:ring-2 focus:ring-oro"
            />
          </div>

          <div>
            <label htmlFor="reserva-correo" className="block font-poppins text-sm font-medium text-zinc-700">
              Correo electrónico
            </label>
            <input
              id="reserva-correo"
              name="correo"
              type="email"
              value={correo}
              onChange={(evento) => setCorreo(evento.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border border-zinc-300 p-2 font-poppins focus:border-oro focus:outline-none focus:ring-2 focus:ring-oro"
            />
          </div>

          <div>
            <label htmlFor="reserva-telefono" className="block font-poppins text-sm font-medium text-zinc-700">
              Teléfono
            </label>
            <input
              id="reserva-telefono"
              name="telefono"
              type="tel"
              placeholder="300 123 4567"
              value={telefono}
              onChange={(evento) => setTelefono(evento.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border border-zinc-300 p-2 font-poppins focus:border-oro focus:outline-none focus:ring-2 focus:ring-oro"
            />
          </div>

          {/* Toda la fila es la etiqueta (zona clicable de al menos 44 px de alto); el checkbox conserva su tamaño de 16 px. */}
          <label
            htmlFor="reserva-consentimiento"
            className="flex min-h-11 cursor-pointer items-start gap-2 py-1 font-poppins text-xs text-zinc-600"
          >
            <input
              id="reserva-consentimiento"
              name="consentimiento"
              type="checkbox"
              checked={consentimiento}
              onChange={(evento) => setConsentimiento(evento.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-300 text-oro focus:ring-oro"
            />
            <span>
              Acepto que Black Iron Barbers use mis datos de contacto (nombre, correo y teléfono)
              únicamente para gestionar esta cita, conforme a la Ley 1581 de 2012 de Protección de Datos
              Personales. No se usarán con fines publicitarios ni se compartirán con terceros.
            </span>
          </label>

          {/* Siempre presente para que el lector de pantalla anuncie el aviso cuando aparece. No dice qué dato coincidió. */}
          <div role="status" aria-live="polite">
            {gratisUsada && (
              <p
                id="aviso-gratis-usada"
                className="rounded-lg border border-amber-400 bg-amber-50 p-3 font-poppins text-sm font-semibold text-zinc-900"
              >
                Ya usaste tu asesoría gratuita. No puedes reservarla otra vez con estos datos. Puedes quitarla de tu
                reserva o elegir otra asesoría.
              </p>
            )}
          </div>
          {gratisUsada && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={() => onQuitarGratis?.(gratis.id)} className={botonAviso}>
                Quitar asesoría gratuita
              </button>
              <button type="button" onClick={() => onElegirOtraAsesoria?.(gratis.id)} className={botonAviso}>
                Elegir otra asesoría
              </button>
            </div>
          )}

          {error && (
            <p role="alert" className="font-poppins text-sm font-semibold text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando || gratisUsada}
            aria-describedby={gratisUsada ? 'aviso-gratis-usada' : undefined}
            className="mt-2 min-h-11 w-full rounded-xl bg-oro py-2 font-cinzel font-bold text-black duration-200 hover:bg-black hover:text-oro disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-oro disabled:hover:text-black"
          >
            {enviando ? 'Enviando...' : 'Confirmar reserva'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default ModalConfirmacion
