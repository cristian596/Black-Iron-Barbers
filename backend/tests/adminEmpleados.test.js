import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import { crearApp } from '../app.js';
import { pool } from '../db/connection.js';
import { NOCHE_BOGOTA, firmarToken, insertarCita, reiniciarContador } from './utilsPrueba.js';

const app = crearApp();

let admin;
let barbero;
const api = (metodo, ruta, token = admin) => request(app)[metodo](`/api/admin${ruta}`).set('Authorization', `Bearer ${token}`);
const get = (ruta, token) => api('get', ruta, token);
const post = (ruta, cuerpo, token) => api('post', ruta, token).send(cuerpo);
const patch = (ruta, cuerpo, token) => api('patch', ruta, token).send(cuerpo);

const empleadoValido = (extra = {}) => ({
  nombre: 'Prueba Ángel',
  cargo: 'Barbero Profesional',
  especialidad: 'Fade',
  usuario: 'prueba_angel',
  contrasena: 'clave-segura-1',
  ...extra,
});

const limpiar = async () => {
  const propios = "SELECT id FROM barberos WHERE nombre LIKE 'Prueba %'";
  await pool.query(`DELETE FROM citas WHERE barbero_id IN (${propios})`);
  await pool.query(`DELETE FROM usuarios WHERE barbero_id IN (${propios}) OR usuario LIKE 'prueba_%'`);
  await pool.query(`DELETE FROM barberos WHERE id IN (${propios})`);
  await pool.query('UPDATE barberos SET activo = true WHERE id IN (1, 2)');
  await pool.query("UPDATE usuarios SET activo = true WHERE usuario IN ('barbero1_test', 'barbero2_test')");
  await pool.query('TRUNCATE citas RESTART IDENTITY CASCADE');
};

const crear = async (extra = {}) => {
  const res = await post('/empleados', empleadoValido(extra));
  expect(res.status).toBe(201);
  return res.body;
};

const iniciarSesion = async (usuario, contrasena = 'clave-segura-1') =>
  (await request(app).post('/api/auth/login').send({ usuario, contrasena })).body.token;

const reservar = (extra = {}) =>
  request(app).post('/api/citas').send({
    cliente: 'Cliente de prueba',
    correo: 'cliente@example.com',
    telefono: '3001234567',
    consentimiento: true,
    servicio_id: 1,
    fecha: '2030-06-15',
    hora: '10:00',
    ...extra,
  });

beforeAll(async () => {
  // globalSetup inserta los barberos 1 y 2 con id fijo sin avanzar la secuencia.
  await pool.query("SELECT setval('barberos_id_seq', GREATEST((SELECT MAX(id) FROM barberos), 2))");
  admin = firmarToken('admin');
  barbero = firmarToken('barbero');
});

