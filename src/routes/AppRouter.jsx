import { createBrowserRouter } from 'react-router-dom'
import { Suspense, lazy } from 'react'

import Landingpage from '../pages/Landingpage'
import ProtectedRoute from './ProtectedRoute';
import RoleRoute from './RoleRoute';
import CargandoPagina from '../components/ui/CargandoPagina';

const Home = lazy(() => import('../pages/Home'));
const Cortes = lazy(() => import('../pages/Cortes'));
const Galeria = lazy(() => import('../pages/Galeria'));
const Ubicacion = lazy(() => import('../pages/Ubicacion'));
const CartaBebidas = lazy(() => import('../pages/CartaBebidas'));
const ReservaCorte = lazy(() => import('../pages/ReservaCorte'));
const LoginBarberos = lazy(() => import('../pages/LoginBarberos'));
const Panel = lazy(() => import('../pages/Panel'));
const Admin = lazy(() => import('../pages/Admin'));
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
        path: 'galeria',
        element: <Galeria />
      },
      {
        path: 'ubicacion',
        element: <Ubicacion />
      },
      {
        path: 'reservar-corte',
        element: <ReservaCorte />
      },
      {
        path: 'carta-bebidas',
        element: <CartaBebidas />
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
            <Panel/>
          </RoleRoute>
        </ProtectedRoute>
      </Suspense>
    )
  },
  {
    path: 'admin',
    element: (
      <Suspense fallback={<CargandoPagina/>}>
        <ProtectedRoute>
          <RoleRoute rol="admin">
            <Admin/>
          </RoleRoute>
        </ProtectedRoute>
      </Suspense>
    )
  }
]);

export default AppRouter
