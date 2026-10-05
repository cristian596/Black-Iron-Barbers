import AvatarBarbero from '../ui/AvatarBarbero'

// Tarjeta del barbero en la barra lateral: avatar (con iniciales si no hay foto), nombre y cargo.
const PerfilBarbero = ({ barbero }) => (
  <div className="flex min-w-0 items-center gap-3 border-b border-white/10 px-5 py-4">
    <AvatarBarbero barbero={barbero} className="size-14 rounded-full" textoClase="text-lg" cargaPerezosa={false} />
    <div className="min-w-0">
      <p className="wrap-anywhere font-playfair text-lg font-semibold leading-tight">{barbero.nombre}</p>
      <p className="wrap-anywhere text-xs text-zinc-400">{barbero.cargo || 'Barbero'}</p>
    </div>
  </div>
)

export default PerfilBarbero
