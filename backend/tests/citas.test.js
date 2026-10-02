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
  telefono: '3001234567',
  consentimiento: true,
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

describe('POST /api/citas — validaciones nuevas', () => {
  it('rechaza un teléfono inválido', async () => {
    const res = await request(app).post('/api/citas').send(citaDePrueba({ telefono: '123' }));
    expect(res.status).toBe(400);
  });

  it('normaliza un teléfono con +57 y espacios', async () => {
    const res = await request(app)
      .post('/api/citas')
      .send(citaDePrueba({ telefono: '+57 300 123 4567' }));

    expect(res.status).toBe(201);
    expect(res.body.telefono).toBe('3001234567');
  });

  it('rechaza una cita sin consentimiento', async () => {
    const res = await request(app).post('/api/citas').send(citaDePrueba({ consentimiento: false }));
    expect(res.status).toBe(400);
  });

  it('responde 409 si un servicio de 90 min se solapa con una cita existente del mismo barbero', async () => {
    await request(app).post('/api/citas').send(citaDePrueba({ servicio_id: 2, hora: '10:00' }));
    const res = await request(app).post('/api/citas').send(citaDePrueba({ servicio_id: 1, hora: '10:30' }));

    expect(res.status).toBe(409);
  });

  it('rechaza un servicio que terminaría después del horario de cierre', async () => {
    const res = await request(app).post('/api/citas').send(citaDePrueba({ servicio_id: 2, hora: '18:30' }));
    expect(res.status).toBe(400);
  });

  it('una cita cancelada libera el hueco para una nueva reserva que se solaparía', async () => {
    const creada = await request(app).post('/api/citas').send(citaDePrueba({ servicio_id: 2, hora: '10:00' }));
    await request(app)
      .patch(`/api/citas/${creada.body.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ estado: 'cancelada' });

    const res = await request(app).post('/api/citas').send(citaDePrueba({ servicio_id: 1, hora: '10:30' }));
    expect(res.status).toBe(201);
  });

  it('sin barbero_id, asigna automáticamente al barbero activo con menos citas ese día', async () => {
    await request(app).post('/api/citas').send(citaDePrueba({ barbero_id: 1, hora: '09:00' }));

    const res = await request(app).post('/api/citas').send(citaDePrueba({ barbero_id: undefined, hora: '09:00' }));

    expect(res.status).toBe(201);
    expect(res.body.barbero_id).toBe(2);
  });

  it('la reasignación de barbero en admin responde 409 si el nuevo barbero está ocupado', async () => {
    await request(app).post('/api/citas').send(citaDePrueba({ barbero_id: 2, hora: '10:00' }));
    const creada = await request(app).post('/api/citas').send(citaDePrueba({ barbero_id: 1, hora: '10:00' }));

    const res = await request(app)
      .patch(`/api/citas/${creada.body.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ barbero_id: 2 });

    expect(res.status).toBe(409);
  });

  it('la reasignación de barbero en admin funciona si el nuevo barbero está libre', async () => {
    const creada = await request(app).post('/api/citas').send(citaDePrueba({ barbero_id: 1, hora: '10:00' }));

    const res = await request(app)
      .patch(`/api/citas/${creada.body.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ barbero_id: 2 });

    expect(res.status).toBe(200);
    expect(res.body.barbero_id).toBe(2);
  });

  it('permite una cita contigua justo después de que termina otra (sin solapamiento real)', async () => {
    await request(app).post('/api/citas').send(citaDePrueba({ servicio_id: 2, hora: '10:00' })); // 90 min: 10:00-11:30
    const res = await request(app).post('/api/citas').send(citaDePrueba({ servicio_id: 1, hora: '11:30' }));

    expect(res.status).toBe(201);
  });

  it('responde 409 con "cualquier barbero" cuando ya no queda ningún barbero libre en esa hora', async () => {
    await request(app).post('/api/citas').send(citaDePrueba({ barbero_id: 1, hora: '10:00' }));
    await request(app).post('/api/citas').send(citaDePrueba({ barbero_id: 2, hora: '10:00' }));

    const res = await request(app).post('/api/citas').send(citaDePrueba({ barbero_id: undefined, hora: '10:00' }));

    expect(res.status).toBe(409);
  });

  it('reactivar una cita cancelada responde 409 si el hueco ya fue ocupado por otra cita', async () => {
    const original = await request(app).post('/api/citas').send(citaDePrueba({ barbero_id: 1, hora: '10:00' }));
    await request(app)
      .patch(`/api/citas/${original.body.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ estado: 'cancelada' });

    // El hueco liberado lo toma otra cita distinta.
    await request(app).post('/api/citas').send(citaDePrueba({ barbero_id: 1, hora: '10:00' }));

    const res = await request(app)
      .patch(`/api/citas/${original.body.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ estado: 'pendiente' });

    expect(res.status).toBe(409);

    const { rows } = await pool.query('SELECT estado FROM citas WHERE id = $1', [original.body.id]);
    expect(rows[0].estado).toBe('cancelada');
  });

  it('la respuesta incluye el resumen completo (servicio, barbero, fecha, hora, duración, precio) sin campos de más', async () => {
    const res = await request(app).post('/api/citas').send(citaDePrueba());

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      servicio_nombre: 'Corte de prueba',
      barbero_nombre: 'Barbero Uno',
      fecha: expect.any(String),
      hora: '10:00:00',
      duracion_min: 30,
      precio: 50000,
      telefono: '3001234567',
      estado: 'pendiente',
    });
    expect(res.body.contrasena).toBeUndefined();
    expect(res.body.rango).toBeUndefined();
  });

  it('guarda duracion_min, precio, telefono y consentimiento_en en la base de datos', async () => {
    const res = await request(app).post('/api/citas').send(citaDePrueba());

    const { rows } = await pool.query(
      'SELECT duracion_min, precio, telefono, consentimiento_en FROM citas WHERE id = $1',
      [res.body.id]
    );

    expect(rows[0].duracion_min).toBe(30);
    expect(rows[0].precio).toBe(50000);
    expect(rows[0].telefono).toBe('3001234567');
    expect(rows[0].consentimiento_en).toBeInstanceOf(Date);
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
