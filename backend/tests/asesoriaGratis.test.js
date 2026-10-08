import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { crearApp } from '../app.js';
import { pool } from '../db/connection.js';
import { firmarToken, reiniciarContador } from './utilsPrueba.js';
import { esAsesoriaGratisYaUsada, esConflictoDeHorario } from '../utils/areas.js';

// Fase 4 de asesorías: la asesoría gratis (clave_seed 'asesoria-gratis') es de UNA por persona, verificada por correo Y
// teléfono normalizados (tabla asesoria_gratis_usos). Las pruebas crean sus propios asesores y servicios (ids 93xx) y los
// borran: no dependen del seed. Los barberos 1 y 2 son los de globalSetup.

const app = crearApp();
const FECHA = '2030-08-14';

const A1 = 9301;
const A2 = 9302;
const GRATIS = 9301; // asesoría gratis (clave_seed), 15 min
const PAGA = 9302; // asesoría de pago, 30 min
const CORTE = 9303;
const CORTE_2 = 9304;
const IDS_SERVICIOS = [GRATIS, PAGA, CORTE, CORTE_2];

const PERSONA = { correo: 'persona.uno@gmail.com', telefono: '3001234567' };

let admin;

const limpiar = async () => {
  await pool.query('TRUNCATE citas RESTART IDENTITY CASCADE'); // también vacía asesoria_gratis_usos (ON DELETE CASCADE)
  await pool.query("DELETE FROM usuarios WHERE usuario LIKE 'prueba_gratis_%'");
};

const borrarDatosPrueba = async () => {
  await limpiar();
  await pool.query('DELETE FROM servicios WHERE id = ANY($1::int[])', [IDS_SERVICIOS]);
  await pool.query('DELETE FROM barberos WHERE id = ANY($1::int[])', [[A1, A2]]);
};

const tokenDe = async (barberoId) => {
  const { rows } = await pool.query(
    `INSERT INTO usuarios (usuario, contrasena, rol, barbero_id, activo) VALUES ($1, 'no-se-usa', 'barbero', $2, true) RETURNING id`,
    [`prueba_gratis_${barberoId}`, barberoId]
  );
  return jwt.sign({ id: rows[0].id, usuario: `prueba_gratis_${barberoId}`, rol: 'barbero', barbero_id: barberoId }, process.env.JWT_SECRET, {
    expiresIn: '1h',
  });
};

beforeAll(async () => {
  await borrarDatosPrueba();
  await pool.query(
    `INSERT INTO barberos (id, nombre, cargo, especialidad, area) VALUES
       ($1, 'Gratis Asesor Uno', 'Asesor de Imagen', 'Asesoria', 'asesoria'),
       ($2, 'Gratis Asesor Dos', 'Asesor de Imagen', 'Asesoria', 'asesoria')`,
    [A1, A2]
  );
  await pool.query(
    `INSERT INTO servicios (id, nombre, duracion_min, precio, tipo, descripcion, area, clave_seed) VALUES
       ($1, 'Gratis asesoría gratis', 15, 0, 'original', 'x', 'asesoria', 'asesoria-gratis'),
       ($2, 'Gratis asesoría de pago', 30, 60000, 'vip', 'x', 'asesoria', NULL),
       ($3, 'Gratis corte', 30, 20000, 'original', 'x', 'barberia', NULL),
       ($4, 'Gratis corte 2', 30, 15000, 'original', 'x', 'barberia', NULL)`,
    IDS_SERVICIOS
  );
  admin = firmarToken('admin');
});

beforeEach(async () => {
  reiniciarContador();
  await limpiar();
  await pool.query('UPDATE barberos SET area = $1, activo = true WHERE id IN (1, 2)', ['barberia']);
  await pool.query('UPDATE barberos SET activo = true WHERE id = ANY($1::int[])', [[A1, A2]]);
});

