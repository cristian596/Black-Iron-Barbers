// Marca de "la ventana de bienvenida ya se mostró en este inicio de sesión". Vive en sessionStorage (se pierde al
// cerrar la pestaña) y se borra al cerrar sesión. El almacenamiento puede no estar disponible (modo privado,
// bloqueado): todo va con try/catch y, sin él, la ventana sale una vez por carga de página.
const CLAVE = 'bienvenida-barbero-vista'

export const bienvenidaYaMostrada = () => {
  try {
    return sessionStorage.getItem(CLAVE) === '1'
  } catch {
    return false
  }
}

export const marcarBienvenidaMostrada = () => {
  try {
    sessionStorage.setItem(CLAVE, '1')
  } catch {
    // sin sessionStorage: se muestra de nuevo al recargar
  }
}

export const olvidarBienvenida = () => {
  try {
    sessionStorage.removeItem(CLAVE)
  } catch {
    // nada que borrar
  }
}
