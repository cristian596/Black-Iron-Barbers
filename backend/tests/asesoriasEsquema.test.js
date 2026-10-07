import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { pool } from '../db/connection.js';

// Fase 1 de asesorías: solo estructura (area, reserva_id, asesoria_gratis_usos y los triggers de emparejamiento).
// Las pruebas crean sus propios barberos y servicios (ids altos, area propia) y los borran: no dependen del seed.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(path.resolve(__dirname, '../db/schema.sql'), 'utf-8');

const BARBERO_CORTE = 9001; // area barberia
const ASESOR = 9002; // area asesoria
const BARBERO_CORTE_2 = 9003; // area barberia
const SERVICIO_CORTE = 9001; // area barberia, 30 min
const SERVICIO_ASESORIA = 9002; // area asesoria, 30 min
const FECHA = '2031-03-10';

const limpiar = async () => {
  await pool.query('DELETE FROM citas WHERE barbero_id = ANY($1)', [[BARBERO_CORTE, ASESOR, BARBERO_CORTE_2]]);
};

// Una reserva real: cita + línea en UNA transacción. Los triggers diferidos se evalúan al COMMIT (que es quien lanza).
const reservar = async ({
  barberoId,
  servicioId,
  hora = '09:00',
  duracion = 30,
  estado = 'pendiente',
  reservaId = null,
  correo = 'esquema@example.com',
  telefono = '3001230000',
}) => {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const { rows } = await cliente.query(
      `INSERT INTO citas (cliente, correo, telefono, servicio_id, barbero_id, fecha, hora, duracion_min, precio, estado, reserva_id)
       VALUES ('Esquema', $1, $2, $3, $4, $5, $6, $7, 0, $8, $9) RETURNING id`,
      [correo, telefono, servicioId, barberoId, FECHA, hora, duracion, estado, reservaId]
    );
    await cliente.query(
      `INSERT INTO cita_servicios (cita_id, servicio_id, orden, nombre, duracion_min, precio)
       SELECT $1, id, 1, nombre, $3, 0 FROM servicios WHERE id = $2`,
      [rows[0].id, servicioId, duracion]
    );
    await cliente.query('COMMIT');
    return rows[0].id;
  } catch (err) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    cliente.release();
  }
};

const fallo = async (promesa) => {
  try {
    await promesa;
  } catch (err) {
    return err;
  }
  throw new Error('Se esperaba un error y no hubo ninguno');
};

beforeAll(async () => {
  await limpiar();
  await pool.query('DELETE FROM servicios WHERE id = ANY($1)', [[SERVICIO_CORTE, SERVICIO_ASESORIA]]);
  await pool.query('DELETE FROM barberos WHERE id = ANY($1)', [[BARBERO_CORTE, ASESOR, BARBERO_CORTE_2]]);
  await pool.query(
    `INSERT INTO barberos (id, nombre, area) VALUES
       ($1, 'Esquema Barbero', 'barberia'), ($2, 'Esquema Asesor', 'asesoria'), ($3, 'Esquema Barbero 2', 'barberia')`,
    [BARBERO_CORTE, ASESOR, BARBERO_CORTE_2]
  );
  await pool.query(
    `INSERT INTO servicios (id, nombre, duracion_min, precio, area) VALUES
       ($1, 'Esquema corte', 30, 0, 'barberia'), ($2, 'Esquema asesoría', 30, 0, 'asesoria')`,
    [SERVICIO_CORTE, SERVICIO_ASESORIA]
  );
});

beforeEach(limpiar);

afterAll(async () => {
  await limpiar();
  await pool.query('DELETE FROM servicios WHERE id = ANY($1)', [[SERVICIO_CORTE, SERVICIO_ASESORIA]]);
  await pool.query('DELETE FROM barberos WHERE id = ANY($1)', [[BARBERO_CORTE, ASESOR, BARBERO_CORTE_2]]);
});

