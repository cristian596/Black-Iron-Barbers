// Ayudas de PRUEBA para la verificación del correo. No existe ningún modo de saltarse la verificación en el código de
// producción: aquí se firman comprobantes REALES con la misma función del servicio (utils/verificacionCorreo.js).
import { createRequire } from 'node:module';
import { firmarComprobante } from '../utils/verificacionCorreo.js';
import { validarCorreo } from '../utils/validarCorreo.js';

export const SECRETO_PRUEBA = 'secreto-de-prueba-para-la-verificacion-0123456789';

// Comprobante real y vigente de un correo (normalizado como lo hace el servidor).
export const comprobanteDe = (correo) => firmarComprobante(validarCorreo(correo) ?? String(correo).trim().toLowerCase()).token;

// Las pruebas anteriores a la verificación reservan con POST /api/citas sin pensar en comprobantes. Para no reescribir
// cada llamada, se añade un comprobante real y recién firmado al cuerpo de POST /api/citas cuando la prueba no indica
// `verificacion_token` (ni siquiera como undefined/null). Solo existe en las pruebas; las que ejercitan la verificación
// pasan su propio `verificacion_token` y por tanto no se tocan.
export const instalarComprobanteAutomatico = () => {
  const require = createRequire(import.meta.url);
  const Test = require('supertest/lib/test.js');
  const sendOriginal = Test.prototype.send;
  Test.prototype.send = function enviarConComprobante(datos) {
    let cuerpo = datos;
    try {
      const esReserva = this.method === 'POST' && new URL(this.url).pathname === '/api/citas';
      if (esReserva && datos && typeof datos === 'object' && !Array.isArray(datos) && typeof datos.correo === 'string' && !('verificacion_token' in datos)) {
        if (validarCorreo(datos.correo)) cuerpo = { ...datos, verificacion_token: comprobanteDe(datos.correo) };
      }
    } catch {
      cuerpo = datos;
    }
    return sendOriginal.call(this, cuerpo);
  };
};