beforeEach(async () => {
  reiniciarContador();
  await limpiar();
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(limpiar);

const RUTAS = [
  ['get', '/empleados'],
  ['post', '/empleados'],
  ['patch', '/empleados/1'],
];

describe('permisos', () => {
  it.each(RUTAS)('%s /api/admin%s: 401 sin token', async (metodo, ruta) => {
    expect((await request(app)[metodo](`/api/admin${ruta}`)).status).toBe(401);
  });

  it.each(RUTAS)('%s /api/admin%s: 403 con token de barbero', async (metodo, ruta) => {
    expect((await api(metodo, ruta, barbero).send({})).status).toBe(403);
  });

  it('no existe DELETE de empleados (ni con el admin)', async () => {
    const empleado = await crear();
    expect((await api('delete', `/empleados/${empleado.id}`)).status).toBe(404);
    expect((await api('delete', '/empleados')).status).toBe(404);
    const { rows } = await pool.query('SELECT 1 FROM barberos WHERE id = $1', [empleado.id]);
    expect(rows).toHaveLength(1);
  });
});

describe('GET /api/admin/empleados', () => {
  it('lista barberos con su usuario, sin el hash, e incluye inactivos', async () => {
    const empleado = await crear();
    await patch(`/empleados/${empleado.id}`, { activo: false });

    const res = await get('/empleados');
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toMatch(/contrasena|\$2[aby]\$/);

    const fila = res.body.find((e) => e.id === empleado.id);
    expect(fila).toMatchObject({
      nombre: 'Prueba Ángel',
      cargo: 'Barbero Profesional',
      especialidad: 'Fade',
      activo: false,
      usuario: { usuario: 'prueba_angel', activo: false },
      cortes_mes: 0,
      citas_pendientes: 0,
    });
    expect(res.body.find((e) => e.id === 1).activo).toBe(true);
  });

  it('con varios usuarios ligados al mismo barbero no duplica la fila: muestra el activo y el total', async () => {
    // El barbero 1 tiene barbero1_test (activo) y barbero_inactivo (inactivo).
    const res = await get('/empleados');
    const filas = res.body.filter((e) => e.id === 1);
    expect(filas).toHaveLength(1);
    expect(filas[0].usuario).toMatchObject({ usuario: 'barbero1_test', activo: true });
    expect(filas[0].usuarios_total).toBe(2);
  });

  it('un barbero sin usuario sale con usuario null', async () => {
    await pool.query("INSERT INTO barberos (nombre) VALUES ('Prueba Sin Acceso')");
    const fila = (await get('/empleados')).body.find((e) => e.nombre === 'Prueba Sin Acceso');
    expect(fila.usuario).toBeNull();
    expect(fila.usuarios_total).toBe(0);
  });

  it.each(['?activo=true', '?q=a', '?a=1&a=2', '?a[]=1'])('rechaza parámetros (%s) con 400', async (consulta) => {
    const res = await get(`/empleados${consulta}`);
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('PARAMETRO_INVALIDO');
  });
});

describe('cortes del mes (reloj en Bogotá)', () => {
  const fijar = (iso) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(iso));
  };

  // El token se firma con el reloj ya fijado, si no nacería vencido.
  const cortesDe = async (id) => (await get('/empleados', firmarToken('admin'))).body.find((e) => e.id === id).cortes_mes;

  it('a las 23:30 del último día del mes (ya es el mes siguiente en UTC) cuenta el mes que termina', async () => {
    const { id } = await crear();
    await insertarCita({ barbero_id: id, fecha: '2026-09-30', hora: '09:00' }); // mes anterior
    await insertarCita({ barbero_id: id, fecha: '2026-10-01', hora: '09:00' });
    await insertarCita({ barbero_id: id, fecha: '2026-10-31', hora: '09:00' });
    await insertarCita({ barbero_id: id, fecha: '2026-10-31', hora: '10:00', estado: 'cancelada' });
    await insertarCita({ barbero_id: id, fecha: '2026-10-31', hora: '11:00', estado: 'pendiente' });
    await insertarCita({ barbero_id: id, fecha: '2026-11-01', hora: '09:00' }); // mes siguiente

    fijar('2026-11-01T04:30:00Z'); // 31 de octubre, 23:30 en Bogotá
    expect(await cortesDe(id)).toBe(2);
  });

  it('pasada la medianoche de Bogotá empieza el mes nuevo', async () => {
    const { id } = await crear();
    await insertarCita({ barbero_id: id, fecha: '2026-10-31', hora: '09:00' });
    await insertarCita({ barbero_id: id, fecha: '2026-11-01', hora: '09:00' });

    fijar('2026-11-01T05:30:00Z'); // 1 de noviembre, 00:30 en Bogotá
    expect(await cortesDe(id)).toBe(1);
  });
});

