import { HORARIO_ATENCION } from '../config/horario.js';

const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const REGEX_HORA = /^\d{2}:\d{2}$/;

// Zona horaria del negocio, fija en código: la barbería opera en Bogotá sin
// importar la zona del contenedor/servidor donde corra el backend.
const ZONA_HORARIA = 'America/Bogota';

const formateadorFecha = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_HORARIA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const formateadorHora = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONA_HORARIA,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export const minutosDesdeMedianoche = (hora) => {
  const [horas, minutos] = hora.split(':').map(Number);
  return horas * 60 + minutos;
};

export const esFechaValida = (fecha) =>
  typeof fecha === 'string' && REGEX_FECHA.test(fecha) && !Number.isNaN(new Date(fecha).getTime());

export const esHoraValida = (hora) => typeof hora === 'string' && REGEX_HORA.test(hora);

// 'en-CA' da directamente el formato AAAA-MM-DD.
export const hoyISO = () => formateadorFecha.format(new Date());

export const horaActualBogota = () => {
  const [horas, minutos] = formateadorHora.format(new Date()).split(':').map(Number);
  return horas * 60 + minutos;
};

export const esFechaAnterior = (fecha) => fecha < hoyISO();

export const esFechaHoy = (fecha) => fecha === hoyISO();

// Un servicio solo se puede ofrecer/agendar si cabe completo dentro del
// horario de atención, es decir si termina a más tardar a la hora de cierre.
export const intervaloDentroDeHorario = (hora, duracionMin) => {
  const inicio = minutosDesdeMedianoche(hora);
  const fin = inicio + duracionMin;
  return (
    inicio >= minutosDesdeMedianoche(HORARIO_ATENCION.apertura) &&
    fin <= minutosDesdeMedianoche(HORARIO_ATENCION.cierre)
  );
};

export const generarHorasDisponibles = () => {
  const horas = [];
  const minutosCierre = minutosDesdeMedianoche(HORARIO_ATENCION.cierre);
  let minutos = minutosDesdeMedianoche(HORARIO_ATENCION.apertura);

  while (minutos < minutosCierre) {
    const h = String(Math.floor(minutos / 60)).padStart(2, '0');
    const m = String(minutos % 60).padStart(2, '0');
    horas.push(`${h}:${m}`);
    minutos += HORARIO_ATENCION.intervaloMin;
  }

  return horas;
};
