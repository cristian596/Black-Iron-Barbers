import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../db/connection.js';
import { crearTransporteMemoria } from '../utils/transporteCorreo.js';
import { instanteDeBogota } from '../utils/ics.js';
import { ejecutarCicloRecordatorios, iniciarPlanificadorRecordatorios } from '../utils/recordatorios.js';
import { leerConfigRecordatorios } from '../config/recordatorios.js';
import { plantillaRecordatorioCliente, etiquetaDia } from '../utils/plantillasCorreo.js';
import { insertarPlan, DOMINIO_DEMO } from '../db/sembrarDemo.js';
import { NOMBRE_NEGOCIO, DIRECCION_NEGOCIO } from '../config/negocio.js';

// Recordatorios por correo (~24 h antes). Reloj y transporte inyectados: nunca sale un correo real.
// 2030-07-17 es miércoles. Todas las horas de estas pruebas son de BOGOTÁ (UTC-5 fijo).

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FECHA = '2030-07-17';
const FROM = 'Black Iron Barbers <no-reply@example.com>';
const BARBERO_ESCAPE = 9601;

const inicioDe = (fecha, hora) => instanteDeBogota(fecha, hora);
const ahoraAntes = (fecha, hora, minutos) => new Date(inicioDe(fecha, hora).getTime() - minutos * 60_000);
// Ahora exactamente 24 h antes de FECHA a las `hora`.
const ahora24 = (hora = '10:00') => ahoraAntes(FECHA, hora, 24 * 60);

let transporte;

const insertar = async ({
  fecha = FECHA,
  hora = '10:00',
  creadaAntesMin = 72 * 60,
  correo = 'cliente.prueba@example.com',
  cliente = 'Cliente Uno',
  estado = 'pendiente',
  barbero = 1,
  reservaId = null,
  intentos = 0,
  enviado = null,
  reclamado = null,
  duracion = 30,
  nombreServicio = 'Corte de prueba',
} = {}) => {
  const creada = new Date(inicioDe(fecha, hora).getTime() - creadaAntesMin * 60_000);
  const { rows } = await pool.query(
    `INSERT INTO citas (cliente, correo, telefono, servicio_id, barbero_id, fecha, hora, duracion_min, precio, estado,
                        creada_en, reserva_id, recordatorio_intentos, recordatorio_enviado_en, recordatorio_reclamado_en)
     VALUES ($1, $2, '3001234567', 1, $3, $4, $5, $6, 50000, $7, $8::timestamptz::timestamp, $9, $10, $11, $12) RETURNING id`,
    [cliente, correo, barbero, fecha, hora, duracion, estado, creada, reservaId, intentos, enviado, reclamado]
  );
  await pool.query(
    'INSERT INTO cita_servicios (cita_id, servicio_id, orden, nombre, duracion_min, precio) VALUES ($1, 1, 1, $2, $3, 50000)',
    [rows[0].id, nombreServicio, duracion]
  );
  return rows[0].id;
};

const estadoDe = async (id) => {
  const { rows } = await pool.query(
    'SELECT recordatorio_enviado_en, recordatorio_intentos, recordatorio_reclamado_en FROM citas WHERE id = $1',
    [id]
  );
  return rows[0];
};

const ciclo = (ahora, opciones = {}) => ejecutarCicloRecordatorios({ ahora, transporte, from: FROM, horasAntes: 24, maxPorCiclo: 50, ...opciones });

let espiaWarn;
let espiaLog;
const textoDeLogs = () => [...espiaWarn.mock.calls, ...espiaLog.mock.calls].flat().map(String).join('\n');

beforeEach(async () => {
  transporte = crearTransporteMemoria();
  espiaWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  espiaLog = vi.spyOn(console, 'log').mockImplementation(() => {});
  await pool.query('TRUNCATE citas RESTART IDENTITY CASCADE');
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await pool.query('TRUNCATE citas RESTART IDENTITY CASCADE');
  await pool.query('DELETE FROM barberos WHERE id = $1', [BARBERO_ESCAPE]);
});

afterAll(async () => {
  await pool.query('TRUNCATE citas RESTART IDENTITY CASCADE');
});

