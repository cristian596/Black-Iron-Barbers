import { Link } from 'react-router-dom'
import { FiEdit2, FiKey } from 'react-icons/fi'
import AvatarBarbero from '../ui/AvatarBarbero'
import { enlaceCitasPendientes } from '../../utils/empleados'
import InterruptorActivo from './InterruptorActivo'
import IndicadorVigencia from './IndicadorVigencia'

const BOTON =
  'inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/15 px-3 text-sm font-medium text-zinc-200 hover:border-white/40 hover:text-white focus-visible:outline-2 focus-visible:outline-oro'

// Etiqueta de texto (no solo opacidad) para los empleados apagados.
const EtiquetaInactivo = () => (
  <span className="rounded-full border border-zinc-600 px-2 py-0.5 text-xs font-medium text-zinc-400">Inactivo</span>
)

const textoUsuario = (empleado) => {
  if (!empleado.usuario) return 'Sin acceso al panel'
  const mas = empleado.usuarios_total > 1 ? ` (+${empleado.usuarios_total - 1} más)` : ''
  return `Usuario: ${empleado.usuario.usuario}${mas}`
}

const CitasPendientes = ({ empleado }) =>
  empleado.citas_pendientes > 0 ? (
    <Link
      to={enlaceCitasPendientes(empleado)}
      aria-label={`${empleado.citas_pendientes} citas pendientes de ${empleado.nombre}: ver en Citas`}
      className="inline-flex min-h-11 min-w-6 items-center font-semibold text-oro underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-oro"
    >
      {empleado.citas_pendientes}
    </Link>
  ) : (
    <span>0</span>
  )

// `compacto` (tabla): solo iconos, con el texto para lectores de pantalla; así las acciones caben junto al panel lateral.
const Acciones = ({ empleado, alEditar, alAcceso, compacto = false }) => (
  <>
    <button type="button" onClick={() => alEditar(empleado)} aria-label={`Editar ${empleado.nombre}`} className={BOTON}>
      <FiEdit2 aria-hidden="true" /> <span className={compacto ? 'sr-only' : undefined}>Editar</span>
    </button>
    <button
      type="button"
      onClick={() => alAcceso(empleado)}
      aria-label={`${empleado.usuario ? 'Restablecer la contraseña de' : 'Crear acceso para'} ${empleado.nombre}`}
      className={BOTON}
    >
      <FiKey aria-hidden="true" /> <span className={compacto ? 'sr-only' : undefined}>{empleado.usuario ? 'Contraseña' : 'Crear acceso'}</span>
    </button>
  </>
)

const Interruptor = ({ empleado, alCambiarActivo, guardando }) => (
  <InterruptorActivo
    activo={empleado.activo}
    etiqueta={`${empleado.activo ? 'Desactivar' : 'Activar'} a ${empleado.nombre}`}
    deshabilitado={guardando}
    alCambiar={() => alCambiarActivo(empleado)}
  />
)

const Tarjeta = ({ empleado, alEditar, alAcceso, alCambiarActivo, guardando }) => (
  <article className={`min-w-0 rounded-xl border border-white/10 bg-zinc-950 p-4 ${empleado.activo ? '' : 'opacity-60'}`}>
    <div className="flex items-center gap-3">
      <AvatarBarbero barbero={empleado} className="size-12 rounded-full" />
      <div className="min-w-0">
        <h3 className="flex flex-wrap items-center gap-2 wrap-anywhere text-base font-semibold">
          {empleado.nombre}
          {!empleado.activo && <EtiquetaInactivo />}
        </h3>
        <p className="wrap-anywhere text-sm text-zinc-400">{empleado.cargo || 'Sin cargo'}</p>
      </div>
    </div>
    <p className="mt-2 wrap-anywhere text-xs text-zinc-500">{textoUsuario(empleado)}</p>
    {empleado.usuario?.vigencia && (
      <p className="mt-1">
        <IndicadorVigencia vigencia={empleado.usuario.vigencia} />
      </p>
    )}
    <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
      <div className="rounded-lg bg-white/5 p-2">
        <dt className="text-xs text-zinc-400">Cortes este mes</dt>
        <dd className="text-lg font-semibold">{empleado.cortes_mes}</dd>
      </div>
      <div className="rounded-lg bg-white/5 p-2">
        <dt className="text-xs text-zinc-400">Citas pendientes</dt>
        <dd className="text-lg font-semibold"><CitasPendientes empleado={empleado} /></dd>
      </div>
    </dl>
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Interruptor empleado={empleado} alCambiarActivo={alCambiarActivo} guardando={guardando} />
      <div className="flex flex-wrap gap-2 sm:ml-auto">
        <Acciones empleado={empleado} alEditar={alEditar} alAcceso={alAcceso} />
      </div>
    </div>
  </article>
)

