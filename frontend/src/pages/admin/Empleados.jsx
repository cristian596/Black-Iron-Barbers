import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FiPlus } from 'react-icons/fi'
import { useAuth } from '../../context/AuthContext'
import {
  obtenerEmpleados,
  crearEmpleado,
  actualizarEmpleado,
  crearUsuarioBarbero,
  actualizarUsuarioBarbero,
} from '../../services/api'
import { useCarga } from '../../hooks/useCarga'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { useFiltroEmpleados } from '../../hooks/useFiltroEmpleados'
import { enlaceCitasPendientes, interpretarErrorEmpleado, textoCitasPendientes } from '../../utils/empleados'
import FiltrosEmpleados from '../../components/admin/FiltrosEmpleados'
import ListaEmpleados from '../../components/admin/ListaEmpleados'
import PanelAdmin from '../../components/admin/PanelAdmin'
import FormularioEmpleado from '../../components/admin/FormularioEmpleado'
import FormularioAcceso from '../../components/admin/FormularioAcceso'
import ModalConfirmar from '../../components/admin/ModalConfirmar'
import ErrorCarga from '../../components/ui/ErrorCarga'
import SinResultados from '../../components/ui/SinResultados'

const LISTA_VACIA = []
const TIPO_NUEVO = 'nuevo'
const TIPO_EDITAR = 'editar'
const TIPO_ACCESO = 'acceso'

const TITULOS = { [TIPO_NUEVO]: 'Nuevo empleado', [TIPO_EDITAR]: 'Editar empleado', [TIPO_ACCESO]: 'Acceso al panel' }

