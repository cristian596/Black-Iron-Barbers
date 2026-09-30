import { HORARIO_ATENCION } from '../config/horario.js';

const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const REGEX_HORA = /^\d{2}:\d{2}$/;

const minutosDesdeMedianoche = (hora) => {
  const [horas, minutos] = hora.split(':').map(Number);
  return horas * 60 + minutos;
};

export const esFechaValida = (fecha) =>
  typeof fecha === 'string' && REGEX_FECHA.test(fecha) && !Number.isNaN(new Date(fecha).getTime());

export const esHoraValida = (hora) => typeof hora === 'string' && REGEX_HORA.test(hora);

export const hoyISO = () => new Date().toISOString().slice(0, 10);

export const esFechaAnterior = (fecha) => fecha < hoyISO();

export const esFechaHoy = (fecha) => fecha === hoyISO();

export const horaDentroDeHorario = (hora) => {
  const minutos = minutosDesdeMedianoche(hora);
  return (
    minutos >= minutosDesdeMedianoche(HORARIO_ATENCION.apertura) &&
    minutos < minutosDesdeMedianoche(HORARIO_ATENCION.cierre)
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
