import { useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useResumenBarbero } from '../../context/ResumenBarberoContext'
import { obtenerMisCitas } from '../../services/api'
import { useCarga } from '../../hooks/useCarga'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { useAccionesCita } from '../../hooks/useAccionesCita'
import { useFiltrosCitasUrl, useCorregirPagina } from '../../hooks/useFiltrosCitasUrl'
import { PESTANAS_BARBERO } from '../../data/pestanasBarbero'
import PestanasCitas from '../../components/admin/PestanasCitas'
import FiltrosCitasAdmin from '../../components/admin/FiltrosCitasAdmin'
import Paginacion from '../../components/admin/Paginacion'
import ListaMisCitas from '../../components/panel/ListaMisCitas'
import Esqueleto from '../../components/panel/Esqueleto'
import ErrorCarga from '../../components/ui/ErrorCarga'
import SinResultados from '../../components/ui/SinResultados'

const LIMITE = 15
const PESTANA_POR_DEFECTO = 'hoy'

const MENSAJE_VACIO = {
  hoy: 'Hoy no tienes citas agendadas.',
  proximas: 'No tienes citas próximas.',
  por_confirmar: 'No tienes citas por confirmar. Todo está al día.',
  completadas: 'Aún no tienes citas completadas.',
  canceladas: 'No tienes citas canceladas.',
  todas: 'Todavía no tienes citas registradas.',
}

// /panel/citas ("Mis citas"): lista paginada de GET /api/barbero/citas (solo las del barbero de la sesión). Todo el
// estado vive en la URL (?pestana=&q=&desde=&hasta=&pagina=), como /admin/citas. Completar y cancelar usan
// useAccionesCita; al terminar se refresca el estado compartido del resumen (aviso persistente), y como la clave de
// carga incluye su \`version\`, la lista se vuelve a pedir con la misma página y los mismos filtros (también cada
// 60 s y al volver a la pestaña, porque una cita puede vencerse con la lista abierta).
const MisCitas = () => {
  const { token } = useAuth()
  const { recargar: recargarResumen, version } = useResumenBarbero()
  const esTabla = useMediaQuery('(min-width: 1280px)')
  const tablaRef = useRef(null)
  const { pestana, q, desde, hasta, pagina, texto, setTexto, cambiar, hayFiltros, limpiar } = useFiltrosCitasUrl({
    pestanas: PESTANAS_BARBERO,
    pestanaPorDefecto: PESTANA_POR_DEFECTO,
  })

  const filtros = { pestana, q, desde, hasta, pagina, limite: LIMITE }
  const { datos, cargando, error, recargar } = useCarga(() => obtenerMisCitas(token, filtros), `${JSON.stringify(filtros)}|${version}`)
  useCorregirPagina(datos, pagina, LIMITE, cambiar)
  const acciones = useAccionesCita(token, recargarResumen)

  const irAPagina = (nueva) => {
    cambiar({ pagina: nueva })
    tablaRef.current?.scrollIntoView?.({ block: 'start' })
  }

  const paginaVacia = datos && datos.items.length === 0 && datos.total > 0 // redirigiendo a la última válida

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="font-playfair text-3xl font-semibold">Mis citas</h1>

      <div className="flex min-w-0 flex-col gap-4">
        <PestanasCitas valor={pestana} alCambiar={(id) => cambiar({ pestana: id })} pestanas={PESTANAS_BARBERO} conteos={datos?.conteos} />
        <FiltrosCitasAdmin
          texto={texto}
          desde={desde}
          hasta={hasta}
          hayFiltros={hayFiltros}
          placeholder="Cliente o servicio"
          alCambiarTexto={setTexto}
          alCambiarDesde={(valor) => cambiar({ desde: valor })}
          alCambiarHasta={(valor) => cambiar({ hasta: valor })}
          alLimpiar={limpiar}
        />
      </div>

      <section
        ref={tablaRef}
        aria-labelledby="titulo-lista-mis-citas"
        aria-busy={cargando}
        className="min-w-0 scroll-mt-20 rounded-xl border border-white/10 bg-zinc-950 p-4"
      >
        <h2 id="titulo-lista-mis-citas" className="sr-only">Lista de citas</h2>

        {acciones.error && (
          <p className="mb-3 rounded-lg bg-red-900/40 p-3 text-sm text-red-300" role="alert">
            {acciones.error}
          </p>
        )}

        {error && !datos ? (
          <ErrorCarga mensaje="No pudimos cargar tus citas." onReintentar={recargar} variante="oscuro" />
        ) : !datos || paginaVacia ? (
          <Esqueleto filas={4} etiqueta="Cargando tus citas..." />
        ) : datos.items.length === 0 ? (
          hayFiltros ? (
            <SinResultados variante="oscuro" mensaje="No hay citas que coincidan con los filtros." onLimpiar={limpiar} />
          ) : (
            <SinResultados variante="oscuro" mensaje={MENSAJE_VACIO[pestana]} />
          )
        ) : (
          <>
            <ListaMisCitas
              citas={datos.items}
              tabla={esTabla}
              ocupadoId={acciones.ocupadoId}
              alCompletar={acciones.completar}
              alCancelar={acciones.pedirCancelar}
            />
            <Paginacion pagina={datos.pagina} total={datos.total} limite={LIMITE} alCambiar={irAPagina} />
          </>
        )}
      </section>

      {acciones.modalCancelar}
    </div>
  )
}

export default MisCitas
