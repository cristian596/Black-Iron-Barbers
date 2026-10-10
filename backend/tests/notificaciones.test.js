import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearApp } from '../app.js';
import { pool } from '../db/connection.js';
import { firmarToken, insertarCita, reiniciarContador } from './utilsPrueba.js';
import { hoyISO } from '../utils/fechas.js';
import { DIRECCION_NEGOCIO, NOMBRE_NEGOCIO } from '../config/negocio.js';
import { leerConfigCorreo } from '../config/correo.js';
import { transporteMemoria } from '../utils/transporteCorreo.js';
import { configurarNotificaciones, restablecerNotificaciones, esperarNotificaciones, notificarCitasCreadas } from '../utils/notificaciones.js';
import { construirIcs, escaparTextoIcs, plegarLinea, instanteDeBogota } from '../utils/ics.js';
import { correoSeguro, enmascararCorreo, escaparHtml, limpiarLinea } from '../utils/plantillasCorreo.js';

// Correos de citas (backend). Todo con el transporte EN MEMORIA: nunca sale un correo real. Ids 95xx.
// 2030-07-17 es miércoles.

const app = crearApp();
const transporte = transporteMemoria();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FECHA = '2030-07-17';
const ASESOR = 9501;
const ASES_A = 9501; // asesoría 30 min, $60.000
const CORTE = 9502; // 30 min, $20.000
const GRATIS = 9503; // asesoría gratis 15 min
const IDS_SERVICIOS = [ASES_A, CORTE, GRATIS];

const CORREOS_PROFESIONALES = { 1: 'barbero1@example.com', 2: 'barbero2@example.com', [ASESOR]: 'asesor@example.com' };

const activarCorreo = (habilitado = true) => {
  vi.stubEnv('EMAIL_ENABLED', habilitado ? 'true' : 'false');
  vi.stubEnv('SMTP_HOST', 'smtp.invalid');
  vi.stubEnv('SMTP_PORT', '1025');
  vi.stubEnv('EMAIL_FROM', 'Black Iron Barbers <no-reply@example.com>');
};

const borrarDatosPrueba = async () => {
  await pool.query('TRUNCATE citas RESTART IDENTITY CASCADE');
  await pool.query("DELETE FROM usuarios WHERE usuario LIKE 'prueba_correo_%'");
  await pool.query('DELETE FROM servicios WHERE id = ANY($1::int[])', [IDS_SERVICIOS]);
  await pool.query('DELETE FROM barberos WHERE id = $1', [ASESOR]);
};

const tokenDe = async (barberoId) => {
  const { rows } = await pool.query(
    `INSERT INTO usuarios (usuario, contrasena, rol, barbero_id, activo) VALUES ($1, 'no-se-usa', 'barbero', $2, true)
     ON CONFLICT (usuario) DO UPDATE SET activo = true RETURNING id`,
    [`prueba_correo_${barberoId}`, barberoId]
  );
  return jwt.sign({ id: rows[0].id, usuario: `prueba_correo_${barberoId}`, rol: 'barbero', barbero_id: barberoId }, process.env.JWT_SECRET, {
    expiresIn: '1h',
  });
};

beforeAll(async () => {
  await borrarDatosPrueba();
  await pool.query(`INSERT INTO barberos (id, nombre, cargo, especialidad, area) VALUES ($1, 'Asesora Correo', 'Asesora de Imagen', 'Asesoria', 'asesoria')`, [ASESOR]);
  await pool.query(
    `INSERT INTO servicios (id, nombre, duracion_min, precio, tipo, descripcion, area, clave_seed) VALUES
       ($1, 'Asesoría correo', 30, 60000, 'vip', 'x', 'asesoria', NULL),
       ($2, 'Corte correo', 30, 20000, 'original', 'x', 'barberia', NULL),
       ($3, 'Asesoría gratis correo', 15, 0, 'original', 'x', 'asesoria', 'asesoria-gratis')`,
    IDS_SERVICIOS
  );
});

