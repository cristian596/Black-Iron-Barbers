import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import NavBar from '../components/layout/NavBar';
import Footer from '../components/layout/Footer';
import FixedFooter from '../components/layout/FixedFooter';
import FixedWhatsapp from '../components/layout/FixedWhatsapp';
import FixedHome from '../components/layout/FixedHome';
import FranjaGarantia from '../components/layout/FranjaGarantia';
import CargandoPagina from '../components/ui/CargandoPagina';

const Landingpage = () => {
  return (
    <>
        {/*Vive la experiencia */}
    <FixedFooter/>
    {/*Franja de garantia, siempre visible arriba del navbar*/}
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


    </>
  )
}

export default Landingpage
