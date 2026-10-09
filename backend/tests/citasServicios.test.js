import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import { crearApp } from '../app.js';
import { pool } from '../db/connection.js';
import { crearServiciosCombo, borrarServiciosCombo } from './utilsPrueba.js';

const app = crearApp();

const base = (extra = {}) => ({
  cliente: 'Cliente combo',
  correo: 'cliente@example.com',
  telefono: '3001234567',
  consentimiento: true,
  barbero_id: 1,
  fecha: '2030-06-15',
  hora: '11:00',
  ...extra,
});

const reservar = (cuerpo) => request(app).post('/api/citas').send(cuerpo);

const obtenerToken = async (usuario, contrasena) => (await request(app).post('/api/auth/login').send({ usuario, contrasena })).body.token;

const contar = async (tabla) => (await pool.query(`SELECT COUNT(*)::int AS n FROM ${tabla}`)).rows[0].n;
const lineasDe = async (citaId) =>
  (await pool.query('SELECT servicio_id, orden, nombre, duracion_min, precio FROM cita_servicios WHERE cita_id = $1 ORDER BY orden', [citaId])).rows;

// Tras la petición todas las conexiones del pool deben estar libres (ninguna transacción quedó abierta).
const poolLibre = async () => {
  for (let i = 0; i < 20; i += 1) {
    if (pool.waitingCount === 0 && pool.idleCount === pool.totalCount) return true;
    await new Promise((r) => setTimeout(r, 25));
  }
  return false;
};

let tokenAdmin;
let tokenBarbero1;

beforeAll(async () => {
  await crearServiciosCombo();
  tokenAdmin = await obtenerToken(process.env.ADMIN_USER, process.env.ADMIN_PASSWORD);
  tokenBarbero1 = await obtenerToken('barbero1_test', 'barbero12345');
});
beforeEach(async () => {
  await pool.query('TRUNCATE citas RESTART IDENTITY CASCADE');
  await pool.query('UPDATE servicios SET activo = true WHERE id BETWEEN 201 AND 205');
});
afterAll(async () => {
  await pool.query('TRUNCATE citas RESTART IDENTITY CASCADE');
  await borrarServiciosCombo();
});

describe('Compatibilidad: servicio_id (formato anterior)', () => {
  it('crea la cita con UNA línea y conserva servicio_id y servicio_nombre', async () => {
    const res = await reservar(base({ servicio_id: 1 }));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      servicio_id: 1,
      servicio_nombre: 'Corte de prueba',
      duracion_min: 30,
      precio: 50000,
      barbero_nombre: 'Barbero Uno',
      servicios: [{ id: 1, nombre: 'Corte de prueba', duracion_min: 30, precio: 50000 }],
    });
    expect(await lineasDe(res.body.id)).toEqual([
      { servicio_id: 1, orden: 1, nombre: 'Corte de prueba', duracion_min: 30, precio: 50000 },
    ]);
  });

  it('servicio_id como texto numérico sigue funcionando; como arreglo u objeto no', async () => {
    expect((await reservar(base({ servicio_id: '1', hora: '10:00' }))).status).toBe(201);
    for (const raro of [[1], { id: 1 }, true]) {
      const res = await reservar(base({ servicio_id: raro, hora: '12:00' }));
      expect(res.status).toBe(400);
    }
  });

  it('servicios_ids con un solo id equivale al formato anterior', async () => {
    const res = await reservar(base({ servicios_ids: [1] }));
    expect(res.status).toBe(201);
    expect(res.body.servicio_id).toBe(1);
    expect(res.body.servicios).toHaveLength(1);
  });

  it('GET /api/citas conserva servicio_id y servicio_nombre y añade servicios', async () => {
    await reservar(base({ servicio_id: 1 }));
    const res = await request(app).get('/api/citas').set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({
      servicio_id: 1,
      servicio_nombre: 'Corte de prueba',
      servicios: [{ id: 1, nombre: 'Corte de prueba', duracion_min: 30, precio: 50000 }],
    });
  });
});

