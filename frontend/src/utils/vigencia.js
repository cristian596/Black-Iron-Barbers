// Estado de la contraseña de un barbero tal como lo calcula el back-end ({ estado, dias_restantes, vence_en }).
// El front solo lo muestra; la regla (60 días, aviso a 2) vive en backend/utils/contrasenas.js.
export const textoDias = (dias) => `${dias} ${dias === 1 ? 'día' : 'días'}`

// Para el indicador discreto de /admin/empleados.
export const textoVigencia = (vigencia) => {
  if (!vigencia) return ''
  if (vigencia.estado === 'caducada') return 'Caducada'
  if (vigencia.estado === 'por_vencer') return `Caduca en ${textoDias(vigencia.dias_restantes)}`
  return 'Vigente'
}