afterAll(async () => {
  await borrarDatosPrueba();
});

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const reservar = (extra = {}) =>
  request(app)
    .post('/api/citas')
    .send({ cliente: 'Cliente de prueba', ...PERSONA, consentimiento: true, fecha: FECHA, hora: '10:00', servicios_ids: [GRATIS], ...extra });
const comprobar = (cuerpo) => request(app).post('/api/asesorias/gratis/comprobar').send(cuerpo);
const contar = async (tabla) => (await pool.query(`SELECT COUNT(*)::int AS n FROM ${tabla}`)).rows[0].n;
const usos = async () => (await pool.query('SELECT cita_id, correo_norm, telefono_norm FROM asesoria_gratis_usos ORDER BY id')).rows;
const cancelar = async (token, citaId) => request(app).patch(`/api/citas/${citaId}`).set(auth(token)).send({ estado: 'cancelada' });

// Cuenta (y observa) los INSERT INTO citas de la transacción: así se prueba que un rechazo por "gratis ya usada" no
// reintenta con otro profesional del pool.
let alInsertar = null;
const instalarEspia = () => {
  const original = pool.connect.bind(pool);
  return vi.spyOn(pool, 'connect').mockImplementation((alTerminar) => {
    if (typeof alTerminar === 'function') return original(alTerminar);
    return original().then((cliente) => {
      if (!cliente.espiado) {
        cliente.espiado = true;
        const consultar = cliente.query.bind(cliente);
        cliente.query = async (...args) => {
          if (alInsertar && typeof args[0] === 'string' && args[0].includes('INSERT INTO citas')) alInsertar(args[1]);
          return consultar(...args);
        };
      }
      return cliente;
    });
  });
};

describe('La primera asesoría gratis', () => {
  it('se reserva y registra el uso con el correo y el teléfono NORMALIZADOS', async () => {
    const res = await reservar({ correo: 'Persona.UNO+promo@Gmail.com', telefono: '+57 300 123 4567' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ servicio_id: GRATIS, precio: 0, duracion_min: 15 });
    expect([A1, A2]).toContain(res.body.barbero_id);
    expect(await usos()).toEqual([{ cita_id: res.body.id, correo_norm: 'personauno@gmail.com', telefono_norm: '3001234567' }]);
    // La cita guarda lo que escribió el cliente; solo el registro de uso va normalizado.
    expect((await pool.query('SELECT correo FROM citas WHERE id = $1', [res.body.id])).rows[0].correo).toBe('Persona.UNO+promo@Gmail.com');
  });

  it('con un asesor concreto también', async () => {
    const res = await reservar({ asesor_id: A2 });
    expect(res.status).toBe(201);
    expect(res.body.barbero_id).toBe(A2);
  });

  it('las asesorías de pago y los cortes NO consumen ni consultan el derecho: se pueden repetir', async () => {
    for (const [i, ids] of [[PAGA], [PAGA], [CORTE], [CORTE_2]].entries()) {
      const res = await reservar({ servicios_ids: ids, hora: `${String(9 + i)}:00`.padStart(5, '0') });
      expect(res.status).toBe(201);
    }
    expect(await contar('asesoria_gratis_usos')).toBe(0);
  });
});

