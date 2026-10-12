import { useNavigate } from 'react-router-dom'
import Modal from '../ui/Modal'
import { RUTA_POR_CONFIRMAR } from './AvisoPorConfirmar'
import { fechaLegible, soloHora, textoCitas } from '../../utils/formato'

const MAXIMO_LISTADAS = 5

// Mensaje del día al iniciar sesión (una vez por inicio de sesión; la marca la maneja PanelLayout): cuántas citas
// tiene hoy y la próxima, y aparte las citas por confirmar de días anteriores con un botón que lleva a esa sección.
const VentanaBienvenida = ({ nombre, resumen, porConfirmar, alCerrar }) => {
  const navigate = useNavigate()
  const { citas_hoy: citasHoy, proxima_cita: proxima } = resumen
  const anteriores = porConfirmar.items.filter((c) => c.fecha < resumen.fecha)

  const irAConfirmar = () => {
    alCerrar()
    navigate(RUTA_POR_CONFIRMAR)
  }

  return (
    <Modal idTitulo="titulo-bienvenida" alCerrar={alCerrar}>
      <h2 id="titulo-bienvenida" className="pr-10 font-playfair text-2xl font-semibold">
        Hola, {nombre}
      </h2>

      <p className="mt-3 text-base text-zinc-100">
        {citasHoy > 0 ? `Tienes ${textoCitas(citasHoy)} para hoy.` : 'Hoy no tienes citas agendadas.'}
      </p>
      {proxima && (
        <p className="mt-1 wrap-anywhere text-sm text-zinc-400">
          Tu próxima cita: {proxima.cliente}, {proxima.servicio_nombre}, {soloHora(proxima.hora)}
          {proxima.fecha !== resumen.fecha ? ` del ${fechaLegible(proxima.fecha)}` : ''}.
        </p>
      )}

      {anteriores.length > 0 && (
        <div className="mt-4 rounded-xl border border-orange-400/40 bg-orange-400/5 p-3">
          <h3 className="text-sm font-semibold text-orange-200">
            Tienes {textoCitas(anteriores.length)} sin confirmar de días anteriores
          </h3>
          <ul className="mt-2 flex flex-col gap-1.5 text-sm text-zinc-300">
            {anteriores.slice(0, MAXIMO_LISTADAS).map((cita) => (
              <li key={cita.id} className="wrap-anywhere">
                {cita.cliente} · {cita.servicio_nombre} · {fechaLegible(cita.fecha)} {soloHora(cita.hora)}
              </li>
            ))}
          </ul>
          {anteriores.length > MAXIMO_LISTADAS && (
            <p className="mt-1 text-sm text-zinc-400">y {anteriores.length - MAXIMO_LISTADAS} más.</p>
          )}
          <button
            type="button"
            onClick={irAConfirmar}
            className="mt-3 min-h-11 w-full cursor-pointer rounded-lg border border-orange-300 px-4 text-sm font-semibold text-orange-200 duration-200 hover:bg-orange-400/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oro sm:w-auto"
          >
            Ver citas sin confirmar
          </button>
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={alCerrar}
          className="min-h-11 w-full cursor-pointer rounded-lg bg-oro px-5 text-sm font-semibold text-black duration-200 hover:bg-oro/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto"
        >
          Entendido
        </button>
      </div>
    </Modal>
  )
}

export default VentanaBienvenida
