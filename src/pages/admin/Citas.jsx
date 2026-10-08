import { useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { actualizarCita, obtenerCitasAdmin } from '../../services/api'
import { useCarga } from '../../hooks/useCarga'
import { useBarberosActivos } from '../../hooks/useBarberosActivos'
import { useFiltrosCitasUrl, useCorregirPagina } from '../../hooks/useFiltrosCitasUrl'
import { PESTANAS_CITAS } from '../../data/periodos'
import TablaCitas from '../../components/dashboard/TablaCitas'
import PestanasCitas from '../../components/admin/PestanasCitas'
import FiltrosCitasAdmin from '../../components/admin/FiltrosCitasAdmin'
import Paginacion from '../../components/admin/Paginacion'
import ErrorCarga from '../../components/ui/ErrorCarga'
import SinResultados from '../../components/ui/SinResultados'

const LIMITE = 15
const PESTANA_POR_DEFECTO = 'todas'

const MENSAJE_VACIO = {
  proximas: 'No hay citas próximas.',
  todas: 'Todavía no hay citas registradas.',
  canceladas: 'No hay citas canceladas.',
}

const Citas = () => {
  const { token } = useAuth()
  const { barberosActivos, errorBarberos } = useBarberosActivos()
  // Todo el estado de la lista vive en la URL (?pestana=&q=&desde=&hasta=&barbero=&pagina=); ver useFiltrosCitasUrl.
  const { pestana, q, desde, hasta, barbero, area, pagina, texto, setTexto, cambiar, hayFiltros, limpiar } = useFiltrosCitasUrl({
    pestanas: PESTANAS_CITAS,
    pestanaPorDefecto: PESTANA_POR_DEFECTO,
    conBarbero: true,
    conArea: true,
  })

  const [accionCitaId, setAccionCitaId] = useState(null)
  const [errorAccion, setErrorAccion] = useState('')
  const tablaRef = useRef(null)

  const filtros = { pestana, q, desde, hasta, barbero, ...(area ? { area } : {}), pagina, limite: LIMITE }
  const { datos, cargando, error, recargar } = useCarga(() => obtenerCitasAdmin(token, filtros), JSON.stringify(filtros))
  useCorregirPagina(datos, pagina, LIMITE, cambiar)

  const irAPagina = (nueva) => {
    cambiar({ pagina: nueva })
    tablaRef.current?.scrollIntoView?.({ block: 'start' })
  }

  // El admin solo reasigna (completar y cancelar son de los barberos). Recarga la lista actual: misma página y filtros.
  const cambiarCita = async (cita, cambios, mensajeError) => {
    setErrorAccion('')
    setAccionCitaId(cita.id)
    try {
      await actualizarCita(token, cita.id, cambios)
      recargar()
    } catch (err) {
      setErrorAccion(mensajeError ? `${mensajeError}: ${err.message}` : err.message)
    } finally {
      setAccionCitaId(null)
    }
  }

  const handleReasignar = (cita, nuevoBarberoId) => {
    if (String(nuevoBarberoId) === String(cita.barbero_id)) return
    cambiarCita(cita, { barbero_id: Number(nuevoBarberoId) }, 'No se pudo reasignar la cita')
  }

  const paginaVacia = datos && datos.items.length === 0 && datos.total > 0 // redirigiendo a la última válida

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="font-playfair text-3xl font-semibold">Citas</h1>

      <div className="flex min-w-0 flex-col gap-4">
        <PestanasCitas valor={pestana} alCambiar={(id) => cambiar({ pestana: id })} />
        <FiltrosCitasAdmin
          texto={texto}
          desde={desde}
          hasta={hasta}
          barbero={barbero}
          barberos={barberosActivos}
          area={area}
          hayFiltros={hayFiltros}
          alCambiarTexto={setTexto}
          alCambiarDesde={(valor) => cambiar({ desde: valor })}
          alCambiarHasta={(valor) => cambiar({ hasta: valor })}
          alCambiarBarbero={(valor) => cambiar({ barbero: valor })}
          alCambiarArea={(valor) => cambiar({ area: valor })}
          alLimpiar={limpiar}
        />
        {errorBarberos && <p className="text-sm text-red-400">{errorBarberos}</p>}
      </div>

      <section
        ref={tablaRef}
        aria-labelledby="titulo-lista-citas"
        aria-busy={cargando}
        className="min-w-0 scroll-mt-20 rounded-xl border border-white/10 bg-zinc-950 p-4"
      >
        <h2 id="titulo-lista-citas" className="sr-only">Lista de citas</h2>

        {errorAccion && (
          <p className="mb-3 rounded-lg bg-red-900/40 p-3 text-red-300" role="alert">
            {errorAccion}
          </p>
        )}

        {error ? (
          <ErrorCarga mensaje="No pudimos cargar las citas." onReintentar={recargar} variante="oscuro" />
        ) : !datos || paginaVacia ? (
          <p role="status" className="py-10 text-center text-zinc-400">Cargando citas...</p>
        ) : datos.items.length === 0 ? (
          hayFiltros ? (
            <SinResultados variante="oscuro" mensaje="No hay citas que coincidan con los filtros." onLimpiar={limpiar} />
          ) : (
            <SinResultados variante="oscuro" mensaje={MENSAJE_VACIO[pestana]} />
          )
        ) : (
          <>
            <div className="min-w-0">
              <TablaCitas
                citas={datos.items}
                mostrarBarbero
                onReasignar={accionCitaId ? undefined : handleReasignar} // el selector de cada cita ofrece solo profesionales de SU área (barberos para cortes, asesores para asesorías)
                barberosActivos={barberosActivos}
              />
            </div>
            <Paginacion pagina={datos.pagina} total={datos.total} limite={LIMITE} alCambiar={irAPagina} />
          </>
        )}
      </section>
    </div>
  )
}

export default Citas
