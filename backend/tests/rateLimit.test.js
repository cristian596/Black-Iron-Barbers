import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { pool } from '../db/connection.js';

// El rate limiter de POST /api/citas se omite bajo NODE_ENV=test salvo que se
// fuerce explícitamente (ver routes/citas.js), para no romper el resto de la
// suite. Aquí lo forzamos con un límite bajo y lo probamos de verdad.
process.env.FORZAR_RATE_LIMIT_PRUEBA = 'true';
process.env.LIMITE_CITAS_RATE = '3';

const { crearApp } = await import('../app.js');
const app = crearApp();

const citaDePrueba = (overrides = {}) => ({
  cliente: 'Cliente rate limit',
  correo: 'ratelimit@example.com',
  telefono: '3001234567',
  consentimiento: true,
  servicio_id: 1,
  barbero_id: 1,
  fecha: '2030-07-01',
  hora: '09:00',
  ...overrides,
});

beforeAll(async () => {
  await pool.query('TRUNCATE citas RESTART IDENTITY CASCADE');
});

beforeEach(async () => {
  await pool.query('TRUNCATE citas RESTART IDENTITY CASCADE');
});

describe('Rate limiting en POST /api/citas', () => {
  it('responde 429 después de superar el límite de solicitudes', async () => {
    const respuestas = [];
    for (let i = 0; i < 5; i += 1) {
      // Horas distintas para que lo que limite sea el rate limit y no un 409 de negocio.
      // eslint-disable-next-line no-await-in-loop
      const hora = String(9 + i).padStart(2, '0') + ':00';
      const res = await request(app).post('/api/citas').send(citaDePrueba({ hora }));
      respuestas.push(res.status);
    }

    expect(respuestas.slice(0, 3)).toEqual([201, 201, 201]);
    expect(respuestas.slice(3)).toEqual([429, 429]);
  });
});
