import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FiDownload, FiPrinter } from 'react-icons/fi'
import { useAuth } from '../../context/AuthContext'
import { obtenerReporteDiario, descargarReporteDiarioCsv } from '../../services/api'
import { useCarga } from '../../hooks/useCarga'
import { esFechaISO, formatearFechaLegible, hoyISO, sumarDiasISO } from '../../utils/fechas'
import { formatearDinero } from '../../utils/formato'
import { guardarArchivo } from '../../utils/descarga'
import SelectorDia from '../../components/admin/SelectorDia'
import TarjetaReporte from '../../components/admin/TarjetaReporte'
import ErrorCarga from '../../components/ui/ErrorCarga'
import SinResultados from '../../components/ui/SinResultados'

const BOTON_ACCION =
  'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/15 px-4 text-sm font-medium text-zinc-200 hover:border-white/40 hover:text-white focus-visible:outline-2 focus-visible:outline-oro disabled:cursor-not-allowed disabled:opacity-50'

const textoCitas = (n) => (n === 1 ? '1 cita' : `${n} citas`)

// Una fecha inválida o posterior a hoy en la URL se ignora y se muestra hoy.
const leerFecha = (params, hoy) => {
  const valor = params.get('fecha')
  return esFechaISO(valor) && valor <= hoy ? valor : hoy
}

const Reportes = () => {
  const { token } = useAuth()
  const [params, setParams] = useSearchParams()
  const hoy = hoyISO()
  const fecha = leerFecha(params, hoy)

  const reporte = useCarga(() => obtenerReporteDiario(token, fecha), fecha)
  const [descargando, setDescargando] = useState(false)
  const [errorDescarga, setErrorDescarga] = useState('')

  const cambiarDia = (nueva) => {
    setErrorDescarga('')
    setParams({ fecha: nueva })
  }

  const descargar = async () => {
    setErrorDescarga('')
    setDescargando(true)
    try {
      const { blob, nombre } = await descargarReporteDiarioCsv(token, fecha)
      guardarArchivo(blob, nombre)
    } catch (err) {
      setErrorDescarga(err.message)
    } finally {
      setDescargando(false)
    }
  }

  const datos = reporte.datos
  const vacio = datos && datos.total_cortes === 0 && datos.canceladas === 0 && datos.pendientes_sin_cerrar === 0
  const fechaLegible = formatearFechaLegible(fecha)

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="hidden font-playfair text-3xl font-semibold text-black print:block">Black Iron Barbers · Reporte diario</p>
        <h1 className="font-playfair text-3xl font-semibold print:hidden">Reportes</h1>
        <p className="wrap-anywhere text-sm first-letter:uppercase text-zinc-400 print:text-base print:text-black">{fechaLegible}</p>
      </header>

      <div className="flex min-w-0 flex-col gap-4 rounded-xl border border-white/10 bg-zinc-950 p-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between print:hidden">
        <SelectorDia
          fecha={fecha}
          max={hoy}
          alCambiar={cambiarDia}
          anterior={sumarDiasISO(fecha, -1)}
          siguiente={sumarDiasISO(fecha, 1)}
        />
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
          <button type="button" onClick={descargar} disabled={descargando || !datos} className={BOTON_ACCION}>
            <FiDownload aria-hidden="true" /> {descargando ? 'Descargando...' : 'Descargar CSV'}
          </button>
          <button type="button" onClick={() => window.print()} disabled={!datos} className={BOTON_ACCION}>
            <FiPrinter aria-hidden="true" /> Imprimir
          </button>
        </div>
      </div>

      {errorDescarga && (
        <p role="alert" className="rounded-lg bg-red-900/40 p-3 text-sm text-red-300 print:hidden">{errorDescarga}</p>
      )}

      {reporte.error ? (
        <div className="rounded-xl border border-white/10 bg-zinc-950 print:hidden">
          <ErrorCarga mensaje="No pudimos cargar el reporte." onReintentar={reporte.recargar} variante="oscuro" />
        </div>
      ) : !datos ? (
        <p role="status" className="py-10 text-center text-zinc-400">Cargando reporte...</p>
      ) : vacio ? (
        <div className="rounded-xl border border-white/10 bg-zinc-950 print:border-zinc-400 print:bg-white">
          <SinResultados variante="oscuro" mensaje="No hay citas registradas en este día." />
        </div>
      ) : (
        <>
          {datos.pendientes_sin_cerrar > 0 && (
            <p role="status" className="min-w-0 rounded-lg border border-oro/40 bg-oro/10 p-3 text-sm text-zinc-100 print:border-zinc-500 print:bg-white print:text-black">
              Hay {textoCitas(datos.pendientes_sin_cerrar)} sin cerrar: las cierran los barberos, y el reporte solo cuenta las completadas.{' '}
              <Link
                to={`/admin/citas?pestana=todas&desde=${fecha}&hasta=${fecha}`}
                className="inline-flex min-h-11 items-center font-semibold text-oro underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-oro print:hidden"
              >
                Ver las citas de este día
              </Link>
            </p>
          )}

          <section aria-labelledby="titulo-cifras" className="min-w-0">
            <h2 id="titulo-cifras" className="sr-only">Cifras del día</h2>
            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <TarjetaReporte etiqueta="Total de cortes" valor={datos.total_cortes} nota="Citas completadas" />
              <TarjetaReporte etiqueta="Ingresos" valor={formatearDinero(datos.ingresos)} nota="Suma de lo cobrado en cada cita" />
              <TarjetaReporte etiqueta="Ticket promedio" valor={formatearDinero(datos.ticket_promedio)} nota="No cuenta los cortes gratis" />
              <TarjetaReporte etiqueta="Canceladas" valor={datos.canceladas} nota="Aparte: no suman ingresos" />
            </div>
          </section>

          <section aria-labelledby="titulo-servicios" className="min-w-0 rounded-xl border border-white/10 bg-zinc-950 p-4 print:border-zinc-400 print:bg-white">
            <h2 id="titulo-servicios" className="text-lg font-semibold print:text-black">Servicios más pedidos</h2>
            {datos.servicios_mas_pedidos.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-400 print:text-zinc-700">Ningún corte completado este día.</p>
            ) : (
              <div className="mt-3 min-w-0 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Servicios completados el {fechaLegible}, de más a menos pedidos</caption>
                  <thead>
                    <tr className="border-b border-white/10 text-zinc-400 print:border-zinc-400 print:text-zinc-700">
                      <th scope="col" className="py-2 pr-3 font-medium">Servicio</th>
                      <th scope="col" className="py-2 pr-3 text-right font-medium">Cantidad</th>
                      <th scope="col" className="py-2 text-right font-medium">Ingresos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.servicios_mas_pedidos.map((servicio) => (
                      <tr key={servicio.nombre} className="border-b border-white/5 print:border-zinc-300">
                        <th scope="row" className="wrap-anywhere py-2 pr-3 font-medium">{servicio.nombre}</th>
                        <td className="py-2 pr-3 text-right">{servicio.cantidad}</td>
                        <td className="py-2 text-right font-semibold">{formatearDinero(servicio.ingresos)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

export default Reportes