describe('citas pendientes', () => {
  it('cuenta solo las pendientes que aún no empiezan (no las vencidas, canceladas ni completadas)', async () => {
    const { id } = await crear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOCHE_BOGOTA)); // 4 de octubre, 22:00 en Bogotá

    await insertarCita({ barbero_id: id, fecha: '2026-10-04', hora: '09:00', estado: 'pendiente' }); // vencida
    await insertarCita({ barbero_id: id, fecha: '2026-10-05', hora: '09:00', estado: 'pendiente' });
    await insertarCita({ barbero_id: id, fecha: '2026-10-06', hora: '09:00', estado: 'pendiente' });
    await insertarCita({ barbero_id: id, fecha: '2026-10-06', hora: '10:00', estado: 'cancelada' });
    await insertarCita({ barbero_id: id, fecha: '2026-10-06', hora: '11:00', estado: 'completada' });

    const fila = (await get('/empleados', firmarToken('admin'))).body.find((e) => e.id === id);
    expect(fila.citas_pendientes).toBe(2);
  });
});

describe('POST /api/admin/empleados', () => {
  it('crea barbero y usuario con rol barbero, activos, sin devolver el hash', async () => {
    const res = await post('/empleados', empleadoValido());
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      nombre: 'Prueba Ángel',
      activo: true,
      foto: null,
      usuario: { usuario: 'prueba_angel', activo: true },
      cortes_mes: 0,
      citas_pendientes: 0,
    });
    expect(JSON.stringify(res.body)).not.toMatch(/contrasena|\$2[aby]\$|clave-segura-1/);

    const { rows } = await pool.query('SELECT rol, barbero_id, activo, contrasena FROM usuarios WHERE usuario = $1', ['prueba_angel']);
    expect(rows[0]).toMatchObject({ rol: 'barbero', barbero_id: res.body.id, activo: true });
    expect(rows[0].contrasena).toMatch(/^\$2[aby]\$/); // guardada con bcrypt, nunca en claro
  });

  it('el empleado nuevo puede iniciar sesión y aparece en la web pública', async () => {
    const empleado = await crear();
    const login = await request(app).post('/api/auth/login').send({ usuario: 'prueba_angel', contrasena: 'clave-segura-1' });
    expect(login.status).toBe(200);
    expect(login.body.usuario).toMatchObject({ rol: 'barbero', barbero_id: empleado.id });

    const publicos = (await request(app).get('/api/barberos')).body;
    expect(publicos.map((b) => b.id)).toContain(empleado.id);
  });

  it('cargo y especialidad son opcionales y un texto vacío queda en null', async () => {
    const res = await post('/empleados', { nombre: 'Prueba Mínimo', usuario: 'prueba_minimo', contrasena: 'clave-segura-1', cargo: '  ' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ cargo: null, especialidad: null });
  });

  it('un usuario repetido responde 409 USUARIO_DUPLICADO y no deja ningún barbero huérfano', async () => {
    await crear();
    const antes = (await pool.query('SELECT COUNT(*)::int AS n FROM barberos')).rows[0].n;

    const res = await post('/empleados', empleadoValido({ nombre: 'Prueba Otro' }));
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ codigo: 'USUARIO_DUPLICADO', campo: 'usuario' });

    const despues = (await pool.query('SELECT COUNT(*)::int AS n FROM barberos')).rows[0].n;
    expect(despues).toBe(antes);
    expect((await pool.query("SELECT 1 FROM barberos WHERE nombre = 'Prueba Otro'")).rows).toHaveLength(0);
  });

  it('un usuario que ya existe (p. ej. el admin) también se rechaza sin huérfanos', async () => {
    const antes = (await pool.query('SELECT COUNT(*)::int AS n FROM barberos')).rows[0].n;
    const res = await post('/empleados', empleadoValido({ usuario: 'barbero1_test' }));
    expect(res.status).toBe(409);
    expect((await pool.query('SELECT COUNT(*)::int AS n FROM barberos')).rows[0].n).toBe(antes);
  });

  it.each([
    ['nombre', ''],
    ['nombre', '   '],
    ['nombre', 'n'.repeat(101)],
    ['nombre', 5],
    ['cargo', 'c'.repeat(101)],
    ['especialidad', 'e'.repeat(151)],
    ['usuario', ''],
    ['usuario', 'u'.repeat(51)],
    ['contrasena', '1234567'],
    ['contrasena', 'c'.repeat(73)],
    ['contrasena', 12345678],
  ])('rechaza %s = %j con 400 DATOS_INVALIDOS en ese campo', async (campo, valor) => {
    const res = await post('/empleados', empleadoValido({ [campo]: valor }));
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ codigo: 'DATOS_INVALIDOS', campo });
    expect((await pool.query("SELECT 1 FROM barberos WHERE nombre LIKE 'Prueba %'")).rows).toHaveLength(0);
  });

  it.each(['nombre', 'usuario', 'contrasena'])('exige %s', async (campo) => {
    const cuerpo = empleadoValido();
    delete cuerpo[campo];
    const res = await post('/empleados', cuerpo);
    expect(res.status).toBe(400);
    expect(res.body.campo).toBe(campo);
  });

  it('acepta los límites: nombre de 100, usuario de 50 y contraseña de 8 y 72', async () => {
    const nombre = `Prueba ${'n'.repeat(93)}`;
    expect((await post('/empleados', empleadoValido({ nombre, usuario: `prueba_${'u'.repeat(43)}`, contrasena: 'c'.repeat(8) }))).status).toBe(201);
    expect((await post('/empleados', empleadoValido({ usuario: 'prueba_72', contrasena: 'c'.repeat(72) }))).status).toBe(201);
  });

  it('rechaza claves desconocidas (también activo, foto y rol) y cuerpos que no son objeto', async () => {
    for (const extra of [{ activo: false }, { foto: '/x.jpg' }, { rol: 'admin' }, { barbero_id: 1 }]) {
      const res = await post('/empleados', empleadoValido(extra));
      expect(res.status).toBe(400);
      expect(res.body.codigo).toBe('DATOS_INVALIDOS');
    }
    expect((await post('/empleados', [empleadoValido()])).status).toBe(400);
    expect((await post('/empleados', {})).status).toBe(400);
  });
});

