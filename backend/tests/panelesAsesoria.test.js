import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { crearApp } from '../app.js';
import { pool } from '../db/connection.js';
import { NOCHE_BOGOTA, HOY, firmarToken, insertarCitaConServicios } from './utilsPrueba.js';

// Fase 6 de asesorías: paneles y estadísticas. Las pruebas crean sus propios asesores y servicios de asesoría (ids 94xx) y los
// borran. Los barberos 1 y 2 y los servicios 1 y 2 (barbería) son los de globalSetup.

const app = crearApp();
const A1 = 9401; // asesores (area 'asesoria')
const A2 = 9402;
const ASES_PREMIUM = 9401; // asesoría de 60 min, $60.000
const ASES_BARBA = 9402; // asesoría de 45 min, $45.000
const ASES_GRATIS = 9403; // asesoría gratis (0)
const CORTE = 1; // 30 min, $50.000 (globalSetup)
const CORTE_2 = 2;

const admin = firmarToken('admin');
const firmarBarbero = (id, barberoId) =>
  jwt.sign({ id, usuario: `u${id}`, rol: 'barbero', barbero_id: barberoId }, process.env.JWT_SECRET, { expiresIn: '30d' });
const barbero1 = firmarBarbero(2, 1);
let asesor1;
let usuarioAsesor1;

const con = (token) => ({ Authorization: `Bearer ${token}` });
const getAdmin = (ruta) => request(app).get(`/api${ruta}`).set(con(admin));
const getBarbero = (ruta, token = barbero1) => request(app).get(`/api/barbero${ruta}`).set(con(token));

const borrarDatos = async () => {
  await pool.query('TRUNCATE citas RESTART IDENTITY CASCADE');
  await pool.query("DELETE FROM usuarios WHERE usuario LIKE 'prueba_paneles_%'");
};

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOCHE_BOGOTA));
  await borrarDatos();
  await pool.query('DELETE FROM servicios WHERE id = ANY($1::int[])', [[ASES_PREMIUM, ASES_BARBA, ASES_GRATIS]]);
  await pool.query('DELETE FROM barberos WHERE id = ANY($1::int[])', [[A1, A2]]);
  await pool.query(
    `INSERT INTO barberos (id, nombre, cargo, especialidad, area) VALUES
       ($1, 'Paneles Asesor Uno', 'Asesor de Imagen', 'Asesoria', 'asesoria'),
       ($2, 'Paneles Asesor Dos', 'Asesor de Imagen', 'Asesoria', 'asesoria')`,
    [A1, A2]
  );
  await pool.query(
    `INSERT INTO servicios (id, nombre, duracion_min, precio, tipo, descripcion, area) VALUES
       ($1, 'Paneles asesoría premium', 60, 60000, 'vip', 'x', 'asesoria'),
       ($2, 'Paneles asesoría barba', 45, 45000, 'elite', 'x', 'asesoria'),
       ($3, 'Paneles asesoría gratis', 15, 0, 'original', 'x', 'asesoria')`,
    [ASES_PREMIUM, ASES_BARBA, ASES_GRATIS]
  );
  const { rows } = await pool.query(
    `INSERT INTO usuarios (usuario, contrasena, rol, barbero_id, activo, contrasena_cambiada_en)
     VALUES ('prueba_paneles_a1', 'no-se-usa', 'barbero', $1, true, $2) RETURNING id`,
    [A1, new Date(NOCHE_BOGOTA)]
  );
  usuarioAsesor1 = rows[0].id;
  asesor1 = firmarBarbero(usuarioAsesor1, A1);
  await pool.query("UPDATE usuarios SET activo = true, contrasena_cambiada_en = $1 WHERE usuario = 'barbero1_test'", [new Date(NOCHE_BOGOTA)]);
});

afterAll(async () => {
  await borrarDatos();
  await pool.query('DELETE FROM servicios WHERE id = ANY($1::int[])', [[ASES_PREMIUM, ASES_BARBA, ASES_GRATIS]]);
  await pool.query('DELETE FROM barberos WHERE id = ANY($1::int[])', [[A1, A2]]);
  vi.useRealTimers();
});

beforeEach(async () => {
  vi.setSystemTime(new Date(NOCHE_BOGOTA));
  await pool.query('TRUNCATE citas RESTART IDENTITY CASCADE');
});