const Empleados = () => {
  const { token } = useAuth()
  // Tabla + panel lateral solo con ancho de sobra (el menú ocupa 16 rem); si no, tarjetas y panel a pantalla completa.
  const escritorio = useMediaQuery('(min-width: 1280px)')

  const empleados = useCarga(() => obtenerEmpleados(token), 'empleados')
  const lista = empleados.datos ?? LISTA_VACIA
  const filtro = useFiltroEmpleados(lista)

  const [panel, setPanel] = useState(null) // null | { tipo, empleado }
  const [aviso, setAviso] = useState(null) // null | { texto, empleado } (con empleado se ofrece reasignar sus citas)
  const [errorAccion, setErrorAccion] = useState('')
  const [idGuardando, setIdGuardando] = useState(null)
  const [porDesactivar, setPorDesactivar] = useState(null)
  const [errorConfirmar, setErrorConfirmar] = useState('')

  const abrirPanel = (tipo, empleado = null) => {
    setAviso(null)
    setErrorAccion('')
    setPanel({ tipo, empleado })
  }

  const guardarEmpleado = async (datos) => {
    if (panel.tipo === TIPO_NUEVO) {
      await crearEmpleado(token, datos)
      filtro.limpiar() // que el empleado nuevo se vea en la lista
      setAviso({ texto: `«${datos.nombre}» creado. Ya aparece en la web y puede iniciar sesión con «${datos.usuario}».` })
    } else {
      const { empleado } = panel
      const cambios = Object.fromEntries(
        Object.entries(datos).filter(([campo, valor]) => (empleado[campo] ?? (campo === 'area' ? 'barberia' : '')) !== valor)
      )
      if (Object.keys(cambios).length === 0) {
        setPanel(null)
        setAviso({ texto: 'No había cambios que guardar.' })
        return
      }
      await actualizarEmpleado(token, empleado.id, cambios)
      setAviso({ texto: `«${datos.nombre}» actualizado.` })
    }
    setPanel(null)
    empleados.recargar()
  }

  const guardarAcceso = async ({ usuario, contrasena }) => {
    const { empleado } = panel
    if (empleado.usuario) {
      await actualizarUsuarioBarbero(token, empleado.usuario.id, { contrasena })
      setAviso({ texto: `Contraseña de «${empleado.nombre}» actualizada. La anterior ya no sirve.` })
    } else {
      await crearUsuarioBarbero(token, { usuario, contrasena, barbero_id: empleado.id })
      setAviso({ texto: `Acceso creado para «${empleado.nombre}» con el usuario «${usuario}».` })
    }
    setPanel(null)
    empleados.recargar()
  }

  const activar = async (empleado) => {
    setAviso(null)
    setErrorAccion('')
    setIdGuardando(empleado.id)
    try {
      await actualizarEmpleado(token, empleado.id, { activo: true })
      setAviso({ texto: `«${empleado.nombre}» activado: vuelve a aparecer en la web y su usuario puede iniciar sesión.` })
      empleados.recargar()
    } catch (err) {
      setErrorAccion(interpretarErrorEmpleado(err).mensaje)
    } finally {
      setIdGuardando(null)
    }
  }

  const alCambiarActivo = (empleado) => {
    if (empleado.activo) {
      setErrorConfirmar('')
      setPorDesactivar(empleado)
    } else {
      activar(empleado)
    }
  }

  const confirmarDesactivar = async () => {
    setErrorConfirmar('')
    setIdGuardando(porDesactivar.id)
    try {
      const respuesta = await actualizarEmpleado(token, porDesactivar.id, { activo: false })
      const conservadas = respuesta.citas_pendientes_conservadas ?? 0
      setAviso({
        texto:
          `«${porDesactivar.nombre}» desactivado: ya no aparece en la web ni en la reserva y su usuario no puede iniciar sesión.` +
          (conservadas > 0 ? ` Conserva ${textoCitasPendientes(conservadas)}: reasígnalas.` : ''),
        empleado: conservadas > 0 ? porDesactivar : null,
      })
      setPorDesactivar(null)
      empleados.recargar()
    } catch (err) {
      setErrorConfirmar(interpretarErrorEmpleado(err).mensaje)
    } finally {
      setIdGuardando(null)
    }
  }

  const error = empleados.error
  const cargando = !error && !empleados.datos

  const formulario =
    panel &&
    (panel.tipo === TIPO_ACCESO ? (
      <FormularioAcceso key={panel.empleado.id} empleado={panel.empleado} alGuardar={guardarAcceso} alCancelar={() => setPanel(null)} />
    ) : (
      <FormularioEmpleado
        key={panel.empleado?.id ?? TIPO_NUEVO}
        empleado={panel.empleado}
        alGuardar={guardarEmpleado}
        alCancelar={() => setPanel(null)}
      />
    ))
  const panelAbierto = panel && (
    <PanelAdmin lateral={escritorio} titulo={TITULOS[panel.tipo]} alCerrar={() => setPanel(null)}>
      {formulario}
    </PanelAdmin>
  )

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-playfair text-3xl font-semibold">Empleados</h1>
        <button
          type="button"
          onClick={() => abrirPanel(TIPO_NUEVO)}
          disabled={cargando || Boolean(error)}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-oro px-4 text-sm font-semibold text-black hover:bg-oro/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oro disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FiPlus aria-hidden="true" /> Nuevo empleado
        </button>
      </header>

      {aviso && (
        <p role="status" className="rounded-lg bg-emerald-900/30 p-3 text-sm text-emerald-300">
          {aviso.texto}
          {aviso.empleado && (
            <>
              {' '}
              <Link to={enlaceCitasPendientes(aviso.empleado)} className="font-semibold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-oro">
                Ver y reasignar sus citas
              </Link>
            </>
          )}
        </p>
      )}
      {errorAccion && <p role="alert" className="rounded-lg bg-red-900/40 p-3 text-sm text-red-300">{errorAccion}</p>}

      {error ? (
        <div className="rounded-xl border border-white/10 bg-zinc-950">
          <ErrorCarga mensaje="No pudimos cargar los empleados." onReintentar={empleados.recargar} variante="oscuro" />
        </div>
      ) : cargando ? (
        <p role="status" className="py-10 text-center text-zinc-400">Cargando empleados...</p>
      ) : (
        <div className={`grid min-w-0 grid-cols-1 gap-6 ${panel && escritorio ? 'xl:grid-cols-[minmax(0,1fr)_24rem]' : ''}`}>
          <section aria-labelledby="titulo-lista-empleados" className="flex min-w-0 flex-col gap-4 rounded-xl border border-white/10 bg-zinc-950 p-4">
            <h2 id="titulo-lista-empleados" className="sr-only">Lista de empleados</h2>
            <FiltrosEmpleados filtro={filtro} />
            {filtro.visibles.length === 0 ? (
              lista.length === 0 ? (
                <SinResultados variante="oscuro" mensaje="Todavía no hay empleados. Crea el primero con «Nuevo empleado»." />
              ) : (
                <SinResultados variante="oscuro" mensaje="No hay empleados con esos filtros." onLimpiar={filtro.limpiar} />
              )
            ) : (
              <ListaEmpleados
                empleados={filtro.visibles}
                tabla={escritorio}
                alEditar={(empleado) => abrirPanel(TIPO_EDITAR, empleado)}
                alAcceso={(empleado) => abrirPanel(TIPO_ACCESO, empleado)}
                alCambiarActivo={alCambiarActivo}
                idGuardando={idGuardando}
              />
            )}
          </section>
          {panel && escritorio && panelAbierto}
        </div>
      )}

      {panel && !escritorio && panelAbierto}

      {porDesactivar && (
        <ModalConfirmar
          titulo={`¿Desactivar a «${porDesactivar.nombre}»?`}
          texto="Dejará de aparecer en la web y en la reserva, y su usuario no podrá iniciar sesión. Sus citas anteriores se conservan; nada se borra y puedes volver a activarlo cuando quieras."
          textoConfirmar="Desactivar"
          cargando={idGuardando === porDesactivar.id}
          error={errorConfirmar}
          alConfirmar={confirmarDesactivar}
          alCerrar={() => setPorDesactivar(null)}
        >
          {porDesactivar.citas_pendientes > 0 && (
            <div role="note" className="mt-3 rounded-lg border border-oro/40 bg-oro/10 p-3 text-sm text-zinc-200">
              <p>
                Tiene <strong>{textoCitasPendientes(porDesactivar.citas_pendientes)}</strong>. Seguirán asignadas a este barbero
                hasta que las reasignes.
              </p>
              <Link to={enlaceCitasPendientes(porDesactivar)} className="mt-2 inline-flex min-h-11 items-center font-semibold text-oro underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-oro">
                Ver y reasignar sus citas
              </Link>
            </div>
          )}
        </ModalConfirmar>
      )}
    </div>
  )
}

export default Empleados
