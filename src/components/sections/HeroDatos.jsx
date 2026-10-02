import { FaUserTie } from 'react-icons/fa6'
import { FaClock, FaMapMarkerAlt } from 'react-icons/fa'
import useCantidadBarberos from '../../hooks/useCantidadBarberos'
import { negocio } from '../../data/negocio'

const textoBarberos = (cantidad) =>
  `${cantidad} ${cantidad === 1 ? 'barbero' : 'barberos'}`

const HeroDatos = ({ className = '' }) => {
  // Sin datos de la API no se muestra la cifra: nunca se inventa
  const cantidad = useCantidadBarberos()

  const datos = [
    ...(cantidad > 0 ? [{ Icono: FaUserTie, texto: textoBarberos(cantidad) }] : []),
    { Icono: FaClock, texto: negocio.horario },
    { Icono: FaMapMarkerAlt, texto: negocio.direccion },
  ]

  return (
    <ul
      aria-label='Datos de la barbería'
      className={`flex flex-col gap-3 border-t border-white/15 pt-6 font-poppins text-sm text-zinc-200 sm:flex-row sm:flex-wrap sm:gap-x-8 ${className}`}
    >
      {datos.map(({ Icono, texto }) => (
        <li key={texto} className='flex items-center gap-2'>
          <Icono aria-hidden='true' className='shrink-0 text-oro' />
          {texto}
        </li>
      ))}
    </ul>
  )
}

export default HeroDatos
