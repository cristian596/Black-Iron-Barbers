import {createBrowserRouter} from 'react-router-dom'

import Home from '../pages/Home';
import Landingpage from '../pages/Landingpage'
import Galeria from '../pages/Galeria';
import Ubicacion from '../pages/Ubicacion';
import CartaBebidas from '../pages/CartaBebidas';
import ReservaCorte from '../pages/ReservaCorte';
import Cortes from '../pages/Cortes';

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
        path: 'galery',
        element: <Galeria />
      },
      {
        path: 'ubication',
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
    ]
  }
]);

export default AppRouter
