// Chips para filtrar el equipo por cargo. Solo se pinta con 2 o más cargos distintos.
const BASE =
  'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 py-2 font-poppins text-sm font-semibold active:scale-95 motion-safe:transition-colors motion-safe:duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oro'
const ACTIVO = 'border-oro bg-oro text-black'
const INACTIVO = 'border-white/25 bg-white/5 text-zinc-100 hover:border-oro hover:text-oro'

const Chip = ({ activo, onClick, etiqueta, total }) => (
  <button type="button" aria-pressed={activo} onClick={onClick} className={`${BASE} ${activo ? ACTIVO : INACTIVO}`}>
    <span className="wrap-anywhere">{etiqueta}</span>
    <span
      className={`rounded-full px-2 py-0.5 text-xs ${activo ? 'bg-black/15 text-black' : 'bg-white/10 text-zinc-200'}`}
    >
      {total}
    </span>
  </button>
)

const FiltroCargos = ({ cargos, total, cargoActivo, onElegir }) => {
  if (cargos.length < 2) return null

  return (
    <div role="group" aria-label="Filtrar por cargo" className="flex flex-wrap justify-center gap-2">
      <Chip activo={cargoActivo === null} onClick={() => onElegir(null)} etiqueta="Todos" total={total} />
      {cargos.map(({ cargo, total: cantidad }) => (
        <Chip key={cargo} activo={cargoActivo === cargo} onClick={() => onElegir(cargo)} etiqueta={cargo} total={cantidad} />
      ))}
    </div>
  )
}

export default FiltroCargos
