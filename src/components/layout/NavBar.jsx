import { useEffect, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { RiScissorsCutFill } from 'react-icons/ri'
import { FaArrowRight } from 'react-icons/fa'
import { IoCloseOutline } from 'react-icons/io5'
import { IoMdMenu } from 'react-icons/io'
import { ImScissors } from 'react-icons/im'
import { IoIosHome } from 'react-icons/io'

const UMBRAL_SCROLL = 24

const enlaces = [
  { to: '/', texto: 'Inicio', Icono: IoIosHome, end: true },
  { to: '/cortes', texto: 'Servicios', Icono: ImScissors },
]

const foco =
  'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-oro'

const NavBar = () => {
  const [menuMovil, setMenuMovil] = useState(false)
  const [conScroll, setConScroll] = useState(false)
  const botonRef = useRef(null)

  useEffect(() => {
    const actualizar = () => setConScroll(window.scrollY > UMBRAL_SCROLL)
    actualizar()
    window.addEventListener('scroll', actualizar, { passive: true })
    return () => window.removeEventListener('scroll', actualizar)
  }, [])

  useEffect(() => {
    if (!menuMovil) return

    const alTeclear = (e) => {
      if (e.key === 'Escape') {
        setMenuMovil(false)
        botonRef.current?.focus()
      }
    }
    const alRedimensionar = () => {
      if (window.innerWidth >= 768) setMenuMovil(false)
    }

    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', alTeclear)
    window.addEventListener('resize', alRedimensionar)

    return () => {
      document.body.style.overflow = overflowPrevio
      document.removeEventListener('keydown', alTeclear)
      window.removeEventListener('resize', alRedimensionar)
    }
  }, [menuMovil])

  const cerrarMenu = () => setMenuMovil(false)

  const claseEnlace = (activo, base) =>
    `${base} ${foco} ${activo ? 'text-oro' : 'text-zinc-300 hover:text-white'}`

  return (
    <>
      <header
        data-scrolled={conScroll}
        className={`${
          menuMovil ? 'fixed inset-x-0' : 'sticky'
        } top-0 ${menuMovil ? 'z-70' : 'z-50'} border-b transition-colors duration-300 text-white ${
          conScroll
            ? 'bg-black/70 backdrop-blur-md border-oro/30'
            : 'bg-black/90 border-white/10'
        }`}
      >
        <nav
          aria-label='Principal'
          className='flex justify-between items-center py-3 px-5 max-w-7xl mx-auto'
        >
          <Link
            to='/'
            onClick={cerrarMenu}
            className={`flex items-center gap-2 font-semibold rounded ${foco}`}
          >
            <RiScissorsCutFill
              aria-hidden='true'
              className='bg-[#f7f4ef] text-black rounded-full p-1'
              size={28}
            />
            Black Iron Barbers
          </Link>

          {/* Escritorio y tablet */}
          <div className='hidden md:flex md:gap-8 lg:gap-10 items-center'>
            {enlaces.map(({ to, texto, Icono, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `${claseEnlace(isActive, 'relative py-1 lg:text-lg flex items-center gap-2 duration-200 active:scale-95')} ${
                    isActive
                      ? 'after:absolute after:left-0 after:right-0 after:-bottom-0.5 after:h-0.5 after:bg-oro'
                      : ''
                  }`
                }
              >
                <Icono aria-hidden='true' />
                {texto}
              </NavLink>
            ))}

            <Link
              to='/reservar-corte'
              className={`group flex items-center gap-2 bg-oro text-black font-semibold rounded-full px-5 py-2 hover:bg-[#e2bc58] duration-300 active:scale-95 ${foco}`}
            >
              Agendar
              <span
                aria-hidden='true'
                className='w-0 ml-0 overflow-hidden opacity-0 duration-300 group-hover:ml-1 group-hover:w-4 group-hover:opacity-100 group-focus-visible:ml-1 group-focus-visible:w-4 group-focus-visible:opacity-100'
              >
                <FaArrowRight size={14} />
              </span>
            </Link>
          </div>

          {/* Botón móvil */}
          <button
            ref={botonRef}
            type='button'
            aria-label={menuMovil ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menuMovil}
            aria-controls='menu-movil'
            onClick={() => setMenuMovil((abierto) => !abierto)}
            className={`md:hidden p-1 rounded cursor-pointer ${foco}`}
          >
            <span
              className={`block transition-transform duration-300 motion-reduce:transition-none ${
                menuMovil ? 'rotate-90' : 'rotate-0'
              }`}
            >
              {menuMovil ? (
                <IoCloseOutline size={32} aria-hidden='true' />
              ) : (
                <IoMdMenu size={32} aria-hidden='true' />
              )}
            </span>
          </button>
        </nav>
      </header>

      {/* Menú móvil: hermano del header para que el blur no altere su posición fija */}
      <nav
        id='menu-movil'
        aria-label='Menú móvil'
        inert={!menuMovil}
        className={`fixed inset-0 z-60 md:hidden flex flex-col items-center justify-center gap-10 bg-cover bg-center transition-all duration-300 motion-reduce:transition-none ${
          menuMovil
            ? 'translate-y-0 opacity-100 visible'
            : '-translate-y-full opacity-0 invisible'
        }`}
        style={{
          backgroundImage:
            'linear-gradient(rgb(0 0 0 / 0.85), rgb(0 0 0 / 0.85)), url(/CourtMan/court_1.jpg)',
        }}
      >
        {enlaces.map(({ to, texto, Icono, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={cerrarMenu}
            className={({ isActive }) =>
              claseEnlace(
                isActive,
                'text-3xl font-bold flex items-center gap-2 active:scale-95 duration-200'
              )
            }
          >
            <Icono aria-hidden='true' />
            {texto}
          </NavLink>
        ))}

        <Link
          to='/reservar-corte'
          onClick={cerrarMenu}
          className={`flex items-center gap-2 bg-oro text-black rounded-full px-8 py-3 font-bold active:scale-95 duration-200 shadow-2xl ${foco}`}
        >
          Agendar
          <FaArrowRight aria-hidden='true' />
        </Link>
      </nav>
    </>
  )
}

export default NavBar