describe('PATCH /api/admin/empleados/:id', () => {
  it('edita nombre, cargo y especialidad', async () => {
    const { id } = await crear();
    const res = await patch(`/empleados/${id}`, { nombre: 'Prueba Ángel Mejía', cargo: 'Barbero Senior', especialidad: '' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ nombre: 'Prueba Ángel Mejía', cargo: 'Barbero Senior', especialidad: null, activo: true });
  });

  it.each([
    [{}, null],
    [{ nombre: '' }, 'nombre'],
    [{ cargo: 'c'.repeat(101) }, 'cargo'],
    [{ especialidad: 'e'.repeat(151) }, 'especialidad'],
    [{ activo: 'false' }, 'activo'],
    [{ usuario: 'otro' }, 'usuario'],
    [{ contrasena: 'clave-segura-1' }, 'contrasena'],
    [{ foto: '/x.jpg' }, 'foto'],
  ])('rechaza %j con 400', async (cuerpo, campo) => {
    const { id } = await crear();
    const res = await patch(`/empleados/${id}`, cuerpo);
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('DATOS_INVALIDOS');
    if (campo) expect(res.body.campo).toBe(campo);
  });

  it('id inválido → 400 ID_INVALIDO; inexistente → 404 EMPLEADO_NO_ENCONTRADO', async () => {
    expect((await patch('/empleados/abc', { nombre: 'X' })).body.codigo).toBe('ID_INVALIDO');
    for (const id of ['999999', '99999999999']) {
      const res = await patch(`/empleados/${id}`, { nombre: 'X' });
      expect(res.status).toBe(404);
      expect(res.body.codigo).toBe('EMPLEADO_NO_ENCONTRADO');
    }
  });
});

