// Guarda un blob como archivo con el nombre indicado (enlace temporal; no hace falta ninguna librería).
export const guardarArchivo = (blob, nombre) => {
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(url)
}
