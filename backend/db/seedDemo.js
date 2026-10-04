// Datos de demostración para el dashboard del admin (SOLO desarrollo, nunca en el flujo normal).
//
//   npm run seed:demo                          simulación: muestra qué se crearía, sin escribir nada
//   npm run seed:demo -- --confirmar           crea las citas demo
//   npm run seed:demo -- --limpiar             simulación de la limpieza
//   npm run seed:demo -- --limpiar --confirmar borra solo las citas demo
//
// Las citas demo se reconocen por la marca "[demo] " al inicio del nombre del cliente: la limpieza solo
// borra esas filas y no toca ninguna cita real. Se niega a correr con NODE_ENV=production o contra una
// base cuyo nombre incluya "test".
import { pathToFileURL } from 'node:url';
import { HORARIO_ATENCION } from '../config/horario.js';
import { hoyISO, horaActualBogota, intervaloDentroDeHorario, minutosDesdeMedianoche } from '../utils/fechas.js';
import { sumarDias } from '../utils/periodos.js';

export const MARCA_DEMO = '[demo] ';
export const DIAS_ATRAS = 60;
export const DIAS_ADELANTE = 5;

const NOMBRES = [
  'Andrés', 'Camila', 'Juan', 'Valentina', 'Santiago', 'Laura', 'Mateo', 'Daniela', 'Sebastián', 'Natalia',
  'Felipe', 'Paula', 'Nicolás', 'Sara', 'David', 'Mariana', 'Esteban', 'Luisa', 'Tomás', 'Carolina',
];
const APELLIDOS = [
  'Gómez', 'Rodríguez', 'Martínez', 'López', 'Hernández', 'Ramírez', 'Torres', 'Díaz', 'Vargas', 'Castro',
  'Rojas', 'Moreno', 'Ortiz', 'Silva', 'Mejía', 'Cardona',
];

