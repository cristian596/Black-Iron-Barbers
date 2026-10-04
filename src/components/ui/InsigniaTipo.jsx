import { TIPOS_POR_VALOR } from '../../data/tiposServicio'

const InsigniaTipo = ({ tipo }) => {
  const config = TIPOS_POR_VALOR[tipo]
  if (!config) return null

  const { etiqueta, Icono, clases } = config

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-poppins text-xs font-semibold ${clases}`}
    >
      <Icono aria-hidden="true" size={11} />
      {etiqueta}
    </span>
  )
}

export default InsigniaTipo
