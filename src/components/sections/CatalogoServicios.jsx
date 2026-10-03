import { useEffect, useMemo, useState } from 'react'
import { obtenerServicios } from '../../services/api'
import { obtenerCategoria } from '../../data/categoriasServicios'
import TarjetaServicio from '../ui/TarjetaServicio'
import Revelar from '../ui/Revelar'
import { retrasoEscalonado } from '../../utils/escalonado'

// Columnas de la rejilla en pantallas grandes (xl:grid-cols-4)
const COLUMNAS_MAX = 4

const CatalogoServicios = () => {
  const [servicios, setServicios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [categoriaActiva, setCategoriaActiva] = useState('Todos')

  useEffect(() => {
    const cargarServicios = async () => {
      try {
        const data = await obtenerServicios()
        setServicios(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setCargando(false)
      }
    }
    cargarServicios()
  }, [])

  const serviciosConCategoria = useMemo(
    () => servicios.map((servicio) => ({ ...servicio, categoria: obtenerCategoria(servicio) })),
    [servicios]
  )

  const categorias = useMemo(
    () => ['Todos', ...new Set(serviciosConCategoria.map((servicio) => servicio.categoria))],
    [serviciosConCategoria]
  )

  const serviciosFiltrados = useMemo(
    () =>
      categoriaActiva === 'Todos'
        ? serviciosConCategoria
        : serviciosConCategoria.filter((servicio) => servicio.categoria === categoriaActiva),
    [serviciosConCategoria, categoriaActiva]
  )

  return (
    <div className='grid justify-center items-center py-3 bg-linear-to-br from-zinc-800 to-amber-600'>
      <Revelar
        como='h2'
        className='flex items-center justify-center text-white py-3 font-bold font-cinzel text-3xl lg:text-6xl text-center px-4'
      >
        NUESTRA CARTA DE SERVICIOS
      </Revelar>

      {cargando && (
        <p className='text-center text-white font-cinzel text-xl py-5'>Cargando servicios...</p>
      )}

      {error && (
        <p className='text-center text-white font-cinzel text-xl py-5'>{error}</p>
      )}

      {!cargando && !error && (
        <>
          <Revelar
            retraso={80}
            className='flex flex-wrap justify-center gap-2 px-5 pb-5'
            role='tablist'
            aria-label='Categorías de servicios'
          >
            {categorias.map((categoria) => (
              <button
                key={categoria}
                type='button'
                role='tab'
                aria-selected={categoriaActiva === categoria}
                onClick={() => setCategoriaActiva(categoria)}
                className={`rounded-full px-4 py-2 font-poppins font-semibold cursor-pointer active:scale-95 duration-300 ${
                  categoriaActiva === categoria
                    ? 'bg-black text-oro'
                    : 'bg-white text-black hover:bg-oro'
                }`}
              >
                {categoria}
              </button>
            ))}
          </Revelar>

          <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 p-5'>
            {serviciosFiltrados.map((servicio, indice) => (
              // El retardo se reinicia cada COLUMNAS_MAX tarjetas: cada una entra al
              // llegar a pantalla, así que una fila lejana no debe esperar por las anteriores
              <Revelar
                key={servicio.id}
                retraso={retrasoEscalonado(indice % COLUMNAS_MAX)}
                className='grid'
              >
                <TarjetaServicio servicio={servicio} categoria={servicio.categoria} />
              </Revelar>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default CatalogoServicios
