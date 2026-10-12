const ESTILOS = {
  vencida: 'bg-orange-100 text-orange-900 border border-orange-400',
  pendiente: 'bg-amber-100 text-amber-900 border border-amber-400',
  completada: 'bg-green-100 text-green-900 border border-green-500',
  cancelada: 'bg-red-100 text-red-900 border border-red-500',
}

const TEXTOS = {
  pendiente: 'Pendiente',
  completada: 'Completada',
  cancelada: 'Cancelada',
}

// `vencida`: pendiente de un día (u hora) que ya pasó; se muestra como "Vencida".
const BadgeEstado = ({ estado, vencida = false }) => {
  const esVencida = vencida && estado === 'pendiente'
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
        esVencida ? ESTILOS.vencida : (ESTILOS[estado] ?? 'bg-gray-100 text-gray-800 border border-gray-400')
      }`}
    >
      {esVencida ? 'Vencida' : (TEXTOS[estado] ?? estado)}
      {esVencida && <span className="sr-only"> (cita pendiente de una fecha pasada)</span>}
    </span>
  )
}

export default BadgeEstado