describe('Una sola asesoría gratis por persona', () => {
  const primera = async () => {
    const res = await reservar({ hora: '09:00' });
    expect(res.status).toBe(201);
    return res;
  };

  it('la segunda con el mismo correo → 409 ASESORIA_GRATIS_YA_USADA, sin crear nada', async () => {
    await primera();
    const res = await reservar({ hora: '11:00' });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ codigo: 'ASESORIA_GRATIS_YA_USADA', servicio_id: GRATIS });
    expect(await contar('citas')).toBe(1);
    expect(await contar('cita_servicios')).toBe(1);
    expect(await contar('asesoria_gratis_usos')).toBe(1);
  });

  it('mismo teléfono con OTRO correo → bloquea', async () => {
    await primera();
    const res = await reservar({ hora: '11:00', correo: 'otra.persona@example.com' });
    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe('ASESORIA_GRATIS_YA_USADA');
  });

  it('mismo correo con OTRO teléfono → bloquea', async () => {
    await primera();
    const res = await reservar({ hora: '11:00', telefono: '3119998888' });
    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe('ASESORIA_GRATIS_YA_USADA');
  });

  it('la respuesta es idéntica sea cual sea el campo que coincide y no revela datos', async () => {
    await primera();
    const porCorreo = await reservar({ hora: '11:00', telefono: '3119998888' });
    const porTelefono = await reservar({ hora: '11:00', correo: 'otra.persona@example.com' });
    const porAmbos = await reservar({ hora: '11:00' });
    expect(porCorreo.body).toEqual(porTelefono.body);
    expect(porCorreo.body).toEqual(porAmbos.body);
    expect(Object.keys(porCorreo.body).sort()).toEqual(['codigo', 'error', 'servicio_id']);
    const texto = JSON.stringify(porCorreo.body).toLowerCase();
    for (const secreto of ['persona.uno', 'personauno', '3001234567', 'correo', 'teléfono', 'telefono', 'otra.persona', '3119998888']) {
      expect(texto).not.toContain(secreto);
    }
  });

  it.each([
    ['mayúsculas', { correo: 'PERSONA.UNO@GMAIL.COM' }],
    ['+etiqueta', { correo: 'persona.uno+gratis@gmail.com' }],
    ['puntos de Gmail', { correo: 'p.e.r.s.o.n.a.u.n.o@gmail.com' }],
    ['googlemail.com', { correo: 'personauno@googlemail.com' }],
    ['teléfono con +57 y espacios', { telefono: '+57 300 123 4567' }],
    ['teléfono con guiones', { correo: 'nueva@example.com', telefono: '300-123-4567' }],
    ['teléfono con 57 delante', { correo: 'nueva@example.com', telefono: '573001234567' }],
  ])('variante: %s → bloquea', async (_nombre, extra) => {
    await primera();
    const res = await reservar({ hora: '11:00', ...extra });
    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe('ASESORIA_GRATIS_YA_USADA');
  });

  it('otro dominio con puntos NO se funde: a.na@example.com y ana@example.com son personas distintas', async () => {
    const uno = await reservar({ hora: '09:00', correo: 'a.na@example.com', telefono: '3001110001' });
    const dos = await reservar({ hora: '11:00', correo: 'ana@example.com', telefono: '3001110002' });
    expect(uno.status).toBe(201);
    expect(dos.status).toBe(201);
  });

  it('una persona distinta (otro correo y otro teléfono) sí puede', async () => {
    await primera();
    const res = await reservar({ hora: '11:00', correo: 'distinta@example.com', telefono: '3115550000' });
    expect(res.status).toBe(201);
    expect(await contar('asesoria_gratis_usos')).toBe(2);
  });

  it('el bloqueo no impide reservar el corte ni una asesoría de pago a esa misma persona', async () => {
    await primera();
    expect((await reservar({ hora: '11:00', servicios_ids: [CORTE] })).status).toBe(201);
    expect((await reservar({ hora: '12:00', servicios_ids: [PAGA] })).status).toBe(201);
  });
});