beforeEach(async () => {
  reiniciarContador();
  await pool.query('TRUNCATE citas RESTART IDENTITY CASCADE');
  await pool.query('UPDATE barberos SET area = $1, activo = true WHERE id IN (1, 2)', ['barberia']);
  activarCorreo();
  transporte.vaciar();
  configurarNotificaciones({ resolverCorreoProfesional: async (id) => CORREOS_PROFESIONALES[id] ?? null });
});

afterEach(async () => {
  await esperarNotificaciones();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  restablecerNotificaciones();
});

afterAll(async () => {
  await borrarDatosPrueba();
});

const reservar = (extra = {}) =>
  request(app)
    .post('/api/citas')
    .send({
      cliente: 'Cliente de prueba',
      correo: 'cliente@example.com',
      telefono: '3001234567',
      consentimiento: true,
      fecha: FECHA,
      hora: '10:30',
      servicios_ids: [CORTE],
      barbero_id: 1,
      ...extra,
    });

const enviadosA = (correo) => transporte.enviados.filter((envio) => envio.opciones.to === correo);
const adjunto = (envio) => envio.opciones.attachments[0].content;
const cabeceras = (envio) => envio.crudo.split(/\r\n\r\n/)[0];
const valorIcs = (ics, propiedad) => [...ics.matchAll(new RegExp(`^${propiedad}:(.*)$`, 'gm'))].map((m) => m[1].trim());

describe('cita creada', () => {
  it('simple: un correo al cliente (servicio, profesional, hora de Bogotá, dirección, ICS) y un aviso al profesional', async () => {
    const res = await reservar();
    expect(res.status).toBe(201);
    await esperarNotificaciones();

    expect(transporte.enviados).toHaveLength(2);
    const [cliente] = enviadosA('cliente@example.com');
    expect(cliente.opciones.from).toBe('Black Iron Barbers <no-reply@example.com>');
    expect(cliente.opciones.subject).toContain('confirmada');
    for (const cuerpo of [cliente.opciones.text, cliente.opciones.html]) {
      expect(cuerpo).toContain('Corte correo');
      expect(cuerpo).toContain('30 min');
      expect(cuerpo).toContain('$20.000');
      expect(cuerpo).toContain('Barbero Uno');
      expect(cuerpo).toContain('miércoles 17 de julio de 2030, 10:30 a. m.');
      expect(cuerpo).toContain(DIRECCION_NEGOCIO);
      expect(cuerpo).toContain(NOMBRE_NEGOCIO);
    }
    expect(cliente.opciones.text).not.toContain('3001234567');

    const ics = adjunto(cliente);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('METHOD:PUBLISH');
    expect(valorIcs(ics, 'DTSTART')).toEqual(['20300717T153000Z']); // 10:30 en Bogotá (UTC-5)
    expect(valorIcs(ics, 'DTEND')).toEqual(['20300717T160000Z']);
    expect(valorIcs(ics, 'UID')).toHaveLength(1);
    expect(valorIcs(ics, 'SEQUENCE')).toEqual(['0']);
    expect(ics.split('\n').every((linea) => linea === '' || linea.endsWith('\r'))).toBe(true);
    expect(cliente.crudo).toContain('text/calendar');

    const [aviso] = enviadosA('barbero1@example.com');
    expect(aviso.opciones.subject).toContain('Cliente de prueba');
    expect(aviso.opciones.text).toContain('miércoles 17 de julio de 2030, 10:30 a. m.');
    expect(aviso.opciones.text).not.toContain('cliente@example.com');
    expect(aviso.opciones.text).not.toContain('3001234567');
  });

  it('combinada: UN correo al cliente con las dos citas y un ICS de 2 eventos; un aviso a cada profesional', async () => {
    const res = await reservar({ servicios_ids: [ASES_A, CORTE], asesor_id: ASESOR, barbero_id: 1, hora: '11:00' });
    expect(res.status).toBe(201);
    expect(res.body.citas).toHaveLength(2);
    await esperarNotificaciones();

    expect(transporte.enviados).toHaveLength(3);
    const paraCliente = enviadosA('cliente@example.com');
    expect(paraCliente).toHaveLength(1);
    const { text } = paraCliente[0].opciones;
    expect(text).toContain('Asesoría correo');
    expect(text).toContain('Corte correo');
    expect(text).toContain('Asesora Correo');
    expect(text).toContain('Barbero Uno');
    expect(text).toContain('11:00 a. m.');
    expect(text).toContain('11:30 a. m.');
    expect(text).toContain('Total: 60 min · $80.000');

    const ics = adjunto(paraCliente[0]);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(new Set(valorIcs(ics, 'UID')).size).toBe(2);

    expect(enviadosA('asesor@example.com')).toHaveLength(1);
    expect(enviadosA('barbero1@example.com')).toHaveLength(1);
  });

  it('asesoría gratuita: se muestra con precio $0', async () => {
    const res = await reservar({ servicios_ids: [GRATIS], asesor_id: ASESOR, barbero_id: undefined, hora: '12:00' });
    expect(res.status).toBe(201);
    await esperarNotificaciones();

    const [cliente] = enviadosA('cliente@example.com');
    expect(cliente.opciones.text).toContain('Asesoría gratis correo · 15 min · $0 · Asesoría gratuita');
    expect(cliente.opciones.html).toContain('$0');
    expect(cliente.opciones.text).toContain('Total: 15 min · $0');
  });
});