describe('desactivar y reactivar', () => {
  it('desactivar apaga barbero y usuario a la vez y lo saca de /api/barberos', async () => {
    const empleado = await crear();
    const res = await patch(`/empleados/${empleado.id}`, { activo: false });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ activo: false, usuario: { activo: false }, citas_pendientes_conservadas: 0 });

    const { rows } = await pool.query(
      'SELECT b.activo AS barbero, u.activo AS usuario FROM barberos b JOIN usuarios u ON u.barbero_id = b.id WHERE b.id = $1',
      [empleado.id]
    );
    expect(rows).toEqual([{ barbero: false, usuario: false }]);

    const publicos = (await request(app).get('/api/barberos')).body;
    expect(publicos.map((b) => b.id)).not.toContain(empleado.id);
  });

  it('con varios usuarios ligados, desactivar apaga todos y reactivar solo el más reciente', async () => {
    const empleado = await crear();
    const extra = await post('/usuarios', { usuario: 'prueba_extra', contrasena: 'clave-segura-1', barbero_id: empleado.id });
    expect(extra.status).toBe(201);

    await patch(`/empleados/${empleado.id}`, { activo: false });
    expect((await pool.query('SELECT 1 FROM usuarios WHERE barbero_id = $1 AND activo', [empleado.id])).rows).toHaveLength(0);

    const res = await patch(`/empleados/${empleado.id}`, { activo: true });
    expect(res.body).toMatchObject({ activo: true, usuario: { usuario: 'prueba_extra', activo: true }, usuarios_total: 2 });
    expect((await pool.query('SELECT 1 FROM usuarios WHERE barbero_id = $1 AND activo', [empleado.id])).rows).toHaveLength(1);
  });

  it('reactivar deja barbero y usuario activos, vuelve a /api/barberos y puede iniciar sesión', async () => {
    const empleado = await crear();
    await patch(`/empleados/${empleado.id}`, { activo: false });
    expect((await request(app).post('/api/auth/login').send({ usuario: 'prueba_angel', contrasena: 'clave-segura-1' })).status).toBe(401);

    const res = await patch(`/empleados/${empleado.id}`, { activo: true });
    expect(res.body).toMatchObject({ activo: true, usuario: { activo: true } });
    expect(res.body).not.toHaveProperty('citas_pendientes_conservadas');

    expect((await request(app).get('/api/barberos')).body.map((b) => b.id)).toContain(empleado.id);
    expect((await request(app).post('/api/auth/login').send({ usuario: 'prueba_angel', contrasena: 'clave-segura-1' })).status).toBe(200);
  });

  it('el empleado inactivo sigue en el listado de usuarios del admin (se puede reactivar)', async () => {
    const empleado = await crear();
    await patch(`/empleados/${empleado.id}`, { activo: false });
    const usuarios = (await get('/usuarios')).body;
    expect(usuarios.find((u) => u.usuario === 'prueba_angel')).toMatchObject({ activo: false, barbero_id: empleado.id });
  });

  it('no deja un usuario activo con su barbero inactivo (PATCH /usuarios y POST /usuarios responden 409)', async () => {
    const empleado = await crear();
    await patch(`/empleados/${empleado.id}`, { activo: false });

    const reactivar = await patch(`/usuarios/${empleado.usuario.id}`, { activo: true });
    expect(reactivar.status).toBe(409);
    expect(reactivar.body.codigo).toBe('BARBERO_INACTIVO');

    const crearAcceso = await post('/usuarios', { usuario: 'prueba_nuevo', contrasena: 'clave-segura-1', barbero_id: empleado.id });
    expect(crearAcceso.status).toBe(409);
    expect(crearAcceso.body.codigo).toBe('BARBERO_INACTIVO');
  });

  it('responde cuántas citas pendientes futuras conserva; siguen asignadas y el admin puede reasignarlas', async () => {
    const empleado = await crear();
    const futura = await reservar({ barbero_id: empleado.id, fecha: '2030-06-15', hora: '10:00' });
    await reservar({ barbero_id: empleado.id, fecha: '2030-06-16', hora: '10:00' });
    expect(futura.status).toBe(201);

    const res = await patch(`/empleados/${empleado.id}`, { activo: false });
    expect(res.status).toBe(200);
    expect(res.body.citas_pendientes_conservadas).toBe(2);

    const { rows } = await pool.query('SELECT barbero_id, estado FROM citas WHERE id = $1', [futura.body.id]);
    expect(rows[0]).toEqual({ barbero_id: empleado.id, estado: 'pendiente' });

    const reasignada = await request(app).patch(`/api/citas/${futura.body.id}`).set('Authorization', `Bearer ${admin}`).send({ barbero_id: 1 });
    expect(reasignada.status).toBe(200);
    expect(reasignada.body.barbero_id).toBe(1);
  });
});

