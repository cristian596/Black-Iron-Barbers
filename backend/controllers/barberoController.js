// Panel del barbero (solo lectura). Rutas bajo /api/barbero con verificarToken + requiereRol('barbero'). El
// barbero_id sale de req.usuario (consultado a la base en cada petición), nunca del cliente: un barbero no puede ver
// datos de otro ni forzándolo con parámetros (los parámetros desconocidos o repetidos dan 400).
import { pool } from '../db/connection.js';
import { ahoraBogota, hoyISO } from '../utils/fechas.js';
import { primerDiaDelMes, sumarDias, sumarMeses } from '../utils/periodos.js';
import { validarParametros } from '../utils/parametrosQuery.js';
import { MINUTOS_GRACIA_CONFIRMACION, TOPE_POR_CONFIRMAR } from '../utils/confirmacion.js';
import { resumenPeriodo } from '../db/estadisticas.js';
import { agendaDelDia, contarPorConfirmar, listarPorConfirmar, proximaCita } from '../db/barbero.js';

// Valida parámetros (ninguno admitido) y devuelve el id del barbero de la sesión, o responde el error y devuelve null.
const preparar = (req, res) => {
  const errorParametros = validarParametros(req.query, []);
  if (errorParametros) {
    res.status(400).json({ error: errorParametros, codigo: 'PARAMETRO_INVALIDO' });
    return null;
  }
  if (!Number.isInteger(req.usuario.barbero_id)) {
    res.status(403).json({ error: 'Tu usuario no está ligado a un barbero', codigo: 'SIN_BARBERO' });
    return null;
  }
  return req.usuario.barbero_id;
};

// GET /api/barbero/resumen
export const resumenDelDia = async (req, res, next) => {
  try {
    const barberoId = preparar(req, res);
    if (barberoId === null) return;

    const hoy = hoyISO();
    const inicioMes = primerDiaDelMes(hoy);
    const finMes = sumarDias(sumarMeses(inicioMes, 1), -1);
    const ahora = ahoraBogota();

    const [dia, mes, proxima, porConfirmar] = await Promise.all([
      resumenPeriodo(pool, { desde: hoy, hasta: hoy }, barberoId),
      resumenPeriodo(pool, { desde: inicioMes, hasta: finMes }, barberoId),
      proximaCita(pool, barberoId, ahora),
      contarPorConfirmar(pool, barberoId, ahora, MINUTOS_GRACIA_CONFIRMACION),
    ]);

    res.json({
      fecha: hoy,
      citas_hoy: dia.citas, // no canceladas
      completadas_hoy: dia.completadas,
      pendientes_hoy: dia.citas - dia.completadas,
      proxima_cita: proxima,
      ingresos_hoy: dia.ingresos,
      cortes_mes: mes.completadas,
      ingresos_mes: mes.ingresos,
      por_confirmar: porConfirmar,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/barbero/citas-por-confirmar → { total, tope, items }
export const citasPorConfirmar = async (req, res, next) => {
  try {
    const barberoId = preparar(req, res);
    if (barberoId === null) return;

    const ahora = ahoraBogota();
    const [items, total] = await Promise.all([
      listarPorConfirmar(pool, barberoId, ahora, MINUTOS_GRACIA_CONFIRMACION, TOPE_POR_CONFIRMAR),
      contarPorConfirmar(pool, barberoId, ahora, MINUTOS_GRACIA_CONFIRMACION),
    ]);
    res.json({ total, tope: TOPE_POR_CONFIRMAR, items });
  } catch (err) {
    next(err);
  }
};

// GET /api/barbero/agenda-hoy → { fecha, citas }
export const agendaHoy = async (req, res, next) => {
  try {
    const barberoId = preparar(req, res);
    if (barberoId === null) return;

    const hoy = hoyISO();
    const citas = await agendaDelDia(pool, barberoId, hoy, ahoraBogota(), MINUTOS_GRACIA_CONFIRMACION);
    res.json({ fecha: hoy, citas });
  } catch (err) {
    next(err);
  }
};