describe('otros eventos', () => {
  it('cancelar: aviso al cliente con ICS METHOD:CANCEL (mismo UID, SEQUENCE mayor) y al profesional', async () => {
    const creada = await reservar();
    await esperarNotificaciones();
    const uid = valorIcs(adjunto(enviadosA('cliente@example.com')[0]), 'UID')[0];
    transporte.vaciar();

    const res = await request(app)
      .patch(`/api/citas/${creada.body.id}`)
      .set('Authorization', `Bearer ${await tokenDe(1)}`)
      .send({ estado: 'cancelada' });
    expect(res.status).toBe(200);
    await esperarNotificaciones();

    expect(transporte.enviados).toHaveLength(2);
    const [cliente] = enviadosA('cliente@example.com');
    expect(cliente.opciones.subject).toContain('cancelada');
    expect(cliente.opciones.text).toContain('Barbero Uno');
    const ics = adjunto(cliente);
    expect(ics).toContain('METHOD:CANCEL');
    expect(ics).toContain('STATUS:CANCELLED');
    expect(valorIcs(ics, 'UID')).toEqual([uid]);
    expect(Number(valorIcs(ics, 'SEQUENCE')[0])).toBeGreaterThan(0);
    expect(enviadosA('barbero1@example.com')).toHaveLength(1);

    // Repetir 'cancelada' es inocuo y no vuelve a avisar.
    transporte.vaciar();
    const repetida = await request(app)
      .patch(`/api/citas/${creada.body.id}`)
      .set('Authorization', `Bearer ${await tokenDe(1)}`)
      .send({ estado: 'cancelada' });
    expect(repetida.status).toBe(200);
    await esperarNotificaciones();
    expect(transporte.enviados).toHaveLength(0);
  });

  it('cambio de profesional: avisa al cliente, al anterior y al nuevo, con SEQUENCE mayor y el mismo UID', async () => {
    const creada = await reservar();
    await esperarNotificaciones();
    const icsInicial = adjunto(enviadosA('cliente@example.com')[0]);
    transporte.vaciar();

    const res = await request(app)
      .patch(`/api/citas/${creada.body.id}`)
      .set('Authorization', `Bearer ${firmarToken('admin')}`)
      .send({ barbero_id: 2 });
    expect(res.status).toBe(200);
    await esperarNotificaciones();

    expect(transporte.enviados).toHaveLength(3);
    const [cliente] = enviadosA('cliente@example.com');
    expect(cliente.opciones.text).toContain('Barbero Dos');
    expect(cliente.opciones.text).toContain('antes: Barbero Uno');
    const ics = adjunto(cliente);
    expect(ics).toContain('METHOD:PUBLISH');
    expect(valorIcs(ics, 'UID')).toEqual(valorIcs(icsInicial, 'UID'));
    expect(Number(valorIcs(ics, 'SEQUENCE')[0])).toBeGreaterThan(Number(valorIcs(icsInicial, 'SEQUENCE')[0]));
    expect(enviadosA('barbero1@example.com')[0].opciones.subject).toContain('reasignada');
    expect(enviadosA('barbero2@example.com')[0].opciones.subject).toContain('cita nueva');
  });

  it('reasignar al mismo profesional no envía nada', async () => {
    const creada = await reservar();
    await esperarNotificaciones();
    transporte.vaciar();
    const res = await request(app)
      .patch(`/api/citas/${creada.body.id}`)
      .set('Authorization', `Bearer ${firmarToken('admin')}`)
      .send({ barbero_id: 1 });
    expect(res.status).toBe(200);
    await esperarNotificaciones();
    expect(transporte.enviados).toHaveLength(0);
  });

  it('completar no envía nada', async () => {
    const id = await insertarCita({ fecha: hoyISO(), estado: 'pendiente', barbero_id: 1, hora: '10:00' });
    const res = await request(app)
      .patch(`/api/citas/${id}`)
      .set('Authorization', `Bearer ${await tokenDe(1)}`)
      .send({ estado: 'completada' });
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('completada');
    await esperarNotificaciones();
    expect(transporte.enviados).toHaveLength(0);
  });
});

