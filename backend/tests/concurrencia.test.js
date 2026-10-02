import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { crearApp } from '../app.js';
import { pool } from '../db/connection.js';

const app = crearApp();

const citaDePrueba = (overrides = {}) => ({
  cliente: 'Cliente concurrente',
  correo: 'concurrente@example.com',
  telefono: '3001234567',
  consentimiento: true,
  servicio_id: 1,
  fecha: '2030-06-20',
  hora: '10:00',
  ...overrides,
});

beforeEach(async () => {
  await pool.query('TRUNCATE citas RESTART IDENTITY CASCADE');
});

describe('Concurrencia en POST /api/citas', () => {
  it('con "cualquier barbero", peticiones paralelas para la misma hora reparten barberos distintos y la sobrante responde 409', async () => {
    // Solo hay 2 barberos activos en la BD de prueba: con 3 peticiones a la vez,
    // 2 deben ganar (una por barbero) y 1 debe quedarse sin barbero libre.
    const peticiones = [1, 2, 3].map(() =>
      request(app).post('/api/citas').send(citaDePrueba({ barbero_id: undefined }))
    );

    const resultados = await Promise.all(peticiones);
    const exitosas = resultados.filter((r) => r.status === 201);
    const rechazadas = resultados.filter((r) => r.status === 409);

    expect(exitosas.length).toBe(2);
    expect(rechazadas.length).toBe(1);

    const barberosAsignados = exitosas.map((r) => r.body.barbero_id).sort();
    expect(barberosAsignados).toEqual([1, 2]);
  });

  it('dos peticiones simultáneas al mismo barbero y hora: solo una gana, la otra responde 409', async () => {
    const [res1, res2] = await Promise.all([
      request(app).post('/api/citas').send(citaDePrueba({ barbero_id: 1 })),
      request(app).post('/api/citas').send(citaDePrueba({ barbero_id: 1 })),
    ]);

    const estados = [res1.status, res2.status].sort();
    expect(estados).toEqual([201, 409]);

    const { rows } = await pool.query(
      "SELECT COUNT(*)::int AS total FROM citas WHERE barbero_id = 1 AND fecha = '2030-06-20' AND hora = '10:00' AND estado <> 'cancelada'"
    );
    expect(rows[0].total).toBe(1);
  });
});
