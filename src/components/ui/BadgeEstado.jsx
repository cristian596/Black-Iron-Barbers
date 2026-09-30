const ESTILOS = {
  pendiente: 'bg-amber-100 text-amber-900 border border-amber-400',
  completada: 'bg-green-100 text-green-900 border border-green-500',
  cancelada: 'bg-red-100 text-red-900 border border-red-500',
}

const TEXTOS = {
  pendiente: 'Pendiente',
  completada: 'Completada',
  cancelada: 'Cancelada',
}

const BadgeEstado = ({ estado }) => (
  <span
    className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
      ESTILOS[estado] ?? 'bg-gray-100 text-gray-800 border border-gray-400'
    }`}
  >
    {TEXTOS[estado] ?? estado}
  </span>
)

export default BadgeEstado
