import { useState } from 'react'
import { FiPlus } from 'react-icons/fi'
import { useAuth } from '../../context/AuthContext'
import {
  obtenerServiciosAdmin,
  crearServicioAdmin,
  actualizarServicioAdmin,
  obtenerCategoriasAdmin,
  crearCategoriaAdmin,
  actualizarCategoriaAdmin,
} from '../../services/api'
import { useCarga } from '../../hooks/useCarga'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { useFiltroServiciosAdmin } from '../../hooks/useFiltroServiciosAdmin'
import { interpretarError } from '../../utils/erroresCatalogo'
import FiltrosServiciosAdmin from '../../components/admin/FiltrosServiciosAdmin'
import ListaServiciosAdmin from '../../components/admin/ListaServiciosAdmin'
import PanelEdicionServicio from '../../components/admin/PanelEdicionServicio'
import SeccionCategorias from '../../components/admin/SeccionCategorias'
import ModalConfirmar from '../../components/admin/ModalConfirmar'
import ErrorCarga from '../../components/ui/ErrorCarga'
import SinResultados from '../../components/ui/SinResultados'

const EDICION_NUEVO = 'nuevo'
const LISTA_VACIA = []

const Servicios = () => {
  const { token } = useAuth()
  // Tabla + panel lateral solo con ancho de sobra (el menú ocupa 16 rem); si no, tarjetas y panel a pantalla completa.
  const escritorio = useMediaQuery('(min-width: 1280px)')

  const servicios = useCarga(() => obtenerServiciosAdmin(token), 'servicios')
  const categorias = useCarga(() => obtenerCategoriasAdmin(token), 'categorias')
  const listaServicios = servicios.datos ?? LISTA_VACIA
  const listaCategorias = categorias.datos ?? LISTA_VACIA
  const filtro = useFiltroServiciosAdmin(listaServicios, listaCategorias)

  const [edicion, setEdicion] = useState(null) // null | EDICION_NUEVO | servicio
  const [errorEdicion, setErrorEdicion] = useState('')
  const [aviso, setAviso] = useState('')
  const [errorAccion, setErrorAccion] = useState('')
  const [idGuardando, setIdGuardando] = useState(null)
  const [porDesactivar, setPorDesactivar] = useState(null)
  const [errorConfirmar, setErrorConfirmar] = useState('')

  const recargarTodo = () => {
    servicios.recargar()
    categorias.recargar()
  }

  const abrirEdicion = (valor) => {
    setAviso('')
    setErrorAccion('')
    setErrorEdicion('')
    setEdicion(valor)
  }

  const guardarServicio = async (datos) => {
    const editando = edicion !== EDICION_NUEVO ? edicion : null
    const cambios = editando
      ? Object.fromEntries(
          Object.entries(datos).filter(([campo, valor]) => {
            const actual = campo === 'categoria_id' ? editando.categoria?.id : editando[campo]
            return actual !== valor
          })
        )
      : datos

    if (editando && Object.keys(cambios).length === 0) {
      setEdicion(null)
      setAviso('No había cambios que guardar.')
      return
    }

    const guardado = editando
      ? await actualizarServicioAdmin(token, editando.id, cambios)
      : await crearServicioAdmin(token, datos)
    if (guardado?.categoria?.slug) filtro.setCategoria(guardado.categoria.slug) // que se vea el servicio guardado
    setEdicion(null)
    setAviso(editando ? `«${datos.nombre}» actualizado. Ya se ve en /cortes y en la reserva.` : `«${datos.nombre}» creado. Ya se ve en /cortes y en la reserva.`)
    recargarTodo()
  }

  const activar = async (servicio) => {
    setAviso('')
    setErrorAccion('')
    setIdGuardando(servicio.id)
    try {
      await actualizarServicioAdmin(token, servicio.id, { activo: true })
      setAviso(`«${servicio.nombre}» activado. Ya se ve en /cortes y en la reserva.`)
      recargarTodo()
    } catch (err) {
      const { mensaje } = interpretarError(err, 'servicio')
      // Falta completar datos o la categoría está inactiva: se abre el formulario para resolverlo.
      if (err.codigo === 'SERVICIO_INCOMPLETO' || err.codigo === 'CATEGORIA_NO_DISPONIBLE') {
        setErrorEdicion(mensaje)
        setEdicion(servicio)
      } else {
        setErrorAccion(mensaje)
      }
    } finally {
      setIdGuardando(null)
    }
  }

  const alCambiarActivo = (servicio) => {
    if (servicio.activo) {
      setErrorConfirmar('')
      setPorDesactivar(servicio)
    } else {
      activar(servicio)
    }
  }

  const confirmarDesactivar = async () => {
    setErrorConfirmar('')
    setIdGuardando(porDesactivar.id)
    try {
      await actualizarServicioAdmin(token, porDesactivar.id, { activo: false })
      setAviso(`«${porDesactivar.nombre}» desactivado: ya no se ve en /cortes ni en la reserva. Sus citas anteriores se conservan.`)
      setPorDesactivar(null)
      recargarTodo()
    } catch (err) {
      setErrorConfirmar(interpretarError(err, 'servicio').mensaje)
    } finally {
      setIdGuardando(null)
    }
  }

  const error = servicios.error || categorias.error
  const cargando = !error && (!servicios.datos || !categorias.datos)

  const panel = edicion && (
    <PanelEdicionServicio
      lateral={escritorio}
      servicio={edicion === EDICION_NUEVO ? null : edicion}
      categorias={listaCategorias}
      alGuardar={guardarServicio}
      alCerrar={() => setEdicion(null)}
      errorInicial={errorEdicion}
    />
  )

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-playfair text-3xl font-semibold">Servicios</h1>
        <button
          type="button"
          onClick={() => abrirEdicion(EDICION_NUEVO)}
          disabled={cargando || Boolean(error)}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-oro px-4 text-sm font-semibold text-black hover:bg-oro/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oro disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FiPlus aria-hidden="true" /> Nuevo servicio
        </button>
      </header>

      {aviso && <p role="status" className="rounded-lg bg-emerald-900/30 p-3 text-sm text-emerald-300">{aviso}</p>}
      {errorAccion && <p role="alert" className="rounded-lg bg-red-900/40 p-3 text-sm text-red-300">{errorAccion}</p>}

      {error ? (
        <div className="rounded-xl border border-white/10 bg-zinc-950">
          <ErrorCarga mensaje="No pudimos cargar el catálogo." onReintentar={recargarTodo} variante="oscuro" />
        </div>
      ) : cargando ? (
        <p role="status" className="py-10 text-center text-zinc-400">Cargando servicios...</p>
      ) : (
        <>
          <div className={`grid min-w-0 grid-cols-1 gap-6 ${edicion && escritorio ? 'xl:grid-cols-[minmax(0,1fr)_24rem]' : ''}`}>
            <section aria-labelledby="titulo-lista-servicios" className="flex min-w-0 flex-col gap-4 rounded-xl border border-white/10 bg-zinc-950 p-4">
              <h2 id="titulo-lista-servicios" className="sr-only">Lista de servicios</h2>
              <FiltrosServiciosAdmin filtro={filtro} />
              {filtro.visibles.length === 0 ? (
                listaServicios.length === 0 ? (
                  <SinResultados variante="oscuro" mensaje="Todavía no hay servicios. Crea el primero con «Nuevo servicio»." />
                ) : (
                  <SinResultados variante="oscuro" mensaje="No hay servicios con esos filtros." onLimpiar={filtro.limpiar} />
                )
              ) : (
                <ListaServiciosAdmin
                  servicios={filtro.visibles}
                  tabla={escritorio}
                  alEditar={(servicio) => abrirEdicion(servicio)}
                  alCambiarActivo={alCambiarActivo}
                  idGuardando={idGuardando}
                />
              )}
            </section>
            {edicion && escritorio && panel}
          </div>

          <SeccionCategorias
            categorias={listaCategorias}
            alCrear={async (datos) => {
              await crearCategoriaAdmin(token, datos)
              recargarTodo()
            }}
            alActualizar={async (id, cambios) => {
              await actualizarCategoriaAdmin(token, id, cambios)
              recargarTodo()
            }}
          />
        </>
      )}

      {edicion && !escritorio && panel}

      {porDesactivar && (
        <ModalConfirmar
          titulo={`¿Desactivar «${porDesactivar.nombre}»?`}
          texto="Dejará de mostrarse en /cortes y en la reserva. Las citas que ya existen conservan su precio y duración; nada se borra y puedes volver a activarlo cuando quieras."
          textoConfirmar="Desactivar"
          cargando={idGuardando === porDesactivar.id}
          error={errorConfirmar}
          alConfirmar={confirmarDesactivar}
          alCerrar={() => setPorDesactivar(null)}
        />
      )}
    </div>
  )
}

export default Servicios
