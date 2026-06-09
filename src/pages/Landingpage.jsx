import React from 'react'
import { Outlet } from 'react-router-dom';
import NavBar from '../components/layout/NavBar';
import Footer from '../components/layout/Footer';
import FixedFooter from '../components/layout/FixedFooter';
import FixedWhatsapp from '../components/layout/FixedWhatsapp';
import FixedHome from '../components/layout/FixedHome';


const Landingpage = () => {
  return (
    <>
    {/*Navbar que se vera en todo momento sin importar la pagina a la que vallan los usuarios*/}
      <NavBar/>

      <main>
        <Outlet/>
      </main>

    {/*Footer */}
    <Footer/>
    {/*Boton de Home para agilizar navegacion en mobile*/}
    <FixedHome/>
    {/*Boton de Whatsapp Fixed*/}
    <FixedWhatsapp/>
    {/*Vive la experiencia */}
    <FixedFooter/>

    </>
  )
}

export default Landingpage
