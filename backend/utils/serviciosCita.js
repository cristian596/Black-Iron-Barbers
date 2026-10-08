// Servicios de una cita (de 1 a 3, atendidos seguidos por el mismo barbero como un solo bloque). Una sola fuente de
// verdad para la reserva y la disponibilidad: los límites, la lectura estricta de ids y la carga de los servicios.
// Una reserva puede mezclar UNA asesoría con hasta 2 servicios de barbería: se parte en dos grupos (una cita por grupo).
// La duración y el precio de la cita SIEMPRE se calculan aquí con lo que hay en la base; jamás con lo que mande el cliente.

import {
  MAX_ASESORIAS_POR_RESERVA,
  errorLimiteAsesorias,
  serviciosDeAsesoria,
  serviciosDeBarberia,
} from './areas.js';

export const MAX_SERVICIOS_POR_CITA = 3;
// Tope de duración SOLO para combos (2 o más servicios). Un servicio individual se puede reservar aunque dure más
// (el catálogo admite hasta 600 min): lo limita únicamente el horario de atención.
export const MAX_DURACION_TOTAL_MIN = 240;
const ID_MAXIMO_INT = 2147483647;

// Un error es { status, cuerpo } listo para `res.status(status).json(cuerpo)`.
const falla = (cuerpo) => ({ status: 400, cuerpo });

const errorServiciosNoDisponibles = (ids, total) =>
  falla({
    error:
      total === 1
        ? 'El servicio seleccionado no existe o no está disponible'
        : 'Uno o más servicios seleccionados no existen o no están disponibles',
    codigo: 'SERVICIO_NO_DISPONIBLE',
    servicios_no_disponibles: ids,
  });

// Límites y repetidos de una lista de ids ya numéricos. Devuelve un error o null.
export const validarListaIds = (ids) => {
  if (ids.length < 1 || ids.length > MAX_SERVICIOS_POR_CITA) {
    return falla({
      error: `Debes elegir entre 1 y ${MAX_SERVICIOS_POR_CITA} servicios`,
      codigo: 'LIMITE_SERVICIOS',
      maximo: MAX_SERVICIOS_POR_CITA,
    });
  }
  if (new Set(ids).size !== ids.length) {
    return falla({ error: 'No puedes repetir un servicio en la misma reserva', codigo: 'SERVICIOS_REPETIDOS' });
  }
  return null;
};

const datosInvalidos = (campo, error) => falla({ error, codigo: 'DATOS_INVALIDOS', campo });

// Lee los servicios pedidos en el cuerpo de POST /api/citas.
//  - `servicios_ids`: array de 1 a 3 enteros positivos (number JSON; ni strings ni objetos), sin repetidos.
//  - `servicio_id` (formato anterior): equivale a [servicio_id]. Si llegan los dos campos, 400.
// Devuelve { ids } o { error }.
export const leerServiciosDelCuerpo = ({ servicio_id: servicioId, servicios_ids: serviciosIds }) => {
  if (serviciosIds !== undefined && servicioId !== undefined) {
    return { error: datosInvalidos('servicios_ids', 'Envía servicios_ids o servicio_id, no los dos a la vez') };
  }

  if (serviciosIds !== undefined) {
    if (!Array.isArray(serviciosIds)) {
      return { error: datosInvalidos('servicios_ids', 'servicios_ids debe ser un arreglo de ids') };
    }
    const todosEnteros = serviciosIds.every(
      (id) => typeof id === 'number' && Number.isInteger(id) && id >= 1 && id <= ID_MAXIMO_INT
    );
    if (!todosEnteros) {
      return { error: datosInvalidos('servicios_ids', 'Cada servicio debe ser un id numérico entero positivo') };
    }
    return { ids: serviciosIds, error: validarListaIds(serviciosIds) ?? undefined };
  }

  // Formato anterior: se aceptan número o texto numérico, nada más (ni arreglos ni objetos).
  if (typeof servicioId !== 'number' && typeof servicioId !== 'string') {
    return { error: falla({ error: 'El servicio es obligatorio' }) };
  }
  const numero = Number(servicioId);
  if (!Number.isInteger(numero)) return { error: falla({ error: 'El servicio es obligatorio' }) };
  if (numero < 1 || numero > ID_MAXIMO_INT) return { error: errorServiciosNoDisponibles([numero], 1) };
  return { ids: [numero] };
};

