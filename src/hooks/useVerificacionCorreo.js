import { useCallback, useEffect, useRef, useState } from 'react'
import { solicitarCodigoCorreo, confirmarCodigoCorreo } from '../services/api'
import { esCorreoValido, normalizarCorreo } from '../utils/correo'
import { useCuentaAtras } from './useCuentaAtras'

export const ESPERA_REENVIO_SEG = 60
const VIGENCIA_COMPROBANTE_SEG = 30 * 60
const MARGEN_VENCIMIENTO_SEG = 5
const REGEX_CODIGO = /^\d{6}$/

const textoEspera = (segundos) => {
  const total = Math.max(1, Math.ceil(segundos))
  return total >= 90 ? `${Math.ceil(total / 60)} minutos` : `${total} segundos`
}

const MENSAJE_RED = 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.'

// Mensaje (en español) de un error al pedir el código.
const mensajeAlSolicitar = (err) => {
  if (err.status === 429) {
    const espera = Number.isFinite(err.reintentar_en_seg) ? ` Inténtalo de nuevo en ${textoEspera(err.reintentar_en_seg)}.` : ''
    return err.codigo === 'ESPERA_REQUERIDA'
      ? `Ya te enviamos un código hace un momento.${espera}`
      : `Pediste demasiados códigos.${espera}`
  }
  if (err.codigo === 'CORREO_NO_DISPONIBLE') return 'No pudimos enviar el código en este momento. Inténtalo de nuevo en unos minutos.'
  if (err.codigo === 'CORREO_INVALIDO') return 'El correo no es válido.'
  if (!err.status) return MENSAJE_RED
  return 'No pudimos enviar el código. Inténtalo de nuevo.'
}

const mensajeAlConfirmar = (err) => {
  if (err.codigo === 'CODIGO_INVALIDO') return 'El código es incorrecto o ya venció. Revísalo o pide uno nuevo.'
  if (err.codigo === 'CODIGO_FORMATO_INVALIDO') return 'El código debe tener 6 dígitos.'
  if (err.status === 429) {
    const espera = Number.isFinite(err.reintentar_en_seg) ? ` Inténtalo de nuevo en ${textoEspera(err.reintentar_en_seg)}.` : ''
    return `Demasiados intentos.${espera}`
  }
  if (!err.status) return MENSAJE_RED
  return 'No pudimos verificar el código. Inténtalo de nuevo.'
}

const VACIO = { solicitadoA: '', verificadoA: '', token: '' }

// Verificación del correo con un código de 6 dígitos. Vive en `ReservaCorte` (no en el modal) para que el comprobante
// sobreviva a un 409 de horario: el modal se cierra, la persona elige otro bloque y no tiene que verificar otra vez.
// El comprobante solo existe en memoria (nunca en localStorage/sessionStorage) y no se muestra jamás. Si el correo
// escrito deja de ser el verificado, el comprobante deja de valer en el acto.
//
// Devuelve: `verificado`, `token` (vacío si no hay uno válido para el correo actual), `codigoSolicitado` (ya se pidió un
// código para este correo), `pendiente` ('' | 'enviando' | 'verificando'), `error` ({ mensaje } o null), `restante`
// (segundos para poder reenviar) y las acciones `solicitar`, `confirmar(codigo)`, `descartar` y `cambiarCorreo`.
export const useVerificacionCorreo = (correo) => {
  const actual = normalizarCorreo(correo)
  const actualRef = useRef(actual)
  const enCursoRef = useRef(false)
  useEffect(() => {
    actualRef.current = actual
  }, [actual])

  const [estado, setEstado] = useState(VACIO)
  const [pendiente, setPendiente] = useState('')
  const [fallo, setFallo] = useState(null)
  const { restante, iniciar, detener } = useCuentaAtras()

  const verificado = Boolean(estado.token) && estado.verificadoA === actual && actual !== ''
  const codigoSolicitado = actual !== '' && estado.solicitadoA === actual
  const error = fallo && fallo.correo === actual ? fallo : null

  // El comprobante dura 30 min en el servidor: se descarta un poco antes para no enviar uno que ya venció.
  const expiraEnSeg = estado.expiraEnSeg
  useEffect(() => {
    if (!estado.token) return undefined
    const espera = Math.max(1, (expiraEnSeg ?? VIGENCIA_COMPROBANTE_SEG) - MARGEN_VENCIMIENTO_SEG) * 1000
    const id = setTimeout(() => {
      setEstado(VACIO)
      setFallo({ correo: estado.verificadoA, mensaje: 'La verificación venció. Verifica tu correo de nuevo.' })
    }, espera)
    return () => clearTimeout(id)
  }, [estado.token, estado.verificadoA, expiraEnSeg])

  const solicitar = useCallback(async () => {
    const destino = actualRef.current
    if (!esCorreoValido(destino)) {
      setFallo({ correo: destino, mensaje: 'Escribe un correo válido para recibir el código.' })
      return false
    }
    if (enCursoRef.current) return false
    enCursoRef.current = true
    setPendiente('enviando')
    setFallo(null)
    try {
      const respuesta = await solicitarCodigoCorreo(destino)
      setEstado((previo) => ({ ...previo, solicitadoA: destino }))
      iniciar(Number.isFinite(respuesta?.reenviar_en_seg) ? respuesta.reenviar_en_seg : ESPERA_REENVIO_SEG)
      return true
    } catch (err) {
      if (err.codigo === 'ESPERA_REQUERIDA') {
        // Ya hay un código reciente para este correo: se queda en el paso del código y se espera para reenviar.
        setEstado((previo) => ({ ...previo, solicitadoA: destino }))
        iniciar(Number.isFinite(err.reintentar_en_seg) ? err.reintentar_en_seg : ESPERA_REENVIO_SEG)
      }
      setFallo({ correo: destino, mensaje: mensajeAlSolicitar(err) })
      return false
    } finally {
      enCursoRef.current = false
      setPendiente('')
    }
  }, [iniciar])

  const confirmar = useCallback(async (codigo) => {
    const destino = actualRef.current
    if (typeof codigo !== 'string' || !REGEX_CODIGO.test(codigo)) {
      setFallo({ correo: destino, mensaje: 'Escribe los 6 dígitos del código.' })
      return false
    }
    if (enCursoRef.current) return false
    enCursoRef.current = true
    setPendiente('verificando')
    setFallo(null)
    try {
      const respuesta = await confirmarCodigoCorreo(destino, codigo)
      setEstado({
        solicitadoA: destino,
        verificadoA: destino,
        token: respuesta.token,
        expiraEnSeg: Number.isFinite(respuesta.expira_en_seg) ? respuesta.expira_en_seg : VIGENCIA_COMPROBANTE_SEG,
      })
      detener()
      return true
    } catch (err) {
      setFallo({ correo: destino, mensaje: mensajeAlConfirmar(err) })
      return false
    } finally {
      enCursoRef.current = false
      setPendiente('')
    }
  }, [detener])

  // Olvida el comprobante y el código pedido: vuelve a empezar (el servidor lo rechazó, la reserva se completó o la
  // persona quiere cambiar de correo).
  const descartar = useCallback(() => {
    setEstado(VACIO)
    setFallo(null)
    detener()
  }, [detener])

  return {
    verificado,
    token: verificado ? estado.token : '',
    codigoSolicitado,
    pendiente,
    error,
    restante: codigoSolicitado ? restante : 0,
    solicitar,
    confirmar,
    descartar,
    cambiarCorreo: descartar,
  }
}
