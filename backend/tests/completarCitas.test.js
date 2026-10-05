import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { vi } from 'vitest';
import { crearApp } from '../app.js';
import { pool } from '../db/connection.js';
import { NOCHE_BOGOTA, HOY, firmarToken, insertarCita, reiniciarContador } from './utilsPrueba.js';

const app = crearApp();

let admin;
let barbero1;
const patch = (id, token, cuerpo) =>
  request(app).patch(`/api/citas/${id}`).set('Authorization', `Bearer ${token}`).send(cuerpo);

// Reloj: 22:00 del 4 de octubre en Bogotá (ya es 5 de octubre en UTC). "Mañana" para el negocio es el día 5.
beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOCHE_BOGOTA));
  admin = firmarToken('admin');
  barbero1 = firmarToken('barbero'); // barbero_id 1
});

afterAll(() => {
  vi.useRealTimers();
});

beforeEach(async () => {
  reiniciarContador();
  await pool.query('TRUNCATE citas RESTART IDENTITY CASCADE');
});

describe('PATCH /api/citas/:id — completar una cita de fecha futura', () => {
  it.each([['barbero dueño de la cita', () => barbero1]])('%s: 400 con codigo CITA_FUTURA si la cita es de mañana (hora de Bogotá)', async (_rol, token) => {
    const id = await insertarCita({ fecha: '2026-10-05', estado: 'pendiente', barbero_id: 1 });

    const res = await patch(id, token(), { estado: 'completada' });

    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('CITA_FUTURA');
    expect(res.body.error).toMatch(/futura/);
    const { rows } = await pool.query('SELECT estado FROM citas WHERE id = $1', [id]);
    expect(rows[0].estado).toBe('pendiente');
  });

  it('usa el día de Bogotá, no el de UTC: la cita del día 4 (hoy en Bogotá) sí se puede completar', async () => {
    const id = await insertarCita({ fecha: HOY, estado: 'pendiente', barbero_id: 1 });

    const comoBarbero = await patch(id, barbero1, { estado: 'completada' });

    expect(comoBarbero.status).toBe(200);
    expect(comoBarbero.body.estado).toBe('completada');
  });

  it('una cita de un día pasado la completa el barbero; el admin ya no puede (403 SOLO_BARBERO)', async () => {
    const a = await insertarCita({ fecha: '2026-09-20', estado: 'pendiente', barbero_id: 1 });
    const b = await insertarCita({ fecha: '2026-09-21', estado: 'pendiente', barbero_id: 1 });

    const comoAdmin = await patch(a, admin, { estado: 'completada' });
    expect(comoAdmin.status).toBe(403);
    expect(comoAdmin.body.codigo).toBe('SOLO_BARBERO');
    expect((await patch(b, barbero1, { estado: 'completada' })).status).toBe(200);
  });

  it('una cita futura sí se puede reasignar (admin) y cancelar (barbero dueño); el bloqueo es solo para completar', async () => {
    const id = await insertarCita({ fecha: '2030-06-15', estado: 'pendiente', barbero_id: 1 });
    const otra = await insertarCita({ fecha: '2030-06-16', estado: 'pendiente', barbero_id: 1 });

    const reasignada = await patch(id, admin, { barbero_id: 2 });
    expect(reasignada.status).toBe(200);
    expect(reasignada.body.barbero_id).toBe(2);

    const cancelada = await patch(otra, barbero1, { estado: 'cancelada' });
    expect(cancelada.status).toBe(200);
    expect(cancelada.body.estado).toBe('cancelada');
  });

  it('el admin que manda estado y barbero_id a la vez recibe 403 SOLO_BARBERO y no cambia nada', async () => {
    const id = await insertarCita({ fecha: '2030-06-15', estado: 'pendiente', barbero_id: 1 });

    const res = await patch(id, admin, { estado: 'completada', barbero_id: 2 });

    expect(res.status).toBe(403);
    expect(res.body.codigo).toBe('SOLO_BARBERO');
    const { rows } = await pool.query('SELECT estado, barbero_id FROM citas WHERE id = $1', [id]);
    expect(rows[0]).toEqual({ estado: 'pendiente', barbero_id: 1 });
  });

  it('un barbero que no es dueño sigue recibiendo 404 (no se revela nada) aunque la cita sea futura', async () => {
    const id = await insertarCita({ fecha: '2030-06-15', estado: 'pendiente', barbero_id: 2 });

    const res = await patch(id, barbero1, { estado: 'completada' });

    expect(res.status).toBe(404);
    expect(res.body.codigo).toBeUndefined();
  });

  it('los validadores previos siguen primero: estado inválido sigue siendo 400 sin código de cita futura', async () => {
    const id = await insertarCita({ fecha: '2030-06-15', estado: 'pendiente', barbero_id: 1 });

    const res = await patch(id, admin, { estado: 'terminada' });

    expect(res.status).toBe(400);
    expect(res.body.codigo).toBeUndefined();
  });
});
