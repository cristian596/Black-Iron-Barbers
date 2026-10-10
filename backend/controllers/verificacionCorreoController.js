import { validarCorreo } from '../utils/validarCorreo.js';
import {
  solicitarCodigo,
  confirmarCodigo,
  ESPERA_ENTRE_SOLICITUDES_SEG,
} from '../utils/verificacionCorreo.js';

const REGEX_CODIGO = /^\d{6}$/;

const correoInvalido = (res) => res.status(400).json({ error: 'El correo no es válido', codigo: 'CORREO_INVALIDO' });

const MENSAJES_LIMITE = {
  ESPERA_REQUERIDA: 'Espera un momento antes de pedir otro código',
  LIMITE_CODIGOS_HORA: 'Pediste demasiados códigos para este correo, intenta más tarde',
};

// El cuerpo es siempre el mismo si todo va bien (no revela nada del correo): { ok: true, reenviar_en_seg: 60 }.
export const solicitar = async (req, res, next) => {
  try {
    const correo = validarCorreo(req.body?.correo);
    if (!correo) return correoInvalido(res);

    const resultado = await solicitarCodigo(correo);
    if (resultado.ok) return res.json({ ok: true, reenviar_en_seg: ESPERA_ENTRE_SOLICITUDES_SEG });
    if (resultado.motivo === 'CORREO_NO_DISPONIBLE') {
      return res.status(503).json({ error: 'No pudimos enviar el código en este momento, intenta de nuevo', codigo: 'CORREO_NO_DISPONIBLE' });
    }
    return res.status(429).json({
      error: MENSAJES_LIMITE[resultado.motivo],
      codigo: resultado.motivo,
      reintentar_en_seg: resultado.reintentarEnSeg,
    });
  } catch (err) {
    next(err);
  }
};

export const confirmar = async (req, res, next) => {
  try {
    const { codigo } = req.body ?? {};
    const correo = validarCorreo(req.body?.correo);
    if (!correo) return correoInvalido(res);
    if (typeof codigo !== 'string' || !REGEX_CODIGO.test(codigo)) {
      return res.status(400).json({ error: 'El código debe tener 6 dígitos', codigo: 'CODIGO_FORMATO_INVALIDO' });
    }

    const resultado = await confirmarCodigo(correo, codigo);
    if (!resultado.ok) {
      return res.status(400).json({ error: 'El código no es válido o venció. Pide uno nuevo.', codigo: 'CODIGO_INVALIDO' });
    }
    res.json({ token: resultado.token, expira_en_seg: resultado.expira_en_seg });
  } catch (err) {
    next(err);
  }
};
