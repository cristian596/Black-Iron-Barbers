// Aritmética de fechas de calendario (AAAA-MM-DD) en UTC puro: la fecha es un dato de calendario, no un
// instante, así que no depende de la zona del servidor. "Hoy" lo decide quien llama (hoyISO() en Bogotá).

const aUTC = (iso) => {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia));
};

// Valida que la fecha exista de verdad en el calendario ('2026-02-31' no existe; new Date() la "corrige").
export const esFechaCalendario = (valor) =>
  typeof valor === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(valor) &&
  aUTC(valor).toISOString().slice(0, 10) === valor;

export const sumarDias = (iso, dias) => {
  const fecha = aUTC(iso);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
};

export const primerDiaDelMes = (iso) => `${iso.slice(0, 7)}-01`;

// `primerDia` debe ser el día 1 de un mes.
export const sumarMeses = (primerDia, meses) => {
  const [anio, mes] = primerDia.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1 + meses, 1)).toISOString().slice(0, 10);
};

const diasDelMes = (primerDia) => {
  const [anio, mes] = primerDia.split('-').map(Number);
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
};

export const PERIODOS = ['hoy', '7d', '30d', 'mes'];

// Devuelve el período pedido y el período anterior con la misma cantidad de días:
//   hoy → ayer · 7d → los 7 días previos · 30d → los 30 días previos
//   mes → del 1 al día de hoy del mes en curso, contra el mismo tramo del mes anterior
//         (recortado si el mes anterior es más corto).
export const calcularPeriodos = (periodo, hoy) => {
  if (periodo === 'hoy') {
    const ayer = sumarDias(hoy, -1);
    return { actual: { desde: hoy, hasta: hoy }, anterior: { desde: ayer, hasta: ayer } };
  }
  if (periodo === '7d' || periodo === '30d') {
    const dias = periodo === '7d' ? 7 : 30;
    const desde = sumarDias(hoy, -(dias - 1));
    return {
      actual: { desde, hasta: hoy },
      anterior: { desde: sumarDias(desde, -dias), hasta: sumarDias(desde, -1) },
    };
  }
  if (periodo === 'mes') {
    const inicio = primerDiaDelMes(hoy);
    const inicioAnterior = sumarMeses(inicio, -1);
    const dia = Math.min(Number(hoy.slice(8)), diasDelMes(inicioAnterior));
    return {
      actual: { desde: inicio, hasta: hoy },
      anterior: { desde: inicioAnterior, hasta: `${inicioAnterior.slice(0, 8)}${String(dia).padStart(2, '0')}` },
    };
  }
  throw new Error(`Período desconocido: ${periodo}`);
};
