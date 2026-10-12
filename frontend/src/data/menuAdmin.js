import { FiGrid, FiCalendar, FiScissors, FiUsers, FiFileText, FiSettings } from 'react-icons/fi'

export const SECCIONES_ADMIN = [
  { ruta: '/admin', etiqueta: 'Resumen', icono: FiGrid, exacta: true },
  { ruta: '/admin/citas', etiqueta: 'Citas', icono: FiCalendar },
  { ruta: '/admin/servicios', etiqueta: 'Servicios', icono: FiScissors },
  { ruta: '/admin/empleados', etiqueta: 'Empleados', icono: FiUsers },
  { ruta: '/admin/reportes', etiqueta: 'Reportes', icono: FiFileText },
  { ruta: '/admin/configuracion', etiqueta: 'Configuración', icono: FiSettings },
]
