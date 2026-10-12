// Marcador de carga (solo Tailwind). Un único aviso de estado para lectores de pantalla; los bloques son decorativos.
const Esqueleto = ({ filas = 3, alto = 'h-20', etiqueta = 'Cargando...', className = '' }) => (
  <div role="status" aria-busy="true" className={`flex min-w-0 flex-col gap-3 ${className}`}>
    <span className="sr-only">{etiqueta}</span>
    {Array.from({ length: filas }, (_, i) => (
      <div key={i} aria-hidden="true" className={`${alto} w-full rounded-xl bg-white/5 motion-safe:animate-pulse`} />
    ))}
  </div>
)

export default Esqueleto
