import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { crearApp } from '../app.js';
import { pool } from '../db/connection.js';
import { transporteMemoria } from '../utils/transporteCorreo.js';
import { esperarNotificaciones } from '../utils/notificaciones.js';
import {
  configurarVerificacion,
  restablecerVerificacion,
  hashCodigo,
  firmarComprobante,
  leerComprobante,
  MAX_INTENTOS,
} from '../utils/verificacionCorreo.js';
import { SECRETO_PRUEBA } from './verificacionPrueba.js';

// Solicitar y confirmar el código de verificación del correo, y el comprobante que resulta. Todo con el transporte EN
// MEMORIA (nunca sale un correo real) y con un reloj inyectable para los vencimientos. Correos *.verif@example.com.

const app = crearApp();
const transporte = transporteMemoria();
const CORREO = 'ana.verif@example.com';

const activarCorreo = (habilitado = true) => {
  vi.stubEnv('EMAIL_ENABLED', habilitado ? 'true' : 'false');
  vi.stubEnv('SMTP_HOST', 'smtp.invalid');
  vi.stubEnv('SMTP_PORT', '1025');
  vi.stubEnv('EMAIL_FROM', 'Black Iron Barbers <no-reply@example.com>');
};

let ahora = new Date('2030-07-17T15:00:00Z');
const avanzar = (segundos) => {
  ahora = new Date(ahora.getTime() + segundos * 1000);
};

const limpiar = async () => {
  await pool.query("DELETE FROM verificaciones_correo WHERE correo LIKE '%.verif@example.com'");
  await pool.query("DELETE FROM verificaciones_usadas WHERE correo LIKE '%.verif@example.com'");
};

const solicitar = (correo = CORREO) => request(app).post('/api/verificacion-correo/solicitar').send({ correo });
const confirmar = (codigo, correo = CORREO) => request(app).post('/api/verificacion-correo/confirmar').send({ correo, codigo });

const ultimoCodigo = () => {
  const envio = transporte.enviados.at(-1);
  return /C[óo]digo: (\d{6})/.exec(envio.opciones.text)[1];
};

// Pide un código y devuelve el que llegó por correo.
const pedirCodigo = async (correo = CORREO) => {
  const res = await solicitar(correo);
  expect(res.status).toBe(200);
  return ultimoCodigo();
};

const otroCodigo = (codigo) => (codigo === '123456' ? '654321' : '123456');

beforeAll(limpiar);

beforeEach(async () => {
  await limpiar();
  activarCorreo();
  transporte.vaciar();
  ahora = new Date('2030-07-17T15:00:00Z');
  configurarVerificacion({ ahora: () => ahora });
});

afterEach(async () => {
  await esperarNotificaciones();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  restablecerVerificacion();
});

afterAll(limpiar);

