// Observer compartido: un solo IntersectionObserver por combinación de umbral y
// margen, sin importar cuántos elementos lo usen. Cada elemento se observa hasta
// su primera intersección y entonces se libera; cuando el grupo se queda sin
// elementos, el observer se desconecta.
const grupos = new Map()

const crearGrupo = (clave, opciones) => {
  const callbacks = new Map()
  const grupo = { callbacks, observer: null }

  grupo.observer = new IntersectionObserver((entradas) => {
    entradas.forEach((entrada) => {
      const alIntersectar = callbacks.get(entrada.target)
      if (!entrada.isIntersecting || !alIntersectar) return
      liberar(clave, grupo, entrada.target)
      alIntersectar()
    })
  }, opciones)

  grupos.set(clave, grupo)
  return grupo
}

const liberar = (clave, grupo, elemento) => {
  if (!grupo.callbacks.delete(elemento)) return
  grupo.observer.unobserve(elemento)
  if (grupo.callbacks.size === 0) {
    grupo.observer.disconnect()
    grupos.delete(clave)
  }
}

// Devuelve la función de limpieza (segura de llamar varias veces).
// Sin IntersectionObserver no observa nada: quien llama decide qué mostrar.
export const observarUnaVez = (elemento, alIntersectar, { umbral = 0, margen } = {}) => {
  if (typeof IntersectionObserver === 'undefined') return () => {}

  const clave = `${umbral}|${margen ?? ''}`
  const opciones = margen ? { threshold: umbral, rootMargin: margen } : { threshold: umbral }
  const grupo = grupos.get(clave) ?? crearGrupo(clave, opciones)

  grupo.callbacks.set(elemento, alIntersectar)
  grupo.observer.observe(elemento)

  return () => liberar(clave, grupo, elemento)
}
