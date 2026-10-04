// Estilo y envoltorio de los campos de los formularios del panel (etiqueta enlazada, ayuda y error por campo).
export const ESTILO_CAMPO =
  'min-h-11 w-full min-w-0 rounded-lg border bg-black px-3 text-sm text-white placeholder:text-zinc-500 focus-visible:outline-2 focus-visible:outline-oro'

const CampoFormulario = ({ id, etiqueta, error, ayuda, children }) => (
  <div className="flex min-w-0 flex-col gap-1">
    <label htmlFor={id} className="text-sm font-medium text-zinc-300">{etiqueta}</label>
    {children}
    {ayuda && !error && <p id={`${id}-ayuda`} className="text-xs text-zinc-500">{ayuda}</p>}
    {error && <p id={`${id}-error`} role="alert" className="text-sm text-red-400">{error}</p>}
  </div>
)

export default CampoFormulario
