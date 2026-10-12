import { useState } from 'react'
import { FiCheckCircle, FiLogOut } from 'react-icons/fi'
import { useAuth } from '../../context/AuthContext'
import { useResumenBarbero } from '../../context/ResumenBarberoContext'
import { useConfirmarCierreSesion } from '../../hooks/useConfirmarCierreSesion'
import { formatearFechaLegible } from '../../utils/fechas'
import { textoDias } from '../../utils/vigencia'
import AvatarBarbero from '../../components/ui/AvatarBarbero'
import AvisoCaducidad from '../../components/dashboard/AvisoCaducidad'

const DATOS = [
  { clave: 'cargo', etiqueta: 'Cargo', vacio: 'Barbero' },
  { clave: 'especialidad', etiqueta: 'Especialidad', vacio: 'No indicada' },
]

// /panel/cuenta: datos del barbero (solo lectura) y estado de su contraseña. NO hay cambio libre de contraseña: el
// formulario solo aparece cuando está por vencer (y el back-end lo exige igual con 403 CAMBIO_NO_PERMITIDO). La
// caducada la cubre la pantalla obligatoria del layout, que bloquea todo /panel.
const MiCuenta = () => {
  const { token, usuario, vigencia, actualizarVigencia } = useAuth()
  const { barbero } = useResumenBarbero()
  const { pedirCierreSesion, dialogoCierreSesion } = useConfirmarCierreSesion()
  const [cambiada, setCambiada] = useState(false)

  const alCambiar = (respuesta) => {
    actualizarVigencia(respuesta.vigencia)
    setCambiada(true)
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="font-playfair text-3xl font-semibold">Mi cuenta</h1>

      <section aria-labelledby="titulo-datos-cuenta" className="min-w-0 rounded-xl border border-white/10 bg-zinc-950 p-4 sm:p-6">
        <h2 id="titulo-datos-cuenta" className="sr-only">Tus datos</h2>
        <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
          <AvatarBarbero barbero={barbero} className="size-24 rounded-full" textoClase="text-3xl" cargaPerezosa={false} />
          <div className="min-w-0">
            <p className="wrap-anywhere font-playfair text-2xl font-semibold">{barbero.nombre}</p>
            <dl className="mt-3 grid min-w-0 grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-3">
              {DATOS.map(({ clave, etiqueta, vacio }) => (
                <div key={clave} className="min-w-0">
                  <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400">{etiqueta}</dt>
                  <dd className="wrap-anywhere">{barbero[clave] || vacio}</dd>
                </div>
              ))}
              <div className="min-w-0">
                <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400">Usuario</dt>
                <dd className="wrap-anywhere">{usuario.usuario}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section aria-labelledby="titulo-estado-contrasena" className="flex min-w-0 flex-col gap-3">
        <h2 id="titulo-estado-contrasena" className="text-lg font-semibold">Contraseña</h2>

        {cambiada && (
          <p className="rounded-lg bg-green-900/40 p-3 text-green-300" role="status">
            Contraseña actualizada. La nueva vale 60 días.
          </p>
        )}

        {vigencia?.estado === 'por_vencer' && <AvisoCaducidad vigencia={vigencia} token={token} alCambiada={alCambiar} />}

        {vigencia?.estado === 'vigente' && (
          <div className="min-w-0 rounded-xl border border-white/10 bg-zinc-950 p-4 sm:p-6">
            <p className="flex items-start gap-2 text-emerald-300">
              <FiCheckCircle aria-hidden="true" className="mt-1 shrink-0" />
              <span className="wrap-anywhere">
                <strong className="font-semibold">Tu contraseña está vigente.</strong> Vence el {formatearFechaLegible(vigencia.vence_en)}; faltan{' '}
                {textoDias(vigencia.dias_restantes)}.
              </span>
            </p>
            <p className="mt-3 text-sm text-zinc-400">
              Solo el administrador puede restablecer tu contraseña antes de que venza. Cuando falten 2 días o menos podrás cambiarla
              desde aquí.
            </p>
          </div>
        )}

        {!vigencia && (
          <p className="rounded-xl border border-white/10 bg-zinc-950 p-4 text-zinc-400">
            No pudimos consultar el estado de tu contraseña. Recarga la página para intentarlo de nuevo.
          </p>
        )}
      </section>

      <div>
        <button
          type="button"
          onClick={pedirCierreSesion}
          className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/20 px-5 font-medium text-white duration-300 hover:bg-white hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oro active:scale-95 sm:w-auto"
        >
          <FiLogOut aria-hidden="true" />
          Cerrar sesión
        </button>
      </div>
      {dialogoCierreSesion}
    </div>
  )
}

export default MiCuenta