describe('robustez', () => {
  it('si el transporte falla, la API responde igual, la cita queda guardada y el fallo se registra con el correo enmascarado', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    transporte.fallar = new Error('SMTP caído: rechazó a cliente@example.com');

    const res = await reservar();
    expect(res.status).toBe(201);
    expect(res.body.cliente).toBe('Cliente de prueba');
    await expect(esperarNotificaciones()).resolves.toBeUndefined();

    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM citas');
    expect(rows[0].n).toBe(1);
    expect(transporte.enviados).toHaveLength(0);

    const registro = aviso.mock.calls.map((llamada) => llamada.join(' ')).join('\n');
    expect(registro).toContain('c***@example.com');
    expect(registro).not.toContain('cliente@example.com');
  });

  it('un fallo al cancelar tampoco cambia la respuesta', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const creada = await reservar();
    await esperarNotificaciones();
    transporte.fallar = new Error('SMTP caído');
    const res = await request(app)
      .patch(`/api/citas/${creada.body.id}`)
      .set('Authorization', `Bearer ${await tokenDe(1)}`)
      .send({ estado: 'cancelada' });
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('cancelada');
    await expect(esperarNotificaciones()).resolves.toBeUndefined();
  });

  it('con EMAIL_ENABLED=false no envía nada', async () => {
    activarCorreo(false);
    const res = await reservar();
    expect(res.status).toBe(201);
    await esperarNotificaciones();
    expect(transporte.enviados).toHaveLength(0);
  });

  // MODIFICADO (verificación de correo): el validador único ya rechaza estos correos en POST /api/citas con 400, así que la
  // reserva ni se crea ni envía nada. La defensa de las plantillas (correoSeguro) se conserva y se prueba abajo con una
  // fila escrita directo en la base, como la barrera final por si algún día entrara un dato así por otra vía.
  it('un correo del cliente que no es una sola dirección simple se rechaza al reservar y no envía nada', async () => {
    for (const correo of ['victima@example.com,otro.com', 'a@b.com;c.d', 'x@y.com>']) {
      transporte.vaciar();
      await pool.query('TRUNCATE citas RESTART IDENTITY CASCADE');
      const res = await reservar({ correo, servicios_ids: [CORTE], barbero_id: 2 });
      expect(res.status, JSON.stringify([correo, res.body])).toBe(400);
      await esperarNotificaciones();
      expect(transporte.enviados).toHaveLength(0);
    }
  });

  it('defensa en profundidad: aunque una fila trajera un correo con varias direcciones, no se le envía nada', async () => {
    for (const correo of ['victima@example.com,otro.com', 'a@b.com;c.d', 'x@y.com>']) {
      transporte.vaciar();
      await pool.query('TRUNCATE citas RESTART IDENTITY CASCADE');
      const id = await insertarCita({ fecha: FECHA, estado: 'pendiente', barbero_id: 2, hora: '10:30' });
      await pool.query('UPDATE citas SET correo = $2 WHERE id = $1', [id, correo]);
      notificarCitasCreadas([id]);
      await esperarNotificaciones();
      // Solo el aviso del profesional; ningún mensaje lleva esa dirección como destinatario.
      expect(transporte.enviados).toHaveLength(1);
      expect(transporte.enviados[0].opciones.to).toBe('barbero2@example.com');
    }
  });

  it('con un nombre de cliente con HTML, el HTML sale escapado y no ejecutable', async () => {
    const nombre = '<script>alert("x")</script> O\'Brien & "Hijos"';
    const res = await reservar({ cliente: nombre });
    expect(res.status).toBe(201);
    await esperarNotificaciones();

    for (const envio of transporte.enviados) {
      expect(envio.opciones.html).not.toContain('<script>');
      expect(envio.opciones.html).not.toContain('alert("x")');
    }
    const [cliente] = enviadosA('cliente@example.com');
    expect(cliente.opciones.html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(cliente.opciones.html).toContain('O&#39;Brien &amp; &quot;Hijos&quot;');
  });

  it('con saltos de línea y un Bcc: en el nombre, no se crea ninguna cabecera extra', async () => {
    const res = await reservar({ cliente: 'Eve\r\nBcc: victima@example.com\r\nSubject: hackeado' });
    expect(res.status).toBe(201);
    await esperarNotificaciones();

    expect(transporte.enviados.length).toBeGreaterThan(0);
    for (const envio of transporte.enviados) {
      const { to, subject, from } = envio.opciones;
      for (const valor of [to, subject, from]) expect(valor).not.toMatch(/[\r\n]/);
      expect(envio.opciones.bcc).toBeUndefined();
      const lineas = cabeceras(envio).split('\r\n').filter((linea) => !/^\s/.test(linea));
      expect(lineas.filter((linea) => /^bcc:/i.test(linea))).toHaveLength(0);
      expect(lineas.filter((linea) => /^subject:/i.test(linea))).toHaveLength(1);
    }
    const aviso = enviadosA('barbero1@example.com')[0];
    expect(aviso.opciones.subject).toContain('Eve Bcc: victima@example.com');
  });

  it('una cita a las 19:30 de Bogotá no cambia de día ni de hora en el texto ni en el ICS', async () => {
    const res = await reservar({ hora: '19:00', servicios_ids: [CORTE] });
    expect(res.status).toBe(201);
    await esperarNotificaciones();
    transporte.vaciar();
    await pool.query('TRUNCATE citas RESTART IDENTITY CASCADE');

    const tarde = await reservar({ hora: '19:30' });
    expect(tarde.status).toBe(201);
    await esperarNotificaciones();

    const [cliente] = enviadosA('cliente@example.com');
    expect(cliente.opciones.text).toContain('miércoles 17 de julio de 2030, 7:30 p. m.');
    expect(cliente.opciones.text).not.toContain('18 de julio');
    expect(cliente.opciones.html).toContain('7:30 p. m.');
    const ics = adjunto(cliente);
    expect(valorIcs(ics, 'DTSTART')).toEqual(['20300718T003000Z']); // 19:30 Bogotá = 00:30 UTC del día siguiente
    expect(valorIcs(ics, 'DTEND')).toEqual(['20300718T010000Z']);
  });
});

