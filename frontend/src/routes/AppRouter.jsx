import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { Suspense, lazy } from 'react'

import ScrollToTop from '../components/layout/ScrollToTop'
import AnaliticaRutas from '../components/layout/AnaliticaRutas'
import Landingpage from '../pages/Landingpage'
import ProtectedRoute from './ProtectedRoute';
import RoleRoute from './RoleRoute';
import CargandoPagina from '../components/ui/CargandoPagina';
import RedirigirAsesoria from './RedirigirAsesoria';

const Home = lazy(() => import('../pages/Home'));
const Cortes = lazy(() => import('../pages/Cortes'));
const ReservaCorte = lazy(() => import('../pages/ReservaCorte'));
const Asesorias = lazy(() => import('../pages/Asesorias'));
const PoliticaPrivacidad = lazy(() => import('../pages/legal/PoliticaPrivacidad'));
const TratamientoDatos = lazy(() => import('../pages/legal/TratamientoDatos'));
const PoliticaCookies = lazy(() => import('../pages/legal/PoliticaCookies'));
const LoginBarberos = lazy(() => import('../pages/LoginBarberos'));
const PanelLayout = lazy(() => import('../pages/panel/PanelLayout'));
const ResumenBarbero = lazy(() => import('../pages/panel/Resumen'));
const MisCitas = lazy(() => import('../pages/panel/MisCitas'));
const MiRendimiento = lazy(() => import('../pages/panel/MiRendimiento'));
const MiCuenta = lazy(() => import('../pages/panel/MiCuenta'));
const AdminLayout = lazy(() => import('../pages/admin/AdminLayout'));
const Resumen = lazy(() => import('../pages/admin/Resumen'));
const CitasAdmin = lazy(() => import('../pages/admin/Citas'));
const Servicios = lazy(() => import('../pages/admin/Servicios'));
const Empleados = lazy(() => import('../pages/admin/Empleados'));
const Reportes = lazy(() => import('../pages/admin/Reportes'));
const Configuracion = lazy(() => import('../pages/Configuracion'));
const NotFound = lazy(() => import('../pages/NotFound'));

// Ruta raíz sin path: monta ScrollToTop una sola vez dentro del router, antes de todas las rutas.
const RaizConScroll = () => (
  <>
    <ScrollToTop />
    <AnaliticaRutas />
    <Outlet />
  </>
)

const AppRouter = createBrowserRouter([
  {
    element: <RaizConScroll />,
    children: [
  {
    path: '/',
    element: <Landingpage />,
    children: [
      {
        index: true,
        element: <Home />
      },
      {
        path: 'cortes',
        element: <Cortes/>
      },
      {
        path: 'reservar-corte',
        element: <ReservaCorte />
      },
      {
        path: 'asesorias',
        element: <Asesorias />
      },
      {
        path: 'asesoria',
        element: <RedirigirAsesoria />
      },
      {
        path: 'politica-de-privacidad',
        element: <PoliticaPrivacidad />
      },
      {
        path: 'tratamiento-de-datos',
        element: <TratamientoDatos />
      },
      {
        path: 'politica-de-cookies',
        element: <PoliticaCookies />
      },
      {
        path: '*',
        element: <NotFound />
      },
    ]
  },
  {
    // Pantalla propia, fuera de Landingpage: sin barra pública, footer ni WhatsApp.
    path: 'acceso',
    element: (
      <Suspense fallback={<CargandoPagina/>}>
        <LoginBarberos/>
      </Suspense>
    )
  },
  {
    path: 'panel',
    element: (
      <Suspense fallback={<CargandoPagina/>}>
        <ProtectedRoute>
          <RoleRoute rol="barbero">
            <PanelLayout/>
          </RoleRoute>
        </ProtectedRoute>
      </Suspense>
    ),
    // Como /admin: el guard va una sola vez en el padre y cada hija carga con React.lazy (Suspense dentro de LayoutPanel).
    children: [
      { index: true, element: <ResumenBarbero /> },
      { path: 'citas', element: <MisCitas /> },
      { path: 'rendimiento', element: <MiRendimiento /> },
      { path: 'cuenta', element: <MiCuenta /> },
      { path: 'configuracion', element: <Configuracion /> },
      { path: '*', element: <Navigate to="/panel" replace /> },
    ]
  },
  {
    path: 'admin',
    element: (
      <Suspense fallback={<CargandoPagina/>}>
        <ProtectedRoute>
          <RoleRoute rol="admin">
            <AdminLayout/>
          </RoleRoute>
        </ProtectedRoute>
      </Suspense>
    ),
    // Cada página hija carga con React.lazy; el Suspense está dentro de AdminLayout (alrededor del Outlet)
    // para que el menú no desaparezca mientras llega la página.
    children: [
      { index: true, element: <Resumen /> },
      { path: 'citas', element: <CitasAdmin /> },
      { path: 'servicios', element: <Servicios /> },
      { path: 'empleados', element: <Empleados /> },
      { path: 'reportes', element: <Reportes /> },
      { path: 'configuracion', element: <Configuracion /> },
      { path: '*', element: <Navigate to="/admin" replace /> },
    ]
  }
    ]
  }
]);

export default AppRouter