// Generador pseudoaleatorio con semilla: la misma semilla produce siempre los mismos datos.
const crearAzar = (semilla) => {
  let estado = semilla >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const hhmm = (minutos) => `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;

const diaDeSemana = (fecha) => {
  const [a, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
};

// Genera la lista de citas demo (función pura, sin base de datos).
//  - barberos: ids de barberos activos · servicios: [{ id, duracion_min, precio }] activos
//  - ocupadas: citas existentes no canceladas [{ barbero_id, fecha, hora: 'HH:MM[:SS]', duracion_min }]
//  - minutosAhora: hora actual de Bogotá en minutos desde medianoche
export const generarCitasDemo = ({ hoy, minutosAhora, barberos, servicios, ocupadas = [], semilla = 2026 }) => {
  const azar = crearAzar(semilla);
  const elegir = (lista) => lista[Math.floor(azar() * lista.length)];
  const porPrecio = [...servicios].sort((a, b) => a.precio - b.precio || a.id - b.id);

  const intervalos = new Map();
  const clave = (barbero, fecha) => `${barbero}|${fecha}`;
  const ocupar = (barbero, fecha, inicio, fin) => {
    const k = clave(barbero, fecha);
    if (!intervalos.has(k)) intervalos.set(k, []);
    intervalos.get(k).push([inicio, fin]);
  };
  const libre = (barbero, fecha, inicio, fin) =>
    (intervalos.get(clave(barbero, fecha)) ?? []).every(([i, f]) => fin <= i || inicio >= f);

  for (const o of ocupadas) {
    const inicio = minutosDesdeMedianoche(o.hora.slice(0, 5));
    ocupar(o.barbero_id, o.fecha, inicio, inicio + o.duracion_min);
  }

  const apertura = minutosDesdeMedianoche(HORARIO_ATENCION.apertura);
  const cierre = minutosDesdeMedianoche(HORARIO_ATENCION.cierre);
  const ranuras = [];
  for (let m = apertura; m < cierre; m += HORARIO_ATENCION.intervaloMin) ranuras.push(m);

  const citas = [];
  for (let offset = -DIAS_ATRAS; offset <= DIAS_ADELANTE; offset += 1) {
    const fecha = sumarDias(hoy, offset);
    const dia = diaDeSemana(fecha);
    const cantidad = dia === 0 ? 2 + Math.floor(azar() * 3) : dia === 6 ? 8 + Math.floor(azar() * 5) : 5 + Math.floor(azar() * 4);

    for (let i = 0; i < cantidad; i += 1) {
      // Sesgo hacia los servicios más baratos: los populares son los de menor precio.
      const servicio = porPrecio[Math.floor(azar() ** 1.6 * porPrecio.length)];
      const barbero = elegir(barberos);

      let inicio = null;
      for (let intento = 0; intento < 12 && inicio === null; intento += 1) {
        const candidata = elegir(ranuras);
        if (
          intervaloDentroDeHorario(hhmm(candidata), servicio.duracion_min) &&
          libre(barbero, fecha, candidata, candidata + servicio.duracion_min)
        ) {
          inicio = candidata;
        }
      }
      if (inicio === null) continue;
      ocupar(barbero, fecha, inicio, inicio + servicio.duracion_min);

      const sorteo = azar();
      let estado;
      if (offset < 0) {
        estado = sorteo < 0.78 ? 'completada' : sorteo < 0.93 ? 'cancelada' : 'pendiente'; // pendiente = vencida
      } else if (offset === 0) {
        const yaTermino = inicio + servicio.duracion_min <= minutosAhora;
        estado = yaTermino ? (sorteo < 0.85 ? 'completada' : 'cancelada') : sorteo < 0.9 ? 'pendiente' : 'cancelada';
      } else {
        estado = sorteo < 0.92 ? 'pendiente' : 'cancelada';
      }

      const creada = sumarDias(fecha, -(1 + Math.floor(azar() * 3)));
      citas.push({
        cliente: `${MARCA_DEMO}${elegir(NOMBRES)} ${elegir(APELLIDOS)}`,
        correo: `demo${citas.length + 1}@example.com`,
        telefono: `3${String(100000000 + Math.floor(azar() * 99999999)).slice(0, 9)}`,
        servicio_id: servicio.id,
        barbero_id: barbero,
        fecha,
        hora: hhmm(inicio),
        duracion_min: servicio.duracion_min, // snapshot del servicio al momento de la cita
        precio: servicio.precio,
        estado,
        creada_en: `${creada > hoy ? hoy : creada} ${hhmm(480 + Math.floor(azar() * 600))}:00`,
      });
    }
  }
  return citas;
};

const resumirPorEstado = (citas) =>
  citas.reduce((acc, c) => ({ ...acc, [c.estado]: (acc[c.estado] ?? 0) + 1 }), {});

export const contarDemo = async (db) => {
  const { rows } = await db.query('SELECT COUNT(*)::int AS total FROM citas WHERE starts_with(cliente, $1)', [MARCA_DEMO]);
  return rows[0].total;
};

// Con `simular: true` calcula y devuelve el resumen sin escribir nada.
export const sembrarDemo = async (pool, { simular = false, semilla } = {}) => {
  const existentes = await contarDemo(pool);
  if (existentes > 0) {
    throw new Error(`Ya hay ${existentes} citas demo. Ejecuta primero: npm run seed:demo -- --limpiar --confirmar`);
  }

  const hoy = hoyISO();
  const [{ rows: barberos }, { rows: servicios }, { rows: ocupadas }] = await Promise.all([
    pool.query('SELECT id FROM barberos WHERE activo = true ORDER BY id'),
    pool.query('SELECT id, duracion_min, precio FROM servicios WHERE activo = true ORDER BY id'),
    pool.query(
      `SELECT barbero_id, fecha::text AS fecha, hora::text AS hora, duracion_min
       FROM citas WHERE estado <> 'cancelada' AND fecha BETWEEN $1::date AND $2::date`,
      [sumarDias(hoy, -DIAS_ATRAS), sumarDias(hoy, DIAS_ADELANTE)]
    ),
  ]);
  if (barberos.length === 0 || servicios.length === 0) {
    throw new Error('Hacen falta barberos y servicios activos (corre primero npm run seed).');
  }

  const citas = generarCitasDemo({
    hoy,
    minutosAhora: horaActualBogota(),
    barberos: barberos.map((b) => b.id),
    servicios,
    ocupadas,
    semilla,
  });
  const resumen = { total: citas.length, porEstado: resumirPorEstado(citas) };
  if (simular) return resumen;

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    for (const c of citas) {
      await cliente.query(
        `INSERT INTO citas
           (cliente, correo, telefono, servicio_id, barbero_id, fecha, hora, duracion_min, precio, estado, creada_en, consentimiento_en)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)`,
        [c.cliente, c.correo, c.telefono, c.servicio_id, c.barbero_id, c.fecha, c.hora, c.duracion_min, c.precio, c.estado, c.creada_en]
      );
    }
    await cliente.query('COMMIT');
  } catch (err) {
    await cliente.query('ROLLBACK');
    throw err;
  } finally {
    cliente.release();
  }
  return resumen;
};

// Borra únicamente las citas con la marca demo. Con `simular: true` solo las cuenta.
export const limpiarDemo = async (pool, { simular = false } = {}) => {
  if (simular) return { eliminadas: await contarDemo(pool) };
  const { rowCount } = await pool.query('DELETE FROM citas WHERE starts_with(cliente, $1)', [MARCA_DEMO]);
  return { eliminadas: rowCount };
};

const principal = async () => {
  const args = process.argv.slice(2);
  const limpiar = args.includes('--limpiar');
  const confirmar = args.includes('--confirmar');
  const desconocidos = args.filter((a) => !['--limpiar', '--confirmar'].includes(a));
  if (desconocidos.length > 0) {
    console.error(`❌ Argumentos desconocidos: ${desconocidos.join(', ')}. Usa --limpiar y/o --confirmar.`);
    process.exit(1);
  }

  if (process.env.NODE_ENV === 'production') {
    console.error('❌ seed:demo es solo para desarrollo: se niega a correr con NODE_ENV=production.');
    process.exit(1);
  }

  const { env } = await import('../config/env.js');
  if (env.db.database.toLowerCase().includes('test')) {
    console.error(`❌ seed:demo no se ejecuta contra la base de pruebas (${env.db.database}).`);
    process.exit(1);
  }

  const { pool } = await import('./connection.js');
  try {
    console.log(`Base: ${env.db.database} (${env.db.host}:${env.db.port})${confirmar ? '' : ' · SIMULACIÓN (agrega --confirmar para escribir)'}`);
    if (limpiar) {
      const { eliminadas } = await limpiarDemo(pool, { simular: !confirmar });
      console.log(confirmar ? `🧹 ${eliminadas} citas demo eliminadas. Las citas reales no se tocaron.` : `Se eliminarían ${eliminadas} citas demo.`);
    } else {
      const { total, porEstado } = await sembrarDemo(pool, { simular: !confirmar });
      console.log(`${confirmar ? '✅ Creadas' : 'Se crearían'} ${total} citas demo:`, porEstado);
    }
  } finally {
    await pool.end();
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal().catch((err) => {
    console.error('❌ Error en seed:demo:', err.message);
    process.exit(1);
  });
}
