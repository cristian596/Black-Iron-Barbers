import { pool } from '../db/connection.js';
import { hoyISO } from '../utils/fechas.js';
import { PERIODOS, calcularPeriodos, primerDiaDelMes, sumarDias, sumarMeses } from '../utils/periodos.js';
import { validarParametros, leerEntero } from '../utils/parametrosQuery.js';
import { resumenPeriodo, ingresosPorDia, ingresosPorMes, serviciosTop } from '../db/estadisticas.js';

const DIAS_GRAFICO = 30;
const MESES_GRAFICO = 12;
const LIMITE_POR_DEFECTO = 5;
const LIMITE_MAXIMO = 20;

const leerPeriodo = (valor, porDefecto) => {
  const periodo = valor ?? porDefecto;
  return PERIODOS.includes(periodo) ? periodo : null;
};

const errorPeriodo = `El parámetro 'periodo' debe ser uno de: ${PERIODOS.join(', ')}`;

export const obtenerEstadisticas = async (req, res, next) => {
  try {
    const errorParametros = validarParametros(req.query, ['periodo']);
    if (errorParametros) return res.status(400).json({ error: errorParametros });

    const periodo = leerPeriodo(req.query.periodo, 'hoy');
    if (!periodo) return res.status(400).json({ error: errorPeriodo });

    const { actual, anterior } = calcularPeriodos(periodo, hoyISO());
    const [datosActual, datosPrevio] = await Promise.all([
      resumenPeriodo(pool, actual),
      resumenPeriodo(pool, anterior),
    ]);

    res.json({ periodo: { clave: periodo, ...actual }, anterior, actual: datosActual, previo: datosPrevio });
  } catch (err) {
    next(err);
  }
};

// Últimos 30 días (o 12 meses) contra los 30 días (12 meses) inmediatamente anteriores, con ceros incluidos.
// Se consulta una sola serie del doble de largo y se divide en dos mitades.
export const obtenerIngresos = async (req, res, next) => {
  try {
    const errorParametros = validarParametros(req.query, ['agrupar']);
    if (errorParametros) return res.status(400).json({ error: errorParametros });

    const agrupar = req.query.agrupar ?? 'dia';
    if (!['dia', 'mes'].includes(agrupar)) {
      return res.status(400).json({ error: "El parámetro 'agrupar' debe ser dia o mes" });
    }

    const hoy = hoyISO();
    let serie;
    let largo;
    if (agrupar === 'dia') {
      largo = DIAS_GRAFICO;
      serie = await ingresosPorDia(pool, sumarDias(hoy, -(2 * largo - 1)), 2 * largo);
    } else {
      largo = MESES_GRAFICO;
      serie = await ingresosPorMes(pool, sumarMeses(primerDiaDelMes(hoy), -(2 * largo - 1)), 2 * largo);
    }

    res.json({ agrupar, anteriores: serie.slice(0, largo), puntos: serie.slice(largo) });
  } catch (err) {
    next(err);
  }
};

export const obtenerServiciosTop = async (req, res, next) => {
  try {
    const errorParametros = validarParametros(req.query, ['periodo', 'limite']);
    if (errorParametros) return res.status(400).json({ error: errorParametros });

    const periodo = leerPeriodo(req.query.periodo, '30d');
    if (!periodo) return res.status(400).json({ error: errorPeriodo });

    let limite = LIMITE_POR_DEFECTO;
    if (req.query.limite !== undefined) {
      limite = leerEntero(req.query.limite, 1, LIMITE_MAXIMO);
      if (Number.isNaN(limite)) {
        return res.status(400).json({ error: `El parámetro 'limite' debe ser un entero entre 1 y ${LIMITE_MAXIMO}` });
      }
    }

    const { actual } = calcularPeriodos(periodo, hoyISO());
    const servicios = await serviciosTop(pool, actual, limite);

    res.json({ periodo: { clave: periodo, ...actual }, servicios });
  } catch (err) {
    next(err);
  }
};