describe('elegibilidad (reloj fijo)', () => {
  it('justo dentro de la ventana (ahora = inicio − 24 h exactos) se envía y se marca', async () => {
    const id = await insertar();
    const r = await ciclo(ahora24());
    expect(r).toMatchObject({ reclamadas: 1, enviados: 1, fallidos: 0 });
    expect(transporte.enviados).toHaveLength(1);
    const e = await estadoDe(id);
    expect(e.recordatorio_enviado_en).not.toBeNull();
    expect(e.recordatorio_reclamado_en).toBeNull();
    expect(e.recordatorio_intentos).toBe(0);
  });

  it('un minuto antes de la ventana (demasiado pronto) no se envía y no se toca la fila', async () => {
    const id = await insertar();
    const r = await ciclo(new Date(ahora24().getTime() - 60_000));
    expect(r.enviados).toBe(0);
    expect(transporte.enviados).toHaveLength(0);
    const e = await estadoDe(id);
    expect(e.recordatorio_enviado_en).toBeNull();
    expect(e.recordatorio_reclamado_en).toBeNull();
  });

  it('cita creada con menos de 24 h de anticipación se omite (aunque ya esté en la ventana)', async () => {
    await insertar({ creadaAntesMin: 23 * 60 });
    expect((await ciclo(ahora24())).enviados).toBe(0);
    expect((await ciclo(ahoraAntes(FECHA, '10:00', 5 * 60))).enviados).toBe(0);
    expect(transporte.enviados).toHaveLength(0);
  });

  it('creada con exactamente 24 h de anticipación sí cuenta', async () => {
    await insertar({ creadaAntesMin: 24 * 60 });
    expect((await ciclo(ahora24())).enviados).toBe(1);
  });

  it('cita a menos de 1 hora (o exactamente 1 hora) se omite; a 61 minutos se envía', async () => {
    await insertar();
    expect((await ciclo(ahoraAntes(FECHA, '10:00', 59))).enviados).toBe(0);
    expect((await ciclo(ahoraAntes(FECHA, '10:00', 60))).enviados).toBe(0);
    expect((await ciclo(ahoraAntes(FECHA, '10:00', 61))).enviados).toBe(1);
  });

  it('recuperación tardía válida: servidor "caído" y primer ciclo a las T−2 h → se envía', async () => {
    const id = await insertar();
    const r = await ciclo(ahoraAntes(FECHA, '10:00', 120));
    expect(r.enviados).toBe(1);
    expect((await estadoDe(id)).recordatorio_enviado_en).not.toBeNull();
  });

  it.each([
    ['cancelada', { estado: 'cancelada' }, true],
    ['completada', { estado: 'completada' }, true],
    ['ya enviada', { enviado: new Date('2030-07-15T00:00:00Z') }, true],
    ['con 3 intentos fallidos', { intentos: 3 }, true],
    ['sin correo (vacío)', { correo: '' }],
    ['correo inválido (lista de destinatarios)', { correo: 'a@b.com,c@d.com' }],
    ['correo inválido (sin dominio)', { correo: 'sin-arroba' }],
    ['fila de demostración (dominio demo)', { correo: `alguien@${DOMINIO_DEMO}` }, true],
    ['fila de demostración (dominio demo en mayúsculas)', { correo: `Alguien@${DOMINIO_DEMO.toUpperCase()}` }],
    ['fila de seed:demo (cliente con marca "[demo] ")', { cliente: '[demo] Cliente' }, true],
    ['con un reclamo vigente de otro ciclo', { reclamado: new Date(ahora24().getTime() - 60_000) }, true],
  ])('%s: no se envía', async (_, datos, ni_siquiera_se_reclama) => {
    await insertar(datos);
    const r = await ciclo(ahora24());
    expect(r.enviados).toBe(0);
    expect(transporte.enviados).toHaveLength(0);
    // Las exclusiones de estado, demostración, envío previo y reclamo se aplican en la propia base: ni se reclama la fila.
    if (ni_siquiera_se_reclama) expect(r.reclamadas).toBe(0);
  });

  it('un reclamo vencido (más de 10 minutos) se libera y la cita se envía', async () => {
    await insertar({ reclamado: new Date(ahora24().getTime() - 11 * 60_000) });
    expect((await ciclo(ahora24())).enviados).toBe(1);
  });

  it('un correo inválido que sí pasó el filtro de la base se descarta una vez (intentos = 3) sin enviar ni loguearlo', async () => {
    const id = await insertar({ correo: 'a..b@example.com' });
    const r = await ciclo(ahora24());
    expect(r).toMatchObject({ enviados: 0, descartados: 1 });
    expect((await estadoDe(id)).recordatorio_intentos).toBe(3);
    expect((await ciclo(ahora24())).reclamadas).toBe(0);
    expect(textoDeLogs()).not.toContain('a..b@example.com');
  });

  it('la cita se cancela entre el reclamo y la lectura: no se envía y el reclamo se libera', async () => {
    const id = await insertar();
    // Justo después del UPDATE de reclamo, la cita se cancela (como si el barbero lo hiciera en ese instante).
    const original = pool.query.bind(pool);
    let cancelada = false;
    vi.spyOn(pool, 'query').mockImplementation(async (...args) => {
      const resultado = await original(...args);
      if (!cancelada && typeof args[0] === 'string' && args[0].includes('recordatorio_reclamado_en = $1::timestamptz')) {
        cancelada = true;
        await original("UPDATE citas SET estado = 'cancelada' WHERE id = $1", [id]);
      }
      return resultado;
    });
    const base = transporte;
    const r = await ciclo(ahora24(), { transporte: base });
    vi.restoreAllMocks();
    expect(r.enviados).toBe(0);
    expect(base.enviados).toHaveLength(0);
    expect((await estadoDe(id)).recordatorio_reclamado_en).toBeNull();
  });
});

