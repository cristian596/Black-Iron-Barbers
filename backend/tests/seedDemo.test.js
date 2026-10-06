import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../db/connection.js';
import {
  MARCA_DEMO,
  DIAS_ATRAS,
  DIAS_ADELANTE,
  generarCitasDemo,
  sembrarDemo,
  limpiarDemo,
  contarDemo,
} from '../db/seedDemo.js';
import { sumarDias } from '../utils/periodos.js';
import { minutosDesdeMedianoche, intervaloDentroDeHorario } from '../utils/fechas.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ_BACKEND = path.resolve(__dirname, '..');

const HOY = '2026-10-04';
const SERVICIOS = [
  { id: 1, duracion_min: 30, precio: 18000 },
  { id: 2, duracion_min: 45, precio: 35000 },
  { id: 3, duracion_min: 90, precio: 120000 },
  { id: 4, duracion_min: 30, precio: 0 },
];
const base = { hoy: HOY, minutosAhora: 14 * 60, barberos: [1, 2, 3], servicios: SERVICIOS };

const solapan = (a, b) => {
  const ia = minutosDesdeMedianoche(a.hora);
  const ib = minutosDesdeMedianoche(b.hora);
  return ia < ib + b.duracion_min && ib < ia + a.duracion_min;
};

describe('generarCitasDemo (función pura)', () => {
  const citas = generarCitasDemo(base);

  it('es determinista: la misma semilla produce los mismos datos', () => {
    expect(generarCitasDemo(base)).toEqual(citas);
    expect(generarCitasDemo({ ...base, semilla: 7 })).not.toEqual(citas);
  });

  it('todas llevan la marca [demo] y caben en la columna cliente (100)', () => {
    expect(citas.length).toBeGreaterThan(200);
    expect(citas.every((c) => c.cliente.startsWith(MARCA_DEMO) && c.cliente.length <= 100)).toBe(true);
  });

  it('reparte completadas, canceladas y pendientes (vencidas y próximas) en ~60 días', () => {
    const estados = new Set(citas.map((c) => c.estado));
    expect(estados).toEqual(new Set(['completada', 'cancelada', 'pendiente']));
    expect(citas.some((c) => c.estado === 'pendiente' && c.fecha < HOY)).toBe(true);
    expect(citas.some((c) => c.estado === 'pendiente' && c.fecha >= HOY)).toBe(true);

    const fechas = citas.map((c) => c.fecha).sort();
    expect(fechas[0] >= sumarDias(HOY, -DIAS_ATRAS)).toBe(true);
    expect(fechas.at(-1) <= sumarDias(HOY, DIAS_ADELANTE)).toBe(true);
    expect(new Set(fechas).size).toBeGreaterThan(55);
  });

  it('nunca hay completadas en el futuro ni en horas que aún no terminaron hoy', () => {
    for (const c of citas.filter((x) => x.estado === 'completada')) {
      expect(c.fecha <= HOY).toBe(true);
      if (c.fecha === HOY) {
        expect(minutosDesdeMedianoche(c.hora) + c.duracion_min).toBeLessThanOrEqual(base.minutosAhora);
      }
    }
  });

  it('cada cita guarda el precio y la duración de su servicio (snapshot)', () => {
    const porId = new Map(SERVICIOS.map((s) => [s.id, s]));
    for (const c of citas) {
      expect(c.precio).toBe(porId.get(c.servicio_id).precio);
      expect(c.duracion_min).toBe(porId.get(c.servicio_id).duracion_min);
    }
  });

  it('usa solo barberos y servicios dados y respeta el horario de atención', () => {
    expect(citas.every((c) => base.barberos.includes(c.barbero_id))).toBe(true);
    expect(citas.every((c) => SERVICIOS.some((s) => s.id === c.servicio_id))).toBe(true);
    expect(citas.every((c) => intervaloDentroDeHorario(c.hora, c.duracion_min))).toBe(true);
  });

  it('no hay solapamientos entre citas del mismo barbero y día', () => {
    const grupos = new Map();
    for (const c of citas) {
      const clave = `${c.barbero_id}|${c.fecha}`;
      if (!grupos.has(clave)) grupos.set(clave, []);
      grupos.get(clave).push(c);
    }
    for (const lista of grupos.values()) {
      for (let i = 0; i < lista.length; i += 1) {
        for (let j = i + 1; j < lista.length; j += 1) {
          expect(solapan(lista[i], lista[j])).toBe(false);
        }
      }
    }
  });

  it('respeta las citas que ya existen (no se solapa con ellas)', () => {
    const ocupadas = [1, 2, 3].flatMap((barbero_id) =>
      Array.from({ length: DIAS_ATRAS + DIAS_ADELANTE + 1 }, (_, i) => ({
        barbero_id,
        fecha: sumarDias(HOY, i - DIAS_ATRAS),
        hora: '09:00:00',
        duracion_min: 240,
      }))
    );
    const conOcupadas = generarCitasDemo({ ...base, ocupadas });

    for (const c of conOcupadas) {
      expect(solapan(c, { hora: '09:00', duracion_min: 240 })).toBe(false);
    }
  });

  it('acepta servicios de precio 0 como cualquier otro', () => {
    expect(citas.some((c) => c.precio === 0)).toBe(true);
  });
});

