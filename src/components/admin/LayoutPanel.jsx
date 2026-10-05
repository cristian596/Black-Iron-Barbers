import { Suspense, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import BarraLateral from './BarraLateral'
import BarraSuperior from './BarraSuperior'
import CargandoPagina from '../ui/CargandoPagina'
import NoIndex from '../ui/NoIndex'

// Estructura común de los dashboards (admin y barbero): barra lateral en escritorio y cajón accesible en móvil,
// barra superior y contenido con las rutas hijas (<Outlet />). Lo que cambia entre dashboards llega por props:
//   secciones      menú lateral (data/menuAdmin.js, data/menuBarbero.js)
//   tarjeta        bloque opcional bajo el logo (p. ej. la tarjeta del barbero)
//   centroBarra    contenido central de la barra superior (p. ej. el buscador del admin)
//   derechaBarra   contenido a la derecha de la barra superior (menú de usuario)
//   alCerrarSesion pide confirmar el cierre de sesión (useConfirmarCierreSesion)
//   cajonPausado   true mientras ese diálogo está abierto: el cajón suelta su trampa de foco
//   encabezado     contenido sobre las rutas hijas (avisos propios del dashboard)
//   superpuestos   elementos fijos o modales del dashboard (quedan dentro de la zona `inert` si el cajón está abierto)
//   espacioInferior  reserva espacio al final del contenido (hay un aviso fijo abajo)
const LayoutPanel = ({
  secciones,
  tarjeta,
  centroBarra,
  derechaBarra,
  alCerrarSesion,
  cajonPausado = false,
  encabezado,
  superpuestos,
  espacioInferior = false,
}) => {
  const location = useLocation()
  const esEscritorio = useMediaQuery('(min-width: 1024px)')

  // El cajón queda abierto solo para la ubicación en la que se abrió: al navegar (o buscar) cambia
  // `location.key` y se cierra solo, sin efectos.
  const [abiertoEn, setAbiertoEn] = useState(null)
  const cajonAbierto = !esEscritorio && abiertoEn === location.key

  return (
    <>
      <NoIndex />
      <div className="grid min-h-screen grid-cols-1 bg-black font-poppins text-white lg:grid-cols-[16rem_minmax(0,1fr)] print:block print:min-h-0 print:bg-white print:text-black">
        <BarraLateral
          secciones={secciones}
          tarjeta={tarjeta}
          modal={!esEscritorio}
          abierta={esEscritorio || cajonAbierto}
          alCerrar={() => setAbiertoEn(null)}
          alCerrarSesion={alCerrarSesion}
          pausado={cajonPausado}
        />
        <div className="min-w-0" inert={cajonAbierto}>
          <BarraSuperior alAbrirMenu={() => setAbiertoEn(location.key)} menuAbierto={cajonAbierto} centro={centroBarra} derecha={derechaBarra} />
          <main className={`min-w-0 px-4 py-6 sm:px-6 lg:px-8 print:p-0 ${espacioInferior ? 'pb-28 lg:pb-36' : ''}`}>
            <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6">
              {encabezado}
              <Suspense fallback={<CargandoPagina />}>
                <Outlet />
              </Suspense>
            </div>
          </main>
          {superpuestos}
        </div>
      </div>
    </>
  )
}

export default LayoutPanel
