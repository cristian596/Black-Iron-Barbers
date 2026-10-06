import jwt from 'jsonwebtoken';
import { pool } from '../db/connection.js';

// Reloj usado por las pruebas del dashboard: 22:00 en Bogotá del 4 de octubre de 2026,
// que en UTC ya es el 5 de octubre. Si algún cálculo usara UTC, "hoy" saldría mal.
export const NOCHE_BOGOTA = '2026-10-05T03:00:00Z';
export const HOY = '2026-10-04';

// Se firma después de fijar el reloj simulado para que el token no nazca vencido.
export const firmarToken = (rol) =>
  jwt.sign(
    { id: rol === 'admin' ? 1 : 2, usuario: `${rol}_prueba`, rol, barbero_id: rol === 'admin' ? null : 1 },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

// Línea única de servicio para una cita insertada a mano (lo que hace la reserva real): snapshot del nombre del catálogo
// y de la duración y precio indicados. Las pruebas que insertan citas con SQL directo la usan para que los lectores
// (que leen cita_servicios) vean el servicio.
export const insertarLineaServicio = (citaId, { servicio_id = 1, duracion_min = 30, precio = 50000 } = {}) =>
  pool.query(
    `INSERT INTO cita_servicios (cita_id, servicio_id, orden, nombre, duracion_min, precio)
     SELECT $1, s.id, 1, s.nombre, $3, $4 FROM servicios s WHERE s.id = $2`,
    [citaId, servicio_id, duracion_min, precio]
  );

let contador = 0;
export const reiniciarContador = () => {
  contador = 0;
};

// Inserta una cita directamente. Si no se indican barbero y hora, reparte las citas en ranuras que no se solapan.
export const insertarCita = async ({
  fecha,
  estado = 'completada',
  precio = 50000,
  servicio_id = 1,
  duracion_min = 30,
  cliente = 'Cliente de prueba',
  barbero_id,
  hora,
}) => {
  const k = contador;
  contador += 1;
  // k=0..3 → 09:00/09:30 con barbero 1 y 2; k=4..7 → 10:00/10:30, etc.
  const horaFinal = hora ?? `${String(9 + Math.floor(k / 4)).padStart(2, '0')}:${k % 2 === 0 ? '00' : '30'}`;
  const barberoFinal = barbero_id ?? (k % 4 < 2 ? 1 : 2);
  const { rows } = await pool.query(
    `INSERT INTO citas (cliente, correo, telefono, servicio_id, barbero_id, fecha, hora, duracion_min, precio, estado)
     VALUES ($1, 'c@example.com', '3001234567', $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [cliente, servicio_id, barberoFinal, fecha, horaFinal, duracion_min, precio, estado]
  );
  await insertarLineaServicio(rows[0].id, { servicio_id, duracion_min, precio });
  return rows[0].id;
};

// Inserta una cita con VARIOS servicios como lo hace la reserva real: duración y precio de la cita = suma de las líneas,
// servicio principal = el primero, y una línea por servicio con el snapshot (nombre, duración y precio actuales).
export const insertarCitaConServicios = async ({
  ids,
  fecha,
  hora,
  estado = 'completada',
  cliente = 'Cliente combo',
  barbero_id = 1,
}) => {
  const { rows: servicios } = await pool.query(
    'SELECT id, nombre, duracion_min, precio FROM servicios WHERE id = ANY($1::int[])',
    [ids]
  );
  const lista = ids.map((id) => servicios.find((servicio) => servicio.id === id));
  const duracion = lista.reduce((suma, servicio) => suma + servicio.duracion_min, 0);
  const precio = lista.reduce((suma, servicio) => suma + servicio.precio, 0);
  const { rows } = await pool.query(
    `INSERT INTO citas (cliente, correo, telefono, servicio_id, barbero_id, fecha, hora, duracion_min, precio, estado)
     VALUES ($1, 'c@example.com', '3001234567', $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [cliente, ids[0], barbero_id, fecha, hora, duracion, precio, estado]
  );
  for (const [indice, servicio] of lista.entries()) {
    await pool.query(
      `INSERT INTO cita_servicios (cita_id, servicio_id, orden, nombre, duracion_min, precio) VALUES ($1, $2, $3, $4, $5, $6)`,
      [rows[0].id, servicio.id, indice + 1, servicio.nombre, servicio.duracion_min, servicio.precio]
    );
  }
  return rows[0].id;
};

// Servicios de prueba para las reservas con varios servicios (ids altos para no chocar con los de globalSetup).
export const SERVICIOS_COMBO = [
  { id: 201, nombre: 'Corte T', duracion_min: 30, precio: 20000, activo: true },
  { id: 202, nombre: 'Barba T', duracion_min: 30, precio: 15000, activo: true },
  { id: 203, nombre: 'Cejas T', duracion_min: 20, precio: 5000, activo: true },
  { id: 204, nombre: 'Largo A T', duracion_min: 120, precio: 80000, activo: true },
  { id: 205, nombre: 'Largo B T', duracion_min: 120, precio: 90000, activo: true },
  { id: 206, nombre: 'Inactivo T', duracion_min: 30, precio: 10000, activo: false },
  { id: 207, nombre: 'Largo único T', duracion_min: 300, precio: 150000, activo: true },
];

export const crearServiciosCombo = async () => {
  await borrarServiciosCombo();
  for (const s of SERVICIOS_COMBO) {
    await pool.query('INSERT INTO servicios (id, nombre, duracion_min, precio, activo) VALUES ($1, $2, $3, $4, $5)', [
      s.id, s.nombre, s.duracion_min, s.precio, s.activo,
    ]);
  }
};

export const borrarServiciosCombo = async () => {
  const ids = SERVICIOS_COMBO.map((s) => s.id);
  await pool.query('DELETE FROM citas WHERE id IN (SELECT cita_id FROM cita_servicios WHERE servicio_id = ANY($1::int[]))', [ids]);
  await pool.query('DELETE FROM servicios WHERE id = ANY($1::int[])', [ids]);
};
