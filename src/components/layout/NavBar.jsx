import React from 'react'
import { NavLink, useNavigate, useNavigation } from 'react-router'
import { RiScissorsCutFill } from "react-icons/ri";
import { FaArrowRight } from "react-icons/fa";
import { IoCloseOutline } from "react-icons/io5";
import { IoMdMenu } from "react-icons/io";
import { useState } from 'react';
import { ImScissors } from "react-icons/im";
import { GrGallery } from "react-icons/gr";
import { GiBeard } from "react-icons/gi";
import { FaMapMarkedAlt } from "react-icons/fa";
import { IoIosHome } from "react-icons/io";


const NavBar = () => {
    const [menuMovil, setMenuMovil] = useState(false)
    const navigate = useNavigate()

  return (
    <>
      <nav className='flex justify-between items-center py-3 px-5 bg-[#1a1a1a] text-white relative z-100 border-gray-600 border-b '>

        {/* Logo */}
        <div className='group flex items-center gap-2 font-semibold'>
          
          <RiScissorsCutFill
            className='bg-[#f7f4ef] text-black rounded-full p-1 group-hover:cursor-pointer'
            size={28}
          />

          <a href='/' className='group-hover:cursor-pointer'>
            Black Iron Barbers
          </a>

        </div>

        {/* Desktop */}
        <div className='hidden md:flex md:gap-8 lg:gap-10 items-center'>
          <NavLink
            to="/"
            className="text-gray-400 hover:text-white lg:text-xl flex items-center gap-2 active:scale-90 duration-200" 
          >
          <IoIosHome />  Inicio
          </NavLink>
          <NavLink
            to="/cortes"
            className="text-gray-400 hover:text-white  lg:text-xl flex items-center gap-2 active:scale-90 duration-200" 
          >
          <ImScissors />  Servicios
          </NavLink>

          <NavLink
            to="/galery"
            className="text-gray-400 hover:text-white  lg:text-xl flex items-center gap-2 active:scale-90 duration-200"
          >
            <GrGallery /> Galeria
          </NavLink>


          <NavLink
            to="/ubication"
            className="text-gray-400 hover:text-white  lg:text-xl flex items-center gap-2 active:scale-90 duration-200"
          >
            <FaMapMarkedAlt />Ubicaciones
          </NavLink>

          <button
          onClick={()=> navigate("/reservar-corte")}
          className='group flex items-center gap-2 bg-black text-white rounded-full px-4 py-2 hover:cursor-pointer border border-white/10 duration-300 active:scale-95'>
            
            <span>
              Agendar
            </span>

            <span className='ml-0 w-0 overflow-hidden opacity-0 duration-300 group-hover:ml-1 group-hover:w-4 group-hover:opacity-100 '>
              <FaArrowRight size={14}/>
            </span>

          </button>

          <button
          onClick={()=> navigate("/login-barberos")}
          className='group flex items-center bg-white text-black font-semibold rounded-full px-4 py-2 cursor-pointer active:scale-95 duration-300'>
            
            <span>
              ✂️Barbero
            </span>
          </button>

        </div>

        {/* Botón móvil */}
        <div
          className='md:hidden cursor-pointer z-50'
          onClick={() => setMenuMovil(!menuMovil)}
        >

          <div
            className={`transition-all duration-500 ease-in-out ${
              menuMovil
                ? 'rotate-180 scale-110'
                : 'rotate-0 scale-100'
            }`}
          >

            {
              menuMovil
                ? <IoCloseOutline size={32}/>
                : <IoMdMenu size={32}/>
            }

          </div>

        </div>

      </nav>

      {/* MENU MOVIL */}
      <div
        className={`
          fixed top-0 left-0 w-full min-h-dvh
          bg-[#1a1a1a]/95 backdrop-blur-md
          flex flex-col items-center justify-center gap-10 overflow-hidden
          md:hidden 
          transition-all duration-500 ease-in-out
          z-90 bg-cover bg-center bg-no-repeat
          ${
            menuMovil
              ? 'translate-y-0 opacity-100'
              : '-translate-y-full opacity-0 pointer-events-none'
          }
        `}
        style={{
          backgroundImage:"url('https://images.unsplash.com/photo-1621645582931-d1d3e6564943?q=80&w=1064&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D')"
        }}
      >
        <NavLink
            to="/"
            onClick={()=> setMenuMovil(false)}
            className="text-3xl font-bold text-white active:scale-95 duration-200 flex  items-center gap-2" 
          >
          <IoIosHome />  Inicio
          </NavLink>
        <NavLink
          to="/cortes"
          onClick={() => setMenuMovil(false)}
          className="text-3xl font-bold text-white active:scale-95 duration-200 flex  items-center gap-2"
        >
         <ImScissors />  Servicios
        </NavLink>

        <NavLink
          to="/galery"
          onClick={() => setMenuMovil(false)}
          className="text-3xl font-bold text-white active:scale-95 duration-200 flex  items-center gap-2"
        >
         <GrGallery /> Galeria
        </NavLink>


        <NavLink
          to="/ubication"
          onClick={() => setMenuMovil(false)}
          className="text-3xl font-bold text-white active:scale-95 duration-200 flex  items-center gap-2"
        >
          <FaMapMarkedAlt />Ubicaciones
        </NavLink>

        <button  
        onClick={()=>{
          setMenuMovil(false);
          navigate("/reservar-corte")
        }}
        className='flex items-center gap-2 bg-white border border-amber-500 text-black rounded-full px-7 py-3 font-bold active:scale-95 duration-200 shadow-2xl'>
          
          Agendar

          <FaArrowRight/>

        </button>

      </div>

    </>
  )
}

export default NavBar