describe('idempotencia y concurrencia', () => {
  it('dos ciclos seguidos → un solo correo', async () => {
    await insertar();
    await ciclo(ahora24());
    await ciclo(new Date(ahora24().getTime() + 5 * 60_000));
    expect(transporte.enviados).toHaveLength(1);
  });

  it('dos ciclos concurrentes sobre la misma cita (Promise.all) → un solo correo', async () => {
    await insertar();
    // El envío tarda: sin el reclamo atómico, los dos ciclos leerían la misma fila antes de que se marque.
    const lento = {
      ...transporte,
      async sendMail(opciones) {
        await new Promise((resolver) => setTimeout(resolver, 80));
        return transporte.sendMail(opciones);
      },
    };
    const resultados = await Promise.all([ciclo(ahora24(), { transporte: lento }), ciclo(ahora24(), { transporte: lento })]);
    expect(resultados.reduce((suma, r) => suma + r.enviados, 0)).toBe(1);
    expect(transporte.enviados).toHaveLength(1);
  });

  it('varios ciclos concurrentes con varias citas: cada cita recibe exactamente un correo', async () => {
    for (const hora of ['10:00', '10:30', '11:00', '11:30']) await insertar({ hora, correo: `c${hora.replace(':', '')}@example.com` });
    const lento = {
      ...transporte,
      async sendMail(opciones) {
        await new Promise((resolver) => setTimeout(resolver, 30));
        return transporte.sendMail(opciones);
      },
    };
    await Promise.all([1, 2, 3, 4].map(() => ciclo(ahora24('10:00'), { transporte: lento, horasAntes: 26 })));
    const destinos = transporte.enviados.map((m) => m.opciones.to).sort();
    expect(destinos).toEqual(['c1000@example.com', 'c1030@example.com', 'c1100@example.com', 'c1130@example.com']);
  });
});

describe('reserva combinada', () => {
  it('UN correo con las dos citas y ambas quedan marcadas', async () => {
    const reservaId = '11111111-1111-4111-8111-111111111111';
    const a = await insertar({ hora: '10:00', reservaId, barbero: 1, nombreServicio: 'Asesoría de prueba' });
    const b = await insertar({ hora: '10:30', reservaId, barbero: 2, nombreServicio: 'Corte combinado' });
    const r = await ciclo(ahora24('10:00'));
    expect(r.enviados).toBe(1);
    expect(transporte.enviados).toHaveLength(1);
    const { text, html } = transporte.enviados[0].opciones;
    for (const contenido of [text, html]) {
      expect(contenido).toContain('Asesoría de prueba');
      expect(contenido).toContain('Corte combinado');
      expect(contenido).toContain('Barbero Uno');
      expect(contenido).toContain('Barbero Dos');
    }
    expect((await estadoDe(a)).recordatorio_enviado_en).not.toBeNull();
    expect((await estadoDe(b)).recordatorio_enviado_en).not.toBeNull();
    expect((await ciclo(ahora24('10:00'))).enviados).toBe(0);
  });

  it('si solo una cumple las reglas (la otra está cancelada), se envía solo con la elegible', async () => {
    const reservaId = '22222222-2222-4222-8222-222222222222';
    await insertar({ hora: '10:00', reservaId, barbero: 1, nombreServicio: 'Asesoría de prueba', estado: 'cancelada' });
    const b = await insertar({ hora: '10:30', reservaId, barbero: 2, nombreServicio: 'Corte combinado' });
    const r = await ciclo(ahora24('10:30'));
    expect(r.enviados).toBe(1);
    const { text } = transporte.enviados[0].opciones;
    expect(text).toContain('Corte combinado');
    expect(text).not.toContain('Asesoría de prueba');
    expect((await estadoDe(b)).recordatorio_enviado_en).not.toBeNull();
  });

  it('una reserva combinada cuenta como UN correo para el tope por ciclo y no se parte entre ciclos', async () => {
    const reservaId = '33333333-3333-4333-8333-333333333333';
    await insertar({ hora: '10:00', reservaId, barbero: 1, correo: 'combo@example.com' });
    await insertar({ hora: '10:30', reservaId, barbero: 2, correo: 'combo@example.com' });
    await insertar({ hora: '11:00', barbero: 1, correo: 'suelta@example.com' });
    const r = await ciclo(ahora24('10:00'), { maxPorCiclo: 1, horasAntes: 25 });
    expect(r.enviados).toBe(1);
    expect(transporte.enviados[0].opciones.to).toBe('combo@example.com');
    const r2 = await ciclo(ahora24('10:00'), { maxPorCiclo: 1, horasAntes: 25 });
    expect(r2.enviados).toBe(1);
    expect(transporte.enviados[1].opciones.to).toBe('suelta@example.com');
  });
});

