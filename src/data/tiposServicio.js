import { FaRegCircle, FaGem, FaStar } from 'react-icons/fa'

// Cada tipo se distingue por texto (siempre visible) y por la forma del icono, no solo por color.
// Escala visual: Original (neutro) < Élite (borde dorado) < VIP (negro con dorado).
// El dorado #D4AF37 solo va como borde o sobre negro: sobre blanco no alcanza el contraste mínimo.
export const TIPOS_SERVICIO = [
  { valor: 'original', etiqueta: 'Original', Icono: FaRegCircle, clases: 'border-zinc-400 bg-zinc-100 text-zinc-800' },
  { valor: 'elite', etiqueta: 'Élite', Icono: FaGem, clases: 'border-[#D4AF37] bg-[#FFFBF0] text-black' },
  { valor: 'vip', etiqueta: 'VIP', Icono: FaStar, clases: 'border-black bg-black text-[#D4AF37]' },
]

export const TIPOS_POR_VALOR = Object.fromEntries(TIPOS_SERVICIO.map((tipo) => [tipo.valor, tipo]))

// Valor del filtro que no restringe por tipo.
export const TIPO_TODOS = 'todos'
