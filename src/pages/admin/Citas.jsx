import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { actualizarCita, obtenerCitasAdmin } from '../../services/api'
import { useCarga } from '../../hooks/useCarga'
import { useBarberosActivos } from '../../hooks/useBarberosActivos'
import { PESTANAS_CITAS } from '../../data/periodos'
import { esFechaISO } from '../../utils/fechas'
import { totalPaginas } from '../../utils/paginacion'
import TablaCitas from '../../components/dashboard/TablaCitas'
import PestanasCitas from '../../components/admin/PestanasCitas'
import FiltrosCitasAdmin from '../../components/admin/FiltrosCitasAdmin'
import Paginacion from '../../components/admin/Paginacion'
import ErrorCarga from '../../components/ui/ErrorCarga'
import SinResultados from '../../components/ui/SinResultados'

const LIMITE = 15
const ESPERA_BUSQUEDA_MS = 300
const PESTANA_POR_DEFECTO = 'todas'

const MENSAJE_VACIO = {
  proximas: 'No hay citas próximas.',
  todas: 'Todavía no hay citas registradas.',
  canceladas: 'No hay citas canceladas.',
}

// Todo el estado de la lista vive en la URL (?pestana=&q=&desde=&hasta=&barbero=&pagina=): atrás, adelante,
// F5 y los enlaces compartidos funcionan. Un valor inválido en la URL se ignora en vez de romper la página.
const leerParametros = (params) => {
  const pestana = params.get('pestana')
  const pagina = params.get('pagina')
  const barbero = params.get('barbero')
  const desde = params.get('desde')
  const hasta = params.get('hasta')
  return {
    pestana: PESTANAS_CITAS.some((p) => p.id === pestana) ? pestana : PESTANA_POR_DEFECTO,
    q: (params.get('q') ?? '').trim().slice(0, 100),
    desde: esFechaISO(desde) ? desde : '',
    hasta: esFechaISO(hasta) ? hasta : '',
    barbero: /^\d{1,9}$/.test(barbero ?? '') && Number(barbero) > 0 ? barbero : '',
    pagina: /^\d{1,6}$/.test(pagina ?? '') && Number(pagina) > 0 ? Number(pagina) : 1,
  }
}

