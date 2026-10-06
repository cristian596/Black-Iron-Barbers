// Perfil del dashboard (nombre y foto que solo existen dentro del panel). Las validaciones repiten las del back-end
// (que sigue siendo la autoridad) para dar el error al momento, con los mismos mensajes.
export const LIMITES_PERFIL = { nombreMin: 2, nombreMax: 40, fotoBytes: 2 * 1024 * 1024 }
export const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp']

export const MENSAJE_FORMATO = 'Solo se admiten imágenes JPEG, PNG o WebP'
export const MENSAJE_TAMANO = 'La foto no puede superar 2 MB'

// Mismas reglas que el back-end: recorte, espacios colapsados, sin caracteres de control ni invisibles, 2–40 caracteres.
// Devuelve { valor } (nombre normalizado) o { mensaje }.
export const validarNombrePerfil = (entrada) => {
  const recortado = entrada.normalize('NFC').trim()
  if (/[\p{Cc}\p{Cf}]/u.test(recortado)) return { mensaje: 'El nombre no puede tener caracteres de control ni invisibles' }
  const nombre = recortado.replace(/\s+/g, ' ')
  const largo = Array.from(nombre).length
  if (largo < LIMITES_PERFIL.nombreMin || largo > LIMITES_PERFIL.nombreMax) {
    return { mensaje: `El nombre debe tener entre ${LIMITES_PERFIL.nombreMin} y ${LIMITES_PERFIL.nombreMax} caracteres` }
  }
  return { valor: nombre }
}

// Mensaje de error de una foto antes de subirla (tipo y tamaño), o '' si es válida.
export const validarFoto = (archivo) => {
  if (!TIPOS_FOTO.includes(archivo.type)) return MENSAJE_FORMATO
  if (archivo.size > LIMITES_PERFIL.fotoBytes) return MENSAJE_TAMANO
  return ''
}

// foto_url del perfil: una ruta del front (/Barberos/x.jpg, cuando se usa la foto pública) o una ruta del back-end
// (/api/perfil/foto/uuid.ext, cuando foto_propia es true). Esta última se resuelve contra el ORIGEN de VITE_API_URL
// (que ya trae /api, así que no se duplica) y solo se acepta si tiene esa forma.
const RUTA_FOTO_PROPIA = /^\/api\/perfil\/foto\/[0-9a-f-]{36}\.(jpg|png|webp)$/

export const resolverUrlFoto = (perfil, apiUrl = import.meta.env.VITE_API_URL) => {
  if (!perfil?.foto_url) return null
  if (!perfil.foto_propia) return perfil.foto_url
  if (!RUTA_FOTO_PROPIA.test(perfil.foto_url)) return null
  const origen = apiUrl ? new URL(apiUrl, window.location.origin).origin : window.location.origin
  return `${origen}${perfil.foto_url}`
}

// Barbero tal como lo ve SU panel: el nombre y la foto del perfil encima de lo público (cargo y especialidad no cambian).
// Sin perfil (aún no cargó o falló) se devuelve el barbero público tal cual.
export const barberoConPerfil = (barbero, perfil) =>
  perfil ? { ...barbero, nombre: perfil.nombre, foto: resolverUrlFoto(perfil) } : barbero

// Texto del error de una acción del perfil según el `codigo` estable del back-end.
export const mensajeErrorPerfil = (err) => {
  if (err?.red) return err.message
  switch (err?.codigo) {
    case 'ARCHIVO_DEMASIADO_GRANDE':
      return MENSAJE_TAMANO
    case 'FORMATO_NO_PERMITIDO':
      return MENSAJE_FORMATO
    case 'ARCHIVO_VACIO':
      return 'El archivo está vacío. Elige otra imagen'
    case 'DEMASIADOS_INTENTOS': {
      const minutos = Number.isFinite(err.reintentar_en_seg) ? Math.max(1, Math.ceil(err.reintentar_en_seg / 60)) : null
      return minutos
        ? `Demasiadas subidas de foto. Vuelve a intentarlo en ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`
        : 'Demasiadas subidas de foto. Espera unos minutos antes de intentarlo de nuevo'
    }
    default:
      return err?.message || 'No se pudo completar la acción. Inténtalo de nuevo'
  }
}
