// Reglas y utilidades de /admin/empleados. Las validaciones repiten las del back-end (que sigue siendo la
// autoridad) para dar el error junto al campo sin esperar la respuesta.
export const LIMITES_EMPLEADO = { nombre: 100, cargo: 100, especialidad: 150, usuario: 50, contrasenaMin: 8, contrasenaMax: 72 }

// "Ángel Mejía" → "ÁM"; una sola palabra → su inicial; vacío → "?".
export const iniciales = (nombre = '') => {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean)
  if (palabras.length === 0) return '?'
  const letras = palabras.length === 1 ? [palabras[0]] : [palabras[0], palabras[palabras.length - 1]]
  return letras.map((palabra) => Array.from(palabra)[0].toLocaleUpperCase('es')).join('')
}

// Alfabético en español ("Ángel" va antes de "Boby"); a igualdad de nombre, por id.
export const ordenarEmpleados = (empleados) =>
  [...empleados].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es') || a.id - b.id)

const sinTildes = (texto) => texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export const ESTADOS_EMPLEADO = ['activos', 'inactivos', 'todos']

export const filtrarEmpleados = (empleados, { estado = 'activos', busqueda = '' } = {}) => {
  const texto = sinTildes(busqueda.trim())
  return empleados.filter((e) => {
    if (estado === 'activos' && !e.activo) return false
    if (estado === 'inactivos' && e.activo) return false
    if (!texto) return true
    return [e.nombre, e.cargo, e.especialidad, e.usuario?.usuario].some((campo) => campo && sinTildes(campo).includes(texto))
  })
}

export const textoCitasPendientes = (cantidad) =>
  cantidad === 1 ? '1 cita pendiente' : `${cantidad} citas pendientes`

export const validarContrasena = (contrasena) => {
  const { contrasenaMin, contrasenaMax } = LIMITES_EMPLEADO
  return contrasena.length >= contrasenaMin && contrasena.length <= contrasenaMax
    ? ''
    : `La contraseña debe tener entre ${contrasenaMin} y ${contrasenaMax} caracteres.`
}

const validarUsuario = (usuario) =>
  usuario.trim().length >= 1 && usuario.trim().length <= LIMITES_EMPLEADO.usuario
    ? ''
    : `El usuario es obligatorio (máximo ${LIMITES_EMPLEADO.usuario} caracteres).`

// `conAcceso`: el alta pide además usuario y contraseña. Devuelve { errores, datos } (datos = null si hay errores).
export const validarFormularioEmpleado = (valores, { conAcceso }) => {
  const errores = {}
  const nombre = valores.nombre.trim()
  const cargo = valores.cargo.trim()
  const especialidad = valores.especialidad.trim()

  if (nombre.length < 1 || nombre.length > LIMITES_EMPLEADO.nombre) {
    errores.nombre = `El nombre es obligatorio (máximo ${LIMITES_EMPLEADO.nombre} caracteres).`
  }
  if (cargo.length > LIMITES_EMPLEADO.cargo) errores.cargo = `El cargo no puede superar ${LIMITES_EMPLEADO.cargo} caracteres.`
  if (especialidad.length > LIMITES_EMPLEADO.especialidad) {
    errores.especialidad = `La especialidad no puede superar ${LIMITES_EMPLEADO.especialidad} caracteres.`
  }
  if (conAcceso) {
    const errorUsuario = validarUsuario(valores.usuario)
    if (errorUsuario) errores.usuario = errorUsuario
    const errorContrasena = validarContrasena(valores.contrasena)
    if (errorContrasena) errores.contrasena = errorContrasena
  }

  if (Object.keys(errores).length > 0) return { errores, datos: null }
  const datos = { nombre, cargo, especialidad }
  if (conAcceso) Object.assign(datos, { usuario: valores.usuario.trim(), contrasena: valores.contrasena })
  return { errores, datos }
}

// Formulario de acceso: restablecer contraseña (solo contraseña) o crear acceso (usuario y contraseña).
export const validarFormularioAcceso = (valores, { creando }) => {
  const errores = {}
  if (creando) {
    const errorUsuario = validarUsuario(valores.usuario)
    if (errorUsuario) errores.usuario = errorUsuario
  }
  const errorContrasena = validarContrasena(valores.contrasena)
  if (errorContrasena) errores.contrasena = errorContrasena
  return { errores, datos: Object.keys(errores).length > 0 ? null : valores }
}

// Traduce los errores de la API (por `codigo`, no por el texto) a un mensaje y al campo donde mostrarlo.
export const interpretarErrorEmpleado = (err) => {
  switch (err.codigo) {
    case 'USUARIO_DUPLICADO':
      return { campo: 'usuario', mensaje: 'Ese nombre de usuario ya existe. Elige otro.' }
    case 'DATOS_INVALIDOS':
      return { campo: err.campo ?? null, mensaje: err.message }
    case 'EMPLEADO_NO_ENCONTRADO':
      return { campo: null, mensaje: 'Ese empleado ya no existe. Recarga la página para ver la lista actualizada.' }
    case 'BARBERO_INACTIVO':
      return { campo: null, mensaje: 'El empleado está inactivo. Actívalo primero.' }
    default:
      return { campo: null, mensaje: err.message }
  }
}

// Citas próximas de ese barbero en /admin/citas, para reasignarlas.
export const enlaceCitasPendientes = (empleado) => `/admin/citas?barbero=${empleado.id}&pestana=proximas`