const cita = (ids, extra) => insertarCitaConServicios({ ids, fecha: HOY, estado: 'completada', ...extra });
const idsDe = (res) => res.body.items.map((c) => c.cliente);

// Reserva combinada: la asesoría (asesor A1) a las 10:00 (60 min) y el corte justo después, a las 11:00 (barbero 1).
const combinada = async ({ estadoAsesoria = 'pendiente', estadoCorte = 'pendiente', fecha = HOY, horaAsesoria = '10:00', horaCorte = '11:00' } = {}) => {
  const reservaId = randomUUID();
  const idAsesoria = await insertarCitaConServicios({
    ids: [ASES_PREMIUM], fecha, hora: horaAsesoria, estado: estadoAsesoria, cliente: 'Combinada Ana', barbero_id: A1,
  });
  const idCorte = await insertarCitaConServicios({
    ids: [CORTE], fecha, hora: horaCorte, estado: estadoCorte, cliente: 'Combinada Ana', barbero_id: 1,
  });
  await pool.query('UPDATE citas SET reserva_id = $1 WHERE id = ANY($2::int[])', [reservaId, [idAsesoria, idCorte]]);
  return { reservaId, idAsesoria, idCorte };
};

const CLAVES_HERMANA = ['area', 'estado', 'hora_fin', 'hora_inicio', 'id', 'profesional'];

describe('listados de citas: area, reserva_id y hermana', () => {
  it('una cita suelta (de barbería) trae area "barberia", reserva_id null y hermana null en todos los listados', async () => {
    await cita([CORTE], { hora: '09:00', cliente: 'Suelta' });
    const admin1 = (await getAdmin('/admin/citas?pestana=todas')).body.items[0];
    expect(admin1).toMatchObject({ area: 'barberia', reserva_id: null, hermana: null });
    const mis = (await getBarbero('/citas?pestana=todas')).body.items[0];
    expect(mis).toMatchObject({ area: 'barberia', reserva_id: null, hermana: null });
    const agenda = (await getBarbero('/agenda-hoy')).body.citas[0];
    expect(agenda).toMatchObject({ area: 'barberia', reserva_id: null, hermana: null });
    const todas = (await getAdmin('/citas')).body[0];
    expect(todas).toMatchObject({ area: 'barberia', reserva_id: null, hermana: null });
  });

  it('una cita de asesoría suelta trae area "asesoria"', async () => {
    await cita([ASES_PREMIUM], { hora: '09:00', cliente: 'Sola', barbero_id: A1 });
    const mis = (await getBarbero('/citas?pestana=todas', asesor1)).body.items[0];
    expect(mis).toMatchObject({ area: 'asesoria', reserva_id: null, hermana: null });
  });

  it('combinada vista desde el asesor: la hermana es el corte, con SOLO los campos mínimos', async () => {
    const { reservaId, idCorte } = await combinada();
    const res = await getBarbero('/citas?pestana=todas', asesor1);
    expect(res.body.items).toHaveLength(1);
    const item = res.body.items[0];
    expect(item).toMatchObject({ area: 'asesoria', reserva_id: reservaId });
    expect(item.hermana).toEqual({
      id: idCorte, area: 'barberia', profesional: 'Barbero Uno', hora_inicio: '11:00:00', hora_fin: '11:30:00', estado: 'pendiente',
    });
    expect(Object.keys(item.hermana).sort()).toEqual(CLAVES_HERMANA);
    // Nada de contacto, precio ni servicios de la hermana, ni datos internos.
    expect(JSON.stringify(item.hermana)).not.toMatch(/correo|telefono|example\.com|3001234567|precio|servicio|cliente/);
  });

  it('combinada vista desde el barbero: la hermana es la asesoría; cada profesional sigue viendo solo lo suyo', async () => {
    const { idAsesoria, idCorte } = await combinada();
    const res = await getBarbero('/citas?pestana=todas');
    expect(res.body.items.map((c) => c.id)).toEqual([idCorte]); // la cita del asesor NO aparece
    expect(res.body.items[0].hermana).toEqual({
      id: idAsesoria, area: 'asesoria', profesional: 'Paneles Asesor Uno', hora_inicio: '10:00:00', hora_fin: '11:00:00', estado: 'pendiente',
    });
    expect(res.body.total).toBe(1);
    expect(res.body.conteos.todas).toBe(1);
  });

  it('la hermana sale también en la agenda de hoy y en "por confirmar"', async () => {
    const { idAsesoria, idCorte } = await combinada(); // 22:00 en Bogotá: las dos ya terminaron → por confirmar
    const agenda = (await getBarbero('/agenda-hoy')).body.citas;
    expect(agenda).toHaveLength(1);
    expect(agenda[0].hermana).toMatchObject({ id: idAsesoria, area: 'asesoria' });
    const porConfirmar = (await getBarbero('/citas-por-confirmar')).body.items;
    expect(porConfirmar.map((c) => c.id)).toEqual([idCorte]);
    expect(porConfirmar[0]).toMatchObject({ area: 'barberia' });
    expect(porConfirmar[0].hermana).toMatchObject({ id: idAsesoria, estado: 'pendiente' });
  });

  it('hermana cancelada: se ve su estado', async () => {
    const { idAsesoria } = await combinada({ estadoCorte: 'pendiente', estadoAsesoria: 'cancelada' });
    const res = await getBarbero('/citas?pestana=todas');
    expect(res.body.items[0].hermana).toMatchObject({ id: idAsesoria, estado: 'cancelada' });
  });

  it('GET /api/citas y /api/admin/citas traen lo mismo, con la hermana de cada una', async () => {
    const { idAsesoria, idCorte } = await combinada();
    const lista = (await getAdmin('/citas')).body;
    expect(lista.find((c) => c.id === idAsesoria).hermana.id).toBe(idCorte);
    expect(lista.find((c) => c.id === idCorte).hermana.id).toBe(idAsesoria);
    const paginada = (await getAdmin('/admin/citas?pestana=todas')).body.items;
    expect(paginada.find((c) => c.id === idAsesoria)).toMatchObject({ area: 'asesoria', hermana: { id: idCorte } });
    expect(paginada.find((c) => c.id === idCorte)).toMatchObject({ area: 'barberia', hermana: { id: idAsesoria } });
  });

  it('una cita ANTERIOR a las asesorías (servicio de barbería con un profesional hoy de asesoría) sigue siendo de barbería', async () => {
    // Como los cortes que hizo Camila antes de pasar a 'asesoria': el trigger solo mira líneas nuevas, así que se desactiva para sembrarla.
    await pool.query('ALTER TABLE cita_servicios DISABLE TRIGGER cita_servicios_area_profesional');
    try {
      await cita([CORTE], { hora: '09:00', cliente: 'Legado', barbero_id: A1 });
    } finally {
      await pool.query('ALTER TABLE cita_servicios ENABLE TRIGGER cita_servicios_area_profesional');
    }
    const item = (await getAdmin('/admin/citas?pestana=todas')).body.items[0];
    expect(item.area).toBe('barberia');
    const resumen = (await getAdmin('/admin/estadisticas?periodo=hoy')).body.actual;
    expect(resumen).toMatchObject({ cortes: 1, asesorias: 0, ingresos_barberia: 50000, ingresos_asesoria: 0 });
  });
});

