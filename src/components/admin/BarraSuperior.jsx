import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiMenu, FiSearch } from 'react-icons/fi'
import MenuUsuario from './MenuUsuario'

// El buscador es global: lleva a /admin/citas?q=<texto> (la lista aplica el filtro desde la parte 1c).
const BarraSuperior = ({ alAbrirMenu, menuAbierto, usuario, token }) => {
  const navigate = useNavigate()
  const [texto, setTexto] = useState('')

  const buscar = (e) => {
    e.preventDefault()
    const q = texto.trim()
    navigate(q ? `/admin/citas?${new URLSearchParams({ q })}` : '/admin/citas')
  }

  return (
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

      <form role="search" onSubmit={buscar} className="relative min-w-0 max-w-xl flex-1">
        <label htmlFor="buscador-admin" className="sr-only">
          Buscar citas por cliente, servicio o barbero
        </label>
        <FiSearch
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
        />
        <input
          id="buscador-admin"
          type="search"
          value={texto}
          maxLength={100}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar citas..."
          className="h-11 w-full min-w-0 rounded-lg border border-white/10 bg-[#111] pl-9 pr-3 text-sm text-white placeholder:text-zinc-500 focus-visible:border-oro focus-visible:outline-2 focus-visible:outline-oro"
        />
      </form>

      <div className="ml-auto">
        <MenuUsuario usuario={usuario} token={token} />
      </div>
    </header>
  )
}

export default BarraSuperior