describe('POST /api/verificacion-correo/solicitar', () => {
  it('responde siempre lo mismo y no revela nada del correo', async () => {
    const a = await solicitar('uno.verif@example.com');
    const b = await solicitar('dos.verif@example.com');
    expect(a.status).toBe(200);
    expect(a.body).toEqual({ ok: true, reenviar_en_seg: 60 });
    expect(b.body).toEqual(a.body);
  });

  it('envía un correo con un código de 6 dígitos solo en el cuerpo, con vigencia y aviso de "si no fuiste tú"', async () => {
    await solicitar();
    expect(transporte.enviados).toHaveLength(1);
    const { opciones } = transporte.enviados[0];
    const codigo = ultimoCodigo();
    expect(codigo).toMatch(/^\d{6}$/);
    expect(opciones.to).toBe(CORREO);
    expect(opciones.subject).not.toContain(codigo);
    expect(opciones.text).toContain(codigo);
    expect(opciones.html).toContain(codigo);
    expect(opciones.text).toMatch(/10 minutos/);
    expect(opciones.text).toMatch(/ignora este mensaje/);
    expect(opciones.html).toMatch(/lang="es"/);
  });

  it('en la base solo se guarda el HMAC: el código en texto plano no aparece en ninguna columna', async () => {
    await solicitar();
    const codigo = ultimoCodigo();
    const { rows } = await pool.query('SELECT * FROM verificaciones_correo WHERE correo = $1', [CORREO]);
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows[0])).not.toContain(codigo);
    expect(rows[0].codigo_hash).toBe(hashCodigo(CORREO, codigo));
    expect(rows[0].codigo_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0].intentos).toBe(0);
    expect(rows[0].expira_en.getTime() - rows[0].creado_en.getTime()).toBe(10 * 60 * 1000);
  });

  it('normaliza el correo (recorte y minúsculas): es el mismo correo', async () => {
    await solicitar('  ANA.Verif@Example.com ');
    const { rows } = await pool.query('SELECT correo FROM verificaciones_correo WHERE correo LIKE $1', ['%.verif@example.com']);
    expect(rows.map((fila) => fila.correo)).toEqual([CORREO]);
  });

  it('un código nuevo invalida el anterior', async () => {
    const primero = await pedirCodigo();
    avanzar(61);
    const segundo = await pedirCodigo();
    expect((await confirmar(primero === segundo ? otroCodigo(primero) : primero)).body.codigo).toBe('CODIGO_INVALIDO');
    expect((await confirmar(segundo)).status).toBe(200);
  });

  it('un código nuevo marca el anterior como invalidado en la base', async () => {
    await solicitar();
    avanzar(61);
    await solicitar();
    const { rows } = await pool.query('SELECT invalidado_en FROM verificaciones_correo WHERE correo = $1 ORDER BY creado_en', [CORREO]);
    expect(rows).toHaveLength(2);
    expect(rows[0].invalidado_en).not.toBeNull();
    expect(rows[1].invalidado_en).toBeNull();
  });

  it('exige esperar 60 s entre solicitudes del mismo correo (429 con reintentar_en_seg) y no envía otro correo', async () => {
    await solicitar();
    avanzar(20);
    const res = await solicitar();
    expect(res.status).toBe(429);
    expect(res.body.codigo).toBe('ESPERA_REQUERIDA');
    expect(res.body.reintentar_en_seg).toBe(40);
    expect(transporte.enviados).toHaveLength(1);
    avanzar(41);
    expect((await solicitar()).status).toBe(200);
  });

  it('permite como máximo 5 códigos por hora por correo (429 con reintentar_en_seg) y se libera pasada la hora', async () => {
    for (let i = 0; i < 5; i += 1) {
      expect((await solicitar()).status, `solicitud ${i + 1}`).toBe(200);
      avanzar(61);
    }
    const res = await solicitar();
    expect(res.status).toBe(429);
    expect(res.body.codigo).toBe('LIMITE_CODIGOS_HORA');
    expect(res.body.reintentar_en_seg).toBeGreaterThan(0);
    expect(res.body.reintentar_en_seg).toBeLessThanOrEqual(3600);
    expect(transporte.enviados).toHaveLength(5);
    // Otro correo no se ve afectado.
    expect((await solicitar('otro.verif@example.com')).status).toBe(200);
    avanzar(3600);
    expect((await solicitar()).status).toBe(200);
  });

  it('los límites por correo viven en la base: tres solicitudes en paralelo del mismo correo envían un solo código', async () => {
    const respuestas = await Promise.all([solicitar(), solicitar(), solicitar()]);
    expect(respuestas.map((r) => r.status).sort()).toEqual([200, 429, 429]);
    expect(transporte.enviados).toHaveLength(1);
  });

  it.each([
    ['con coma', 'a@b.com,c.d'],
    ['con ángulo', 'x@y.com>'],
    ['con salto de línea', 'a@b.com\nBcc: x@y.com'],
    ['de más de 254 caracteres', `${'a'.repeat(60)}@${'d'.repeat(60)}.${'e'.repeat(60)}.${'f'.repeat(60)}.${'g'.repeat(60)}.com`],
    ['vacío', ''],
  ])('rechaza con 400 un correo %s y no envía nada', async (_, correo) => {
    const res = await solicitar(correo);
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('CORREO_INVALIDO');
    expect(transporte.enviados).toHaveLength(0);
  });

  it.each([[{ a: 1 }], [['a@b.com']], [123], [null], [true]])('rechaza con 400 un correo que no es texto (%j)', async (correo) => {
    const res = await request(app).post('/api/verificacion-correo/solicitar').send({ correo });
    expect(res.status).toBe(400);
  });

  it('sin cuerpo responde 400', async () => {
    expect((await request(app).post('/api/verificacion-correo/solicitar')).status).toBe(400);
  });

  it('si el envío falla responde 503 CORREO_NO_DISPONIBLE, no deja el código vivo y no gasta cupo del correo', async () => {
    transporte.fallar = new Error('SMTP caído para ana.verif@example.com');
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await solicitar();
    expect(res.status).toBe(503);
    expect(res.body.codigo).toBe('CORREO_NO_DISPONIBLE');
    expect((await pool.query('SELECT 1 FROM verificaciones_correo WHERE correo = $1', [CORREO])).rowCount).toBe(0);
    // El registro lleva el correo enmascarado, nunca completo.
    const registrado = aviso.mock.calls.flat().join(' ');
    expect(registrado).toContain('a***@example.com');
    expect(registrado).not.toContain(CORREO);
    transporte.fallar = null;
    expect((await solicitar()).status).toBe(200); // sin esperar 60 s
  });

  it('con el correo apagado (EMAIL_ENABLED=false) responde 503: no se puede verificar sin enviar', async () => {
    activarCorreo(false);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await solicitar();
    expect(res.status).toBe(503);
    expect(res.body.codigo).toBe('CORREO_NO_DISPONIBLE');
  });

  it('borra de forma perezosa los códigos vencidos hace más de un día', async () => {
    await solicitar('viejo.verif@example.com');
    avanzar(24 * 3600 + 11 * 60);
    await solicitar();
    const { rows } = await pool.query("SELECT 1 FROM verificaciones_correo WHERE correo = 'viejo.verif@example.com'");
    expect(rows).toHaveLength(0);
  });

  it('ningún log contiene el código ni el correo completo', async () => {
    const espias = ['log', 'warn', 'error', 'info'].map((nivel) => vi.spyOn(console, nivel).mockImplementation(() => {}));
    const codigo = await pedirCodigo();
    await confirmar(otroCodigo(codigo));
    const ok = await confirmar(codigo);
    const todo = espias.flatMap((espia) => espia.mock.calls.flat()).join('\n');
    expect(todo).not.toContain(codigo);
    expect(todo).not.toContain(ok.body.token);
    expect(todo).not.toContain(CORREO);
  });
});

