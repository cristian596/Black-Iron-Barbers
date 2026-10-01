import { createBrowserRouter } from 'react-router-dom'
import { lazy } from 'react'

import Landingpage from '../pages/Landingpage'
import ProtectedRoute from './ProtectedRoute';
import RoleRoute from './RoleRoute';

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
        path: 'login-barberos',
        element: <LoginBarberos/>
      },
      {
        path: 'panel',
        element: (
          <ProtectedRoute>
            <RoleRoute rol="barbero">
              <Panel/>
            </RoleRoute>
          </ProtectedRoute>
        )
      },
      {
        path: 'admin',
        element: (
          <ProtectedRoute>
            <RoleRoute rol="admin">
              <Admin/>
            </RoleRoute>
          </ProtectedRoute>
        )
      },
      {
        path: '*',
        element: <NotFound />
      },
    ]
  }
]);

export default AppRouter
