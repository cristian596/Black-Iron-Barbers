import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { crearApp } from '../app.js';
import { pool } from '../db/connection.js';
import { esperarNotificaciones } from '../utils/notificaciones.js';
import { configurarVerificacion, restablecerVerificacion, firmarComprobante } from '../utils/verificacionCorreo.js';
import { SECRETO_PRUEBA, comprobanteDe } from './verificacionPrueba.js';

// POST /api/citas exige el comprobante de verificación del correo. Estas pruebas pasan su propio `verificacion_token`
// (el ayudante automático de tests/setup.js no interviene cuando la clave está presente). Ids 96xx.

const app = crearApp();
const FECHA = '2030-07-17';
const ASESOR = 9601;
const ASESORIA = 9601; // asesoría de 30 min
const CORTE = 9602; // 30 min
const GRATIS = 9603; // asesoría gratis (15 min)
const IDS_SERVICIOS = [ASESORIA, CORTE, GRATIS];

let reloj = new Date();

const limpiar = async () => {
  await pool.query('TRUNCATE citas RESTART IDENTITY CASCADE');
  await pool.query("DELETE FROM verificaciones_usadas WHERE correo LIKE '%.reserva@example.com'");
};

const borrarDatosPrueba = async () => {
  await limpiar();
  await pool.query('DELETE FROM servicios WHERE id = ANY($1::int[])', [IDS_SERVICIOS]);
  await pool.query('DELETE FROM barberos WHERE id = $1', [ASESOR]);
};

const cuerpo = (extra = {}) => ({
  cliente: 'Cliente de prueba',
  correo: 'ana.reserva@example.com',
  telefono: '3001234567',
  consentimiento: true,
  fecha: FECHA,
  hora: '10:30',
  servicios_ids: [CORTE],
  barbero_id: 1,
  ...extra,
});

const reservar = (datos) => request(app).post('/api/citas').send(datos);
const contarCitas = async () => Number((await pool.query('SELECT COUNT(*) FROM citas')).rows[0].count);
const filasUsadas = async () => (await pool.query("SELECT jti, correo FROM verificaciones_usadas WHERE correo LIKE '%.reserva@example.com'")).rows;

beforeAll(async () => {
  await borrarDatosPrueba();
  await pool.query(`INSERT INTO barberos (id, nombre, cargo, especialidad, area) VALUES ($1, 'Asesora Reserva', 'Asesora de Imagen', 'Asesoria', 'asesoria')`, [ASESOR]);
  await pool.query(
    `INSERT INTO servicios (id, nombre, duracion_min, precio, tipo, descripcion, area, clave_seed) VALUES
       ($1, 'Asesoría reserva', 30, 60000, 'vip', 'x', 'asesoria', NULL),
       ($2, 'Corte reserva', 30, 20000, 'original', 'x', 'barberia', NULL),
       ($3, 'Asesoría gratis reserva', 15, 0, 'original', 'x', 'asesoria', 'asesoria-gratis')`,
    IDS_SERVICIOS
  );
});

beforeEach(async () => {
  await limpiar();
  await pool.query('UPDATE barberos SET area = $1, activo = true WHERE id IN (1, 2)', ['barberia']);
  reloj = new Date();
  configurarVerificacion({ ahora: () => reloj });
});

afterEach(async () => {
  await esperarNotificaciones();
  vi.unstubAllEnvs();
  restablecerVerificacion();
});

afterAll(borrarDatosPrueba);