describe('fallos del transporte', () => {
  it('no lanza, cuenta el intento, no marca como enviado, reintenta y tras 3 fallos deja de intentar', async () => {
    const id = await insertar({ correo: 'cliente.fallo@example.com' });
    transporte.fallar = new Error('SMTP caído para cliente.fallo@example.com');

    for (const intentos of [1, 2, 3]) {
      const r = await ciclo(ahora24());
      expect(r).toMatchObject({ enviados: 0, fallidos: 1 });
      const e = await estadoDe(id);
      expect(e.recordatorio_intentos).toBe(intentos);
      expect(e.recordatorio_enviado_en).toBeNull();
      expect(e.recordatorio_reclamado_en).toBeNull();
    }
    // Cuarto ciclo: ya no se intenta, aunque el SMTP vuelva.
    transporte.fallar = null;
    const r = await ciclo(ahora24());
    expect(r.reclamadas).toBe(0);
    expect(transporte.enviados).toHaveLength(0);
    expect(textoDeLogs()).not.toContain('cliente.fallo@example.com');
    expect(textoDeLogs()).toContain('c***@example.com');
  });

  it('el siguiente ciclo reintenta y, si el SMTP volvió, se envía', async () => {
    const id = await insertar();
    transporte.fallar = new Error('SMTP caído');
    expect((await ciclo(ahora24())).fallidos).toBe(1);
    transporte.fallar = null;
    expect((await ciclo(ahora24())).enviados).toBe(1);
    const e = await estadoDe(id);
    expect(e.recordatorio_enviado_en).not.toBeNull();
    expect(e.recordatorio_intentos).toBe(1);
  });

  it('un fallo en una cita no impide enviar las demás del ciclo', async () => {
    await insertar({ hora: '10:00', correo: 'mala@example.com' });
    await insertar({ hora: '10:30', correo: 'buena@example.com' });
    const original = transporte.sendMail;
    const parcial = {
      ...transporte,
      async sendMail(opciones) {
        if (opciones.to === 'mala@example.com') throw new Error('rechazado');
        return original.call(transporte, opciones);
      },
    };
    const r = await ciclo(ahora24('10:00'), { transporte: parcial, horasAntes: 25 });
    expect(r).toMatchObject({ enviados: 1, fallidos: 1 });
    expect(transporte.enviados.map((m) => m.opciones.to)).toEqual(['buena@example.com']);
  });

  it('un error de la base de datos no escapa del ciclo', async () => {
    vi.spyOn(pool, 'query').mockRejectedValue(new Error('base caída (x@y.com)'));
    const r = await ciclo(ahora24());
    expect(r.enviados).toBe(0);
    expect(textoDeLogs()).not.toContain('x@y.com');
  });
});

describe('zona horaria: siempre Bogotá, con el reloj del servidor en otra zona', () => {
  let zonaOriginal;
  beforeEach(() => {
    zonaOriginal = process.env.TZ;
    process.env.TZ = 'Pacific/Auckland';
  });
  afterEach(() => {
    if (zonaOriginal === undefined) delete process.env.TZ;
    else process.env.TZ = zonaOriginal;
  });

  it('cita a las 00:30 de Bogotá, con ahora en la noche de Bogotá (ya "mañana" en UTC): etiqueta "mañana" y hora 12:30 a. m.', async () => {
    // 22:30 del 16 en Bogotá = 03:30Z del 17: por UTC la cita sería "hoy"; por Bogotá es "mañana".
    await insertar({ hora: '00:30' });
    const ahora = ahoraAntes(FECHA, '00:30', 2 * 60);
    expect(ahora.toISOString()).toBe('2030-07-17T03:30:00.000Z');
    const r = await ciclo(ahora);
    expect(r.enviados).toBe(1);
    const { text, html } = transporte.enviados[0].opciones;
    expect(text).toContain('tu cita es mañana');
    expect(text).toContain('miércoles 17 de julio de 2030, 12:30 a. m.');
    expect(html).toContain('12:30 a. m.');
  });

  it('cita a las 19:30 de Bogotá, ya el mismo día: etiqueta "hoy" y hora 7:30 p. m.', async () => {
    await insertar({ hora: '19:30' });
    const ahora = ahoraAntes(FECHA, '19:30', 2 * 60);
    expect(ahora.toISOString()).toBe('2030-07-17T22:30:00.000Z');
    const r = await ciclo(ahora);
    expect(r.enviados).toBe(1);
    const { text } = transporte.enviados[0].opciones;
    expect(text).toContain('tu cita es hoy');
    expect(text).toContain('miércoles 17 de julio de 2030, 7:30 p. m.');
  });

  it('cita a las 19:30 con ahora = 24 h antes: "mañana"', async () => {
    await insertar({ hora: '19:30' });
    await ciclo(ahora24('19:30'));
    expect(transporte.enviados[0].opciones.text).toContain('tu cita es mañana');
  });

  it('la etiqueta del día: hoy, mañana o el día de la semana (según la fecha de Bogotá)', () => {
    const ahora = new Date('2030-07-16T15:00:00Z'); // martes 16, 10:00 en Bogotá
    expect(etiquetaDia('2030-07-16', ahora)).toBe('hoy');
    expect(etiquetaDia('2030-07-17', ahora)).toBe('mañana');
    expect(etiquetaDia('2030-07-19', ahora)).toBe('el viernes');
    // 23:30 en Bogotá del 16 = 04:30Z del 17: sigue siendo el día 16 allá.
    expect(etiquetaDia('2030-07-17', new Date('2030-07-17T04:30:00Z'))).toBe('mañana');
  });
});

