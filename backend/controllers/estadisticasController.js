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

// Los controladores se construyen con `alcance(req, res)`: devuelve el id del barbero al que se limitan las cifras
// (null = todos, caso del admin) o `undefined` si ya respondió un error. El panel del barbero usa los mismos
// controladores con su barbero_id (de req.usuario) y añade `codigo` a los 400.
const crearControladores = (alcance, conCodigo) => {
  const error400 = (res, error) => res.status(400).json(conCodigo ? { error, codigo: 'PARAMETRO_INVALIDO' } : { error });

  const obtenerEstadisticas = async (req, res, next) => {
    try {
      const barberoId = alcance(req, res);
      if (barberoId === undefined) return;

      const errorParametros = validarParametros(req.query, ['periodo']);
      if (errorParametros) return error400(res, errorParametros);

      const periodo = leerPeriodo(req.query.periodo, 'hoy');
      if (!periodo) return error400(res, errorPeriodo);

      const { actual, anterior } = calcularPeriodos(periodo, hoyISO());
      const [datosActual, datosPrevio] = await Promise.all([
        resumenPeriodo(pool, actual, barberoId),
        resumenPeriodo(pool, anterior, barberoId),
      ]);

      res.json({ periodo: { clave: periodo, ...actual }, anterior, actual: datosActual, previo: datosPrevio });
    } catch (err) {
      next(err);
    }
  };

  // Últimos 30 días (o 12 meses) contra los 30 días (12 meses) inmediatamente anteriores, con ceros incluidos.
  // Se consulta una sola serie del doble de largo y se divide en dos mitades.
  const obtenerIngresos = async (req, res, next) => {
    try {
      const barberoId = alcance(req, res);
      if (barberoId === undefined) return;

      const errorParametros = validarParametros(req.query, ['agrupar']);
      if (errorParametros) return error400(res, errorParametros);

      const agrupar = req.query.agrupar ?? 'dia';
      if (!['dia', 'mes'].includes(agrupar)) {
        return error400(res, "El parámetro 'agrupar' debe ser dia o mes");
      }

      const hoy = hoyISO();
      let serie;
      let largo;
      if (agrupar === 'dia') {
        largo = DIAS_GRAFICO;
        serie = await ingresosPorDia(pool, sumarDias(hoy, -(2 * largo - 1)), 2 * largo, barberoId);
      } else {
        largo = MESES_GRAFICO;
        serie = await ingresosPorMes(pool, sumarMeses(primerDiaDelMes(hoy), -(2 * largo - 1)), 2 * largo, barberoId);
      }

      res.json({ agrupar, anteriores: serie.slice(0, largo), puntos: serie.slice(largo) });
    } catch (err) {
      next(err);
    }
  };

  const obtenerServiciosTop = async (req, res, next) => {
    try {
      const barberoId = alcance(req, res);
      if (barberoId === undefined) return;

      const errorParametros = validarParametros(req.query, ['periodo', 'limite']);
      if (errorParametros) return error400(res, errorParametros);

      const periodo = leerPeriodo(req.query.periodo, '30d');
      if (!periodo) return error400(res, errorPeriodo);

      let limite = LIMITE_POR_DEFECTO;
      if (req.query.limite !== undefined) {
        limite = leerEntero(req.query.limite, 1, LIMITE_MAXIMO);
        if (Number.isNaN(limite)) {
          return error400(res, `El parámetro 'limite' debe ser un entero entre 1 y ${LIMITE_MAXIMO}`);
        }
      }

      const { actual } = calcularPeriodos(periodo, hoyISO());
      const servicios = await serviciosTop(pool, actual, limite, barberoId);

      res.json({ periodo: { clave: periodo, ...actual }, servicios });
    } catch (err) {
      next(err);
    }
  };

  return { obtenerEstadisticas, obtenerIngresos, obtenerServiciosTop };
};

// Admin: todas las citas.
export const { obtenerEstadisticas, obtenerIngresos, obtenerServiciosTop } = crearControladores(() => null, false);

// Barbero: solo las suyas. El barbero_id sale de req.usuario (base de datos), nunca de la petición.
export const {
  obtenerEstadisticas: obtenerMisEstadisticas,
  obtenerIngresos: obtenerMisIngresos,
  obtenerServiciosTop: obtenerMisServiciosTop,
} = crearControladores((req, res) => {
  if (!Number.isInteger(req.usuario.barbero_id)) {
    res.status(403).json({ error: 'Tu usuario no está ligado a un barbero', codigo: 'SIN_BARBERO' });
    return undefined;
  }
  return req.usuario.barbero_id;
}, true);