describe('Reserva combinada con la gratis bloqueada', () => {
  it('revierte TODO (ni asesoría ni corte), responde 409 sin revelar el campo y el corte solo se reserva después', async () => {
    expect((await reservar({ hora: '09:00' })).status).toBe(201); // ya usó la gratis
    const citasAntes = await contar('citas');
    const lineasAntes = await contar('cita_servicios');

    const combinada = await reservar({ hora: '12:00', servicios_ids: [GRATIS, CORTE], correo: 'OTRO@example.com' }); // mismo teléfono
    expect(combinada.status).toBe(409);
    expect(combinada.body).toEqual({ error: expect.any(String), codigo: 'ASESORIA_GRATIS_YA_USADA', servicio_id: GRATIS });
    expect(await contar('citas')).toBe(citasAntes);
    expect(await contar('cita_servicios')).toBe(lineasAntes);
    expect(await contar('asesoria_gratis_usos')).toBe(1);

    // Cómo seguir: el front reserva de nuevo SOLO el corte (sin la asesoría), mismos datos y misma hora de corte.
    const soloCorte = await reservar({ hora: '12:00', servicios_ids: [CORTE], correo: 'OTRO@example.com' });
    expect(soloCorte.status).toBe(201);
    expect(soloCorte.body).not.toHaveProperty('citas');
  });

  it('la combinada con la gratis que SÍ está disponible crea las dos citas y registra el uso de la asesoría', async () => {
    const res = await reservar({ servicios_ids: [CORTE, GRATIS] });
    expect(res.status).toBe(201);
    const [asesoria, corte] = res.body.citas;
    expect(asesoria.servicio_id).toBe(GRATIS);
    expect(corte.servicio_id).toBe(CORTE);
    expect((await usos()).map((u) => u.cita_id)).toEqual([asesoria.id]); // la fila es de la cita de la asesoría, no del corte
  });
});

