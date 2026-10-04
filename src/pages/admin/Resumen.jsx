import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import SelectorPeriodo from '../../components/admin/SelectorPeriodo'
import PanelIndicadores from '../../components/admin/PanelIndicadores'
import PanelIngresos from '../../components/admin/PanelIngresos'
import PanelServiciosTop from '../../components/admin/PanelServiciosTop'
import CitasRecientes from '../../components/admin/CitasRecientes'

const Resumen = () => {
  const { token } = useAuth()
  const [periodo, setPeriodo] = useState('hoy')

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="font-playfair text-3xl font-semibold">Resumen</h1>
        <SelectorPeriodo valor={periodo} alCambiar={setPeriodo} />
      </header>

      <PanelIndicadores token={token} periodo={periodo} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <PanelIngresos token={token} className="lg:col-span-2" />
        <PanelServiciosTop token={token} periodo={periodo} />
      </div>

      <CitasRecientes token={token} />
    </div>
  )
}

export default Resumen