const contarEstructura = async () => {
  const { rows } = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM pg_trigger WHERE NOT tgisinternal) AS triggers,
       (SELECT COUNT(*)::int FROM pg_constraint WHERE connamespace = 'public'::regnamespace) AS constraints,
       (SELECT COUNT(*)::int FROM pg_indexes WHERE schemaname = 'public') AS indices,
       (SELECT COUNT(*)::int FROM information_schema.columns WHERE table_schema = 'public') AS columnas`
  );
  return rows[0];
};

describe('Esquema de asesorías: idempotencia y nombres', () => {
  it('aplicar schema.sql varias veces seguidas no da error ni duplica nada', async () => {
    const antes = await contarEstructura();
    await pool.query(schema);
    await pool.query(schema);
    await pool.query(schema);
    expect(await contarEstructura()).toEqual(antes);
  });

  it('crea las restricciones, el índice y los triggers con los nombres esperados', async () => {
    const { rows: restricciones } = await pool.query(
      `SELECT conname FROM pg_constraint
       WHERE conname = ANY($1) ORDER BY conname`,
      [
        [
          'barberos_area_check',
          'servicios_area_check',
          'categorias_area_check',
          'citas_reserva_sin_autosolapamiento',
          'asesoria_gratis_usos_pkey',
          'asesoria_gratis_usos_cita_id_fkey',
          'asesoria_gratis_usos_cita_id_key',
          'asesoria_gratis_usos_correo_norm_key',
          'asesoria_gratis_usos_telefono_norm_key',
        ],
      ]
    );
    expect(restricciones.map((r) => r.conname)).toEqual([
      'asesoria_gratis_usos_cita_id_fkey',
      'asesoria_gratis_usos_cita_id_key',
      'asesoria_gratis_usos_correo_norm_key',
      'asesoria_gratis_usos_pkey',
      'asesoria_gratis_usos_telefono_norm_key',
      'barberos_area_check',
      'categorias_area_check',
      'citas_reserva_sin_autosolapamiento',
      'servicios_area_check',
    ]);

    const { rows: indice } = await pool.query(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_citas_reserva'`
    );
    expect(indice[0].indexdef).toMatch(/WHERE \(reserva_id IS NOT NULL\)/);

    const { rows: triggers } = await pool.query(
      `SELECT tgname, tgdeferrable, tginitdeferred FROM pg_trigger
       WHERE tgname IN ('cita_servicios_area_profesional', 'citas_area_barbero') ORDER BY tgname`
    );
    expect(triggers).toEqual([
      { tgname: 'cita_servicios_area_profesional', tgdeferrable: true, tginitdeferred: true },
      { tgname: 'citas_area_barbero', tgdeferrable: false, tginitdeferred: false },
    ]);
  });
});

