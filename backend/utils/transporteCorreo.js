import nodemailer from 'nodemailer';
import { leerConfigCorreo } from '../config/correo.js';
import { esEntornoDePruebas } from '../config/entorno.js';

// Transporte en memoria (pruebas): pasa cada mensaje por el compositor real de nodemailer (streamTransport) pero no
// sale a la red. Guarda lo que se le pidió enviar (`opciones`) y el mensaje MIME resultante (`crudo`) para inspeccionar
// asunto, destinatarios, cabeceras y adjuntos. `fallar` simula un SMTP caído.
export const crearTransporteMemoria = () => {
  const base = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'windows' });
  const transporte = {
    enviados: [],
    fallar: null,
    async sendMail(opciones) {
      if (transporte.fallar) throw transporte.fallar;
      const info = await base.sendMail(opciones);
      transporte.enviados.push({ opciones, crudo: info.message.toString('utf8') });
      return { messageId: info.messageId };
    },
    vaciar() {
      transporte.enviados.length = 0;
      transporte.fallar = null;
    },
  };
  return transporte;
};

let inyectado = null;
let memoria = null;
let smtp = null;

// Para pruebas: fuerza un transporte concreto (null = volver al normal).
export const inyectarTransporte = (transporte) => {
  inyectado = transporte;
};

// Dentro de las pruebas (NODE_ENV=test bajo Vitest) SIEMPRE es el de memoria (nunca SMTP real); fuera de las pruebas, SMTP con la configuración.
export const obtenerTransporte = () => {
  if (inyectado) return inyectado;
  if (esEntornoDePruebas()) {
    memoria ??= crearTransporteMemoria();
    return memoria;
  }
  if (!smtp) {
    const config = leerConfigCorreo();
    if (!config.habilitado) return null;
    smtp = nodemailer.createTransport(config.smtp);
  }
  return smtp;
};

export const transporteMemoria = () => {
  memoria ??= crearTransporteMemoria();
  return memoria;
};
