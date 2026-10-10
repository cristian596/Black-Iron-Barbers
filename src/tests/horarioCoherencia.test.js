import { describe, it, expect } from 'vitest'
import { HORARIO_ATENCION as FRONT, DIRECCION_NEGOCIO, NOMBRE_NEGOCIO } from '../data/negocio'
import { HORARIO_ATENCION as BACK } from '../../backend/config/horario.js'
import { DIRECCION_NEGOCIO as DIRECCION_BACK, NOMBRE_NEGOCIO as NOMBRE_BACK } from '../../backend/config/negocio.js'

// Guardia: el front (texto de Hero y Footer) y el backend (validación y disponibilidad) tienen cada uno su fuente única
// de horario; este test falla si apertura o cierre dejan de coincidir.
describe('coherencia del horario front/backend', () => {
  it('apertura y cierre coinciden', () => {
    expect(FRONT.apertura).toBe(BACK.apertura)
    expect(FRONT.cierre).toBe(BACK.cierre)
  })

  it('la rejilla de inicios coincide', () => {
    expect(FRONT.intervaloMin).toBe(BACK.intervaloMin)
  })

  it('el texto del front refleja la apertura y el cierre', () => {
    const aTexto = (hhmm) => {
      const [h, m] = hhmm.split(':').map(Number)
      return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`
    }
    expect(FRONT.texto).toBe(`${aTexto(FRONT.apertura)} – ${aTexto(FRONT.cierre)}`)
  })
})

// Guardia: los correos del backend (backend/config/negocio.js) llevan el nombre y la dirección del local; el front tiene
// los suyos en src/data/negocio.js. Si uno cambia sin el otro, esta prueba falla.
describe('coherencia del negocio front/backend', () => {
  it('la dirección coincide', () => {
    expect(DIRECCION_NEGOCIO).toBe(DIRECCION_BACK)
  })

  it('el nombre del negocio coincide', () => {
    expect(NOMBRE_NEGOCIO).toBe(NOMBRE_BACK)
  })
})
