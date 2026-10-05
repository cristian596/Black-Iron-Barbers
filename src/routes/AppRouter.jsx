import { createBrowserRouter, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'

import Landingpage from '../pages/Landingpage'
import ProtectedRoute from './ProtectedRoute';
import RoleRoute from './RoleRoute';
import CargandoPagina from '../components/ui/CargandoPagina';

const Home = lazy(() => import('../pages/Home'));
const Cortes = lazy(() => import('../pages/Cortes'));
const ReservaCorte = lazy(() => import('../pages/ReservaCorte'));
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
const NotFound = lazy(() => import('../pages/NotFound'));

const AppRouter = createBrowserRouter([
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
        path: 'acceso',
        element: <LoginBarberos/>
      },
      {
        path: '*',
        element: <NotFound />
      },
    ]
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
      { path: '*', element: <Navigate to="/admin" replace /> },
    ]
  }
]);

export default AppRouter
