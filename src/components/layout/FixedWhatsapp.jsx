import { FaWhatsapp } from "react-icons/fa";

// TODO: reemplazar por el número real de WhatsApp de la barbería.
const NUMERO_WHATSAPP = 'PENDIENTE_NUMERO'
const MENSAJE_PRELLENADO = encodeURIComponent('¡Hola! Quiero agendar una cita en Black Iron Barbers.')

const FixedWhatsapp = () => {
  return (
    <a
      href={`https://wa.me/${NUMERO_WHATSAPP}?text=${MENSAJE_PRELLENADO}`}
      target='_blank'
      rel='noopener noreferrer'
      aria-label='Escribir por WhatsApp a Black Iron Barbers'
      className='fixed bottom-15 right-2 z-50 bg-[#25D366] text-white rounded-full p-3 m-2 shadow-2xl hover:scale-110 transition-all duration-300 active:scale-95'
    >
      <FaWhatsapp size={32} />
    </a>
  )
}

export default FixedWhatsapp