describe('Esquema de asesorías: valores por defecto', () => {
  it('barberos, servicios y categorías nuevos sin area quedan en barberia, y la cita sin reserva_id queda en NULL', async () => {
    const { rows: categoria } = await pool.query(
      `INSERT INTO categorias (nombre, slug, orden) VALUES ('Esquema categoría', 'esquema-categoria', 999) RETURNING area`
    );
    expect(categoria[0].area).toBe('barberia');
    await pool.query(`DELETE FROM categorias WHERE slug = 'esquema-categoria'`);

    const { rows: porDefecto } = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM barberos WHERE area <> 'barberia' AND id <> ALL($1)) AS barberos_otra_area,
         (SELECT COUNT(*)::int FROM servicios WHERE area <> 'barberia' AND id <> ALL($2)) AS servicios_otra_area`,
      [[ASESOR], [SERVICIO_ASESORIA]]
    );
    expect(porDefecto[0]).toEqual({ barberos_otra_area: 0, servicios_otra_area: 0 });

    const id = await reservar({ barberoId: BARBERO_CORTE, servicioId: SERVICIO_CORTE });
    const { rows } = await pool.query('SELECT reserva_id FROM citas WHERE id = $1', [id]);
    expect(rows[0].reserva_id).toBeNull();
  });

  it('un area fuera de barberia/asesoria se rechaza (CHECK con nombre propio)', async () => {
    const err = await fallo(pool.query(`INSERT INTO barberos (id, nombre, area) VALUES (9099, 'X', 'otra')`));
    expect(err.code).toBe('23514');
    expect(err.constraint).toBe('barberos_area_check');
    const err2 = await fallo(
      pool.query(`INSERT INTO servicios (id, nombre, duracion_min, precio, area) VALUES (9099, 'X', 10, 0, 'otra')`)
    );
    expect(err2.constraint).toBe('servicios_area_check');
  });
});

describe('Esquema de asesorías: emparejamiento estricto (triggers)', () => {
  it('el caso válido pasa: corte con barbero de barbería y asesoría con asesor', async () => {
    await expect(reservar({ barberoId: BARBERO_CORTE, servicioId: SERVICIO_CORTE })).resolves.toEqual(expect.any(Number));
    await expect(
      reservar({ barberoId: ASESOR, servicioId: SERVICIO_ASESORIA, hora: '10:00' })
    ).resolves.toEqual(expect.any(Number));
  });

  it('un corte con un asesor falla AL COMMIT, con SQLSTATE BI001 y el mensaje reconocible, y no deja la cita', async () => {
    const err = await fallo(reservar({ barberoId: ASESOR, servicioId: SERVICIO_CORTE }));
    expect(err.code).toBe('BI001');
    expect(err.constraint).toBe('cita_servicios_area_profesional');
    expect(err.message).toMatch(/^PROFESIONAL_INCOMPATIBLE:/);
    const { rows } = await pool.query('SELECT 1 FROM citas WHERE barbero_id = $1', [ASESOR]);
    expect(rows).toHaveLength(0);
  });

  it('una asesoría con un barbero de barbería falla al COMMIT', async () => {
    const err = await fallo(reservar({ barberoId: BARBERO_CORTE, servicioId: SERVICIO_ASESORIA }));
    expect(err.code).toBe('BI001');
    const { rows } = await pool.query('SELECT 1 FROM citas WHERE barbero_id = $1', [BARBERO_CORTE]);
    expect(rows).toHaveLength(0);
  });

  it('es diferido: el INSERT de la línea no falla, falla el COMMIT', async () => {
    const cliente = await pool.connect();
    try {
      await cliente.query('BEGIN');
      const { rows } = await cliente.query(
        `INSERT INTO citas (cliente, correo, servicio_id, barbero_id, fecha, hora, duracion_min, precio)
         VALUES ('Esquema', 'e@example.com', $1, $2, $3, '09:00', 30, 0) RETURNING id`,
        [SERVICIO_CORTE, ASESOR, FECHA]
      );
      await cliente.query(
        `INSERT INTO cita_servicios (cita_id, servicio_id, orden, nombre, duracion_min, precio)
         VALUES ($1, $2, 1, 'Esquema corte', 30, 0)`,
        [rows[0].id, SERVICIO_CORTE]
      );
      const err = await fallo(cliente.query('COMMIT'));
      expect(err.code).toBe('BI001');
    } finally {
      await cliente.query('ROLLBACK').catch(() => {});
      cliente.release();
    }
  });

  it('la reasignación a un barbero de otra área falla; a uno de la misma área pasa', async () => {
    const corte = await reservar({ barberoId: BARBERO_CORTE, servicioId: SERVICIO_CORTE });
    const err = await fallo(pool.query('UPDATE citas SET barbero_id = $1 WHERE id = $2', [ASESOR, corte]));
    expect(err.code).toBe('BI001');
    expect(err.message).toMatch(/^PROFESIONAL_INCOMPATIBLE:/);

    await pool.query('UPDATE citas SET barbero_id = $1 WHERE id = $2', [BARBERO_CORTE_2, corte]);
    const { rows } = await pool.query('SELECT barbero_id FROM citas WHERE id = $1', [corte]);
    expect(rows[0].barbero_id).toBe(BARBERO_CORTE_2);
  });

  it('las filas legacy no se ven afectadas: una asesora con un corte antiguo sigue pudiendo cerrarse', async () => {
    // Estado de Camila hoy: corte completado atendido por quien luego pasa a ser asesora.
    const corte = await reservar({ barberoId: BARBERO_CORTE, servicioId: SERVICIO_CORTE, estado: 'pendiente' });
    await pool.query(`UPDATE barberos SET area = 'asesoria' WHERE id = $1`, [BARBERO_CORTE]);
    try {
      // Cambiar estado, hora o reasignar a sí mismo no dispara nada.
      await pool.query(`UPDATE citas SET estado = 'completada' WHERE id = $1`, [corte]);
      await pool.query('UPDATE citas SET barbero_id = barbero_id WHERE id = $1', [corte]);
      const { rows } = await pool.query('SELECT estado FROM citas WHERE id = $1', [corte]);
      expect(rows[0].estado).toBe('completada');
      // Lo nuevo sí se valida: otro corte con ella falla.
      const err = await fallo(reservar({ barberoId: BARBERO_CORTE, servicioId: SERVICIO_CORTE, hora: '11:00' }));
      expect(err.code).toBe('BI001');
    } finally {
      await pool.query(`UPDATE barberos SET area = 'barberia' WHERE id = $1`, [BARBERO_CORTE]);
    }
  });
});

describe('Esquema de asesorías: citas_reserva_sin_autosolapamiento', () => {
  it('una cadena contigua (asesoría y luego corte) con el mismo reserva_id pasa', async () => {
    const reservaId = randomUUID();
    await reservar({ barberoId: ASESOR, servicioId: SERVICIO_ASESORIA, hora: '10:00', reservaId });
    await expect(
      reservar({ barberoId: BARBERO_CORTE, servicioId: SERVICIO_CORTE, hora: '10:30', reservaId })
    ).resolves.toEqual(expect.any(Number));
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM citas WHERE reserva_id = $1', [reservaId]);
    expect(rows[0].n).toBe(2);
  });

  it('dos citas de la misma reserva que se solapan fallan, aunque sean de profesionales distintos', async () => {
    const reservaId = randomUUID();
    await reservar({ barberoId: ASESOR, servicioId: SERVICIO_ASESORIA, hora: '10:00', reservaId });
    const err = await fallo(reservar({ barberoId: BARBERO_CORTE, servicioId: SERVICIO_CORTE, hora: '10:15', reservaId }));
    expect(err.code).toBe('23P01');
    expect(err.constraint).toBe('citas_reserva_sin_autosolapamiento');
  });

  it('el mismo horario en reservas distintas, o sin reserva_id, no lo activa', async () => {
    await reservar({ barberoId: ASESOR, servicioId: SERVICIO_ASESORIA, hora: '10:00', reservaId: randomUUID() });
    await expect(
      reservar({ barberoId: BARBERO_CORTE, servicioId: SERVICIO_CORTE, hora: '10:00', reservaId: randomUUID() })
    ).resolves.toEqual(expect.any(Number));
    await expect(
      reservar({ barberoId: BARBERO_CORTE_2, servicioId: SERVICIO_CORTE, hora: '10:00' })
    ).resolves.toEqual(expect.any(Number));
  });

  it('una cita cancelada no cuenta: ni al insertar encima de ella ni al insertar ella misma', async () => {
    const reservaId = randomUUID();
    const asesoria = await reservar({ barberoId: ASESOR, servicioId: SERVICIO_ASESORIA, hora: '10:00', reservaId });
    await reservar({ barberoId: BARBERO_CORTE, servicioId: SERVICIO_CORTE, hora: '10:15', reservaId, estado: 'cancelada' });
    await pool.query(`UPDATE citas SET estado = 'cancelada' WHERE id = $1`, [asesoria]);
    await expect(
      reservar({ barberoId: BARBERO_CORTE_2, servicioId: SERVICIO_CORTE, hora: '10:00', reservaId })
    ).resolves.toEqual(expect.any(Number));
  });
});

describe('Esquema de asesorías: asesoria_gratis_usos', () => {
  const uso = (citaId, correo = 'ana@example.com', telefono = '3001112233') =>
    pool.query(
      'INSERT INTO asesoria_gratis_usos (cita_id, correo_norm, telefono_norm) VALUES ($1, $2, $3)',
      [citaId, correo, telefono]
    );

  it('guarda el uso con su fecha de creación', async () => {
    const cita = await reservar({ barberoId: ASESOR, servicioId: SERVICIO_ASESORIA });
    await uso(cita);
    const { rows } = await pool.query('SELECT correo_norm, telefono_norm, creado_en FROM asesoria_gratis_usos WHERE cita_id = $1', [cita]);
    expect(rows[0]).toMatchObject({ correo_norm: 'ana@example.com', telefono_norm: '3001112233' });
    expect(rows[0].creado_en).toBeInstanceOf(Date);
  });

  it('el correo repetido falla con asesoria_gratis_usos_correo_norm_key (aunque cambie el teléfono)', async () => {
    const a = await reservar({ barberoId: ASESOR, servicioId: SERVICIO_ASESORIA, hora: '09:00' });
    const b = await reservar({ barberoId: ASESOR, servicioId: SERVICIO_ASESORIA, hora: '10:00' });
    await uso(a);
    const err = await fallo(uso(b, 'ana@example.com', '3009998877'));
    expect(err.code).toBe('23505');
    expect(err.constraint).toBe('asesoria_gratis_usos_correo_norm_key');
  });

  it('el teléfono repetido falla con asesoria_gratis_usos_telefono_norm_key (aunque cambie el correo)', async () => {
    const a = await reservar({ barberoId: ASESOR, servicioId: SERVICIO_ASESORIA, hora: '09:00' });
    const b = await reservar({ barberoId: ASESOR, servicioId: SERVICIO_ASESORIA, hora: '10:00' });
    await uso(a);
    const err = await fallo(uso(b, 'otra@example.com', '3001112233'));
    expect(err.code).toBe('23505');
    expect(err.constraint).toBe('asesoria_gratis_usos_telefono_norm_key');
  });

  it('una cita solo puede tener un uso (asesoria_gratis_usos_cita_id_key)', async () => {
    const a = await reservar({ barberoId: ASESOR, servicioId: SERVICIO_ASESORIA });
    await uso(a);
    const err = await fallo(uso(a, 'otra@example.com', '3009998877'));
    expect(err.code).toBe('23505');
    expect(err.constraint).toBe('asesoria_gratis_usos_cita_id_key');
  });

  it('exige que la cita exista (FK) y se borra en cascada con la cita', async () => {
    const err = await fallo(uso(2147483000));
    expect(err.code).toBe('23503');
    expect(err.constraint).toBe('asesoria_gratis_usos_cita_id_fkey');

    const cita = await reservar({ barberoId: ASESOR, servicioId: SERVICIO_ASESORIA });
    await uso(cita);
    await pool.query('DELETE FROM citas WHERE id = $1', [cita]);
    const { rows } = await pool.query('SELECT 1 FROM asesoria_gratis_usos WHERE cita_id = $1', [cita]);
    expect(rows).toHaveLength(0);
    // Liberado: el mismo correo y teléfono pueden volver a registrarse.
    const otra = await reservar({ barberoId: ASESOR, servicioId: SERVICIO_ASESORIA, hora: '11:00' });
    await expect(uso(otra)).resolves.toBeDefined();
  });
});
