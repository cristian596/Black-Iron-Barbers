import { LEGAL } from '../../data/legal'

// Datos de contacto del responsable: cada campo se muestra solo si tiene valor en la configuración legal.
const CAMPOS = [
  { id: 'nombreComercial', etiqueta: 'Nombre comercial' },
  { id: 'razonSocial', etiqueta: 'Razón social' },
  { id: 'nit', etiqueta: 'NIT' },
  { id: 'domicilio', etiqueta: 'Domicilio' },
  { id: 'correo', etiqueta: 'Correo electrónico', enlace: (valor) => `mailto:${valor}` },
  { id: 'telefono', etiqueta: 'Teléfono' },
]

const DatosResponsable = ({ legal = LEGAL }) => (
  <dl className="mt-4 divide-y divide-white/10 rounded-xl border border-white/10 bg-white/5 font-poppins text-base">
    {CAMPOS.filter(({ id }) => String(legal[id] ?? '').trim() !== '').map(({ id, etiqueta, enlace }) => (
      <div key={id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:gap-4">
        <dt className="shrink-0 text-zinc-400 sm:w-44">{etiqueta}</dt>
        <dd className="min-w-0 text-white wrap-anywhere">
          {enlace ? (
            <a
              href={enlace(legal[id])}
              className="text-oro underline decoration-oro/60 underline-offset-4 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oro"
            >
              {legal[id]}
            </a>
          ) : (
            legal[id]
          )}
        </dd>
      </div>
    ))}
  </dl>
)

export default DatosResponsable