describe('piezas', () => {
  it('escapa y sanea', () => {
    expect(escaparHtml(`<b onclick="x">'&`)).toBe('&lt;b onclick=&quot;x&quot;&gt;&#39;&amp;');
    expect(limpiarLinea('a\r\nBcc: x y')).toBe('a Bcc: x y');
    expect(correoSeguro('juan@example.com')).toBe('juan@example.com');
    for (const malo of ['a@b.com,c@d.com', 'a b@c.com', '<a@b.com>', 'a@b', 'a@b.com\r\nBcc: x@y.com', '', null]) {
      expect(correoSeguro(malo)).toBeNull();
    }
    expect(enmascararCorreo('juan@example.com')).toBe('j***@example.com');
  });

  it('ICS: texto escapado según RFC 5545, líneas plegadas a 75 octetos y sin inyección de propiedades', () => {
    expect(escaparTextoIcs('a,b;c\\d\r\nBEGIN:VEVENT')).toBe('a\\,b\\;c\\\\d\\nBEGIN:VEVENT');
    const larga = plegarLinea(`SUMMARY:${'ñ'.repeat(100)}`);
    for (const linea of larga.split('\r\n')) expect(Buffer.byteLength(linea, 'utf8')).toBeLessThanOrEqual(75);
    expect(larga.replace(/\r\n /g, '')).toBe(`SUMMARY:${'ñ'.repeat(100)}`);

    const inicio = instanteDeBogota('2030-07-17', '10:30');
    const ics = construirIcs(
      [{ id: 7, inicio, fin: new Date(inicio.getTime() + 1_800_000), resumen: 'x\r\nATTENDEE:mailto:a@b.com', descripcion: 'd', ubicacion: 'l' }],
      { secuencia: 3, ahora: new Date('2030-01-01T00:00:00Z') }
    );
    expect(ics.match(/^ATTENDEE/gm)).toBeNull();
    expect(ics).toContain('SEQUENCE:3\r\n');
    expect(ics).toContain('DTSTAMP:20300101T000000Z\r\n');
  });

  it('la configuración se valida solo con EMAIL_ENABLED=true y no revela la contraseña', () => {
    expect(leerConfigCorreo({})).toEqual({ habilitado: false });
    expect(leerConfigCorreo({ EMAIL_ENABLED: 'false', SMTP_PORT: 'basura' })).toEqual({ habilitado: false });
    expect(() => leerConfigCorreo({ EMAIL_ENABLED: 'true' })).toThrow(/SMTP_HOST, SMTP_PORT, EMAIL_FROM/);
    expect(() => leerConfigCorreo({ EMAIL_ENABLED: 'true', SMTP_HOST: 'h', SMTP_PORT: '25', EMAIL_FROM: 'a@b.com', SMTP_USER: 'u', SMTP_PASS: '' })).toThrow(/juntos/);
    try {
      leerConfigCorreo({ EMAIL_ENABLED: 'true', SMTP_HOST: 'h', SMTP_PORT: '99999', EMAIL_FROM: 'a@b.com', SMTP_USER: 'u', SMTP_PASS: 'secreto-xyz' });
    } catch (err) {
      expect(err.message).not.toContain('secreto-xyz');
    }
    const ok = leerConfigCorreo({ EMAIL_ENABLED: 'true', SMTP_HOST: 'mailpit', SMTP_PORT: '1025', EMAIL_FROM: 'Black Iron <a@b.com>' });
    expect(ok).toMatchObject({ habilitado: true, smtp: { host: 'mailpit', port: 1025, secure: false } });
    expect(ok.smtp.auth).toBeUndefined();
  });
});

