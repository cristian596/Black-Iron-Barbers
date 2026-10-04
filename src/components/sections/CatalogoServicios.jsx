import { useEffect, useState } from 'react'
import { obtenerServicios } from '../../services/api'
import { useFiltroServicios } from '../../hooks/useFiltroServicios'
import TarjetaServicio from '../ui/TarjetaServicio'
import FiltrosServicios from '../ui/FiltrosServicios'
import SinResultados from '../ui/SinResultados'
import ErrorCarga from '../ui/ErrorCarga'
import Revelar from '../ui/Revelar'
import { retrasoEscalonado } from '../../utils/escalonado'

// Columnas de la rejilla en pantallas grandes (xl:grid-cols-4)
const COLUMNAS_MAX = 4

const CatalogoServicios = () => {
  const [servicios, setServicios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  // Se incrementa para volver a pedir la lista (botón Reintentar).
  const [recarga, setRecarga] = useState(0)
  const filtro = useFiltroServicios(servicios)

  useEffect(() => {
    let cancelado = false

    const cargarServicios = async () => {
      try {
        const data = await obtenerServicios()
        if (!cancelado) setServicios(data)
      } catch (err) {
        if (!cancelado) setError(err.message)
      } finally {
        if (!cancelado) setCargando(false)
      }
    }
    cargarServicios()

    return () => {
      cancelado = true
    }
  }, [recarga])

  const reintentar = () => {
    setError('')
    setCargando(true)
    setRecarga((veces) => veces + 1)
  }

  // Con varias categorías a la vista cada una lleva su encabezado; con una sola no hace falta.
  const conEncabezados = filtro.grupos.length > 1

  return (
    <div className='grid grid-cols-1 py-3 bg-linear-to-br from-zinc-800 to-amber-600'>
      <Revelar
        como='h2'
        className='flex items-center justify-center text-white py-3 font-bold font-cinzel text-3xl lg:text-6xl text-center px-4'
      >
        NUESTRA CARTA DE SERVICIOS
      </Revelar>

      {cargando && (
        <p role='status' className='text-center text-white font-cinzel text-xl py-5'>Cargando servicios...</p>
      )}

      {error && <ErrorCarga mensaje={error} onReintentar={reintentar} variante='oscuro' />}

      {!cargando && !error && (
        <>
          <Revelar
            retraso={80}
            className='min-w-0 px-5 pb-5'
            role='group'
            aria-label='Filtrar servicios'
          >
            <FiltrosServicios filtro={filtro} variante='oscuro' />
          </Revelar>

          {filtro.visibles.length === 0 ? (
            <SinResultados onLimpiar={filtro.limpiar} variante='oscuro' />
          ) : (
            <div className='grid gap-8 p-5'>
              {filtro.grupos.map((grupo) => (
                <section key={grupo.slug} aria-label={grupo.nombre}>
                  {conEncabezados && (
                    <h3 className='mb-4 font-cinzel text-2xl font-bold text-white lg:text-3xl'>{grupo.nombre}</h3>
                  )}
                  <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4'>
                    {grupo.servicios.map((servicio, indice) => (
                      // El retardo se reinicia cada COLUMNAS_MAX tarjetas: cada una entra al
                      // llegar a pantalla, así que una fila lejana no debe esperar por las anteriores
                      <Revelar
                        key={servicio.id}
                        retraso={retrasoEscalonado(indice % COLUMNAS_MAX)}
                        className='grid'
                      >
                        <TarjetaServicio servicio={servicio} Titulo={conEncabezados ? 'h4' : 'h3'} />
                      </Revelar>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default CatalogoServicios
