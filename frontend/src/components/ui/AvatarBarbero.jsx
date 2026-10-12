import { useState } from 'react'
import { iniciales } from '../../utils/empleados'

// Respaldo "premium" de la galería del equipo: monograma Cinzel dorado en un aro fino sobre degradado zinc.
const RESPALDO = {
  basico:
    'flex shrink-0 select-none items-center justify-center bg-linear-to-br from-zinc-800 to-black font-semibold tracking-wide text-oro ring-1 ring-inset ring-oro/40',
  premium:
    'flex shrink-0 select-none items-center justify-center bg-linear-to-br from-zinc-700 via-zinc-900 to-black text-oro ring-1 ring-inset ring-oro/40',
}

// Foto del barbero con respaldo de iniciales (Tailwind, sin archivos): se usa si el barbero no tiene foto
// (los creados desde el admin no la tienen) o si la imagen no carga. `className` fija el tamaño y la forma;
// `textoClase` el tamaño de las iniciales. `variante="premium"` solo cambia el respaldo (galería del inicio).
// `descripcion` (p. ej. el cargo) completa el alt; `ancho`/`alto` reservan el espacio de la foto.
const AvatarBarbero = ({
  barbero,
  className = 'size-12 rounded-full',
  textoClase = 'text-base',
  cargaPerezosa = true,
  variante = 'basico',
  descripcion,
  ancho,
  alto,
}) => {
  const [fotoFallida, setFotoFallida] = useState(null)
  const mostrarFoto = Boolean(barbero.foto) && fotoFallida !== barbero.foto

  if (mostrarFoto) {
    return (
      <img
        src={barbero.foto}
        alt={`Foto de ${barbero.nombre}, ${descripcion || 'barbero'} en Black Iron Barbers`}
        width={ancho}
        height={alto}
        className={`${className} shrink-0 object-cover`}
        loading={cargaPerezosa ? 'lazy' : undefined}
        decoding="async"
        onError={() => setFotoFallida(barbero.foto)}
      />
    )
  }

  return (
    <span role="img" aria-label={`Avatar de ${barbero.nombre}`} className={`${className} ${RESPALDO[variante]} ${variante === 'basico' ? textoClase : ''}`}>
      {variante === 'premium' ? (
        <span
          aria-hidden="true"
          className={`flex aspect-square w-1/2 items-center justify-center rounded-full font-cinzel font-bold ring-1 ring-oro/60 ${textoClase}`}
        >
          {iniciales(barbero.nombre)}
        </span>
      ) : (
        <span aria-hidden="true">{iniciales(barbero.nombre)}</span>
      )}
    </span>
  )
}

export default AvatarBarbero