describe('Varios servicios en una sola cita', () => {
  it('suma duración y precio, guarda el orden y el servicio principal es el primero', async () => {
    const res = await reservar(base({ servicios_ids: [202, 201, 203] }));
    expect(res.status).toBe(201);
    expect(res.body.duracion_min).toBe(80);
    expect(res.body.precio).toBe(40000);
    expect(res.body.servicio_id).toBe(202);
    expect(res.body.servicio_nombre).toBe('Barba T + Corte T + Cejas T');
    expect(res.body.servicios.map((s) => s.id)).toEqual([202, 201, 203]);

    const { rows } = await pool.query('SELECT servicio_id, duracion_min, precio FROM citas WHERE id = $1', [res.body.id]);
    expect(rows[0]).toEqual({ servicio_id: 202, duracion_min: 80, precio: 40000 });
    const lineas = await lineasDe(res.body.id);
    expect(lineas.map((l) => [l.orden, l.servicio_id])).toEqual([[1, 202], [2, 201], [3, 203]]);
    expect(lineas.reduce((s, l) => s + l.duracion_min, 0)).toBe(80);
    expect(lineas.reduce((s, l) => s + l.precio, 0)).toBe(40000);
  });

  it('el bloque completo ocupa al barbero: otra reserva que lo cruza recibe 409', async () => {
    expect((await reservar(base({ servicios_ids: [201, 202], hora: '11:00' }))).status).toBe(201); // 11:00-12:00
    expect((await reservar(base({ servicio_id: 1, hora: '11:30' }))).status).toBe(409);
    expect((await reservar(base({ servicio_id: 1, hora: '12:00' }))).status).toBe(201);
  });

  it('sin barbero elegido asigna UNO solo para todo el bloque', async () => {
    const res = await reservar(base({ servicios_ids: [201, 202], barbero_id: undefined }));
    expect(res.status).toBe(201);
    expect(await contar('citas')).toBe(1);
  });

  it('GET /api/citas y PATCH devuelven servicio_nombre unido y el arreglo servicios ordenado', async () => {
    const creada = await reservar(base({ servicios_ids: [201, 202] }));
    const lista = await request(app).get('/api/citas').set('Authorization', `Bearer ${tokenBarbero1}`);
    expect(lista.body[0].servicio_nombre).toBe('Corte T + Barba T');
    expect(lista.body[0].servicios.map((s) => s.nombre)).toEqual(['Corte T', 'Barba T']);

    const patch = await request(app)
      .patch(`/api/citas/${creada.body.id}`)
      .set('Authorization', `Bearer ${tokenBarbero1}`)
      .send({ estado: 'cancelada' });
    expect(patch.status).toBe(200);
    expect(patch.body).toMatchObject({ estado: 'cancelada', servicio_id: 201, servicio_nombre: 'Corte T + Barba T' });
    expect(patch.body.servicios).toHaveLength(2);
  });

  it('snapshot: renombrar o cambiar un servicio después no cambia la cita ya hecha', async () => {
    const creada = await reservar(base({ servicios_ids: [201, 202] }));
    await pool.query("UPDATE servicios SET nombre = 'Corte renombrado', precio = 99999, duracion_min = 60 WHERE id = 201");

    const lista = await request(app).get('/api/citas').set('Authorization', `Bearer ${tokenAdmin}`);
    const cita = lista.body.find((c) => c.id === creada.body.id);
    expect(cita.servicio_nombre).toBe('Corte T + Barba T');
    expect(cita.servicios[0]).toEqual({ id: 201, nombre: 'Corte T', duracion_min: 30, precio: 20000 });
    expect(cita.precio).toBe(35000);
    expect(cita.duracion_min).toBe(60);
    await pool.query("UPDATE servicios SET nombre = 'Corte T', precio = 20000, duracion_min = 30 WHERE id = 201");
  });

  it('un servicio INDIVIDUAL de 300 min es reservable (el tope de 240 es solo para combos)', async () => {
    const nuevo = await reservar(base({ servicios_ids: [207], hora: '10:00' }));
    expect(nuevo.status).toBe(201);
    expect(nuevo.body.duracion_min).toBe(300);
    const legado = await reservar(base({ servicio_id: 207, hora: '15:00' }));
    expect(legado.status).toBe(201);
    expect(legado.body.duracion_min).toBe(300);
  });

  it('un combo que incluye ese servicio de 300 min se rechaza con DURACION_EXCEDIDA', async () => {
    const res = await reservar(base({ servicios_ids: [207, 203], hora: '10:00' }));
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('DURACION_EXCEDIDA');
    expect(res.body.duracion_total_min).toBe(320);
    expect(await contar('citas')).toBe(0);
  });

  it('exactamente 240 min es válido', async () => {
    const res = await reservar(base({ servicios_ids: [204, 205], hora: '10:00' }));
    expect(res.status).toBe(201);
    expect(res.body.duracion_min).toBe(240);
  });
});