describe('POST /api/citas exige el comprobante del correo', () => {
  it.each([[undefined], [null], ['']])('sin comprobante (%j) responde 400 VERIFICACION_REQUERIDA y no crea nada', async (valor) => {
    const res = await reservar(cuerpo({ verificacion_token: valor }));
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('VERIFICACION_REQUERIDA');
    expect(await contarCitas()).toBe(0);
  });

  it('con un comprobante válido crea la cita (201), la guarda con el correo normalizado y consume el comprobante', async () => {
    const { token, jti } = firmarComprobante('ana.reserva@example.com');
    const res = await reservar(cuerpo({ correo: '  Ana.RESERVA@Example.com ', verificacion_token: token }));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ cliente: 'Cliente de prueba', correo: 'ana.reserva@example.com', servicio_id: CORTE, estado: 'pendiente' });
    expect(await filasUsadas()).toEqual([{ jti, correo: 'ana.reserva@example.com' }]);
  });

  it('se comprueba antes de la lógica de la reserva: sin comprobante, un teléfono inválido da VERIFICACION_REQUERIDA', async () => {
    const res = await reservar(cuerpo({ telefono: '123', verificacion_token: undefined }));
    expect(res.body.codigo).toBe('VERIFICACION_REQUERIDA');
  });

  it('un correo inválido sigue dando 400 sin pedir comprobante', async () => {
    const res = await reservar(cuerpo({ correo: 'a@b.com,c.d', verificacion_token: undefined }));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('El correo no es válido');
  });

  it('un comprobante que no es texto da VERIFICACION_INVALIDA', async () => {
    for (const valor of [123, { a: 1 }, ['x'], true]) {
      const res = await reservar(cuerpo({ verificacion_token: valor }));
      expect(res.status).toBe(400);
      expect(res.body.codigo).toBe('VERIFICACION_INVALIDA');
    }
  });

  it('de otro correo: CORREO_NO_COINCIDE (y no se consume)', async () => {
    const res = await reservar(cuerpo({ verificacion_token: comprobanteDe('otra.persona.reserva@example.com') }));
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('CORREO_NO_COINCIDE');
    expect(await contarCitas()).toBe(0);
    expect(await filasUsadas()).toEqual([]);
  });

  it('el correo se compara EXACTO tras recortar y pasar a minúsculas: solo cambiar mayúsculas es el mismo correo', async () => {
    const res = await reservar(cuerpo({ correo: 'ANA.Reserva@EXAMPLE.COM', verificacion_token: comprobanteDe('ana.reserva@example.com') }));
    expect(res.status).toBe(201);
  });

  it('el +etiqueta y los puntos distinguen correos: ana+1 no coincide con ana', async () => {
    const res = await reservar(cuerpo({ correo: 'ana.reserva+1@example.com', verificacion_token: comprobanteDe('ana.reserva@example.com') }));
    expect(res.body.codigo).toBe('CORREO_NO_COINCIDE');
    const res2 = await reservar(cuerpo({ correo: 'ana.reserva@example.com', verificacion_token: comprobanteDe('anareserva@example.com') }));
    expect(res2.body.codigo).toBe('CORREO_NO_COINCIDE');
  });

  it('manipulado (firma alterada) da VERIFICACION_INVALIDA', async () => {
    const token = comprobanteDe('ana.reserva@example.com');
    const alterado = `${token.slice(0, -3)}${token.endsWith('AAA') ? 'BBB' : 'AAA'}`;
    const res = await reservar(cuerpo({ verificacion_token: alterado }));
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('VERIFICACION_INVALIDA');
  });

  it('con alg none da VERIFICACION_INVALIDA', async () => {
    const iat = Math.floor(Date.now() / 1000);
    const cabecera = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const carga = Buffer.from(
      JSON.stringify({ typ: 'email-verify', correo: 'ana.reserva@example.com', jti: 'x', iat, exp: iat + 1800, aud: 'black-iron-barbers:verificacion-correo', iss: 'black-iron-barbers' })
    ).toString('base64url');
    const res = await reservar(cuerpo({ verificacion_token: `${cabecera}.${carga}.` }));
    expect(res.body.codigo).toBe('VERIFICACION_INVALIDA');
  });

  it('expirado da VERIFICACION_EXPIRADA', async () => {
    const token = comprobanteDe('ana.reserva@example.com');
    reloj = new Date(reloj.getTime() + 31 * 60 * 1000);
    const res = await reservar(cuerpo({ verificacion_token: token }));
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('VERIFICACION_EXPIRADA');
  });

  it('con typ distinto (aunque la firma sea buena) da VERIFICACION_INVALIDA', async () => {
    const iat = Math.floor(reloj.getTime() / 1000);
    const token = jwt.sign({ typ: 'login', correo: 'ana.reserva@example.com', jti: 'y', iat, exp: iat + 1800 }, SECRETO_PRUEBA, {
      algorithm: 'HS256',
      audience: 'black-iron-barbers:verificacion-correo',
      issuer: 'black-iron-barbers',
    });
    const res = await reservar(cuerpo({ verificacion_token: token }));
    expect(res.body.codigo).toBe('VERIFICACION_INVALIDA');
  });

  it('con un JWT de login como comprobante da VERIFICACION_INVALIDA', async () => {
    const login = jwt.sign({ id: 1, usuario: 'admin', rol: 'admin', barbero_id: null, correo: 'ana.reserva@example.com' }, process.env.JWT_SECRET, { expiresIn: '8h' });
    const res = await reservar(cuerpo({ verificacion_token: login }));
    expect(res.body.codigo).toBe('VERIFICACION_INVALIDA');
  });

  it('sin el claim correo da VERIFICACION_INVALIDA', async () => {
    const iat = Math.floor(reloj.getTime() / 1000);
    const token = jwt.sign({ typ: 'email-verify', jti: 'z', iat, exp: iat + 1800 }, SECRETO_PRUEBA, {
      algorithm: 'HS256',
      audience: 'black-iron-barbers:verificacion-correo',
      issuer: 'black-iron-barbers',
    });
    const res = await reservar(cuerpo({ verificacion_token: token }));
    expect(res.body.codigo).toBe('VERIFICACION_INVALIDA');
  });

  it('un comprobante es de un solo uso: reutilizado en una segunda reserva da VERIFICACION_INVALIDA', async () => {
    const token = comprobanteDe('ana.reserva@example.com');
    expect((await reservar(cuerpo({ verificacion_token: token }))).status).toBe(201);
    const segunda = await reservar(cuerpo({ hora: '12:00', verificacion_token: token }));
    expect(segunda.status).toBe(400);
    expect(segunda.body.codigo).toBe('VERIFICACION_INVALIDA');
    expect(await contarCitas()).toBe(1);
    expect(await filasUsadas()).toHaveLength(1);
  });

  it('una reserva combinada usa UN solo comprobante para las dos citas', async () => {
    const res = await reservar(
      cuerpo({ servicios_ids: [ASESORIA, CORTE], asesor_id: ASESOR, hora: '11:00', verificacion_token: comprobanteDe('ana.reserva@example.com') })
    );
    expect(res.status).toBe(201);
    expect(res.body.citas).toHaveLength(2);
    expect(await contarCitas()).toBe(2);
    expect(await filasUsadas()).toHaveLength(1);
  });

  it('un 409 por horario ocupado NO consume el comprobante y sirve en el reintento', async () => {
    expect((await reservar(cuerpo({ correo: 'primero.reserva@example.com', verificacion_token: comprobanteDe('primero.reserva@example.com') }))).status).toBe(201);
    const token = comprobanteDe('ana.reserva@example.com');
    const choque = await reservar(cuerpo({ verificacion_token: token })); // mismo barbero y hora
    expect(choque.status).toBe(409);
    expect(await filasUsadas()).toHaveLength(1); // solo la primera
    const reintento = await reservar(cuerpo({ hora: '14:00', verificacion_token: token }));
    expect(reintento.status).toBe(201);
    expect(await filasUsadas()).toHaveLength(2);
  });

  it('con "cualquier barbero" y todos ocupados (409) tampoco se consume', async () => {
    for (const [i, barbero] of [1, 2].entries()) {
      const correo = `ocupa${i}.reserva@example.com`;
      expect((await reservar(cuerpo({ correo, barbero_id: barbero, verificacion_token: comprobanteDe(correo) }))).status).toBe(201);
    }
    const token = comprobanteDe('ana.reserva@example.com');
    const res = await reservar(cuerpo({ barbero_id: undefined, verificacion_token: token }));
    expect(res.status).toBe(409);
    expect((await filasUsadas()).map((fila) => fila.correo)).not.toContain('ana.reserva@example.com');
    expect((await reservar(cuerpo({ barbero_id: undefined, hora: '15:00', verificacion_token: token }))).status).toBe(201);
  });

  it('dos reservas en paralelo con el mismo comprobante: solo una se crea', async () => {
    const token = comprobanteDe('ana.reserva@example.com');
    const [a, b] = await Promise.all([
      reservar(cuerpo({ barbero_id: 1, hora: '10:00', verificacion_token: token })),
      reservar(cuerpo({ barbero_id: 2, hora: '11:00', verificacion_token: token })),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 400]);
    const perdedora = a.status === 400 ? a : b;
    expect(perdedora.body.codigo).toBe('VERIFICACION_INVALIDA');
    expect(await contarCitas()).toBe(1);
    expect(await filasUsadas()).toHaveLength(1);
  });

  it('muchas reservas en paralelo con el mismo comprobante: exactamente una', async () => {
    const token = comprobanteDe('ana.reserva@example.com');
    const horas = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00'];
    const respuestas = await Promise.all(horas.map((hora) => reservar(cuerpo({ hora, verificacion_token: token }))));
    expect(respuestas.filter((r) => r.status === 201)).toHaveLength(1);
    expect(respuestas.filter((r) => r.status === 400 && r.body.codigo === 'VERIFICACION_INVALIDA')).toHaveLength(5);
    expect(await contarCitas()).toBe(1);
  });

  it('asesoría gratuita ya usada (409) no consume el comprobante, que sirve para reservar otra cosa', async () => {
    const primera = await reservar(
      cuerpo({ servicios_ids: [GRATIS], asesor_id: ASESOR, barbero_id: undefined, verificacion_token: comprobanteDe('ana.reserva@example.com') })
    );
    expect(primera.status).toBe(201);

    // Misma persona (mismo teléfono) con otro correo verificado.
    const correo = 'otro.reserva@example.com';
    const token = comprobanteDe(correo);
    const repetida = await reservar(
      cuerpo({ correo, servicios_ids: [GRATIS], asesor_id: ASESOR, barbero_id: undefined, hora: '12:00', verificacion_token: token })
    );
    expect(repetida.status).toBe(409);
    expect(repetida.body.codigo).toBe('ASESORIA_GRATIS_YA_USADA');
    expect((await filasUsadas()).map((fila) => fila.correo)).toEqual(['ana.reserva@example.com']);

    const soloCorte = await reservar(cuerpo({ correo, hora: '13:00', verificacion_token: token }));
    expect(soloCorte.status).toBe(201);
    expect(await filasUsadas()).toHaveLength(2);
  });

  it('una combinada con la gratuita ya usada se revierte entera y no consume el comprobante', async () => {
    await reservar(cuerpo({ servicios_ids: [GRATIS], asesor_id: ASESOR, barbero_id: undefined, verificacion_token: comprobanteDe('ana.reserva@example.com') }));
    const antes = await contarCitas();
    const correo = 'tercero.reserva@example.com';
    const res = await reservar(
      cuerpo({ correo, servicios_ids: [GRATIS, CORTE], asesor_id: ASESOR, hora: '16:00', verificacion_token: comprobanteDe(correo) })
    );
    expect(res.status).toBe(409);
    expect(await contarCitas()).toBe(antes);
    expect((await filasUsadas()).map((fila) => fila.correo)).not.toContain(correo);
  });

  it('un 400 por validación posterior (servicio inexistente) tampoco consume el comprobante', async () => {
    const token = comprobanteDe('ana.reserva@example.com');
    const res = await reservar(cuerpo({ servicios_ids: [987654], verificacion_token: token }));
    expect(res.status).toBe(400);
    expect(await filasUsadas()).toEqual([]);
    expect((await reservar(cuerpo({ verificacion_token: token }))).status).toBe(201);
  });

  it('REQUIRE_EMAIL_VERIFICATION=false (solo fuera de producción) permite reservar sin comprobante', async () => {
    vi.stubEnv('REQUIRE_EMAIL_VERIFICATION', 'false');
    const res = await reservar(cuerpo({ verificacion_token: undefined }));
    expect(res.status).toBe(201);
    expect(await filasUsadas()).toEqual([]);
  });
});
