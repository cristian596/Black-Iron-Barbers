import { FiGrid, FiCalendar, FiTrendingUp, FiUser, FiSettings } from 'react-icons/fi'

export const SECCIONES_BARBERO = [
  { ruta: '/panel', etiqueta: 'Resumen', icono: FiGrid, exacta: true },
  { ruta: '/panel/citas', etiqueta: 'Mis citas', icono: FiCalendar },
  { ruta: '/panel/rendimiento', etiqueta: 'Mi rendimiento', icono: FiTrendingUp },
  { ruta: '/panel/cuenta', etiqueta: 'Mi cuenta', icono: FiUser },
  { ruta: '/panel/configuracion', etiqueta: 'Configuración', icono: FiSettings },
]