describe('Límites y errores (no crean nada)', () => {
  const sinCita = async () => {
    expect(await contar('citas')).toBe(0);
    expect(await contar('cita_servicios')).toBe(0);
  };

  it.each([
    ['0 servicios', [], 'LIMITE_SERVICIOS'],
    ['4 servicios', [201, 202, 203, 204], 'LIMITE_SERVICIOS'],
    ['4 servicios con repetidos', [201, 201, 202, 202], 'LIMITE_SERVICIOS'],
    ['ids repetidos', [201, 201], 'SERVICIOS_REPETIDOS'],
    ['ids repetidos no contiguos', [201, 202, 201], 'SERVICIOS_REPETIDOS'],
  ])('%s → 400 %s', async (_n, ids, codigo) => {
    const res = await reservar(base({ servicios_ids: ids }));
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe(codigo);
    await sinCita();
  });

  it('un servicio inexistente → 400 SERVICIO_NO_DISPONIBLE con los ids afectados', async () => {
    const res = await reservar(base({ servicios_ids: [201, 99999] }));
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('SERVICIO_NO_DISPONIBLE');
    expect(res.body.servicios_no_disponibles).toEqual([99999]);
    await sinCita();
  });

  it('un servicio inactivo → 400 SERVICIO_NO_DISPONIBLE con su id', async () => {
    const res = await reservar(base({ servicios_ids: [206, 201] }));
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('SERVICIO_NO_DISPONIBLE');
    expect(res.body.servicios_no_disponibles).toEqual([206]);
    await sinCita();
  });

  it.each([
    ['ids como texto', ['201']],
    ['objetos anidados', [{ id: 201 }]],
    ['arreglos anidados', [[201]]],
    ['decimal', [1.5]],
    ['cero', [0]],
    ['negativo', [-1]],
    ['null', [null]],
    ['fuera del rango de int', [3000000000]],
    ['una lista como texto', '201,202'],
    ['un número suelto', 201],
    ['un objeto', { 0: 201 }],
    ['null en el campo', null],
  ])('tipo inválido (%s) → 400 DATOS_INVALIDOS', async (_n, valor) => {
    const res = await reservar(base({ servicios_ids: valor }));
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('DATOS_INVALIDOS');
    expect(res.body.campo).toBe('servicios_ids');
    await sinCita();
  });

  it('servicio_id y servicios_ids a la vez → 400', async () => {
    const res = await reservar(base({ servicio_id: 201, servicios_ids: [201] }));
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('DATOS_INVALIDOS');
    await sinCita();
  });

  it('sin ningún servicio → 400 (mensaje de siempre)', async () => {
    const res = await reservar(base());
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('El servicio es obligatorio');
  });

  it('más de 240 min en total → 400 DURACION_EXCEDIDA', async () => {
    const res = await reservar(base({ servicios_ids: [204, 205, 203], hora: '10:00' }));
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('DURACION_EXCEDIDA');
    expect(res.body.duracion_total_min).toBe(260);
    expect(res.body.maximo_min).toBe(240);
    await sinCita();
  });

  it('el bloque debe caber en el horario: 180 min a las 18:00 no, a las 17:00 sí', async () => {
    const tarde = await reservar(base({ servicios_ids: [204, 201, 202], hora: '18:00' }));
    expect(tarde.status).toBe(400);
    expect(tarde.body.error).toMatch(/no caben/);
    await sinCita();
    expect((await reservar(base({ servicios_ids: [204, 201, 202], hora: '17:00' }))).status).toBe(201);
  });

  it('ignora totales, precios y duraciones que mande el navegador', async () => {
    const res = await reservar(
      base({
        servicios_ids: [201, 202],
        precio: 1,
        total: 0,
        duracion_min: 5,
        duracion: 5,
        servicios: [{ id: 201, precio: 1, duracion_min: 1 }],
      })
    );
    expect(res.status).toBe(201);
    expect(res.body.precio).toBe(35000);
    expect(res.body.duracion_min).toBe(60);
    expect(res.body.servicios.map((s) => s.precio)).toEqual([20000, 15000]);
    const { rows } = await pool.query('SELECT precio, duracion_min FROM citas WHERE id = $1', [res.body.id]);
    expect(rows[0]).toEqual({ precio: 35000, duracion_min: 60 });
  });
});

