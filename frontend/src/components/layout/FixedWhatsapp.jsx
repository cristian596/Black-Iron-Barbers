import { FaWhatsapp } from "react-icons/fa";
import { enlaceWhatsApp, MENSAJE_WHATSAPP_GENERAL } from '../../data/negocio'

const FixedWhatsapp = () => {
  return (
    <a
      href={enlaceWhatsApp(MENSAJE_WHATSAPP_GENERAL)}
      target='_blank'
      rel='noopener noreferrer'
      aria-label='Escribir por WhatsApp a Black Iron Barbers'
      className='fixed bottom-15 right-1 md:right-2 z-50 bg-[#25D366] text-white rounded-full p-2.5 md:p-3 m-2 shadow-2xl hover:scale-110 transition-all duration-300 active:scale-95'
    >
      <FaWhatsapp aria-hidden='true' className='size-7 md:size-8' />
    </a>
  )
}

export default FixedWhatsapp
