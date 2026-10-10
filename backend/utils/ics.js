// Calendario .ics generado a mano (RFC 5545): sin dependencias. Una VEVENT por cita, UID estable por cita, fechas en UTC,
// saltos de línea CRLF, texto escapado y líneas plegadas a 75 octetos.

const CRLF = '\r\n';
const UID_DOMINIO = 'blackironbarbers';

// Colombia no tiene horario de verano: America/Bogota es UTC-5 todo el año.
const DESFASE_BOGOTA_HORAS = 5;

// Instante (Date, UTC) de una fecha y hora de pared de Bogotá ('AAAA-MM-DD', 'HH:MM').
export const instanteDeBogota = (fecha, hora) => {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const [horas, minutos] = hora.split(':').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia, horas + DESFASE_BOGOTA_HORAS, minutos));
};

const dosDigitos = (n) => String(n).padStart(2, '0');

// 20261010T153000Z
export const formatoFechaUtc = (instante) =>
  `${instante.getUTCFullYear()}${dosDigitos(instante.getUTCMonth() + 1)}${dosDigitos(instante.getUTCDate())}` +
  `T${dosDigitos(instante.getUTCHours())}${dosDigitos(instante.getUTCMinutes())}${dosDigitos(instante.getUTCSeconds())}Z`;

// TEXT de RFC 5545: la barra invertida, ; y , se escapan con barra invertida y los saltos de línea pasan a la secuencia \n.
// Los saltos reales no pueden colarse: inyectarían propiedades nuevas en el evento.
export const escaparTextoIcs = (valor) =>
  String(valor ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n|\p{Zl}|\p{Zp}/gu, '\\n')
    .replace(/\p{Cc}/gu, '');

// Pliega a 75 octetos por línea (sin partir un carácter UTF-8); las continuaciones empiezan con un espacio.
export const plegarLinea = (linea) => {
  const partes = [];
  let actual = '';
  let octetos = 0;
  for (const caracter of linea) {
    const bytes = Buffer.byteLength(caracter, 'utf8');
    if (octetos + bytes > 75) {
      partes.push(actual);
      actual = ' ';
      octetos = 1;
    }
    actual += caracter;
    octetos += bytes;
  }
  partes.push(actual);
  return partes.join(CRLF);
};

// SEQUENCE: 0 al crear; al cancelar o cambiar, segundos desde 2026-01-01 UTC. Así es siempre mayor que el anterior sin
// guardar un contador en la base (una cita no cambia dos veces en el mismo segundo).
const EPOCA_SECUENCIA = Date.UTC(2026, 0, 1);
export const secuenciaDeCambio = (ahora = new Date()) => Math.max(1, Math.floor((ahora.getTime() - EPOCA_SECUENCIA) / 1000));

export const uidDeCita = (citaId) => `cita-${citaId}@${UID_DOMINIO}`;

// evento: { id, inicio: Date, fin: Date, resumen, descripcion, ubicacion }
// metodo: 'PUBLISH' (cita nueva o cambiada) | 'CANCEL' (cancelación, STATUS:CANCELLED con el mismo UID).
export const construirIcs = (eventos, { metodo = 'PUBLISH', secuencia = 0, ahora = new Date() } = {}) => {
  const lineas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Black Iron Barbers//Citas//ES', 'CALSCALE:GREGORIAN', `METHOD:${metodo}`];
  for (const evento of eventos) {
    lineas.push(
      'BEGIN:VEVENT',
      `UID:${uidDeCita(evento.id)}`,
      `DTSTAMP:${formatoFechaUtc(ahora)}`,
      `DTSTART:${formatoFechaUtc(evento.inicio)}`,
      `DTEND:${formatoFechaUtc(evento.fin)}`,
      `SEQUENCE:${secuencia}`,
      `STATUS:${metodo === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED'}`,
      `SUMMARY:${escaparTextoIcs(evento.resumen)}`
    );
    if (evento.descripcion) lineas.push(`DESCRIPTION:${escaparTextoIcs(evento.descripcion)}`);
    if (evento.ubicacion) lineas.push(`LOCATION:${escaparTextoIcs(evento.ubicacion)}`);
    lineas.push('END:VEVENT');
  }
  lineas.push('END:VCALENDAR');
  return lineas.map(plegarLinea).join(CRLF) + CRLF;
};
