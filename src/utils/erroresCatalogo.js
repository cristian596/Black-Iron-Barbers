// Traduce los errores de la API del catálogo (por `codigo`, no por el texto) a un mensaje claro y, cuando aplica,
// al campo del formulario donde mostrarlo. `entidad`: 'servicio' | 'categoría'.
export const interpretarError = (err, entidad = 'servicio') => {
  switch (err.codigo) {
    case 'NOMBRE_DUPLICADO':
      return { campo: 'nombre', mensaje: `Ya existe ${entidad === 'servicio' ? 'un servicio' : 'una categoría'} con ese nombre (sin distinguir mayúsculas). Usa otro.` }
    case 'CATEGORIA_NO_DISPONIBLE':
      return { campo: 'categoria_id', mensaje: 'La categoría no existe o está inactiva. Elige otra.' }
    case 'SERVICIO_INCOMPLETO':
      return { campo: err.campo ?? null, mensaje: 'Para activar este servicio primero completa su categoría, tipo y descripción.' }
    case 'CATEGORIA_CON_SERVICIOS':
      return {
        campo: null,
        mensaje: `No se puede desactivar: tiene ${err.total_servicios ?? 'algunos'} servicio(s) activo(s). Desactívalos o muévelos a otra categoría primero.`,
      }
    case 'DATOS_INVALIDOS':
      return { campo: err.campo ?? null, mensaje: err.message }
    case 'SERVICIO_NO_ENCONTRADO':
    case 'CATEGORIA_NO_ENCONTRADA':
      return { campo: null, mensaje: `Esa ${entidad} ya no existe. Recarga la página para ver la lista actualizada.` }
    default:
      return { campo: null, mensaje: err.message }
  }
}

// Validación del formulario de servicio en el cliente (las mismas reglas que el back-end, que sigue siendo la
// autoridad). Devuelve { errores, datos }: `datos` con los tipos ya convertidos si no hay errores.
export const validarFormularioServicio = (valores) => {
  const errores = {}
  const nombre = valores.nombre.trim()
  const descripcion = valores.descripcion.trim()

  if (nombre.length < 1 || nombre.length > 150) errores.nombre = 'El nombre es obligatorio (máximo 150 caracteres).'
  if (!valores.categoria_id) errores.categoria_id = 'Elige una categoría.'
  if (!valores.tipo) errores.tipo = 'Elige el tipo de servicio.'

  const textoPrecio = String(valores.precio).trim()
  const precio = Number(textoPrecio)
  if (textoPrecio === '' || !/^\d+$/.test(textoPrecio) || !Number.isSafeInteger(precio) || precio > 2147483647) {
    errores.precio = 'El precio debe ser un número entero de 0 en adelante (sin puntos ni decimales).'
  }

  const textoDuracion = String(valores.duracion_min).trim()
  const duracion = Number(textoDuracion)
  if (!/^\d+$/.test(textoDuracion) || duracion < 1 || duracion > 600) {
    errores.duracion_min = 'La duración debe ser un número entero de minutos entre 1 y 600.'
  }

  if (descripcion.length < 1 || descripcion.length > 500) {
    errores.descripcion = 'La descripción es obligatoria (máximo 500 caracteres).'
  }

  if (Object.keys(errores).length > 0) return { errores, datos: null }
  return {
    errores,
    datos: {
      nombre,
      categoria_id: Number(valores.categoria_id),
      tipo: valores.tipo,
      precio,
      duracion_min: duracion,
      descripcion,
    },
  }
}
