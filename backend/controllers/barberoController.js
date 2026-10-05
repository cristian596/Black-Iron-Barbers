// Panel del barbero (solo lectura). Rutas bajo /api/barbero con verificarToken + requiereRol('barbero'). El
// barbero_id sale de req.usuario (consultado a la base en cada petición), nunca del cliente: un barbero no puede ver
// datos de otro ni forzándolo con parámetros (los parámetros desconocidos o repetidos dan 400).
import { pool } from '../db/connection.js';
import { ahoraBogota, hoyISO } from '../utils/fechas.js';
import { primerDiaDelMes, sumarDias, sumarMeses } from '../utils/periodos.js';
import { validarParametros, leerEntero, escaparLike } from '../utils/parametrosQuery.js';
import { esFechaCalendario } from '../utils/periodos.js';
import { MINUTOS_GRACIA_CONFIRMACION, TOPE_POR_CONFIRMAR } from '../utils/confirmacion.js';
import { resumenPeriodo } from '../db/estadisticas.js';
import { PESTANAS_BARBERO, agendaDelDia, contarPorConfirmar, listarCitasBarbero, listarPorConfirmar, proximaCita } from '../db/barbero.js';

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

const PARAMETROS_CITAS = ['pestana', 'q', 'desde', 'hasta', 'pagina', 'limite'];
const LIMITE_POR_DEFECTO = 10;
const LIMITE_MAXIMO = 50;
const PAGINA_MAXIMA = 1_000_000;
const MAX_LONGITUD_Q = 100;

const parametroInvalido = (res, campo, mensaje) => res.status(400).json({ error: mensaje, codigo: 'PARAMETRO_INVALIDO', campo });

// GET /api/barbero/citas?pestana=&q=&desde=&hasta=&pagina=&limite= → { items, pagina, limite, total, conteos }
// Solo sus citas. Una página fuera de rango devuelve items vacíos (como /api/admin/citas): el front pasa a la última válida.
export const listarMisCitas = async (req, res, next) => {
  try {
    const errorParametros = validarParametros(req.query, PARAMETROS_CITAS);
    if (errorParametros) return res.status(400).json({ error: errorParametros, codigo: 'PARAMETRO_INVALIDO' });
    if (!Number.isInteger(req.usuario.barbero_id)) {
      return res.status(403).json({ error: 'Tu usuario no está ligado a un barbero', codigo: 'SIN_BARBERO' });
    }

    const { pestana = 'hoy', q, desde, hasta, pagina, limite } = req.query;
    if (!PESTANAS_BARBERO.includes(pestana)) {
      return parametroInvalido(res, 'pestana', `El parámetro 'pestana' debe ser uno de: ${PESTANAS_BARBERO.join(', ')}`);
    }
    if (q !== undefined && q.trim().length > MAX_LONGITUD_Q) {
      return parametroInvalido(res, 'q', `El parámetro 'q' no puede superar ${MAX_LONGITUD_Q} caracteres`);
    }
    for (const [nombre, valor] of [['desde', desde], ['hasta', hasta]]) {
      if (valor !== undefined && !esFechaCalendario(valor)) {
        return parametroInvalido(res, nombre, `El parámetro '${nombre}' debe ser una fecha válida AAAA-MM-DD`);
      }
    }
    if (desde !== undefined && hasta !== undefined && desde > hasta) {
      return parametroInvalido(res, 'desde', "El parámetro 'desde' no puede ser posterior a 'hasta'");
    }
    let paginaActual = 1;
    if (pagina !== undefined) {
      paginaActual = leerEntero(pagina, 1, PAGINA_MAXIMA);
      if (Number.isNaN(paginaActual)) {
        return parametroInvalido(res, 'pagina', `El parámetro 'pagina' debe ser un entero entre 1 y ${PAGINA_MAXIMA}`);
      }
    }
    let tamano = LIMITE_POR_DEFECTO;
    if (limite !== undefined) {
      tamano = leerEntero(limite, 1, LIMITE_MAXIMO);
      if (Number.isNaN(tamano)) {
        return parametroInvalido(res, 'limite', `El parámetro 'limite' debe ser un entero entre 1 y ${LIMITE_MAXIMO}`);
      }
    }

    const { items, total, conteos } = await listarCitasBarbero(
      pool,
      req.usuario.barbero_id,
      {
        pestana,
        patron: q?.trim() ? `%${escaparLike(q.trim())}%` : undefined,
        desde,
        hasta,
        limite: tamano,
        offset: (paginaActual - 1) * tamano,
      },
      ahoraBogota(),
      MINUTOS_GRACIA_CONFIRMACION
    );

    res.json({ items, pagina: paginaActual, limite: tamano, total, conteos });
  } catch (err) {
    next(err);
  }
};
