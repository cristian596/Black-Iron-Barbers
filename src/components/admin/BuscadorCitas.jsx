import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiSearch } from 'react-icons/fi'

// El buscador de la barra superior del admin es global: lleva a /admin/citas?q=<texto> (la lista aplica el filtro).
const BuscadorCitas = () => {
  const navigate = useNavigate()
  const [texto, setTexto] = useState('')

  const buscar = (e) => {
    e.preventDefault()
    const q = texto.trim()
    navigate(q ? `/admin/citas?${new URLSearchParams({ q })}` : '/admin/citas')
  }

  return (
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
  )
}

export default BuscadorCitas
