import { useEffect, useRef, useState } from 'react'
import { FiLock } from 'react-icons/fi'
import CambiarContrasena from '../dashboard/CambiarContrasena'
import Modal from '../ui/Modal'

const iniciales = (nombre) => nombre.trim().slice(0, 2).toUpperCase()

// Avatar con iniciales (solo CSS) que abre un panel con las opciones de la cuenta.
const MenuUsuario = ({ usuario, token }) => {
  const nombre = usuario?.usuario ?? 'Administrador'
  const [abierto, setAbierto] = useState(false)
  const [verContrasena, setVerContrasena] = useState(false)
  const contenedorRef = useRef(null)
  const botonRef = useRef(null)

  useEffect(() => {
    if (!abierto) return undefined
    const fuera = (e) => {
      if (!contenedorRef.current?.contains(e.target)) setAbierto(false)
    }
    const escape = (e) => {
      if (e.key === 'Escape') {
        setAbierto(false)
        botonRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', escape)
    }
  }, [abierto])

  const cerrarModal = () => {
    setVerContrasena(false)
    botonRef.current?.focus()
  }

  return (
    <div ref={contenedorRef} className="relative shrink-0">
      <button
        ref={botonRef}
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-controls="menu-usuario"
        aria-label={`Menú de usuario de ${nombre}`}
        className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full pr-1 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-oro sm:pr-3"
      >
        <span
          aria-hidden="true"
          className="flex size-11 items-center justify-center rounded-full border border-oro/60 bg-oro/10 text-sm font-semibold text-oro sm:size-9"
        >
          {iniciales(nombre)}
        </span>
        <span className="hidden max-w-32 truncate text-sm font-medium sm:block">{nombre}</span>
      </button>

      {abierto && (
        <div
          id="menu-usuario"
          className="absolute right-0 top-full z-40 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-white/10 bg-[#0a0a0a] p-2 shadow-xl"
        >
          <div className="border-b border-white/10 px-3 py-2">
            <p className="truncate text-sm font-semibold">{nombre}</p>
            <p className="text-xs text-zinc-400">Administrador</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setAbierto(false)
              setVerContrasena(true)
            }}
            className="mt-1 flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-sm text-zinc-200 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-oro"
          >
            <FiLock aria-hidden="true" />
            Cambiar contraseña
          </button>
        </div>
      )}

      {verContrasena && (
        <Modal idTitulo="titulo-contrasena" alCerrar={cerrarModal}>
          <CambiarContrasena token={token} variante="admin" />
        </Modal>
      )}
    </div>
  )
}

export default MenuUsuario
