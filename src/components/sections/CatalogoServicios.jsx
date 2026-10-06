import { useEffect, useState } from 'react'
import { obtenerServicios } from '../../services/api'
import { useFiltroServicios } from '../../hooks/useFiltroServicios'
import { useCarrito } from '../../context/CarritoContext'
import TarjetaServicio from '../ui/TarjetaServicio'
import FiltrosServicios from '../ui/FiltrosServicios'
import SinResultados from '../ui/SinResultados'
import ErrorCarga from '../ui/ErrorCarga'
import Revelar from '../ui/Revelar'
import CarritoServicios from '../carrito/CarritoServicios'
import { AvisoSeleccion } from '../carrito/ContenidoCarrito'
import { retrasoEscalonado } from '../../utils/escalonado'

// Columnas de la rejilla de tarjetas en pantallas grandes (xl:grid-cols-3, con el carrito a la derecha)
const COLUMNAS_MAX = 3

const CatalogoServicios = () => {
  const [servicios, setServicios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  // Se incrementa para volver a pedir la lista (botón Reintentar).
  const [recarga, setRecarga] = useState(0)
  const filtro = useFiltroServicios(servicios)
  const { ids, aviso, sincronizar, descartarAviso } = useCarrito()

  useEffect(() => {
    let cancelado = false

    const cargarServicios = async () => {
      try {
        const data = await obtenerServicios()
        if (!cancelado) {
          setServicios(data)
          // Quita de la selección guardada lo que ya no está activo (con aviso).
          sincronizar(data)
        }
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
  }, [recarga, sincronizar])

  const reintentar = () => {
    setError('')
    setCargando(true)
    setRecarga((veces) => veces + 1)
  }

  // Con varias categorías a la vista cada una lleva su encabezado; con una sola no hace falta.
  const conEncabezados = filtro.grupos.length > 1

  return (
    // En móvil, con la barra de "Tu selección" fija abajo, se deja espacio para no taparle el final de la página.
    <div className={`grid grid-cols-1 py-3 bg-linear-to-br from-zinc-800 to-amber-600 ${ids.length > 0 ? 'pb-20 lg:pb-3' : ''}`}>
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

          {/* En móvil el carrito es una barra inferior; su aviso (servicios que se quitaron) sale aquí, a la vista. */}
          <AvisoSeleccion aviso={aviso} onDescartar={descartarAviso} className='mx-5 mb-4 bg-zinc-950 lg:hidden' />

          <div className='mx-auto grid w-full min-w-0 max-w-450 grid-cols-1 gap-6 px-5 pb-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start'>
            {filtro.visibles.length === 0 ? (
              <SinResultados onLimpiar={filtro.limpiar} variante='oscuro' />
            ) : (
              <div className='grid min-w-0 gap-8 pt-5'>
                {filtro.grupos.map((grupo) => (
                  <section key={grupo.slug} aria-label={grupo.nombre}>
                    {conEncabezados && (
                      <h3 className='mb-4 font-cinzel text-2xl font-bold text-white lg:text-3xl'>{grupo.nombre}</h3>
                    )}
                    <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4'>
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

            <CarritoServicios />
          </div>
        </>
      )}
    </div>
  )
}

export default CatalogoServicios
