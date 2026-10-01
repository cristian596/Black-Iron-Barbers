import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { crearApp } from '../app.js';
import { pool } from '../db/connection.js';

const app = crearApp();

const obtenerToken = async (usuario, contrasena) => {
  const res = await request(app).post('/api/auth/login').send({ usuario, contrasena });
  return res.body.token;
};

const citaDePrueba = (overrides = {}) => ({
  cliente: 'Cliente de prueba',
  correo: 'cliente@example.com',
  servicio_id: 1,
  barbero_id: 1,
  fecha: '2030-06-15',
  hora: '10:00',
  ...overrides,
});

let tokenAdmin;
let tokenBarbero1;
let tokenBarbero2;

beforeAll(async () => {
  tokenAdmin = await obtenerToken(process.env.ADMIN_USER, process.env.ADMIN_PASSWORD);
  tokenBarbero1 = await obtenerToken('barbero1_test', 'barbero12345');
  tokenBarbero2 = await obtenerToken('barbero2_test', 'barbero12345');
});

beforeEach(async () => {
  await pool.query('TRUNCATE citas RESTART IDENTITY CASCADE');
});

describe('POST /api/citas', () => {
  it('crea una cita valida', async () => {
    const res = await request(app).post('/api/citas').send(citaDePrueba());
    expect(res.status).toBe(201);
    expect(res.body.estado).toBe('pendiente');
  });

  it('responde 409 ante una doble reserva para el mismo barbero, fecha y hora', async () => {
    await request(app).post('/api/citas').send(citaDePrueba());
    const res = await request(app).post('/api/citas').send(citaDePrueba());

    expect(res.status).toBe(409);
    expect(res.body.error).toBeDefined();
  });
});

describe('GET /api/citas (aislamiento por barbero)', () => {
  it('un barbero solo ve sus propias citas, no las de otro', async () => {
    await request(app).post('/api/citas').send(citaDePrueba({ barbero_id: 1, hora: '10:00' }));
    await request(app).post('/api/citas').send(citaDePrueba({ barbero_id: 2, hora: '11:00' }));

    const res = await request(app)
      .get('/api/citas')
      .set('Authorization', `Bearer ${tokenBarbero1}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].barbero_id).toBe(1);

    const resBarbero2 = await request(app)
      .get('/api/citas')
      .set('Authorization', `Bearer ${tokenBarbero2}`);

    expect(resBarbero2.body.length).toBe(1);
    expect(resBarbero2.body[0].barbero_id).toBe(2);
  });

  it('el admin ve las citas de todos los barberos', async () => {
    await request(app).post('/api/citas').send(citaDePrueba({ barbero_id: 1, hora: '10:00' }));
    await request(app).post('/api/citas').send(citaDePrueba({ barbero_id: 2, hora: '11:00' }));

    const res = await request(app).get('/api/citas').set('Authorization', `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });
});

describe('PATCH /api/citas/:id (permisos por rol)', () => {
  it('un barbero no puede modificar la cita de otro barbero', async () => {
    const creada = await request(app).post('/api/citas').send(citaDePrueba({ barbero_id: 2 }));

    const res = await request(app)
      .patch(`/api/citas/${creada.body.id}`)
      .set('Authorization', `Bearer ${tokenBarbero1}`)
      .send({ estado: 'completada' });

    expect(res.status).toBe(404);
  });

  it('un barbero si puede modificar su propia cita', async () => {
    const creada = await request(app).post('/api/citas').send(citaDePrueba({ barbero_id: 1 }));

    const res = await request(app)
      .patch(`/api/citas/${creada.body.id}`)
      .set('Authorization', `Bearer ${tokenBarbero1}`)
      .send({ estado: 'completada' });

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('completada');
  });
});

describe('Acceso de barbero a /api/admin/*', () => {
  it('un barbero recibe 403 al intentar acceder a una ruta de admin', async () => {
    const res = await request(app)
      .get('/api/admin/resumen')
      .set('Authorization', `Bearer ${tokenBarbero1}`);

    expect(res.status).toBe(403);
  });

  it('el admin si puede acceder a /api/admin/resumen', async () => {
    const res = await request(app)
      .get('/api/admin/resumen')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(200);
  });
});
