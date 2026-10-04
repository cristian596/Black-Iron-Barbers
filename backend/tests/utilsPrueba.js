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
  return rows[0].id;
};
