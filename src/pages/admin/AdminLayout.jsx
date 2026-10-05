import { Suspense, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import BarraLateral from '../../components/admin/BarraLateral'
import BarraSuperior from '../../components/admin/BarraSuperior'
import CargandoPagina from '../../components/ui/CargandoPagina'
import NoIndex from '../../components/ui/NoIndex'

const AdminLayout = () => {
  const { usuario, token, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const esEscritorio = useMediaQuery('(min-width: 1024px)')

  // El cajón queda abierto solo para la ubicación en la que se abrió: al navegar (o buscar) cambia
  // `location.key` y se cierra solo, sin efectos.
  const [abiertoEn, setAbiertoEn] = useState(null)
  const cajonAbierto = !esEscritorio && abiertoEn === location.key

  const cerrarSesion = () => {
    logout()
    navigate('/acceso')
  }

  return (
    <>
      <NoIndex />
      <div className="grid min-h-screen grid-cols-1 bg-black font-poppins text-white lg:grid-cols-[16rem_minmax(0,1fr)] print:block print:min-h-0 print:bg-white print:text-black">
        <BarraLateral
          modal={!esEscritorio}
          abierta={esEscritorio || cajonAbierto}
          alCerrar={() => setAbiertoEn(null)}
          alCerrarSesion={cerrarSesion}
        />
        <div className="min-w-0" inert={cajonAbierto}>
          <BarraSuperior
            alAbrirMenu={() => setAbiertoEn(location.key)}
            menuAbierto={cajonAbierto}
            usuario={usuario}
            token={token}
          />
          <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-8 print:p-0">
            <div className="mx-auto w-full min-w-0 max-w-6xl">
              <Suspense fallback={<CargandoPagina />}>
                <Outlet />
              </Suspense>
            </div>
          </main>
        </div>
      </div>
    </>
  )
}

export default AdminLayout
