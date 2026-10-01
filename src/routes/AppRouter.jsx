import {createBrowserRouter} from 'react-router-dom'

import Home from '../pages/Home';
import Landingpage from '../pages/Landingpage'
import Galeria from '../pages/Galeria';
import Ubicacion from '../pages/Ubicacion';
import CartaBebidas from '../pages/CartaBebidas';
import ReservaCorte from '../pages/ReservaCorte';
import Cortes from '../pages/Cortes';
import LoginBarberos from '../pages/LoginBarberos';
import Panel from '../pages/Panel';
import Admin from '../pages/Admin';
import NotFound from '../pages/NotFound';
import ProtectedRoute from './ProtectedRoute';
import RoleRoute from './RoleRoute';

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
