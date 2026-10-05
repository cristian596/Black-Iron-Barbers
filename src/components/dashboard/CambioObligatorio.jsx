import { useEffect, useRef } from 'react'
import CambiarContrasena from './CambiarContrasena'
import NoIndex from '../ui/NoIndex'

// Pantalla completa para un barbero con la contraseña caducada: no hay acceso al resto del panel (el back-end
// tampoco lo permite) hasta que la cambie. Se puede cerrar sesión.
const CambioObligatorio = ({ token, alCambiada, alCerrarSesion }) => {
  const tituloRef = useRef(null)

  useEffect(() => {
    tituloRef.current?.focus()
  }, [])

  return (
    <>
      <NoIndex />
      <main className="min-h-screen bg-black px-4 py-10 text-white sm:px-8">
        <div className="mx-auto flex min-w-0 max-w-md flex-col gap-6">
          <header>
            <h1 ref={tituloRef} tabIndex={-1} className="text-3xl font-bold outline-none sm:text-4xl">
              Tu contraseña caducó
            </h1>
            <p className="mt-2 text-gray-400" role="status">
              Por seguridad las contraseñas duran 60 días. Crea una nueva para volver a tu panel.
            </p>
          </header>
          <CambiarContrasena token={token} titulo="Elige tu nueva contraseña" alExito={alCambiada} />
          <button
            type="button"
            onClick={alCerrarSesion}
            className="min-h-11 w-fit cursor-pointer rounded-xl border border-white/20 px-4 text-white duration-300 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-95"
          >
            Cerrar sesión
          </button>
        </div>
      </main>
    </>
  )
}

export default CambioObligatorio