describe('barbero inactivo en la reserva', () => {
  it('reservar con un barbero específico inactivo se rechaza (cita, disponibilidad y reasignación)', async () => {
    const empleado = await crear();
    await patch(`/empleados/${empleado.id}`, { activo: false });

    const cita = await reservar({ barbero_id: empleado.id });
    expect(cita.status).toBe(400);
    expect((await pool.query('SELECT 1 FROM citas')).rows).toHaveLength(0);

    const disponibilidad = await request(app).get(`/api/disponibilidad?barbero=${empleado.id}&fecha=2030-06-15&servicio=1`);
    expect(disponibilidad.status).toBe(404);

    const existente = await reservar({ barbero_id: 1 });
    const reasignar = await request(app).patch(`/api/citas/${existente.body.id}`).set('Authorization', `Bearer ${admin}`).send({ barbero_id: empleado.id });
    expect(reasignar.status).toBe(400);
  });

  it('"cualquier barbero" excluye a los inactivos', async () => {
    const empleado = await crear();
    await pool.query('UPDATE barberos SET activo = false WHERE id IN (1, 2)');

    // Con el empleado como único activo, la asignación automática lo elige a él…
    const asignada = await reservar();
    expect(asignada.status).toBe(201);
    expect(asignada.body.barbero_id).toBe(empleado.id);

    // …y apenas se desactiva, nadie más está disponible.
    await patch(`/empleados/${empleado.id}`, { activo: false });
    const sinNadie = await reservar({ hora: '11:00' });
    expect(sinNadie.status).toBe(409);

    const horas = await request(app).get('/api/disponibilidad?fecha=2030-06-15&servicio=1');
    expect(horas.body.horas).toEqual([]);
  });
});

describe('token de un usuario desactivado', () => {
  it('deja de funcionar al instante (401 SESION_INVALIDA) aunque no haya expirado, y vuelve al reactivar', async () => {
    const empleado = await crear();
    const token = await iniciarSesion('prueba_angel');
    const propias = () => request(app).get('/api/citas').set('Authorization', `Bearer ${token}`);
    expect((await propias()).status).toBe(200);

    await patch(`/empleados/${empleado.id}`, { activo: false });
    const rechazada = await propias();
    expect(rechazada.status).toBe(401);
    expect(rechazada.body.codigo).toBe('SESION_INVALIDA');

    await patch(`/empleados/${empleado.id}`, { activo: true });
    expect((await propias()).status).toBe(200);
  });

  it('desactivar solo el barbero (estado inconsistente heredado) también invalida el token', async () => {
    const empleado = await crear();
    const token = await iniciarSesion('prueba_angel');
    await pool.query('UPDATE barberos SET activo = false WHERE id = $1', [empleado.id]);
    expect((await request(app).get('/api/citas').set('Authorization', `Bearer ${token}`)).status).toBe(401);
  });

  it('el rol sale de la base: un barbero con un token que dice admin no entra a /api/admin', async () => {
    const empleado = await crear();
    const jwt = (await import('jsonwebtoken')).default;
    const falso = jwt.sign({ id: empleado.usuario.id, rol: 'admin', barbero_id: null }, process.env.JWT_SECRET, { expiresIn: '1h' });
    expect((await get('/empleados', falso)).status).toBe(403);
  });

  it('un token de un usuario que ya no existe se rechaza', async () => {
    const jwt = (await import('jsonwebtoken')).default;
    const huerfano = jwt.sign({ id: 987654, rol: 'admin', barbero_id: null }, process.env.JWT_SECRET, { expiresIn: '1h' });
    expect((await get('/empleados', huerfano)).status).toBe(401);
  });
});
