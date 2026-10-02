// Validación ligera en el cliente para dar feedback inmediato antes de llamar a la
// API; la normalización/validación real y autoritativa sigue viviendo en el back-end.
export const esTelefonoValido = (valor) => {
  if (typeof valor !== 'string') return false
  const limpio = valor.replace(/[\s-]/g, '').replace(/^\+?57/, '')
  return /^3\d{9}$/.test(limpio)
}
