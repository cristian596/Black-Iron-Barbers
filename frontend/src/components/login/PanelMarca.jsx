import InsigniaLogo from './InsigniaLogo'
import Revelar from '../ui/Revelar'
import { puntosAcceso } from '../../data/puntosAcceso'

// Mitad izquierda del acceso en escritorio (≥ 1024 px). En pantallas menores no se muestra: la tarjeta lleva su propia insignia.
const PanelMarca = () => (
  <aside className="relative hidden min-w-0 flex-col items-center justify-center gap-8 overflow-hidden border-r border-white/10 bg-zinc-950 px-12 py-16 lg:flex">
    <div aria-hidden="true" className="pointer-events-none absolute -top-24 -left-24 size-96 rounded-full bg-oro/10 blur-3xl" />
    <InsigniaLogo className="relative size-56 xl:size-64" />
    <div className="relative max-w-md text-center">
      <p className="font-poppins text-xs font-semibold uppercase tracking-[0.3em] text-oro">Black Iron Barbers</p>
      <h2 className="mt-3 font-cinzel text-4xl leading-tight font-bold text-white">Cada cita, en su punto</h2>
      <span aria-hidden="true" className="mx-auto mt-5 block h-px w-20 bg-oro" />
    </div>
    <ul className="relative flex w-full max-w-sm flex-col gap-4">
      {puntosAcceso.map(({ id, icono: Icono, texto }, i) => (
        <Revelar como="li" key={id} retraso={i * 120} className="flex items-center gap-4 font-poppins text-zinc-300">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-oro/40 text-oro">
            <Icono aria-hidden="true" />
          </span>
          {texto}
        </Revelar>
      ))}
    </ul>
  </aside>
)

export default PanelMarca