describe('POST /api/verificacion-correo/confirmar', () => {
  it('con el código correcto devuelve un comprobante firmado de ese correo', async () => {
    const codigo = await pedirCodigo();
    const res = await confirmar(codigo);
    expect(res.status).toBe(200);
    expect(res.body.expira_en_seg).toBe(1800);
    expect(Object.keys(res.body).sort()).toEqual(['expira_en_seg', 'token']);
    expect(leerComprobante(res.body.token)).toMatchObject({ ok: true, correo: CORREO });
    const datos = jwt.decode(res.body.token);
    expect(datos).toMatchObject({ typ: 'email-verify', correo: CORREO, iss: 'black-iron-barbers' });
    expect(datos.aud).toBe('black-iron-barbers:verificacion-correo');
    expect(datos.exp - datos.iat).toBe(1800);
    expect(datos.jti).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('acepta el correo con otras mayúsculas o espacios (se normaliza)', async () => {
    const codigo = await pedirCodigo();
    const res = await confirmar(codigo, '  ANA.verif@EXAMPLE.com ');
    expect(res.status).toBe(200);
    expect(leerComprobante(res.body.token).correo).toBe(CORREO);
  });

  it('un código incorrecto da CODIGO_INVALIDO y cuenta un intento', async () => {
    const codigo = await pedirCodigo();
    const res = await confirmar(otroCodigo(codigo));
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('CODIGO_INVALIDO');
    expect((await pool.query('SELECT intentos FROM verificaciones_correo WHERE correo = $1', [CORREO])).rows[0].intentos).toBe(1);
  });

  it('un código vencido (10 min) da CODIGO_INVALIDO', async () => {
    const codigo = await pedirCodigo();
    avanzar(10 * 60 + 1);
    const res = await confirmar(codigo);
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('CODIGO_INVALIDO');
  });

  it('un código ya usado no sirve otra vez', async () => {
    const codigo = await pedirCodigo();
    expect((await confirmar(codigo)).status).toBe(200);
    const otra = await confirmar(codigo);
    expect(otra.status).toBe(400);
    expect(otra.body.codigo).toBe('CODIGO_INVALIDO');
  });

  it('tras 5 intentos fallidos el código queda invalidado aunque luego se envíe el correcto', async () => {
    const codigo = await pedirCodigo();
    for (let i = 0; i < MAX_INTENTOS; i += 1) expect((await confirmar(otroCodigo(codigo))).status).toBe(400);
    const res = await confirmar(codigo);
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('CODIGO_INVALIDO');
    expect((await pool.query('SELECT intentos FROM verificaciones_correo WHERE correo = $1', [CORREO])).rows[0].intentos).toBe(MAX_INTENTOS);
  });

  it('el quinto intento todavía puede ser el correcto', async () => {
    const codigo = await pedirCodigo();
    for (let i = 0; i < MAX_INTENTOS - 1; i += 1) await confirmar(otroCodigo(codigo));
    expect((await confirmar(codigo)).status).toBe(200);
  });

  it('10 confirmaciones incorrectas EN PARALELO nunca superan el máximo de 5 intentos', async () => {
    const codigo = await pedirCodigo();
    const respuestas = await Promise.all(Array.from({ length: 10 }, () => confirmar(otroCodigo(codigo))));
    expect(respuestas.every((r) => r.status === 400 && r.body.codigo === 'CODIGO_INVALIDO')).toBe(true);
    expect((await pool.query('SELECT intentos FROM verificaciones_correo WHERE correo = $1', [CORREO])).rows[0].intentos).toBe(MAX_INTENTOS);
    expect((await confirmar(codigo)).status).toBe(400); // y el correcto ya no entra
  });

  it('compara el código con timingSafeEqual en todos los casos (también sin código pedido), nunca con ===', async () => {
    const espia = vi.spyOn(crypto, 'timingSafeEqual');
    const codigo = await pedirCodigo();
    await confirmar(otroCodigo(codigo)); // incorrecto
    await confirmar('123456', 'nadie.verif@example.com'); // sin código pedido
    await confirmar(codigo); // correcto
    expect(espia).toHaveBeenCalledTimes(3);
  });

  it('tres confirmaciones correctas en paralelo: solo una obtiene comprobante', async () => {
    const codigo = await pedirCodigo();
    const respuestas = await Promise.all([confirmar(codigo), confirmar(codigo), confirmar(codigo)]);
    expect(respuestas.map((r) => r.status).sort()).toEqual([200, 400, 400]);
  });

  it('el error es el mismo (status y cuerpo) para código inexistente, vencido, incorrecto y ya usado', async () => {
    const respuestas = [];
    respuestas.push(await confirmar('123456', 'nadie.verif@example.com')); // sin código pedido
    const vencido = await pedirCodigo('venc.verif@example.com');
    avanzar(11 * 60);
    respuestas.push(await confirmar(vencido, 'venc.verif@example.com'));
    const codigo = await pedirCodigo();
    respuestas.push(await confirmar(otroCodigo(codigo)));
    await confirmar(codigo);
    respuestas.push(await confirmar(codigo));
    for (const respuesta of respuestas) {
      expect(respuesta.status).toBe(400);
      expect(respuesta.body).toEqual(respuestas[0].body);
    }
    expect(respuestas[0].body.codigo).toBe('CODIGO_INVALIDO');
  });

  it.each([
    ['con 5 dígitos', '12345'],
    ['con 7 dígitos', '1234567'],
    ['con letras', '12a456'],
    ['con espacios', '123 56'],
    ['como número', 123456],
    ['como objeto', { $gt: '' }],
    ['como arreglo', ['123456']],
    ['nulo', null],
    ['vacío', ''],
  ])('rechaza con 400 un código %s sin gastar intentos', async (_, codigo) => {
    await pedirCodigo();
    const res = await request(app).post('/api/verificacion-correo/confirmar').send({ correo: CORREO, codigo });
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('CODIGO_FORMATO_INVALIDO');
    expect((await pool.query('SELECT intentos FROM verificaciones_correo WHERE correo = $1', [CORREO])).rows[0].intentos).toBe(0);
  });

  it('rechaza con 400 un correo inválido o que no es texto', async () => {
    for (const correo of ['a@b.com,c.d', { a: 1 }, ['a@b.com'], 5, undefined]) {
      const res = await request(app).post('/api/verificacion-correo/confirmar').send({ correo, codigo: '123456' });
      expect(res.status).toBe(400);
      expect(res.body.codigo).toBe('CORREO_INVALIDO');
    }
  });

  it('un código de un correo no sirve para otro', async () => {
    const codigo = await pedirCodigo();
    await pedirCodigo('otra.verif@example.com');
    expect((await confirmar(codigo, 'otra.verif@example.com')).status).toBe(400);
  });
});

describe('El comprobante', () => {
  const firmar = (carga, opciones = {}, secreto = SECRETO_PRUEBA) => jwt.sign(carga, secreto, opciones);
  const base = () => {
    const iat = Math.floor(ahora.getTime() / 1000);
    return { typ: 'email-verify', correo: CORREO, jti: 'jti-de-prueba', iat, exp: iat + 1800 };
  };
  const opciones = { algorithm: 'HS256', audience: 'black-iron-barbers:verificacion-correo', issuer: 'black-iron-barbers' };

  it('uno bien formado se acepta', () => {
    expect(leerComprobante(firmar(base(), opciones))).toEqual({ ok: true, correo: CORREO, jti: 'jti-de-prueba' });
    expect(leerComprobante(firmarComprobante(CORREO).token)).toMatchObject({ ok: true, correo: CORREO });
  });

  it('dos comprobantes del mismo correo tienen jti distinto', () => {
    expect(firmarComprobante(CORREO).jti).not.toBe(firmarComprobante(CORREO).jti);
  });

  it('con la firma alterada se rechaza', () => {
    const token = firmar(base(), opciones);
    const alterado = `${token.slice(0, -3)}${token.endsWith('AAA') ? 'BBB' : 'AAA'}`;
    expect(leerComprobante(alterado)).toEqual({ ok: false, codigo: 'VERIFICACION_INVALIDA' });
  });

  it('con el contenido alterado (otro correo) se rechaza', () => {
    const [cabecera, , firma] = firmar(base(), opciones).split('.');
    const carga = Buffer.from(JSON.stringify({ ...base(), correo: 'otro@example.com', aud: opciones.audience, iss: opciones.issuer })).toString('base64url');
    expect(leerComprobante(`${cabecera}.${carga}.${firma}`).ok).toBe(false);
  });

  it('con alg none se rechaza (con y sin firma)', () => {
    const cabecera = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const carga = Buffer.from(JSON.stringify({ ...base(), aud: opciones.audience, iss: opciones.issuer })).toString('base64url');
    expect(leerComprobante(`${cabecera}.${carga}.`).ok).toBe(false);
    expect(leerComprobante(`${cabecera}.${carga}.abc`).ok).toBe(false);
  });

  it('firmado con otro algoritmo (HS512) se rechaza', () => {
    expect(leerComprobante(firmar(base(), { ...opciones, algorithm: 'HS512' }))).toEqual({ ok: false, codigo: 'VERIFICACION_INVALIDA' });
  });

  it('firmado con otro secreto se rechaza', () => {
    expect(leerComprobante(firmar(base(), opciones, 'otro-secreto-distinto-de-treinta-y-dos-caracteres')).ok).toBe(false);
  });

  it('expirado se rechaza como VERIFICACION_EXPIRADA', () => {
    const token = firmarComprobante(CORREO).token;
    avanzar(1801);
    expect(leerComprobante(token)).toEqual({ ok: false, codigo: 'VERIFICACION_EXPIRADA' });
  });

  it('con otro typ, sin typ, sin aud, con otra aud, sin iss o sin correo/jti se rechaza', () => {
    const casos = [
      firmar({ ...base(), typ: 'login' }, opciones),
      firmar({ ...base(), typ: undefined }, opciones),
      firmar(base(), { algorithm: 'HS256', issuer: opciones.issuer }),
      firmar(base(), { ...opciones, audience: 'otra-audiencia' }),
      firmar(base(), { algorithm: 'HS256', audience: opciones.audience }),
      firmar({ ...base(), correo: undefined }, opciones),
      firmar({ ...base(), correo: 123 }, opciones),
      firmar({ ...base(), jti: undefined }, opciones),
    ];
    for (const token of casos) expect(leerComprobante(token), token).toEqual({ ok: false, codigo: 'VERIFICACION_INVALIDA' });
  });

  it('un JWT de login NO sirve como comprobante (ni firmado con el secreto de la verificación)', () => {
    const login = jwt.sign({ id: 1, usuario: 'admin', rol: 'admin', barbero_id: null }, process.env.JWT_SECRET, { expiresIn: '8h' });
    expect(leerComprobante(login).ok).toBe(false);
    const loginConOtroSecreto = jwt.sign({ id: 1, usuario: 'admin', rol: 'admin', barbero_id: null }, SECRETO_PRUEBA, { expiresIn: '8h' });
    expect(leerComprobante(loginConOtroSecreto).ok).toBe(false);
  });

  it('un comprobante NO sirve como token de login', async () => {
    const { token } = firmarComprobante(CORREO);
    expect((await request(app).get('/api/auth/sesion').set('Authorization', `Bearer ${token}`)).status).toBe(401);
    expect((await request(app).get('/api/citas').set('Authorization', `Bearer ${token}`)).status).toBe(401);
  });

  it.each([[undefined], [null], [''], [123], [{}], [['x']], ['a.b.c'], ['x'.repeat(5000)]])('un valor basura (%j) se rechaza', (valor) => {
    expect(leerComprobante(valor).ok).toBe(false);
  });
});

describe('Límites por IP (forzados con un límite bajo)', () => {
  it('las solicitudes y las confirmaciones responden 429 DEMASIADOS_INTENTOS pasado el límite de la IP', async () => {
    vi.resetModules();
    vi.stubEnv('FORZAR_RATE_LIMIT_PRUEBA', 'true');
    vi.stubEnv('LIMITE_VERIF_SOLICITAR_IP_RATE', '2');
    vi.stubEnv('LIMITE_VERIF_CONFIRMAR_IP_RATE', '3');
    const { crearApp: crearAppNueva } = await import('../app.js');
    const appLimitada = crearAppNueva();

    const estadosSolicitar = [];
    let ultima;
    for (const correo of ['ip1.verif@example.com', 'ip2.verif@example.com', 'ip3.verif@example.com', 'ip4.verif@example.com']) {
      ultima = await request(appLimitada).post('/api/verificacion-correo/solicitar').send({ correo });
      estadosSolicitar.push(ultima.status);
    }
    expect(estadosSolicitar).toEqual([200, 200, 429, 429]);
    expect(ultima.body).toMatchObject({ codigo: 'DEMASIADOS_INTENTOS' });
    expect(ultima.body.reintentar_en_seg).toBeGreaterThan(0);

    const estadosConfirmar = [];
    for (let i = 0; i < 5; i += 1) {
      const res = await request(appLimitada).post('/api/verificacion-correo/confirmar').send({ correo: 'ip1.verif@example.com', codigo: '000000' });
      estadosConfirmar.push(res.status);
    }
    expect(estadosConfirmar).toEqual([400, 400, 400, 429, 429]);
  });
});