describe('/api/admin/citas?area=', () => {
  beforeEach(async () => {
    await cita([CORTE], { hora: '09:00', cliente: 'Corte uno' });
    await cita([CORTE_2], { hora: '09:30', cliente: 'Corte dos' });
    await cita([ASES_PREMIUM], { hora: '09:00', cliente: 'Asesoría uno', barbero_id: A1 });
  });

  it('barberia: solo cortes; asesoria: solo asesorías; el total y la paginación respetan el filtro', async () => {
    const barberia = await getAdmin('/admin/citas?pestana=todas&area=barberia');
    expect(barberia.status).toBe(200);
    expect(idsDe(barberia).sort()).toEqual(['Corte dos', 'Corte uno']);
    expect(barberia.body.total).toBe(2);
    const asesoria = await getAdmin('/admin/citas?pestana=todas&area=asesoria');
    expect(idsDe(asesoria)).toEqual(['Asesoría uno']);
    expect(asesoria.body.total).toBe(1);
    expect((await getAdmin('/admin/citas?pestana=todas&area=asesoria&limite=1&pagina=2')).body.items).toEqual([]);
  });

  it('sin area devuelve todas (compatible); se combina con la búsqueda y con el barbero', async () => {
    expect((await getAdmin('/admin/citas?pestana=todas')).body.total).toBe(3);
    expect(idsDe(await getAdmin('/admin/citas?pestana=todas&area=barberia&q=Corte%20uno'))).toEqual(['Corte uno']);
    expect(idsDe(await getAdmin(`/admin/citas?pestana=todas&area=asesoria&barbero=${A1}`))).toEqual(['Asesoría uno']);
    expect(idsDe(await getAdmin(`/admin/citas?pestana=todas&area=barberia&barbero=${A1}`))).toEqual([]);
  });

  it.each(['area=otra', 'area=', 'area=barberia&area=asesoria', 'area[]=barberia', 'area=BARBERIA'])(
    'un valor inválido (%s) responde 400',
    async (consulta) => {
      const res = await getAdmin(`/admin/citas?${consulta}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toBeTruthy();
    }
  );

  it('un barbero no puede usar /api/admin/citas (403)', async () => {
    expect((await request(app).get('/api/admin/citas?area=barberia').set(con(barbero1))).status).toBe(403);
  });
});

describe('reasignar por área', () => {
  it('una cita de asesoría solo pasa a otro asesor; un corte solo a otro barbero (400 PROFESIONAL_INCOMPATIBLE)', async () => {
    const idAsesoria = await cita([ASES_PREMIUM], { hora: '09:00', estado: 'pendiente', barbero_id: A1 });
    const idCorte = await cita([CORTE], { hora: '09:00', estado: 'pendiente', barbero_id: 1 });
    const patch = (id, barberoId) => request(app).patch(`/api/citas/${id}`).set(con(admin)).send({ barbero_id: barberoId });

    const aBarbero = await patch(idAsesoria, 2);
    expect(aBarbero.status).toBe(400);
    expect(aBarbero.body.codigo).toBe('PROFESIONAL_INCOMPATIBLE');
    const aAsesor = await patch(idCorte, A2);
    expect(aAsesor.status).toBe(400);
    expect(aAsesor.body.codigo).toBe('PROFESIONAL_INCOMPATIBLE');

    expect((await patch(idAsesoria, A2)).status).toBe(200);
    expect((await patch(idCorte, 2)).status).toBe(200);
    const { rows } = await pool.query('SELECT id, barbero_id FROM citas ORDER BY id');
    expect(rows).toEqual([{ id: idAsesoria, barbero_id: A2 }, { id: idCorte, barbero_id: 2 }]);
  });

  it('GET /api/barberos trae el área de todo el personal activo (la base del selector por área del front)', async () => {
    const res = await request(app).get('/api/barberos');
    const area = (id) => res.body.find((b) => b.id === id)?.area;
    expect([area(1), area(2), area(A1), area(A2)]).toEqual(['barberia', 'barberia', 'asesoria', 'asesoria']);
  });
});

// Escenario del día: 2 cortes completados ($50.000 y $30.000), un corte gratis, 2 asesorías completadas ($60.000 y
// $45.000), una asesoría gratis CANCELADA, un corte cancelado y una pendiente.
const sembrarDia = async () => {
  await cita([CORTE], { hora: '09:00', barbero_id: 1 }); // 50.000
  await pool.query('UPDATE citas SET precio = 30000 WHERE id = (SELECT MAX(id) FROM citas)');
  await pool.query('UPDATE cita_servicios SET precio = 30000 WHERE cita_id = (SELECT MAX(id) FROM citas)');
  await cita([CORTE], { hora: '09:30', barbero_id: 1 }); // 50.000
  await cita([ASES_PREMIUM], { hora: '09:00', barbero_id: A1 }); // 60.000
  await cita([ASES_BARBA], { hora: '10:30', barbero_id: A1 }); // 45.000
  await cita([ASES_GRATIS], { hora: '12:00', barbero_id: A1, estado: 'cancelada' });
  await cita([CORTE], { hora: '14:00', barbero_id: 2, estado: 'cancelada' });
  await cita([ASES_PREMIUM], { hora: '15:00', barbero_id: A2, estado: 'pendiente' });
};

describe('estadísticas: cortes y asesorías separados', () => {
  beforeEach(sembrarDia);

  it('resumen: total_cortes (cortes) cuenta solo barbería y asesorias aparte; completadas e ingresos son el total', async () => {
    const { actual } = (await getAdmin('/admin/estadisticas?periodo=hoy')).body;
    expect(actual).toMatchObject({
      cortes: 2,
      asesorias: 2,
      completadas: 4,
      ingresos: 50000 + 30000 + 60000 + 45000,
      ingresos_barberia: 80000,
      ingresos_asesoria: 105000,
      canceladas: 2,
    });
  });

  it('ticket promedio: SOLO barbería (no mezcla los $60.000 y $45.000 de las asesorías)', async () => {
    const { actual } = (await getAdmin('/admin/estadisticas?periodo=hoy')).body;
    expect(actual.ticket_promedio).toBe(40000); // (50.000 + 30.000) / 2; mezclado sería 46.250
  });

  it('el ticket promedio sigue excluyendo los cortes de precio 0, y sin cortes es 0 aunque haya asesorías', async () => {
    await pool.query("UPDATE citas SET precio = 0 WHERE cliente = 'Cliente combo' AND precio = 30000");
    expect((await getAdmin('/admin/estadisticas?periodo=hoy')).body.actual.ticket_promedio).toBe(50000);
    await pool.query("DELETE FROM citas WHERE barbero_id IN (1, 2)");
    const { actual } = (await getAdmin('/admin/estadisticas?periodo=hoy')).body;
    expect(actual).toMatchObject({ cortes: 0, asesorias: 2, ticket_promedio: 0, ingresos: 105000 });
  });

  it('ingresos por día y por mes: el total y el desglose por área', async () => {
    const dia = (await getAdmin('/admin/estadisticas/ingresos?agrupar=dia')).body;
    expect(dia.puntos[29]).toEqual({
      fecha: HOY, ingresos: 185000, ingresos_barberia: 80000, ingresos_asesoria: 105000, completadas: 4, cortes: 2, asesorias: 2,
    });
    expect(dia.puntos[28]).toMatchObject({ ingresos: 0, ingresos_barberia: 0, ingresos_asesoria: 0, cortes: 0, asesorias: 0 });
    const mes = (await getAdmin('/admin/estadisticas/ingresos?agrupar=mes')).body;
    expect(mes.puntos[11]).toMatchObject({ mes: '2026-10', ingresos: 185000, ingresos_barberia: 80000, ingresos_asesoria: 105000, cortes: 2, asesorias: 2 });
  });

  it('serviciosTop: barbería por defecto; area=asesoria pide las asesorías; area inválida o repetida → 400', async () => {
    const porDefecto = (await getAdmin('/admin/estadisticas/servicios-top?periodo=hoy')).body;
    expect(porDefecto.area).toBe('barberia');
    expect(porDefecto.servicios.map((s) => s.nombre)).toEqual(['Corte de prueba']);
    expect(porDefecto.servicios[0]).toMatchObject({ cantidad: 2, ingresos: 80000 });

    const asesorias = (await getAdmin('/admin/estadisticas/servicios-top?periodo=hoy&area=asesoria')).body;
    expect(asesorias.area).toBe('asesoria');
    expect(asesorias.servicios.map((s) => [s.nombre, s.cantidad, s.ingresos]).sort()).toEqual([
      ['Paneles asesoría barba', 1, 45000],
      ['Paneles asesoría premium', 1, 60000],
    ]);

    for (const consulta of ['area=otra', 'area=', 'area=barberia&area=asesoria']) {
      expect((await getAdmin(`/admin/estadisticas/servicios-top?periodo=hoy&${consulta}`)).status, consulta).toBe(400);
    }
  });

  it('serviciosTop cuenta por línea de cita_servicios también en asesorías (una combinada suma a cada área)', async () => {
    await combinada({ estadoAsesoria: 'completada', estadoCorte: 'completada', horaAsesoria: '16:00', horaCorte: '17:00' });
    const asesorias = (await getAdmin('/admin/estadisticas/servicios-top?periodo=hoy&area=asesoria')).body.servicios;
    expect(asesorias.find((s) => s.nombre === 'Paneles asesoría premium')).toMatchObject({ cantidad: 2, ingresos: 120000 });
    const cortes = (await getAdmin('/admin/estadisticas/servicios-top?periodo=hoy')).body.servicios;
    expect(cortes[0]).toMatchObject({ cantidad: 3 });
  });

  it('el panel de cada profesional solo cuenta SUS citas, sin mezclar áreas; el barbero no admite ?area=', async () => {
    const asesor = (await getBarbero('/estadisticas?periodo=hoy', asesor1)).body.actual;
    expect(asesor).toMatchObject({ completadas: 2, asesorias: 2, cortes: 0, ingresos: 105000, ticket_promedio: 52500 });
    const barbero = (await getBarbero('/estadisticas?periodo=hoy')).body.actual;
    expect(barbero).toMatchObject({ completadas: 2, cortes: 2, asesorias: 0, ingresos: 80000 });
    const top = (await getBarbero('/estadisticas/servicios-top?periodo=hoy', asesor1)).body.servicios;
    expect(top.map((s) => s.nombre).sort()).toEqual(['Paneles asesoría barba', 'Paneles asesoría premium']);
    expect((await getBarbero('/estadisticas/servicios-top?periodo=hoy&area=asesoria')).status).toBe(400);
    const resumen = (await getBarbero('/resumen', asesor1)).body;
    expect(resumen).toMatchObject({ cortes_mes: 2, ingresos_mes: 105000, completadas_hoy: 2 });
  });
});

describe('un profesional de asesoría con citas ANTERIORES de barbería (como los cortes 449 y 450 de Camila)', () => {
  beforeEach(sembrarDia);

  it('su contador del mes y su tarjeta cuentan solo sus asesorías; los cortes de antes quedan como cortes', async () => {
    await pool.query('ALTER TABLE cita_servicios DISABLE TRIGGER cita_servicios_area_profesional');
    try {
      await cita([CORTE], { hora: '18:00', cliente: 'Corte de antes', barbero_id: A1 });
    } finally {
      await pool.query('ALTER TABLE cita_servicios ENABLE TRIGGER cita_servicios_area_profesional');
    }
    const resumen = (await getBarbero('/resumen', asesor1)).body;
    expect(resumen.cortes_mes).toBe(2); // sus asesorías (60.000 y 45.000), no el corte de antes
    const actual = (await getBarbero('/estadisticas?periodo=hoy', asesor1)).body.actual;
    expect(actual).toMatchObject({ asesorias: 2, cortes: 1, completadas: 3 });
    expect(actual.ingresos).toBe(105000 + 50000); // el dinero es todo lo que cobró
  });
});

describe('reporte diario y CSV con asesorías', () => {
  beforeEach(sembrarDia);

  it('JSON: total_cortes es de barbería, total_asesorias aparte, ingresos con desglose y líneas de asesoría separadas', async () => {
    const r = (await getAdmin(`/admin/reportes/diario?fecha=${HOY}`)).body;
    expect(r).toMatchObject({
      total_cortes: 2,
      total_asesorias: 2,
      ingresos: 185000,
      ingresos_barberia: 80000,
      ingresos_asesoria: 105000,
      ticket_promedio: 40000,
      canceladas: 2,
      pendientes_sin_cerrar: 1,
    });
    expect(r.servicios_mas_pedidos).toEqual([{ nombre: 'Corte de prueba', cantidad: 2, ingresos: 80000 }]);
    expect(r.asesorias_mas_pedidas.map((s) => [s.nombre, s.cantidad, s.ingresos]).sort()).toEqual([
      ['Paneles asesoría barba', 1, 45000],
      ['Paneles asesoría premium', 1, 60000],
    ]);
  });

  it('CSV: las filas y columnas de siempre en su lugar y el bloque de asesorías al final (mismas 3 columnas)', async () => {
    const res = await request(app).get(`/api/admin/reportes/diario.csv?fecha=${HOY}`).set(con(admin)).buffer(true).parse((r, cb) => {
      let t = '';
      r.setEncoding('utf8');
      r.on('data', (c) => { t += c; });
      r.on('end', () => cb(null, t));
    });
    const filas = res.body.slice(1).split('\r\n');
    expect(filas.slice(0, 9)).toEqual([
      `Reporte diario;${HOY}`, 'Total de cortes;2', 'Ingresos;185000', 'Ticket promedio;40000', 'Canceladas;2',
      'Pendientes sin cerrar;1', '', 'Servicio;Cantidad;Ingresos', 'Corte de prueba;2;80000',
    ]);
    expect(filas.slice(9)).toEqual([
      '', 'Total de asesorías;2', 'Ingresos de barbería;80000', 'Ingresos de asesorías;105000', '',
      'Asesoría;Cantidad;Ingresos', 'Paneles asesoría premium;1;60000', 'Paneles asesoría barba;1;45000', '',
    ]);
  });
});
