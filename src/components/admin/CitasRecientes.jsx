import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { obtenerCitasAdmin } from '../../services/api'
import { useCarga } from '../../hooks/useCarga'
import PestanasCitas from './PestanasCitas'
import TablaCitas from '../dashboard/TablaCitas'
import ErrorCarga from '../ui/ErrorCarga'
import SinResultados from '../ui/SinResultados'

const LIMITE = 10
const ESPERA_BUSQUEDA_MS = 300

const MENSAJE_VACIO = {
  proximas: 'No hay citas próximas.',
  todas: 'Todavía no hay citas registradas.',
  canceladas: 'No hay citas canceladas.',
}

// Citas recientes del Resumen: solo lectura (la cita, su estado y el barbero a cargo). Gestionarlas
// (reasignar) se hace en /admin/citas; completar y cancelar son de los barberos.
const CitasRecientes = ({ token }) => {
  const [pestana, setPestana] = useState('proximas')
  const [texto, setTexto] = useState('')
  const [q, setQ] = useState('')
  const [fecha, setFecha] = useState('')

  // La búsqueda se aplica un instante después de dejar de escribir, para no pedir datos en cada tecla.
  useEffect(() => {
    const espera = setTimeout(() => setQ(texto.trim()), ESPERA_BUSQUEDA_MS)
    return () => clearTimeout(espera)
  }, [texto])

  const filtros = { pestana, q, desde: fecha, hasta: fecha, limite: LIMITE }
  const { datos, cargando, error, recargar } = useCarga(
    () => obtenerCitasAdmin(token, filtros),
    JSON.stringify(filtros)
  )

  const hayFiltros = Boolean(q || fecha || texto)
  const limpiar = () => {
    setTexto('')
    setQ('')
    setFecha('')
  }
  const enlace = new URLSearchParams(
    Object.entries({ pestana, q, desde: fecha, hasta: fecha }).filter(([, valor]) => valor)
  ).toString()

  return (
    <section
      aria-labelledby="titulo-citas-recientes"
      aria-busy={cargando}
      className="min-w-0 rounded-xl border border-white/10 bg-zinc-950 p-4"
    >
      <h2 id="titulo-citas-recientes" className="mb-3 text-lg font-semibold">Citas recientes</h2>

      <div className="mb-4 flex min-w-0 flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <PestanasCitas valor={pestana} alCambiar={setPestana} />

        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:w-120">
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor="recientes-buscar" className="text-sm font-medium text-zinc-300">Buscar</label>
            <input
              id="recientes-buscar"
              type="search"
              value={texto}
              maxLength={100}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Cliente, servicio o barbero"
              className="h-11 min-w-0 rounded-lg border border-white/15 bg-black px-3 text-sm text-white placeholder:text-zinc-500 focus-visible:border-oro focus-visible:outline-2 focus-visible:outline-oro"
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor="recientes-fecha" className="text-sm font-medium text-zinc-300">Fecha</label>
            <input
              id="recientes-fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="h-11 min-w-0 rounded-lg border border-white/15 bg-black px-3 text-sm text-white focus-visible:border-oro focus-visible:outline-2 focus-visible:outline-oro"
            />
          </div>
        </div>
      </div>

      {error ? (
        <ErrorCarga mensaje="No pudimos cargar las citas." onReintentar={recargar} variante="oscuro" />
      ) : !datos ? (
        <p role="status" className="py-10 text-center text-zinc-400">Cargando citas...</p>
      ) : datos.items.length === 0 ? (
        hayFiltros ? (
          <SinResultados variante="oscuro" mensaje="No hay citas que coincidan con la búsqueda." onLimpiar={limpiar} />
        ) : (
          <SinResultados variante="oscuro" mensaje={MENSAJE_VACIO[pestana]} />
        )
      ) : (
        <>
          <div className="min-w-0">
            <TablaCitas citas={datos.items} mostrarBarbero />
          </div>
          <div className="mt-4 flex flex-col gap-2 text-sm text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
            <p>Mostrando {datos.items.length} de {datos.total}</p>
            <Link
              to={`/admin/citas${enlace ? `?${enlace}` : ''}`}
              className="inline-flex min-h-11 items-center font-medium text-oro hover:underline focus-visible:outline-2 focus-visible:outline-oro"
            >
              Ver todas las citas
            </Link>
          </div>
        </>
      )}
    </section>
  )
}

export default CitasRecientes
