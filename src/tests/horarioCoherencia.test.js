import { describe, it, expect } from 'vitest'
import { HORARIO_ATENCION as FRONT } from '../data/negocio'
import { HORARIO_ATENCION as BACK } from '../../backend/config/horario.js'

// Guardia: el front (texto de Hero y Footer) y el backend (validación y disponibilidad) tienen cada uno su fuente única
// de horario; este test falla si apertura o cierre dejan de coincidir.
describe('coherencia del horario front/backend', () => {
  it('apertura y cierre coinciden', () => {
    expect(FRONT.apertura).toBe(BACK.apertura)
    expect(FRONT.cierre).toBe(BACK.cierre)
  })

  it('el texto del front refleja la apertura y el cierre', () => {
    const aTexto = (hhmm) => {
      const [h, m] = hhmm.split(':').map(Number)
      return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`
    }
    expect(FRONT.texto).toBe(`${aTexto(FRONT.apertura)} – ${aTexto(FRONT.cierre)}`)
  })
})
