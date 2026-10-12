import { FiEdit2 } from 'react-icons/fi'
import InsigniaTipo from '../ui/InsigniaTipo'
import InterruptorActivo from './InterruptorActivo'
import { formatearPrecio } from '../../utils/formato'
import { nombreCategoria } from '../../utils/servicios'
import { EtiquetaArea } from '../ui/ReservaCombinada'

const BOTON_EDITAR =
  'inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/15 px-3 text-sm font-medium text-zinc-200 hover:border-white/40 hover:text-white focus-visible:outline-2 focus-visible:outline-oro'

// Etiqueta de texto (no solo opacidad) para los servicios apagados.
const EtiquetaInactivo = () => (
  <span className="rounded-full border border-zinc-600 px-2 py-0.5 text-xs font-medium text-zinc-400">Inactivo</span>
)

const Tarjeta = ({ servicio, alEditar, alCambiarActivo, guardando }) => (
  <article className={`min-w-0 rounded-xl border border-white/10 bg-zinc-950 p-4 ${servicio.activo ? '' : 'opacity-60'}`}>
    <div className="flex items-start justify-between gap-2">
      <h3 className="min-w-0 wrap-anywhere text-base font-semibold">{servicio.nombre}</h3>
      <InsigniaTipo tipo={servicio.tipo} />
    </div>
    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-zinc-500">
      {nombreCategoria(servicio)}
      <EtiquetaArea area={servicio.area} />
    </p>
    <p className="mt-2 flex items-center justify-between text-sm text-zinc-300">
      <span>{servicio.duracion_min} min</span>
      <span className="font-semibold text-white">{formatearPrecio(servicio.precio)}</span>
    </p>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <InterruptorActivo
        activo={servicio.activo}
        etiqueta={`${servicio.activo ? 'Desactivar' : 'Activar'} ${servicio.nombre}`}
        deshabilitado={guardando}
        alCambiar={() => alCambiarActivo(servicio)}
      />
      <button type="button" onClick={() => alEditar(servicio)} aria-label={`Editar ${servicio.nombre}`} className={BOTON_EDITAR}>
        <FiEdit2 aria-hidden="true" /> Editar
      </button>
    </div>
  </article>
)

const Tabla = ({ servicios, alEditar, alCambiarActivo, idGuardando }) => (
  <div className="min-w-0 overflow-x-auto">
    <table className="w-full min-w-190 text-left text-sm">
      <caption className="sr-only">Servicios del catálogo</caption>
      <thead>
        <tr className="border-b border-white/10 text-zinc-400">
          <th scope="col" className="py-2 pr-3 font-medium">Servicio</th>
          <th scope="col" className="py-2 pr-3 font-medium">Categoría</th>
          <th scope="col" className="py-2 pr-3 font-medium">Área</th>
          <th scope="col" className="py-2 pr-3 font-medium">Tipo</th>
          <th scope="col" className="py-2 pr-3 font-medium">Duración</th>
          <th scope="col" className="py-2 pr-3 font-medium">Precio</th>
          <th scope="col" className="py-2 pr-3 font-medium">Estado</th>
          <th scope="col" className="py-2 font-medium"><span className="sr-only">Acciones</span></th>
        </tr>
      </thead>
      <tbody>
        {servicios.map((servicio) => (
          <tr key={servicio.id} className={`border-b border-white/5 ${servicio.activo ? '' : 'opacity-60'}`}>
            <th scope="row" className="py-1 pr-3 font-medium">
              <span className="flex flex-wrap items-center gap-2">
                {servicio.nombre}
                {!servicio.activo && <EtiquetaInactivo />}
              </span>
            </th>
            <td className="py-1 pr-3 text-zinc-300">{nombreCategoria(servicio)}</td>
            <td className="py-1 pr-3"><EtiquetaArea area={servicio.area} /></td>
            <td className="py-1 pr-3"><InsigniaTipo tipo={servicio.tipo} /></td>
            <td className="py-1 pr-3 text-zinc-300">{servicio.duracion_min} min</td>
            <td className="py-1 pr-3 font-semibold">{formatearPrecio(servicio.precio)}</td>
            <td className="py-1 pr-3">
              <InterruptorActivo
                activo={servicio.activo}
                etiqueta={`${servicio.activo ? 'Desactivar' : 'Activar'} ${servicio.nombre}`}
                deshabilitado={idGuardando === servicio.id}
                alCambiar={() => alCambiarActivo(servicio)}
              />
            </td>
            <td className="py-1">
              <button type="button" onClick={() => alEditar(servicio)} aria-label={`Editar ${servicio.nombre}`} className={BOTON_EDITAR}>
                <FiEdit2 aria-hidden="true" /> Editar
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

// Escritorio ancho: tabla. Móvil y tablet: tarjetas (una sola vista en el DOM según `tabla`).
const ListaServiciosAdmin = ({ servicios, tabla, alEditar, alCambiarActivo, idGuardando }) =>
  tabla ? (
    <Tabla servicios={servicios} alEditar={alEditar} alCambiarActivo={alCambiarActivo} idGuardando={idGuardando} />
  ) : (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {servicios.map((servicio) => (
        <Tarjeta
          key={servicio.id}
          servicio={servicio}
          alEditar={alEditar}
          alCambiarActivo={alCambiarActivo}
          guardando={idGuardando === servicio.id}
        />
      ))}
    </div>
  )

export default ListaServiciosAdmin