describe('contenido del correo', () => {
  it('trae asunto fijo, saludo, servicios con duración, profesional, hora exacta, dirección y no lleva .ics ni enlaces', async () => {
    await insertar({ cliente: 'Camila Prueba', duracion: 45 });
    await ciclo(ahora24());
    const { opciones, crudo } = transporte.enviados[0];
    expect(opciones.subject).toBe(`Recordatorio de tu cita en ${NOMBRE_NEGOCIO}`);
    expect(opciones.to).toBe('cliente.prueba@example.com');
    expect(opciones.attachments).toBeUndefined();
    expect(opciones.text).toContain('Hola, Camila Prueba.');
    expect(opciones.text).toContain('Corte de prueba · 45 min');
    expect(opciones.text).toContain('Barbero: Barbero Uno');
    expect(opciones.text).toContain('miércoles 17 de julio de 2030, 10:00 a. m.');
    expect(opciones.text).toContain(DIRECCION_NEGOCIO);
    expect(opciones.html).toContain(DIRECCION_NEGOCIO);
    expect(opciones.text).not.toMatch(/https?:\/\//);
    expect(opciones.html).not.toMatch(/https?:\/\/|href=/);
    expect(crudo).not.toMatch(/text\/calendar|\.ics/i);
    // No hay teléfono del negocio en el backend: no se inventa ninguna línea de contacto.
    expect(opciones.text).not.toMatch(/avísanos|whatsapp|llama/i);
  });

  it('escapa el HTML y sanea las cabeceras en nombre del cliente, servicio y profesional', async () => {
    await pool.query("INSERT INTO barberos (id, nombre, cargo, activo) VALUES ($1, $2, 'Barbero', true)", [
      BARBERO_ESCAPE,
      'Pro <script>alert(1)</script>\r\nBcc: evil@example.com',
    ]);
    await insertar({
      cliente: 'Ana <img src=x onerror=alert(1)>\r\nBcc: evil@example.com',
      nombreServicio: 'Corte <b>negrita</b> & "comillas"',
      barbero: BARBERO_ESCAPE,
    });
    await ciclo(ahora24());
    const { opciones, crudo } = transporte.enviados[0];
    expect(opciones.html).not.toContain('<img');
    expect(opciones.html).not.toContain('<script>');
    expect(opciones.html).not.toContain('<b>');
    expect(opciones.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(opciones.html).toContain('Corte &lt;b&gt;negrita&lt;/b&gt; &amp; &quot;comillas&quot;');
    expect(opciones.subject).not.toMatch(/[\r\n]/);
    expect(opciones.to).toBe('cliente.prueba@example.com');
    const cabeceras = crudo.split(/\r?\n\r?\n/)[0];
    expect(cabeceras).not.toMatch(/^Bcc:/im);
  });

  it('la plantilla usa solo la fecha de Bogotá del momento del envío', () => {
    const cita = {
      id: 1, cliente: 'Z', correo: 'z@example.com', fecha: FECHA, hora: '10:00', duracion_min: 30, precio: 1000, area: 'barberia', profesional: 'P',
      servicios: [{ nombre: 'S', duracion_min: 30, precio: 1000, gratis: false }],
    };
    const { texto } = plantillaRecordatorioCliente([cita], new Date('2030-07-15T15:00:00Z'));
    expect(texto).toContain('tu cita es el miércoles');
  });
});

describe('límite por ciclo', () => {
  it('con 120 elegibles y límite 50, el primer ciclo envía 50 (y el resto se atiende después)', async () => {
    // 120 citas cada 30 min desde 2 h después de "ahora": todas dentro de las 72 h de la ventana de esta prueba.
    await pool.query(
      `INSERT INTO citas (cliente, correo, telefono, servicio_id, barbero_id, fecha, hora, duracion_min, precio, creada_en)
       SELECT 'Cliente ' || n, 'masivo' || n || '@example.com', '3001234567', 1, 1,
              (($1::timestamptz + (n * interval '30 minutes')) AT TIME ZONE 'America/Bogota')::date,
              (($1::timestamptz + (n * interval '30 minutes')) AT TIME ZONE 'America/Bogota')::time,
              30, 50000, ($1::timestamptz - interval '100 hours')::timestamp
       FROM generate_series(4, 123) AS n`,
      [ahora24()]
    );
    const r = await ciclo(ahora24(), { horasAntes: 72, maxPorCiclo: 50 });
    expect(r.enviados).toBe(50);
    expect(transporte.enviados).toHaveLength(50);
    const r2 = await ciclo(ahora24(), { horasAntes: 72, maxPorCiclo: 50 });
    expect(r2.enviados).toBe(50);
    const r3 = await ciclo(ahora24(), { horasAntes: 72, maxPorCiclo: 50 });
    expect(r3.enviados).toBe(20);
    expect(new Set(transporte.enviados.map((m) => m.opciones.to)).size).toBe(120);
  });
});

describe('correo apagado', () => {
  it('con EMAIL_ENABLED=false (y sin remitente inyectado) el ciclo no hace nada ni marca nada', async () => {
    vi.stubEnv('EMAIL_ENABLED', 'false');
    const id = await insertar();
    const r = await ejecutarCicloRecordatorios({ ahora: ahora24(), transporte, horasAntes: 24, maxPorCiclo: 50 });
    expect(r.reclamadas).toBe(0);
    expect(transporte.enviados).toHaveLength(0);
    expect((await estadoDe(id)).recordatorio_enviado_en).toBeNull();
  });
});

describe('configuración', () => {
  it('apagado por defecto', () => {
    expect(leerConfigRecordatorios({})).toEqual({ habilitado: false, activo: false });
    expect(leerConfigRecordatorios({ RECORDATORIOS_ENABLED: 'false', EMAIL_ENABLED: 'true' }).activo).toBe(false);
  });

  it('con RECORDATORIOS_ENABLED y EMAIL_ENABLED: valores por defecto 24 / 5 / 50', () => {
    expect(leerConfigRecordatorios({ RECORDATORIOS_ENABLED: 'true', EMAIL_ENABLED: 'true' })).toMatchObject({
      habilitado: true, activo: true, horasAntes: 24, intervaloMin: 5, maxPorCiclo: 50, aviso: null,
    });
  });

  it('RECORDATORIOS_ENABLED=true sin EMAIL_ENABLED: no está activo y avisa (sin error fatal)', () => {
    const c = leerConfigRecordatorios({ RECORDATORIOS_ENABLED: 'true' });
    expect(c.habilitado).toBe(true);
    expect(c.activo).toBe(false);
    expect(c.aviso).toMatch(/EMAIL_ENABLED/);
  });

  it.each([
    ['RECORDATORIO_HORAS_ANTES', '0'],
    ['RECORDATORIO_HORAS_ANTES', '73'],
    ['RECORDATORIO_HORAS_ANTES', 'abc'],
    ['RECORDATORIO_HORAS_ANTES', '1.5'],
    ['RECORDATORIO_HORAS_ANTES', '24h'],
    ['RECORDATORIO_HORAS_ANTES', '-3'],
    ['RECORDATORIO_INTERVALO_MIN', '0'],
    ['RECORDATORIO_INTERVALO_MIN', '61'],
    ['RECORDATORIO_INTERVALO_MIN', 'x'],
    ['RECORDATORIO_MAX_POR_CICLO', '0'],
    ['RECORDATORIO_MAX_POR_CICLO', 'muchos'],
  ])('valor inválido %s=%s: lanza un error claro sin imprimir el valor', (clave, valor) => {
    let mensaje = '';
    try {
      leerConfigRecordatorios({ RECORDATORIOS_ENABLED: 'true', EMAIL_ENABLED: 'true', [clave]: valor });
    } catch (err) {
      mensaje = err.message;
    }
    expect(mensaje).toContain(clave);
    expect(mensaje).toMatch(/entero entre/);
    expect(mensaje).not.toContain(`=${valor}`);
  });

  it('acepta los extremos válidos', () => {
    const c = leerConfigRecordatorios({
      RECORDATORIOS_ENABLED: 'true', EMAIL_ENABLED: 'true', RECORDATORIO_HORAS_ANTES: '72', RECORDATORIO_INTERVALO_MIN: '1', RECORDATORIO_MAX_POR_CICLO: '1',
    });
    expect([c.horasAntes, c.intervaloMin, c.maxPorCiclo]).toEqual([72, 1, 1]);
  });
});

describe('planificador', () => {
  it('bajo NODE_ENV=test no arranca salvo que se pida explícitamente', () => {
    const espia = vi.spyOn(globalThis, 'setInterval');
    expect(iniciarPlanificadorRecordatorios({ intervaloMin: 5 })).toBeNull();
    expect(espia).not.toHaveBeenCalled();
  });

  it('con forzar: programa cada N minutos, con unref, corre un ciclo al arrancar, no solapa y se detiene limpiamente', async () => {
    const id = await insertar();
    const temporizador = { unref: vi.fn() };
    let tic = null;
    const espiaIntervalo = vi.spyOn(globalThis, 'setInterval').mockImplementation((fn, ms) => {
      tic = { fn, ms };
      return temporizador;
    });
    const espiaClear = vi.spyOn(globalThis, 'clearInterval').mockImplementation(() => {});
    // Reloj real: el ciclo usa new Date(); la cita de 2030 queda fuera de la ventana y no se envía nada.
    const planificador = iniciarPlanificadorRecordatorios({ intervaloMin: 7, forzar: true, transporte, from: FROM, horasAntes: 24, maxPorCiclo: 50 });
    expect(tic.ms).toBe(7 * 60_000);
    expect(temporizador.unref).toHaveBeenCalledTimes(1);
    const a = planificador.ejecutarAhora();
    const b = planificador.ejecutarAhora();
    expect(a).toBe(b); // no solapa ciclos
    await planificador.detener();
    expect(espiaClear).toHaveBeenCalledWith(temporizador);
    expect(espiaIntervalo).toHaveBeenCalledTimes(1);
    expect(transporte.enviados).toHaveLength(0);
    expect((await estadoDe(id)).recordatorio_enviado_en).toBeNull();
  });
});

describe('esquema y datos de demostración', () => {
  it('el esquema se aplica dos veces sin fallar, sin duplicar el índice y sin tocar filas existentes', async () => {
    const id = await insertar({ intentos: 2 });
    const antes = await estadoDe(id);
    const schema = readFileSync(path.resolve(__dirname, '../db/schema.sql'), 'utf-8');
    await pool.query(schema);
    await pool.query(schema);
    const despues = await estadoDe(id);
    expect(despues).toEqual(antes);
    const { rows: columnas } = await pool.query(
      `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
       WHERE table_name = 'citas' AND column_name LIKE 'recordatorio_%' ORDER BY column_name`
    );
    expect(columnas.map((c) => [c.column_name, c.data_type, c.is_nullable])).toEqual([
      ['recordatorio_enviado_en', 'timestamp with time zone', 'YES'],
      ['recordatorio_intentos', 'smallint', 'NO'],
      ['recordatorio_reclamado_en', 'timestamp with time zone', 'YES'],
    ]);
    expect(columnas.find((c) => c.column_name === 'recordatorio_intentos').column_default).toBe('0');
    const { rows: indices } = await pool.query("SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_citas_recordatorio_pendiente'");
    expect(indices).toHaveLength(1);
    expect(indices[0].indexdef).toMatch(/WHERE/);
  });

  it('sembrarDemo crea las filas ya marcadas (recordatorio_enviado_en) y el ciclo no les envía nada aunque no se excluyeran por dominio', async () => {
    const cliente = await pool.connect();
    try {
      await cliente.query('BEGIN');
      await insertarPlan(cliente, {
        citas: [
          {
            cliente: 'Demo Uno', correo: `demo.uno@${DOMINIO_DEMO}`, telefono: '3000000001', servicio_id: 1, barbero_id: 1,
            fecha: FECHA, hora: '10:00', duracion_min: 30, precio: 50000, estado: 'pendiente',
            creada_en: '2030-07-10 09:00:00', reserva_id: null,
            servicios: [{ servicio_id: 1, orden: 1, nombre: 'Corte de prueba', duracion_min: 30, precio: 50000 }],
            gratis_uso: null,
          },
        ],
      });
      await cliente.query('COMMIT');
    } finally {
      cliente.release();
    }
    const { rows } = await pool.query('SELECT id, recordatorio_enviado_en FROM citas');
    expect(rows).toHaveLength(1);
    expect(rows[0].recordatorio_enviado_en).not.toBeNull();
    // Defensa de la marca por sí sola: la misma fila con un correo "normal" tampoco se envía.
    await pool.query("UPDATE citas SET correo = 'real@example.com'");
    expect((await ciclo(ahora24())).enviados).toBe(0);
    expect(transporte.enviados).toHaveLength(0);
  });

  it('el módulo de recordatorios no escribe ningún correo completo en los logs durante un ciclo normal', async () => {
    await insertar({ correo: 'privado.largo@example.com' });
    await ciclo(ahora24());
    expect(textoDeLogs()).not.toContain('privado.largo@example.com');
  });
});

// ---------- Arranque real del servidor (proceso hijo, base de pruebas, SMTP inalcanzable: nunca sale un correo) ----------

const lanzarServidor = (variables) => {
  const hijo = spawn(process.execPath, ['index.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'development', PORT: '5057', EMAIL_ENABLED: 'false', RECORDATORIOS_ENABLED: 'false', ...variables },
  });
  let salida = '';
  hijo.stdout.on('data', (d) => (salida += d));
  hijo.stderr.on('data', (d) => (salida += d));
  const espera = (patron, ms = 15_000) =>
    new Promise((resolver, rechazar) => {
      const limite = setTimeout(() => rechazar(new Error(`Sin "${patron}" en la salida:\n${salida}`)), ms);
      const revisar = setInterval(() => {
        if (patron.test(salida)) {
          clearTimeout(limite);
          clearInterval(revisar);
          resolver();
        }
      }, 50);
    });
  const termino = new Promise((resolver) => hijo.on('exit', (codigo, senal) => resolver({ codigo, senal })));
  return { hijo, espera, termino, salida: () => salida };
};

describe('arranque del servidor (index.js)', () => {
  const SMTP_INALCANZABLE = { SMTP_HOST: '127.0.0.1', SMTP_PORT: '9', EMAIL_FROM: 'Black Iron <no-reply@example.com>' };

  it('RECORDATORIOS_ENABLED=false: el temporizador no arranca', async () => {
    const s = lanzarServidor({});
    try {
      await s.espera(/Recordatorios deshabilitados/);
      expect(s.salida()).not.toMatch(/Recordatorios activos/);
    } finally {
      s.hijo.kill();
      await s.termino;
    }
  }, 30_000);

  it('RECORDATORIOS_ENABLED=true sin EMAIL_ENABLED: avisa claro y no arranca el temporizador (sin error fatal)', async () => {
    const s = lanzarServidor({ RECORDATORIOS_ENABLED: 'true' });
    try {
      await s.espera(/EMAIL_ENABLED no es true/);
      await s.espera(/Servidor escuchando/);
      expect(s.salida()).not.toMatch(/Recordatorios activos/);
    } finally {
      s.hijo.kill();
      await s.termino;
    }
  }, 30_000);

  it('con las dos variables en true: el temporizador arranca con los valores configurados', async () => {
    const s = lanzarServidor({
      RECORDATORIOS_ENABLED: 'true', EMAIL_ENABLED: 'true', RECORDATORIO_HORAS_ANTES: '30', RECORDATORIO_INTERVALO_MIN: '2', RECORDATORIO_MAX_POR_CICLO: '7',
      ...SMTP_INALCANZABLE,
    });
    try {
      await s.espera(/Recordatorios activos \(30 h antes, cada 2 min, máx\. 7 por ciclo\)/);
    } finally {
      s.hijo.kill();
      await s.termino;
    }
  }, 30_000);

  it('configuración inválida: el arranque falla (código 1) con un mensaje claro y sin imprimir el valor', async () => {
    const s = lanzarServidor({ RECORDATORIOS_ENABLED: 'true', EMAIL_ENABLED: 'true', RECORDATORIO_HORAS_ANTES: '999', ...SMTP_INALCANZABLE });
    const { codigo } = await s.termino;
    expect(codigo).toBe(1);
    expect(s.salida()).toMatch(/Configuración de recordatorios inválida/);
    expect(s.salida()).toMatch(/RECORDATORIO_HORAS_ANTES debe ser un entero entre 1 y 72/);
    expect(s.salida()).not.toContain('999');
  }, 30_000);

  // En Windows process.kill('SIGTERM') termina el proceso sin ejecutar el manejador: solo se prueba donde las señales existen.
  it.skipIf(process.platform === 'win32')('SIGTERM: detiene el temporizador, cierra el servidor y sale con código 0', async () => {
    const s = lanzarServidor({ RECORDATORIOS_ENABLED: 'true', EMAIL_ENABLED: 'true', ...SMTP_INALCANZABLE });
    await s.espera(/Recordatorios activos/);
    await s.espera(/Servidor escuchando/);
    s.hijo.kill('SIGTERM');
    const { codigo } = await s.termino;
    expect(codigo).toBe(0);
    expect(s.salida()).toMatch(/SIGTERM recibida/);
  }, 30_000);
});
