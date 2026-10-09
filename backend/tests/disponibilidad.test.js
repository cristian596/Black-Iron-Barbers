import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { crearApp } from '../app.js';
import { pool } from '../db/connection.js';

const app = crearApp();

const crearCitaDirecta = async ({ barberoId, fecha, hora, duracionMin = 30, precio = 50000 }) => {
  await pool.query(
    `INSERT INTO citas (cliente, correo, telefono, servicio_id, barbero_id, fecha, hora, duracion_min, precio, consentimiento_en)
     VALUES ('Cliente', 'c@c.com', '3001234567', 1, $1, $2, $3, $4, $5, NOW())`,
    [barberoId, fecha, hora, duracionMin, precio]
  );
};

beforeEach(async () => {
  await pool.query('TRUNCATE citas RESTART IDENTITY CASCADE');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('GET /api/disponibilidad', () => {
  it('exige servicio y fecha', async () => {
    const res = await request(app).get('/api/disponibilidad').query({ fecha: '2030-06-15' });
    expect(res.status).toBe(400);
  });

  it('con un barbero específico, ofrece horas donde cabe toda la duración del servicio', async () => {
    await crearCitaDirecta({ barberoId: 1, fecha: '2030-06-15', hora: '11:00', duracionMin: 90 });

    const res = await request(app)
      .get('/api/disponibilidad')
      .query({ servicio: 1, barbero: 1, fecha: '2030-06-15' });

    expect(res.status).toBe(200);
    expect(res.body.horas).not.toContain('11:00');
    expect(res.body.horas).not.toContain('11:30');
    expect(res.body.horas).not.toContain('12:00'); // un servicio aquí terminaría a las 13:30, se solapa con 11:00-12:30
    expect(res.body.horas).toContain('10:00');
    expect(res.body.horas).toContain('12:30'); // justo cuando termina la cita de 90 min
  });

  it('"cualquier barbero" (sin barbero) ofrece una hora si al menos un barbero activo está libre', async () => {
    await crearCitaDirecta({ barberoId: 1, fecha: '2030-06-15', hora: '11:00', duracionMin: 30 });
    await crearCitaDirecta({ barberoId: 2, fecha: '2030-06-15', hora: '12:00', duracionMin: 30 });

    const res = await request(app).get('/api/disponibilidad').query({ servicio: 1, fecha: '2030-06-15' });

    expect(res.status).toBe(200);
    expect(res.body.barbero_id).toBeNull();
    expect(res.body.horas).toContain('11:00'); // barbero 2 libre
    expect(res.body.horas).toContain('12:00'); // barbero 1 libre
  });

  it('"cualquier barbero" NO ofrece una hora si todos los barberos activos están ocupados en ese intervalo', async () => {
    await crearCitaDirecta({ barberoId: 1, fecha: '2030-06-15', hora: '11:00', duracionMin: 30 });
    await crearCitaDirecta({ barberoId: 2, fecha: '2030-06-15', hora: '11:00', duracionMin: 30 });

    const res = await request(app).get('/api/disponibilidad').query({ servicio: 1, fecha: '2030-06-15' });

    expect(res.body.horas).not.toContain('11:00');
  });

  it('no ofrece horas que harían que el servicio termine después del cierre', async () => {
    const res = await request(app)
      .get('/api/disponibilidad')
      .query({ servicio: 2, barbero: 1, fecha: '2030-06-15' }); // servicio 2 = 90 min en la BD de prueba

    expect(res.body.horas).not.toContain('19:30');
    expect(res.body.horas[res.body.horas.length - 1]).toBe('18:30'); // 18:30 + 90min = 20:00 (cierre exacto)
  });

  it('a las 23:30 hora Colombia (ya es el día siguiente en UTC), "hoy" sigue siendo el día de Bogotá y filtra horas pasadas', async () => {
    vi.useFakeTimers();
    // 2030-06-15 23:30 Bogotá = 2030-06-16 04:30 UTC
    vi.setSystemTime(new Date('2030-06-16T04:30:00Z'));

    const res = await request(app)
      .get('/api/disponibilidad')
      .query({ servicio: 1, barbero: 1, fecha: '2030-06-15' });

    expect(res.status).toBe(200);
    expect(res.body.fecha).toBe('2030-06-15');
    expect(res.body.horas).toEqual([]); // ya pasaron todas las horas de atención de "hoy" en Bogotá
  });

  it('a las 21:00 hora Colombia, ya cerró (cierre 20:00) y no ofrece ninguna hora de "hoy"', async () => {
    vi.useFakeTimers();
    // 2030-06-15 21:00 Bogotá = 2030-06-16 02:00 UTC
    vi.setSystemTime(new Date('2030-06-16T02:00:00Z'));

    const res = await request(app)
      .get('/api/disponibilidad')
      .query({ servicio: 1, barbero: 1, fecha: '2030-06-15' });

    expect(res.body.fecha).toBe('2030-06-15');
    expect(res.body.horas).toEqual([]);
  });

  it('a las 15:00 hora Colombia, filtra horas anteriores a las 15:00 pero deja las posteriores', async () => {
    vi.useFakeTimers();
    // 2030-06-15 15:00 Bogotá = 2030-06-15 20:00 UTC
    vi.setSystemTime(new Date('2030-06-15T20:00:00Z'));

    const res = await request(app)
      .get('/api/disponibilidad')
      .query({ servicio: 1, barbero: 1, fecha: '2030-06-15' });

    expect(res.body.horas).not.toContain('14:30');
    expect(res.body.horas).toContain('15:30');
  });
});