// Lee `servicios=1,2,3` de GET /api/disponibilidad: ids decimales separados por coma, sin espacios ni vacíos.
export const leerServiciosCsv = (texto) => {
  if (typeof texto !== 'string' || !/^\d{1,10}(,\d{1,10})*$/.test(texto)) {
    return { error: datosInvalidos('servicios', 'servicios debe ser una lista de ids numéricos separados por comas') };
  }
  const ids = texto.split(',').map(Number);
  if (ids.some((id) => id < 1 || id > ID_MAXIMO_INT)) {
    return { error: datosInvalidos('servicios', 'servicios debe contener ids numéricos válidos') };
  }
  return { ids, error: validarListaIds(ids) ?? undefined };
};

const sumar = (lista, campo) => lista.reduce((suma, servicio) => suma + servicio[campo], 0);

// Totales de un grupo de servicios que va en UNA cita; sus líneas se numeran de nuevo 1..n (UNIQUE (cita_id, orden)).
const armarGrupo = (lista) => {
  const numerada = lista.map((servicio, indice) => ({ ...servicio, orden: indice + 1 }));
  return { lista: numerada, duracion: sumar(numerada, 'duracion_min'), precio: sumar(numerada, 'precio') };
};

// Carga los servicios ACTIVOS pedidos (en el orden pedido) con su duración, precio, área y clave_seed actuales, y calcula
// los totales. Con `bloquear` toma FOR SHARE sobre las filas (ordenadas por id para no provocar deadlocks entre
// reservas): una baja del servicio queda esperando hasta que la reserva termine, así nunca se reserva algo que se
// desactiva a mitad.
// Devuelve { lista, duracion, precio, asesoria, barberia } o { error }.
//  - `lista`/`duracion`/`precio`: toda la reserva, con `orden` global (1..3).
//  - `asesoria` y `barberia`: cada grupo ({ lista, duracion, precio }, con `orden` propio) o null si no hay servicios de
//    esa área. Cada grupo es UNA cita, atendida por un profesional de su área.
// Reglas de la reserva (los errores salen en este orden): servicios inexistentes/inactivos → máximo UNA asesoría
// (LIMITE_ASESORIAS) → tope de duración. La asesoría gratis se ofrece como cualquier otra: su límite de una por persona
// necesita la identidad del cliente y lo decide POST /api/citas dentro de la transacción.
// El tope de 240 min se aplica POR CITA (por grupo), no a la suma de asesoría + corte: lo que protege es el bloque
// continuo de un solo profesional (los combos de barbería ya lo tenían), y cada profesional atiende solo su cita. Sumar
// los dos castigaría al cliente por una asesoría larga que no ocupa al barbero. Siguen acotando la reserva el máximo de
// 3 servicios y el horario de atención, que sí se mide sobre la duración total encadenada.
export const cargarServicios = async (db, ids, { bloquear = false } = {}) => {
  const { rows } = await db.query(
    `SELECT id, nombre, duracion_min, precio, area, clave_seed
     FROM servicios
     WHERE id = ANY($1::int[]) AND activo = true
     ORDER BY id
     ${bloquear ? 'FOR SHARE' : ''}`,
    [ids]
  );
  const porId = new Map(rows.map((fila) => [fila.id, fila]));

  const faltantes = ids.filter((id) => !porId.has(id));
  if (faltantes.length > 0) return { error: errorServiciosNoDisponibles(faltantes, ids.length) };

  const pedidos = ids.map((id) => porId.get(id));
  const deAsesoria = serviciosDeAsesoria(pedidos);
  const deBarberia = serviciosDeBarberia(pedidos);

  if (deAsesoria.length > MAX_ASESORIAS_POR_RESERVA) return { error: errorLimiteAsesorias() };

  const grupos = [deAsesoria, deBarberia];
  for (const grupo of grupos) {
    const duracion = sumar(grupo, 'duracion_min');
    if (grupo.length >= 2 && duracion > MAX_DURACION_TOTAL_MIN) {
      return {
        error: falla({
          error: `La duración total de los servicios (${duracion} min) supera el máximo de ${MAX_DURACION_TOTAL_MIN} min por reserva`,
          codigo: 'DURACION_EXCEDIDA',
          duracion_total_min: duracion,
          maximo_min: MAX_DURACION_TOTAL_MIN,
        }),
      };
    }
  }

  const lista = pedidos.map((servicio, indice) => ({ ...servicio, orden: indice + 1 }));
  return {
    lista,
    duracion: sumar(lista, 'duracion_min'),
    precio: sumar(lista, 'precio'),
    asesoria: deAsesoria.length > 0 ? armarGrupo(deAsesoria) : null,
    barberia: deBarberia.length > 0 ? armarGrupo(deBarberia) : null,
  };
};
