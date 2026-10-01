import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import NavBar from '../components/layout/NavBar';
import Footer from '../components/layout/Footer';
import FixedFooter from '../components/layout/FixedFooter';
import FixedWhatsapp from '../components/layout/FixedWhatsapp';
import FixedHome from '../components/layout/FixedHome';

const CargandoPagina = () => (
  <div className='flex justify-center items-center py-20'>
    <div className='h-10 w-10 rounded-full border-4 border-gray-600 border-t-white animate-spin' />
  </div>
)


const Landingpage = () => {
  return (
    <>
        {/*Vive la experiencia */}
    <FixedFooter/>
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
