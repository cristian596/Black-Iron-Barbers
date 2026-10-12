import { FiMenu } from 'react-icons/fi'

// Barra superior común: botón de menú (móvil), `centro` (p. ej. el buscador del admin) y `derecha` (menú de usuario).
const BarraSuperior = ({ alAbrirMenu, menuAbierto, centro, derecha }) => (
  <header className="sticky top-0 z-20 print:hidden flex h-16 items-center gap-2 border-b border-white/10 bg-black/90 px-3 backdrop-blur sm:gap-3 sm:px-6 lg:px-8">
    <button
      type="button"
      onClick={alAbrirMenu}
      aria-label="Abrir menú"
      aria-expanded={menuAbierto}
      aria-controls="barra-lateral"
      className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-zinc-300 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-oro lg:hidden"
    >
      <FiMenu aria-hidden="true" className="text-xl" />
    </button>

    {centro}

    <div className="ml-auto">{derecha}</div>
  </header>
)

export default BarraSuperior
