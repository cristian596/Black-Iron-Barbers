import { useState } from 'react'
import { actualizarCita } from '../services/api'
import ModalConfirmar from '../components/admin/ModalConfirmar'
import { soloHora } from '../utils/formato'

// Completar y cancelar citas del barbero con el endpoint de siempre (PATCH /api/citas/:id). Completar es directo;
// cancelar pide confirmación en un ModalConfirmar (nunca window.confirm). Los errores del back-end (CITA_FUTURA u
// otros) se muestran en pantalla: `error` (acción directa) y dentro del propio diálogo (cancelar).
// `alExito` se llama tras cada cambio para recargar los datos del panel.
export const useAccionesCita = (token, alExito) => {
  const [ocupadoId, setOcupadoId] = useState(null)
  const [error, setError] = useState('')
  const [porCancelar, setPorCancelar] = useState(null)
  const [errorCancelar, setErrorCancelar] = useState('')

  const completar = async (cita) => {
    setError('')
    setOcupadoId(cita.id)
    try {
      await actualizarCita(token, cita.id, { estado: 'completada' })
      alExito?.()
    } catch (err) {
      setError(`No se pudo completar la cita de ${cita.cliente}: ${err.message}`)
    } finally {
      setOcupadoId(null)
    }
  }

  const pedirCancelar = (cita) => {
    setErrorCancelar('')
    setPorCancelar(cita)
  }

  const cerrarModal = () => {
    if (ocupadoId === null) setPorCancelar(null)
  }

  const confirmarCancelar = async () => {
    const cita = porCancelar
    setErrorCancelar('')
    setOcupadoId(cita.id)
    try {
      await actualizarCita(token, cita.id, { estado: 'cancelada' })
      setPorCancelar(null)
      alExito?.()
    } catch (err) {
      setErrorCancelar(err.message)
    } finally {
      setOcupadoId(null)
    }
  }

  const modalCancelar = porCancelar && (
    <ModalConfirmar
      titulo="Cancelar cita"
      texto={`¿Seguro que quieres cancelar la cita de ${porCancelar.cliente} (${soloHora(porCancelar.hora)})? Esta acción no se puede deshacer.`}
      textoConfirmar="Sí, cancelar cita"
      alConfirmar={confirmarCancelar}
      alCerrar={cerrarModal}
      cargando={ocupadoId === porCancelar.id}
      error={errorCancelar}
    />
  )

  return { ocupadoId, error, completar, pedirCancelar, modalCancelar }
}