const Citas = () => {
  const { token } = useAuth()
  const { barberosActivos, errorBarberos } = useBarberosActivos()
  const [searchParams, setSearchParams] = useSearchParams()
  const { pestana, q, desde, hasta, barbero, pagina } = leerParametros(searchParams)

  const [texto, setTexto] = useState(q)
  const [accionCitaId, setAccionCitaId] = useState(null)
  const [errorAccion, setErrorAccion] = useState('')
  const tablaRef = useRef(null)

  // Cambia parámetros de la URL. Cualquier cambio que no traiga `pagina` vuelve a la página 1.
  const cambiar = useCallback(
    (cambios, { reemplazar = false } = {}) => {
      const siguiente = new URLSearchParams(searchParams)
      for (const [clave, valor] of Object.entries(cambios)) {
        if (valor === '' || valor === null || valor === undefined) siguiente.delete(clave)
        else siguiente.set(clave, String(valor))
      }
      if (!('pagina' in cambios) || siguiente.get('pagina') === '1') siguiente.delete('pagina')
      if (siguiente.get('pestana') === PESTANA_POR_DEFECTO) siguiente.delete('pestana')
      setSearchParams(siguiente, { replace: reemplazar })
    },
    [searchParams, setSearchParams]
  )

  // La búsqueda se aplica un instante después de dejar de escribir y no llena el historial con cada pausa.
  useEffect(() => {
    if (texto.trim() === q) return undefined
    const espera = setTimeout(() => cambiar({ q: texto.trim() }, { reemplazar: true }), ESPERA_BUSQUEDA_MS)
    return () => clearTimeout(espera)
  }, [texto, q, cambiar])

  // Atrás/adelante o "Limpiar filtros" cambian q en la URL: el campo la sigue (ajuste durante el render, sin
  // efecto). Si q cambió porque la búsqueda misma la escribió, el campo ya coincide y no se toca.
  const [qVista, setQVista] = useState(q)
  if (q !== qVista) {
    setQVista(q)
    if (texto.trim() !== q) setTexto(q)
  }

  const filtros = { pestana, q, desde, hasta, barbero, pagina, limite: LIMITE }
  const { datos, cargando, error, recargar } = useCarga(() => obtenerCitasAdmin(token, filtros), JSON.stringify(filtros))

  // Una página que no existe (URL vieja, o la última se vació tras reasignar) lleva a la última válida.
  useEffect(() => {
    if (!datos || datos.pagina !== pagina) return
    const ultima = totalPaginas(datos.total, LIMITE)
    if (pagina > ultima) cambiar({ pagina: ultima }, { reemplazar: true })
  }, [datos, pagina, cambiar])

  const hayFiltros = Boolean(q || desde || hasta || barbero || texto)
  const limpiar = () => {
    setTexto('')
    cambiar({ q: '', desde: '', hasta: '', barbero: '' })
  }

  const irAPagina = (nueva) => {
    cambiar({ pagina: nueva })
    tablaRef.current?.scrollIntoView?.({ block: 'start' })
  }

  // El admin solo reasigna (completar y cancelar son de los barberos). Recarga la lista actual: misma página y filtros.
  const cambiarCita = async (cita, cambios, mensajeError) => {
    setErrorAccion('')
    setAccionCitaId(cita.id)
    try {
      await actualizarCita(token, cita.id, cambios)
      recargar()
    } catch (err) {
      setErrorAccion(mensajeError ? `${mensajeError}: ${err.message}` : err.message)
    } finally {
      setAccionCitaId(null)
    }
  }

  const handleReasignar = (cita, nuevoBarberoId) => {
    if (String(nuevoBarberoId) === String(cita.barbero_id)) return
    cambiarCita(cita, { barbero_id: Number(nuevoBarberoId) }, 'No se pudo reasignar la cita')
  }

  const paginaVacia = datos && datos.items.length === 0 && datos.total > 0 // redirigiendo a la última válida

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="font-playfair text-3xl font-semibold">Citas</h1>

      <div className="flex min-w-0 flex-col gap-4">
        <PestanasCitas valor={pestana} alCambiar={(id) => cambiar({ pestana: id })} />
        <FiltrosCitasAdmin
          texto={texto}
          desde={desde}
          hasta={hasta}
          barbero={barbero}
          barberos={barberosActivos}
          hayFiltros={hayFiltros}
          alCambiarTexto={setTexto}
          alCambiarDesde={(valor) => cambiar({ desde: valor })}
          alCambiarHasta={(valor) => cambiar({ hasta: valor })}
          alCambiarBarbero={(valor) => cambiar({ barbero: valor })}
          alLimpiar={limpiar}
        />
        {errorBarberos && <p className="text-sm text-red-400">{errorBarberos}</p>}
      </div>

      <section
        ref={tablaRef}
        aria-labelledby="titulo-lista-citas"
        aria-busy={cargando}
        className="min-w-0 scroll-mt-20 rounded-xl border border-white/10 bg-zinc-950 p-4"
      >
        <h2 id="titulo-lista-citas" className="sr-only">Lista de citas</h2>

        {errorAccion && (
          <p className="mb-3 rounded-lg bg-red-900/40 p-3 text-red-300" role="alert">
            {errorAccion}
          </p>
        )}

        {error ? (
          <ErrorCarga mensaje="No pudimos cargar las citas." onReintentar={recargar} variante="oscuro" />
        ) : !datos || paginaVacia ? (
          <p role="status" className="py-10 text-center text-zinc-400">Cargando citas...</p>
        ) : datos.items.length === 0 ? (
          hayFiltros ? (
            <SinResultados variante="oscuro" mensaje="No hay citas que coincidan con los filtros." onLimpiar={limpiar} />
          ) : (
            <SinResultados variante="oscuro" mensaje={MENSAJE_VACIO[pestana]} />
          )
        ) : (
          <>
            <div className="min-w-0">
              <TablaCitas
                citas={datos.items}
                mostrarBarbero
                onReasignar={accionCitaId ? undefined : handleReasignar}
                barberosActivos={barberosActivos}
              />
            </div>
            <Paginacion pagina={datos.pagina} total={datos.total} limite={LIMITE} alCambiar={irAPagina} />
          </>
        )}
      </section>
    </div>
  )
}

export default Citas
