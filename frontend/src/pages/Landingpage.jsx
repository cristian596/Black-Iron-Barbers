import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import NavBar from '../components/layout/NavBar';
import Footer from '../components/layout/Footer';
import FixedWhatsapp from '../components/layout/FixedWhatsapp';
import FixedHome from '../components/layout/FixedHome';
import BannerCookies from '../components/cookies/BannerCookies';
import PanelCookies from '../components/cookies/PanelCookies';
import FranjaGarantia from '../components/layout/FranjaGarantia';
import CargandoPagina from '../components/ui/CargandoPagina';
import { ProveedorCarrito } from '../context/CarritoContext';
import { useScrollAHash } from '../hooks/useScrollAHash';

// Secciones de la web pública a las que se puede llegar con un hash (p. ej. /#equipo).
const ANCLAS_PUBLICAS = ['equipo']

const Landingpage = () => {
  useScrollAHash(ANCLAS_PUBLICAS)

  return (
    // La selección de servicios vive aquí para sobrevivir a la navegación entre la carta y la reserva.
    <ProveedorCarrito>
        {/*Vive la experiencia */}
    {/*Franja de garantia, siempre arriba del navbar*/}
    <FranjaGarantia/>
    {/*Navbar que se vera en todo momento sin importar la pagina a la que vallan los usuarios*/}
      <NavBar/>

      <main>
        <Suspense fallback={<CargandoPagina/>}>
          <Outlet/>
        </Suspense>
      </main>

    {/*Footer */}
    <Footer/>
    {/*Boton de Home para agilizar navegacion en mobile*/}
    <FixedHome/>
    {/*Boton de Whatsapp Fixed*/}
    <FixedWhatsapp/>
    {/*Aviso de cookies (primera visita) y panel de configuración; el pie y las políticas también lo abren*/}
    <BannerCookies/>
    <PanelCookies/>

    </ProveedorCarrito>
  )
}

export default Landingpage
