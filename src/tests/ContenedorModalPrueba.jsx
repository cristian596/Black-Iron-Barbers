import { useState } from 'react'
import ModalConfirmacion from '../components/sections/reserva/ModalConfirmacion'
import { useVerificacionCorreo } from '../hooks/useVerificacionCorreo'

// ModalConfirmacion con su correo y verificación como los lleva la página: estado del correo + el hook REAL (con el API
// mockeado). Requiere que la suite mockee solicitarCodigoCorreo y confirmarCodigoCorreo.
const ContenedorModalPrueba = ({ correoInicial = '', ...props }) => {
  const [correo, setCorreo] = useState(correoInicial)
  const verificacion = useVerificacionCorreo(correo)
  return <ModalConfirmacion correo={correo} onCorreoChange={setCorreo} verificacion={verificacion} {...props} />
}

export default ContenedorModalPrueba
