import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { obtenerBarberos } from '../../services/api'
import { useCarga } from '../../hooks/useCarga'
import { cargosDelEquipo, enlaceReserva, filtrarPorCargo, ordenarEquipo } from '../../utils/equipo'
import { retrasoEscalonado } from '../../utils/escalonado'
import TarjetaEquipo, { EsqueletoTarjetaEquipo } from './equipo/TarjetaEquipo'
import FiltroCargos from './equipo/FiltroCargos'
import ErrorCarga from '../ui/ErrorCarga'
import SinResultados from '../ui/SinResultados'
import Revelar from '../ui/Revelar'

// Galería con todo el equipo. Se centra por filas (flex-wrap + justify-center) para que pocos barberos no se
// estiren: 2 columnas en móvil, 3 desde md y 4 desde xl (gap-3 / sm:gap-4 / xl:gap-5).
const LISTA = 'mx-auto flex max-w-6xl flex-wrap justify-center gap-3 sm:gap-4 xl:gap-5'
const ITEM =
  'w-[calc((100%_-_0.75rem)/2)] sm:w-[calc((100%_-_1rem)/2)] md:w-[calc((100%_-_2rem)/3)] xl:w-[calc((100%_-_3.75rem)/4)]'
const ESQUELETOS = 8

const NuestrosColaboradores = () => {
  const { datos, cargando, error, recargar } = useCarga(obtenerBarberos, 'equipo')
  const [cargoElegido, setCargoElegido] = useState(null)
  const [filtrado, setFiltrado] = useState(false)

  const equipo = useMemo(() => ordenarEquipo(datos ?? []), [datos])
  const cargos = useMemo(() => cargosDelEquipo(equipo), [equipo])
  // Si el cargo elegido ya no existe (p. ej. tras recargar), se vuelve a "Todos".
  const cargoActivo = cargos.some(({ cargo }) => cargo === cargoElegido) ? cargoElegido : null
  const visibles = useMemo(() => filtrarPorCargo(equipo, cargoActivo), [equipo, cargoActivo])

  const elegirCargo = (cargo) => {
    setCargoElegido(cargo)
    setFiltrado(true)
  }

  const sinDatos = cargando && datos === null

  return (
    <section id="equipo" aria-labelledby="titulo-equipo" className="relative overflow-hidden bg-zinc-950 px-4 py-16 md:py-20">
      <div aria-hidden="true" className="pointer-events-none absolute -top-32 left-1/2 h-112 w-md max-w-full -translate-x-1/2 rounded-full bg-oro/10 blur-3xl" />

      <div className="relative mx-auto max-w-6xl">
        <header className="mb-10 flex flex-col items-center gap-3 text-center md:mb-12">
          <Revelar como="p" className="font-poppins text-xs font-semibold tracking-[0.3em] text-oro uppercase">
            El equipo
          </Revelar>
          <Revelar
            como="h2"
            retraso={80}
            id="titulo-equipo"
            className="font-playfair text-4xl font-bold text-white md:text-5xl lg:text-6xl"
          >
            Nuestro Equipo
          </Revelar>
          <Revelar como="p" retraso={160} className="max-w-xl font-poppins text-base text-zinc-300 md:text-lg">
            Profesionales con estilo propio. Elige con quién quieres sentarte.
          </Revelar>
          <Revelar como="span" retraso={240} aria-hidden="true" className="mt-1 block h-px w-20 bg-oro" />
        </header>

        {error && <ErrorCarga mensaje={error} onReintentar={recargar} variante="oscuro" />}

        {sinDatos && (
          <>
            <p role="status" className="sr-only">Cargando equipo...</p>
            <ul aria-hidden="true" className={LISTA}>
              {Array.from({ length: ESQUELETOS }, (_, i) => (
                <li key={i} className={ITEM}>
                  <EsqueletoTarjetaEquipo />
                </li>
              ))}
            </ul>
          </>
        )}

        {!cargando && !error && equipo.length === 0 && (
          <SinResultados variante="oscuro" mensaje="Pronto presentaremos a nuestro equipo." />
        )}

        {equipo.length > 0 && !error && (
          <>
            <Revelar retraso={120} className="mb-8">
              <FiltroCargos cargos={cargos} total={equipo.length} cargoActivo={cargoActivo} onElegir={elegirCargo} />
              <p role="status" className="sr-only">
                {visibles.length === 1 ? 'Mostrando 1 integrante' : `Mostrando ${visibles.length} integrantes`}
              </p>
            </Revelar>

            {visibles.length === 0 ? (
              <SinResultados
                variante="oscuro"
                mensaje="No hay integrantes con ese cargo."
                onLimpiar={() => elegirCargo(null)}
                etiquetaBoton="Ver todo el equipo"
              />
            ) : (
              <ul className={LISTA}>
                {visibles.map((barbero, indice) => (
                  <Revelar
                    como="li"
                    key={`${cargoActivo ?? 'todos'}-${barbero.id}`}
                    retraso={retrasoEscalonado(indice, 70, 280)}
                    className={ITEM}
                  >
                    <TarjetaEquipo barbero={barbero} entrada={filtrado} />
                  </Revelar>
                ))}
              </ul>
            )}

            <Revelar className="mx-auto mt-12 flex max-w-xl flex-col items-center gap-4 text-center">
              <p className="font-playfair text-xl text-white md:text-2xl">¿No sabes con quién?</p>
              <p className="font-poppins text-zinc-300">Te asignamos al primer barbero disponible.</p>
              <Link
                to={enlaceReserva(null)}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-oro px-6 py-2.5 font-poppins font-semibold text-oro hover:bg-oro hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oro active:scale-95 motion-safe:transition-colors motion-safe:duration-200"
              >
                Reservar con cualquier barbero
              </Link>
            </Revelar>
          </>
        )}
      </div>
    </section>
  )
}

export default NuestrosColaboradores
