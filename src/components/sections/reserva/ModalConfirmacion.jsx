import { useEffect, useRef, useState } from 'react'
import { formatearFechaLegible } from '../../../utils/fechas'
import { esTelefonoValido } from '../../../utils/telefono'
import { formatearPrecio } from '../../../utils/formato'

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const mensajeParaError = (err) => {
  if (err.status === 429) return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'
  if (err.status === 400) return err.message
  if (!err.status) return 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.'
  return err.message || 'Ocurrió un error inesperado. Inténtalo de nuevo.'
}

const FOCUSABLES = 'button, input, [href], select, textarea, [tabindex]:not([tabindex="-1"])'

const ModalConfirmacion = ({ servicio, barbero, fecha, hora, onClose, onConfirmar }) => {
  const [cliente, setCliente] = useState('')
  const [correo, setCorreo] = useState('')
  const [telefono, setTelefono] = useState('')
  const [consentimiento, setConsentimiento] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

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
      setError(mensajeParaError(err))
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
            className="rounded-full p-1 text-xl text-zinc-500 duration-150 hover:bg-zinc-100 hover:text-black"
          >
            ✕
          </button>
        </div>

        <dl className="mt-4 space-y-1 rounded-xl bg-zinc-50 p-4 font-poppins text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500">Servicio</dt>
            <dd className="text-right font-semibold text-black">{servicio?.nombre}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500">Barbero</dt>
            <dd className="text-right font-semibold text-black">
              {barbero ? barbero.nombre : 'Cualquier barbero disponible'}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500">Fecha</dt>
            <dd className="text-right font-semibold text-black">{formatearFechaLegible(fecha)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500">Hora</dt>
            <dd className="text-right font-semibold text-black">{hora}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500">Duración</dt>
            <dd className="text-right font-semibold text-black">{servicio?.duracion_min} min</dd>
          </div>
          <div className="mt-1 flex justify-between gap-2 border-t border-zinc-200 pt-2">
            <dt className="text-zinc-500">Total</dt>
            <dd className="text-right font-bold text-black">
              {servicio ? formatearPrecio(servicio.precio) : '—'}
            </dd>
          </div>
        </dl>

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
              className="mt-1 w-full rounded-lg border border-zinc-300 p-2 font-poppins focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
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
              className="mt-1 w-full rounded-lg border border-zinc-300 p-2 font-poppins focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
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
              className="mt-1 w-full rounded-lg border border-zinc-300 p-2 font-poppins focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
            />
          </div>

          <div className="flex items-start gap-2">
            <input
              id="reserva-consentimiento"
              name="consentimiento"
              type="checkbox"
              checked={consentimiento}
              onChange={(evento) => setConsentimiento(evento.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-300 text-[#D4AF37] focus:ring-[#D4AF37]"
            />
            <label htmlFor="reserva-consentimiento" className="font-poppins text-xs text-zinc-600">
              Acepto que Black Iron Barbers use mis datos de contacto (nombre, correo y teléfono)
              únicamente para gestionar esta cita, conforme a la Ley 1581 de 2012 de Protección de Datos
              Personales. No se usarán con fines publicitarios ni se compartirán con terceros.
            </label>
          </div>

          {error && (
            <p role="alert" className="font-poppins text-sm font-semibold text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="mt-2 w-full rounded-xl bg-[#D4AF37] py-2 font-cinzel font-bold text-black duration-200 hover:bg-black hover:text-[#D4AF37] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[#D4AF37] disabled:hover:text-black"
          >
            {enviando ? 'Enviando...' : 'Confirmar reserva'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default ModalConfirmacion
