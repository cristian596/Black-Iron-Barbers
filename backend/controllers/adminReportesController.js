// Reporte diario del admin: un solo día, sin desglose por barbero. Mismas reglas que /admin/estadisticas
// (ingresos = SUM(citas.precio) de las completadas, el ticket promedio excluye precio 0, las canceladas aparte).
// Cortes y asesorías van separados: total_cortes y servicios_mas_pedidos son de BARBERÍA; total_asesorias,
// ingresos_asesoria y asesorias_mas_pedidas, de asesoría. `ingresos` es el total de ambas áreas.
// "Hoy" lo decide Node con hoyISO() (Bogotá), nunca CURRENT_DATE/NOW().
import { pool } from '../db/connection.js';
import { hoyISO } from '../utils/fechas.js';
import { esFechaCalendario } from '../utils/periodos.js';
import { validarParametros } from '../utils/parametrosQuery.js';
import { generarCsv } from '../utils/csv.js';
import { resumenPeriodo, serviciosTop } from '../db/estadisticas.js';
import { AREA_BARBERIA, AREA_ASESORIA } from '../utils/areas.js';

const LIMITE_SERVICIOS = 10;

const fallo = (res, estado, codigo, error) => res.status(estado).json({ error, codigo });

// Devuelve la fecha validada ('hoy' si no se envía) o responde el error y devuelve null.
const leerFecha = (req, res) => {
  const errorParametros = validarParametros(req.query, ['fecha']);
  if (errorParametros) {
    fallo(res, 400, 'PARAMETRO_INVALIDO', errorParametros);
    return null;
  }
  const hoy = hoyISO();
  const fecha = req.query.fecha ?? hoy;
  if (!esFechaCalendario(fecha)) {
    fallo(res, 400, 'FECHA_INVALIDA', "El parámetro 'fecha' debe ser una fecha real con formato AAAA-MM-DD");
    return null;
  }
  if (fecha > hoy) {
    fallo(res, 400, 'FECHA_FUTURA', 'No hay reporte de un día que todavía no llega');
    return null;
  }
  return fecha;
};

const construirReporte = async (fecha) => {
  const rango = { desde: fecha, hasta: fecha };
  const [resumen, servicios, asesorias, pendientes] = await Promise.all([
    resumenPeriodo(pool, rango),
    serviciosTop(pool, rango, LIMITE_SERVICIOS, null, AREA_BARBERIA),
    serviciosTop(pool, rango, LIMITE_SERVICIOS, null, AREA_ASESORIA),
    pool.query("SELECT COUNT(*)::int AS n FROM citas WHERE fecha = $1::date AND estado = 'pendiente'", [fecha]),
  ]);
  return {
    fecha,
    total_cortes: resumen.cortes,
    total_asesorias: resumen.asesorias,
    ingresos: resumen.ingresos,
    ingresos_barberia: resumen.ingresos_barberia,
    ingresos_asesoria: resumen.ingresos_asesoria,
    ticket_promedio: resumen.ticket_promedio, // solo barbería
    canceladas: resumen.canceladas,
    pendientes_sin_cerrar: pendientes.rows[0].n,
    servicios_mas_pedidos: servicios.map(({ nombre, cantidad, ingresos }) => ({ nombre, cantidad, ingresos })),
    asesorias_mas_pedidas: asesorias.map(({ nombre, cantidad, ingresos }) => ({ nombre, cantidad, ingresos })),
  };
};

// GET /api/admin/reportes/diario?fecha=AAAA-MM-DD
export const reporteDiario = async (req, res, next) => {
  try {
    const fecha = leerFecha(req, res);
    if (fecha === null) return;
    res.json(await construirReporte(fecha));
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/reportes/diario.csv?fecha=AAAA-MM-DD  (mismo contenido que el JSON)
export const reporteDiarioCsv = async (req, res, next) => {
  try {
    const fecha = leerFecha(req, res);
    if (fecha === null) return;
    const r = await construirReporte(fecha);

    const filas = [
      ['Reporte diario', r.fecha],
      ['Total de cortes', r.total_cortes],
      ['Ingresos', r.ingresos],
      ['Ticket promedio', r.ticket_promedio],
      ['Canceladas', r.canceladas],
      ['Pendientes sin cerrar', r.pendientes_sin_cerrar],
      [],
      ['Servicio', 'Cantidad', 'Ingresos'],
      ...r.servicios_mas_pedidos.map((s) => [s.nombre, s.cantidad, s.ingresos]),
      // Bloque de asesorías (filas NUEVAS al final: las anteriores no cambian de lugar ni de columnas, que siguen siendo 3).
      [],
      ['Total de asesorías', r.total_asesorias],
      ['Ingresos de barbería', r.ingresos_barberia],
      ['Ingresos de asesorías', r.ingresos_asesoria],
      [],
      ['Asesoría', 'Cantidad', 'Ingresos'],
      ...r.asesorias_mas_pedidas.map((s) => [s.nombre, s.cantidad, s.ingresos]),
    ];

    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="reporte-diario-${fecha}.csv"`,
      'Cache-Control': 'no-store',
    });
    res.send(generarCsv(filas));
  } catch (err) {
    next(err);
  }
};