describe('Concurrencia', () => {
  it.each([
    ['a la misma hora', '10:00', '10:00'],
    ['a horas distintas', '10:00', '15:00'],
  ])('dos reservas simultáneas de la misma persona %s: una gana y la otra recibe ASESORIA_GRATIS_YA_USADA', async (_n, h1, h2) => {
    for (let ronda = 0; ronda < 3; ronda += 1) {
      await limpiar();
      const [a, b] = await Promise.all([reservar({ hora: h1 }), reservar({ hora: h2 })]);
      expect([a.status, b.status].sort()).toEqual([201, 409]);
      const perdedora = [a, b].find((r) => r.status === 409);
      expect(perdedora.body.codigo).toBe('ASESORIA_GRATIS_YA_USADA');
      expect(await contar('citas')).toBe(1);
      expect(await contar('cita_servicios')).toBe(1);
      expect(await contar('asesoria_gratis_usos')).toBe(1);
    }
  });

  it('con datos que coinciden solo en el teléfono, lo mismo', async () => {
    const [a, b] = await Promise.all([
      reservar({ hora: '10:00', correo: 'uno@example.com' }),
      reservar({ hora: '15:00', correo: 'dos@example.com' }),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(await contar('citas')).toBe(1);
  });

  it('combinadas simultáneas de la misma persona: gana una y la perdedora no deja ni la asesoría ni el corte', async () => {
    for (let ronda = 0; ronda < 3; ronda += 1) {
      await limpiar();
      const [a, b] = await Promise.all([
        reservar({ hora: '10:00', servicios_ids: [GRATIS, CORTE] }),
        reservar({ hora: '15:00', servicios_ids: [GRATIS, CORTE_2] }),
      ]);
      expect([a.status, b.status].sort()).toEqual([201, 409]);
      expect([a, b].find((r) => r.status === 409).body.codigo).toBe('ASESORIA_GRATIS_YA_USADA');
      expect(await contar('citas')).toBe(2);
      expect(await contar('cita_servicios')).toBe(2);
      expect(await contar('asesoria_gratis_usos')).toBe(1);
    }
  });
});

describe('ASESORIA_GRATIS_YA_USADA no es "horario ocupado"', () => {
  let espia;
  let inserciones;
  beforeEach(() => {
    inserciones = 0;
    alInsertar = () => {
      inserciones += 1;
    };
    espia = instalarEspia();
  });
  afterEach(() => {
    alInsertar = null;
    espia.mockRestore();
  });

  it('no reintenta con otro asesor del pool: un solo INSERT de cita y respuesta de gratis usada', async () => {
    alInsertar = null;
    await reservar({ hora: '09:00' });
    inserciones = 0;
    alInsertar = () => {
      inserciones += 1;
    };
    const res = await reservar({ hora: '11:00' }); // hay 2 asesores libres: un reintento sería visible
    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe('ASESORIA_GRATIS_YA_USADA');
    expect(res.body.error).not.toMatch(/horario|asesores|disponibles/i);
    expect(inserciones).toBe(1);
  });

  it('en una combinada se detiene tras la asesoría: el corte ni se intenta insertar', async () => {
    alInsertar = null;
    await reservar({ hora: '09:00' });
    inserciones = 0;
    alInsertar = () => {
      inserciones += 1;
    };
    const res = await reservar({ hora: '11:00', servicios_ids: [GRATIS, CORTE] });
    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe('ASESORIA_GRATIS_YA_USADA');
    expect(inserciones).toBe(1);
  });

  it('esConflictoDeHorario y esAsesoriaGratisYaUsada se reparten los errores 23505 por restricción', async () => {
    const citaId = (await reservar({ hora: '09:00' })).body.id;
    const otra = (await reservar({ hora: '11:00', servicios_ids: [PAGA], correo: 'x@example.com' })).body.id;
    const falla = (correo, telefono, cita) =>
      pool.query('INSERT INTO asesoria_gratis_usos (cita_id, correo_norm, telefono_norm) VALUES ($1, $2, $3)', [cita, correo, telefono]).catch((e) => e);

    const porCorreo = await falla('personauno@gmail.com', '3110000001', otra);
    const porTelefono = await falla('nuevo@example.com', '3001234567', otra);
    const porCita = await falla('nuevo@example.com', '3110000002', citaId);
    for (const [error, constraint] of [
      [porCorreo, 'asesoria_gratis_usos_correo_norm_key'],
      [porTelefono, 'asesoria_gratis_usos_telefono_norm_key'],
    ]) {
      expect(error.constraint).toBe(constraint);
      expect(esAsesoriaGratisYaUsada(error)).toBe(true);
      expect(esConflictoDeHorario(error)).toBe(false);
    }
    expect(porCita.constraint).toBe('asesoria_gratis_usos_cita_id_key');
    expect(esAsesoriaGratisYaUsada(porCita)).toBe(false); // un error inesperado no se disfraza de "ya usada"
    expect(esConflictoDeHorario(porCita)).toBe(false);
    expect(esAsesoriaGratisYaUsada({ code: '23P01', constraint: 'citas_sin_solapamiento' })).toBe(false);
    expect(esConflictoDeHorario({ code: '23505', constraint: 'citas_pkey' })).toBe(true);
  });
});

describe('Cancelar libera el derecho; completada y vencida lo conservan', () => {
  it('cancelar la gratis (el asesor) libera: se borra su fila y la persona puede reservar otra', async () => {
    const primera = await reservar({ hora: '09:00', asesor_id: A1 });
    const tokenAsesor = await tokenDe(A1);
    expect((await reservar({ hora: '11:00' })).status).toBe(409);

    const res = await cancelar(tokenAsesor, primera.body.id);
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('cancelada');
    expect(await contar('asesoria_gratis_usos')).toBe(0);

    const otra = await reservar({ hora: '11:00' });
    expect(otra.status).toBe(201);
    expect(await contar('asesoria_gratis_usos')).toBe(1);
  });

  it('cancelar el CORTE hermano no libera la gratis; cancelar la asesoría sí', async () => {
    const combinada = await reservar({ servicios_ids: [GRATIS, CORTE], asesor_id: A1, barbero_id: 1 });
    const [asesoria, corte] = combinada.body.citas;

    const cancelaCorte = await cancelar(firmarToken('barbero'), corte.id); // barbero 1
    expect(cancelaCorte.status).toBe(200);
    expect(await contar('asesoria_gratis_usos')).toBe(1);
    expect((await reservar({ hora: '15:00' })).status).toBe(409);

    const cancelaAsesoria = await cancelar(await tokenDe(A1), asesoria.id);
    expect(cancelaAsesoria.status).toBe(200);
    expect(await contar('asesoria_gratis_usos')).toBe(0);
    expect((await reservar({ hora: '15:00' })).status).toBe(201);
  });

  it('cancelar una asesoría de pago o un corte no toca los usos de otras personas', async () => {
    const gratis = await reservar({ hora: '09:00' });
    const corte = await reservar({ hora: '11:00', servicios_ids: [CORTE], barbero_id: 1, correo: 'x@example.com', telefono: '3111111111' });
    expect((await cancelar(firmarToken('barbero'), corte.body.id)).status).toBe(200);
    expect((await usos()).map((u) => u.cita_id)).toEqual([gratis.body.id]);
  });

  it('una completada sigue contando', async () => {
    const primera = await reservar({ hora: '09:00', asesor_id: A1 });
    await pool.query("UPDATE citas SET fecha = (SELECT (now() AT TIME ZONE 'America/Bogota')::date - 1) WHERE id = $1", [primera.body.id]);
    const completa = await request(app).patch(`/api/citas/${primera.body.id}`).set(auth(await tokenDe(A1))).send({ estado: 'completada' });
    expect(completa.status).toBe(200);
    expect(await contar('asesoria_gratis_usos')).toBe(1);
    expect((await reservar({ hora: '11:00' })).status).toBe(409);
  });

  it('una pendiente VENCIDA sin confirmar sigue contando', async () => {
    const primera = await reservar({ hora: '09:00' });
    await pool.query("UPDATE citas SET fecha = (SELECT (now() AT TIME ZONE 'America/Bogota')::date - 30) WHERE id = $1", [primera.body.id]);
    expect((await pool.query('SELECT estado FROM citas WHERE id = $1', [primera.body.id])).rows[0].estado).toBe('pendiente');
    expect((await reservar({ hora: '11:00' })).status).toBe(409);
  });

  it('cancelar y liberar es atómico: si la cita ya no está pendiente no se libera nada', async () => {
    const primera = await reservar({ hora: '09:00', asesor_id: A1 });
    await pool.query("UPDATE citas SET estado = 'completada', fecha = (SELECT (now() AT TIME ZONE 'America/Bogota')::date - 1) WHERE id = $1", [primera.body.id]);
    const res = await cancelar(await tokenDe(A1), primera.body.id);
    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe('TRANSICION_INVALIDA');
    expect(await contar('asesoria_gratis_usos')).toBe(1);
  });
});

describe('Estados finales', () => {
  const crearCitaEn = async (estado) => {
    const res = await reservar({ servicios_ids: [CORTE], barbero_id: 1, hora: '10:00', correo: `${estado}@example.com`, telefono: '3112223333' });
    await pool.query("UPDATE citas SET estado = $2, fecha = (SELECT (now() AT TIME ZONE 'America/Bogota')::date - 1) WHERE id = $1", [res.body.id, estado]);
    return res.body.id;
  };
  const cambiar = (id, estado) => request(app).patch(`/api/citas/${id}`).set(auth(firmarToken('barbero'))).send({ estado });

  it.each([
    ['completada', 'cancelada'],
    ['completada', 'pendiente'],
    ['cancelada', 'pendiente'],
    ['cancelada', 'completada'],
  ])('%s → %s: 409 TRANSICION_INVALIDA y la cita no cambia', async (desde, hacia) => {
    const id = await crearCitaEn(desde);
    const res = await cambiar(id, hacia);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ codigo: 'TRANSICION_INVALIDA', estado_actual: desde });
    expect((await pool.query('SELECT estado FROM citas WHERE id = $1', [id])).rows[0].estado).toBe(desde);
  });

  it('reabrir una cancelada con el hueco LIBRE también se rechaza', async () => {
    const id = await crearCitaEn('cancelada');
    expect((await cambiar(id, 'pendiente')).status).toBe(409);
  });

  it('repetir el estado final es inocuo (200) y las transiciones válidas siguen funcionando', async () => {
    const cancelada = await crearCitaEn('cancelada');
    expect((await cambiar(cancelada, 'cancelada')).status).toBe(200);
    const completada = await crearCitaEn('completada');
    expect((await cambiar(completada, 'completada')).status).toBe(200);

    await pool.query('TRUNCATE citas RESTART IDENTITY CASCADE');
    const a = (await reservar({ servicios_ids: [CORTE], barbero_id: 1, hora: '10:00' })).body.id;
    const b = (await reservar({ servicios_ids: [CORTE], barbero_id: 1, hora: '11:00', correo: 'b@example.com' })).body.id;
    expect((await cambiar(a, 'cancelada')).body.estado).toBe('cancelada'); // pendiente → cancelada
    await pool.query("UPDATE citas SET fecha = (SELECT (now() AT TIME ZONE 'America/Bogota')::date - 1) WHERE id = $1", [b]);
    expect((await cambiar(b, 'completada')).body.estado).toBe('completada'); // pendiente → completada
  });

  it('reasignar una cita (admin) no depende del estado y sigue funcionando', async () => {
    const id = (await reservar({ servicios_ids: [CORTE], barbero_id: 1, hora: '10:00' })).body.id;
    const res = await request(app).patch(`/api/citas/${id}`).set(auth(admin)).send({ barbero_id: 2 });
    expect(res.status).toBe(200);
    expect(res.body.barbero_id).toBe(2);
  });
});