describe('sembrarDemo / limpiarDemo contra la base de pruebas', () => {
  beforeEach(async () => {
    await pool.query('TRUNCATE citas RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    await pool.query('TRUNCATE citas RESTART IDENTITY CASCADE');
  });

  const insertarReal = (cliente, fecha) =>
    pool.query(
      `INSERT INTO citas (cliente, correo, telefono, servicio_id, barbero_id, fecha, hora, duracion_min, precio, estado)
       VALUES ($1, 'real@example.com', '3001234567', 1, 1, $2, '10:00', 30, 50000, 'pendiente')`,
      [cliente, fecha]
    );

  it('la simulación no escribe nada', async () => {
    const resumen = await sembrarDemo(pool, { simular: true });
    expect(resumen.total).toBeGreaterThan(100);
    expect(await contarDemo(pool)).toBe(0);
  });

  it('inserta citas válidas (la base acepta todas, sin solapar) y no toca las reales', async () => {
    await insertarReal('Cliente real 1', sumarDias(new Date().toISOString().slice(0, 10), 30));
    const resumen = await sembrarDemo(pool);

    expect(await contarDemo(pool)).toBe(resumen.total);
    expect(Object.keys(resumen.porEstado).sort()).toEqual(['cancelada', 'completada', 'pendiente']);
    const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM citas WHERE cliente = 'Cliente real 1'");
    expect(rows[0].n).toBe(1);
  });

  it('guarda el precio de la cita igual al del servicio en ese momento', async () => {
    await sembrarDemo(pool);
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM citas c JOIN servicios s ON s.id = c.servicio_id
       WHERE starts_with(c.cliente, $1) AND (c.precio <> s.precio OR c.duracion_min <> s.duracion_min)`,
      [MARCA_DEMO]
    );
    expect(rows[0].n).toBe(0);
  });

  it('cada cita demo lleva su línea en cita_servicios (snapshot coherente) y limpiar se las lleva en cascada', async () => {
    await sembrarDemo(pool);
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM citas c
       LEFT JOIN cita_servicios cs ON cs.cita_id = c.id AND cs.orden = 1
       WHERE starts_with(c.cliente, $1)
         AND (cs.id IS NULL OR cs.servicio_id <> c.servicio_id OR cs.duracion_min <> c.duracion_min OR cs.precio <> c.precio)`,
      [MARCA_DEMO]
    );
    expect(rows[0].n).toBe(0);

    await limpiarDemo(pool);
    const lineas = await pool.query('SELECT COUNT(*)::int AS n FROM cita_servicios');
    expect(lineas.rows[0].n).toBe(0);
  });

  it('se niega a duplicar: si ya hay datos demo pide limpiar primero', async () => {
    await sembrarDemo(pool);
    await expect(sembrarDemo(pool)).rejects.toThrow(/Ya hay \d+ citas demo/);
  });

  it('limpiar borra solo las citas demo y deja las reales intactas', async () => {
    await insertarReal('Cliente real 1', '2030-01-10');
    await insertarReal('Cliente real 2', '2030-01-11');
    await insertarReal('Cliente [demo] en medio', '2030-01-12'); // la marca solo cuenta al inicio
    await sembrarDemo(pool);

    const simulada = await limpiarDemo(pool, { simular: true });
    expect(simulada.eliminadas).toBeGreaterThan(100);
    expect(await contarDemo(pool)).toBe(simulada.eliminadas);

    const { eliminadas } = await limpiarDemo(pool);

    expect(eliminadas).toBe(simulada.eliminadas);
    expect(await contarDemo(pool)).toBe(0);
    const { rows } = await pool.query('SELECT cliente FROM citas ORDER BY cliente');
    expect(rows.map((r) => r.cliente)).toEqual(['Cliente [demo] en medio', 'Cliente real 1', 'Cliente real 2']);
  });

  it('se puede sembrar de nuevo después de limpiar', async () => {
    await sembrarDemo(pool);
    await limpiarDemo(pool);
    await expect(sembrarDemo(pool)).resolves.toMatchObject({ total: expect.any(Number) });
  });
});

describe('seguridad del comando seed:demo', () => {
  const ejecutar = (entorno, args = []) =>
    spawnSync(process.execPath, ['db/seedDemo.js', ...args], {
      cwd: RAIZ_BACKEND,
      env: { ...process.env, ...entorno },
      encoding: 'utf-8',
    });

  it('se niega con NODE_ENV=production', () => {
    const r = ejecutar({ NODE_ENV: 'production' }, ['--confirmar']);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/production/);
  });

  it('se niega contra una base de pruebas (DB_NAME con "test")', () => {
    const r = ejecutar({ NODE_ENV: 'development', DB_NAME: 'black_iron_test' }, ['--confirmar']);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/base de pruebas/);
  });

  it('rechaza argumentos desconocidos', () => {
    const r = ejecutar({ NODE_ENV: 'development' }, ['--todo']);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/desconocidos/);
  });
});