const Tabla = ({ empleados, alEditar, alAcceso, alCambiarActivo, idGuardando }) => (
  <div className="min-w-0 overflow-x-auto">
    <table className="w-full min-w-200 text-left text-sm">
      <caption className="sr-only">Empleados</caption>
      <thead>
        <tr className="border-b border-white/10 text-zinc-400">
          <th scope="col" className="py-2 pr-3 font-medium">Empleado</th>
          <th scope="col" className="py-2 pr-3 font-medium">Cargo</th>
          <th scope="col" className="py-2 pr-3 font-medium">Estado</th>
          <th scope="col" className="py-2 pr-3 text-right font-medium">Cortes este mes</th>
          <th scope="col" className="py-2 pr-3 text-right font-medium">Citas pendientes</th>
          <th scope="col" className="py-2 font-medium"><span className="sr-only">Acciones</span></th>
        </tr>
      </thead>
      <tbody>
        {empleados.map((empleado) => (
          <tr key={empleado.id} className={`border-b border-white/5 ${empleado.activo ? '' : 'opacity-60'}`}>
            <th scope="row" className="py-2 pr-3 font-medium">
              <span className="flex items-center gap-3">
                <AvatarBarbero barbero={empleado} className="size-10 rounded-full" textoClase="text-sm" />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2 wrap-anywhere">
                    {empleado.nombre}
                    {!empleado.activo && <EtiquetaInactivo />}
                  </span>
                  <span className="block text-xs font-normal text-zinc-500">{textoUsuario(empleado)}</span>
                  {empleado.usuario?.vigencia && (
                    <span className="mt-1 block">
                      <IndicadorVigencia vigencia={empleado.usuario.vigencia} />
                    </span>
                  )}
                </span>
              </span>
            </th>
            <td className="min-w-32 py-2 pr-3 text-zinc-300">{empleado.cargo || '—'}</td>
            <td className="py-2 pr-3">
              <Interruptor empleado={empleado} alCambiarActivo={alCambiarActivo} guardando={idGuardando === empleado.id} />
            </td>
            <td className="py-2 pr-3 text-right font-semibold">{empleado.cortes_mes}</td>
            <td className="py-2 pr-3 text-right"><CitasPendientes empleado={empleado} /></td>
            <td className="py-2">
              <div className="flex gap-2">
                <Acciones empleado={empleado} alEditar={alEditar} alAcceso={alAcceso} compacto />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

// Escritorio ancho: tabla. Móvil y tablet: tarjetas (una sola vista en el DOM según `tabla`).
const ListaEmpleados = ({ empleados, tabla, alEditar, alAcceso, alCambiarActivo, idGuardando }) =>
  tabla ? (
    <Tabla empleados={empleados} alEditar={alEditar} alAcceso={alAcceso} alCambiarActivo={alCambiarActivo} idGuardando={idGuardando} />
  ) : (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {empleados.map((empleado) => (
        <Tarjeta
          key={empleado.id}
          empleado={empleado}
          alEditar={alEditar}
          alAcceso={alAcceso}
          alCambiarActivo={alCambiarActivo}
          guardando={idGuardando === empleado.id}
        />
      ))}
    </div>
  )

export default ListaEmpleados