describe('POST /api/asesorias/gratis/comprobar', () => {
  it('disponible true si nadie la usó; false cuando el correo o el teléfono ya la usaron (y sus variantes)', async () => {
    expect((await comprobar(PERSONA)).body).toEqual({ disponible: true });
    await reservar({ hora: '09:00' });

    const casos = [PERSONA, { ...PERSONA, telefono: '3119998888' }, { ...PERSONA, correo: 'otro@example.com' }, { correo: 'P.ersonauno+x@GoogleMail.com', telefono: '+57 311 999 8888' }];
    for (const caso of casos) {
      const res = await comprobar(caso);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ disponible: false });
    }
    expect((await comprobar({ correo: 'distinta@example.com', telefono: '3115550000' })).body).toEqual({ disponible: true });
  });

  it('la respuesta es idéntica sin importar qué campo coincide y no lleva nada más', async () => {
    await reservar({ hora: '09:00' });
    const porCorreo = await comprobar({ ...PERSONA, telefono: '3119998888' });
    const porTelefono = await comprobar({ ...PERSONA, correo: 'otro@example.com' });
    expect(porCorreo.status).toBe(porTelefono.status);
    expect(porCorreo.body).toEqual(porTelefono.body);
    expect(porCorreo.headers['content-length']).toBe(porTelefono.headers['content-length']);
  });

  it('no crea ni modifica nada', async () => {
    await comprobar(PERSONA);
    expect(await contar('citas')).toBe(0);
    expect(await contar('asesoria_gratis_usos')).toBe(0);
  });

  it.each([
    ['sin cuerpo', undefined],
    ['sin correo', { telefono: '3001234567' }],
    ['sin teléfono', { correo: 'a@example.com' }],
    ['correo inválido', { correo: 'no-es-correo', telefono: '3001234567' }],
    ['teléfono inválido', { correo: 'a@example.com', telefono: '12345' }],
    ['teléfono que no empieza por 3', { correo: 'a@example.com', telefono: '1234567890' }],
    ['tipos que no son texto', { correo: ['a@example.com'], telefono: 3001234567 }],
    ['objetos', { correo: { $ne: '' }, telefono: { $ne: '' } }],
  ])('formato inválido (%s) → 400 genérico', async (_n, cuerpo) => {
    const res = await comprobar(cuerpo);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Datos inválidos', codigo: 'DATOS_INVALIDOS' });
  });

  it('tras cancelar la gratis vuelve a estar disponible', async () => {
    const primera = await reservar({ hora: '09:00', asesor_id: A1 });
    expect((await comprobar(PERSONA)).body.disponible).toBe(false);
    await cancelar(await tokenDe(A1), primera.body.id);
    expect((await comprobar(PERSONA)).body.disponible).toBe(true);
  });
});
