import { useState } from 'react'
import { iniciales } from '../../utils/empleados'

// Foto del barbero con respaldo de iniciales (Tailwind, sin archivos): se usa si el barbero no tiene foto
// (los creados desde el admin no la tienen) o si la imagen no carga. `className` fija el tamaño y la forma;
// `textoClase` el tamaño de las iniciales.
const AvatarBarbero = ({ barbero, className = 'size-12 rounded-full', textoClase = 'text-base', cargaPerezosa = true }) => {
  const [fotoFallida, setFotoFallida] = useState(null)
  const mostrarFoto = Boolean(barbero.foto) && fotoFallida !== barbero.foto

  if (mostrarFoto) {
    return (
      <img
        src={barbero.foto}
        alt={`Foto de ${barbero.nombre}, barbero en Black Iron Barbers`}
        className={`${className} shrink-0 object-cover`}
        loading={cargaPerezosa ? 'lazy' : undefined}
        onError={() => setFotoFallida(barbero.foto)}
      />
    )
  }

  return (
    <span
      role="img"
      aria-label={`Avatar de ${barbero.nombre}`}
      className={`${className} flex shrink-0 select-none items-center justify-center bg-linear-to-br from-zinc-800 to-black font-semibold tracking-wide text-oro ring-1 ring-inset ring-oro/40 ${textoClase}`}
    >
      <span aria-hidden="true">{iniciales(barbero.nombre)}</span>
    </span>
  )
}

export default AvatarBarbero