describe('Concurrencia y transacciones', () => {
  it('dos reservas simultáneas del mismo bloque: una gana, la otra recibe el choque; sin huérfanos', async () => {
    const [a, b] = await Promise.all([
      reservar(base({ servicios_ids: [201, 202], cliente: 'A' })),
      reservar(base({ servicios_ids: [202, 203], cliente: 'B' })),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);

    expect(await contar('citas')).toBe(1);
    const ganadora = [a, b].find((r) => r.status === 201);
    expect(await lineasDe(ganadora.body.id)).toHaveLength(2);
    const huerfanas = await pool.query('SELECT COUNT(*)::int AS n FROM cita_servicios WHERE cita_id NOT IN (SELECT id FROM citas)');
    expect(huerfanas.rows[0].n).toBe(0);
    const sinLineas = await pool.query('SELECT COUNT(*)::int AS n FROM citas WHERE id NOT IN (SELECT cita_id FROM cita_servicios)');
    expect(sinLineas.rows[0].n).toBe(0);
    expect(await poolLibre()).toBe(true);
  });

  it('tres simultáneas sin barbero y solo dos barberos: dos ganan con barberos distintos, una recibe 409', async () => {
    const rs = await Promise.all(
      ['A', 'B', 'C'].map((cliente) => reservar(base({ servicios_ids: [201, 202], barbero_id: undefined, cliente })))
    );
    expect(rs.map((r) => r.status).sort()).toEqual([201, 201, 409]);
    const barberos = rs.filter((r) => r.status === 201).map((r) => r.body.barbero_id);
    expect(new Set(barberos).size).toBe(2);
    expect(await contar('citas')).toBe(2);
    expect(await contar('cita_servicios')).toBe(4);
    expect(await poolLibre()).toBe(true);
  });

  it('un servicio que se desactiva MIENTRAS se reserva (FOR SHARE) no se reserva: 400 y nada guardado', async () => {
    const baja = await pool.connect();
    try {
      await baja.query('BEGIN');
      await baja.query('UPDATE servicios SET activo = false WHERE id = 202'); // fila bloqueada hasta el COMMIT

      const pendiente = reservar(base({ servicios_ids: [201, 202] })).then((r) => r);
      await new Promise((resolver) => setTimeout(resolver, 300)); // la reserva ya validó y espera el bloqueo
      await baja.query('COMMIT');

      const res = await pendiente;
      expect(res.status).toBe(400);
      expect(res.body.codigo).toBe('SERVICIO_NO_DISPONIBLE');
      expect(res.body.servicios_no_disponibles).toEqual([202]);
    } finally {
      baja.release();
    }
    expect(await contar('citas')).toBe(0);
    expect(await contar('cita_servicios')).toBe(0);
    expect(await poolLibre()).toBe(true);
  });

  it('rollback: si falla el INSERT de las líneas no queda ninguna cita y la conexión se libera', async () => {
    const silencio = vi.spyOn(console, 'error').mockImplementation(() => {});
    await pool.query(`
      CREATE OR REPLACE FUNCTION fallar_linea_prueba() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'falla de prueba en cita_servicios'; END $$ LANGUAGE plpgsql`);
    await pool.query('CREATE TRIGGER trg_fallar_linea BEFORE INSERT ON cita_servicios FOR EACH ROW EXECUTE FUNCTION fallar_linea_prueba()');
    try {
      const res = await reservar(base({ servicios_ids: [201, 202] }));
      expect(res.status).toBe(500);
      expect(await contar('citas')).toBe(0);
      expect(await contar('cita_servicios')).toBe(0);
      expect(await poolLibre()).toBe(true);
    } finally {
      await pool.query('DROP TRIGGER IF EXISTS trg_fallar_linea ON cita_servicios');
      await pool.query('DROP FUNCTION IF EXISTS fallar_linea_prueba()');
      silencio.mockRestore();
    }
    // y la reserva vuelve a funcionar al quitar la falla
    expect((await reservar(base({ servicios_ids: [201, 202] }))).status).toBe(201);
  });

  it('borrar una cita (limpieza demo) borra sus líneas en cascada', async () => {
    const creada = await reservar(base({ servicios_ids: [201, 202] }));
    await pool.query('DELETE FROM citas WHERE id = $1', [creada.body.id]);
    expect(await contar('cita_servicios')).toBe(0);
  });

  it('la base también fuerza el máximo de 3 líneas y no admite servicios repetidos', async () => {
    const creada = await reservar(base({ servicios_ids: [201, 202, 203] }));
    await expect(
      pool.query("INSERT INTO cita_servicios (cita_id, servicio_id, orden, nombre, duracion_min, precio) VALUES ($1, 204, 4, 'x', 10, 1)", [creada.body.id])
    ).rejects.toThrow();
    await expect(
      pool.query("INSERT INTO cita_servicios (cita_id, servicio_id, orden, nombre, duracion_min, precio) VALUES ($1, 201, 3, 'x', 10, 1)", [creada.body.id])
    ).rejects.toThrow();
  });
});