describe('los scripts de datos de demostración no envían correos', () => {
  const PROHIBIDOS = [/notificaciones\.js$/, /transporteCorreo\.js$/, /plantillasCorreo\.js$/, /config\/correo\.js$/, /^nodemailer$/];

  // Recorre el grafo de imports relativos (estático) desde un archivo.
  const importsAlcanzables = (entrada) => {
    const vistos = new Set();
    const pendientes = [entrada];
    const hallados = [];
    while (pendientes.length > 0) {
      const archivo = pendientes.pop();
      if (vistos.has(archivo) || !existsSync(archivo)) continue;
      vistos.add(archivo);
      const fuente = readFileSync(archivo, 'utf-8');
      for (const m of fuente.matchAll(/(?:from\s*|import\s*\(?\s*)['"]([^'"]+)['"]/g)) {
        const destino = m[1];
        hallados.push(destino);
        if (destino.startsWith('.')) pendientes.push(path.resolve(path.dirname(archivo), destino));
      }
    }
    return hallados;
  };

  it.each(['sembrarDemo.js', 'seedDemo.js'])('%s no importa (ni transitivamente) el servicio de notificaciones', (script) => {
    const hallados = importsAlcanzables(path.resolve(__dirname, '../db', script));
    expect(hallados.length).toBeGreaterThan(0);
    for (const destino of hallados) {
      for (const prohibido of PROHIBIDOS) expect(destino).not.toMatch(prohibido);
    }
  });
});
