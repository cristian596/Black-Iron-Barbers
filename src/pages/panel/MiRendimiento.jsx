import { useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { obtenerMisEstadisticas, obtenerMisIngresos, obtenerMisServiciosTop } from '../../services/api'
import { indicadoresBarbero } from '../../data/indicadoresBarbero'
import { campoConteo, vocabularioPanel } from '../../utils/areas'
import SelectorPeriodo from '../../components/admin/SelectorPeriodo'
import PanelIndicadores from '../../components/admin/PanelIndicadores'
import PanelIngresos from '../../components/admin/PanelIngresos'
import PanelServiciosTop from '../../components/admin/PanelServiciosTop'

// /panel/rendimiento: las estadísticas del admin, pero solo con las citas del barbero (el back-end lo decide por su
// sesión). Reutiliza los mismos paneles y gráficos cambiando únicamente de dónde piden los datos.
const MiRendimiento = () => {
  const { token, usuario } = useAuth()
  const [periodo, setPeriodo] = useState('hoy')
  // Solo textos: quien atiende asesorías ve "Asesorías" donde un barbero ve "Cortes". Los datos son los mismos.
  const vocabulario = { ...vocabularioPanel(usuario?.area), campo: campoConteo(usuario?.area) }
  const indicadores = useMemo(() => indicadoresBarbero(usuario?.area), [usuario?.area])

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-playfair text-3xl font-semibold">Mi rendimiento</h1>
          <p className="mt-1 text-zinc-400">Solo cuentan tus citas completadas; las canceladas van aparte.</p>
        </div>
        <SelectorPeriodo valor={periodo} alCambiar={setPeriodo} />
      </header>

      <PanelIndicadores
        token={token}
        periodo={periodo}
        obtener={obtenerMisEstadisticas}
        indicadores={indicadores}
        mensajeVacio={vocabulario.sinCompletadas}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <PanelIngresos
          token={token}
          obtener={obtenerMisIngresos}
          vocabulario={vocabulario}
          className="lg:col-span-2"
        />
        <PanelServiciosTop token={token} periodo={periodo} obtener={obtenerMisServiciosTop} />
      </div>
    </div>
  )
}

export default MiRendimiento
