// Política de contraseñas (se aplica al crear usuarios y empleados, al restablecer y al cambiar la propia):
//  · 8–72 BYTES (bcrypt trunca en silencio por encima: se rechaza en vez de truncar),
//  · no es una contraseña común/trivial (lista pequeña, sin distinguir mayúsculas ni acentos, y quitando símbolos finales),
//  · no es el nombre de usuario ni es "usuario + unos pocos caracteres" (rafa → rafa1234),
//  · no es un solo carácter repetido ni una secuencia obvia.
// Sin reglas de composición (mayúsculas/símbolos obligatorios): se prefiere longitud. El mensaje no da pistas del valor.
import { MIN_CONTRASENA, MAX_CONTRASENA } from './contrasenas.js';

const COMUNES = new Set([
  '12345678', '123456789', '1234567890', '0123456789', '11111111', '00000000', '87654321', '98765432', '12341234', '123123123',
  'password', 'password1', 'password12', 'password123', 'passw0rd', 'p4ssw0rd', 'contrasena', 'contrasena1', 'contrasena123',
  'clave123', 'clave1234', 'qwertyui', 'qwerty123', 'qwertyuiop', 'asdfghjk', 'asdfghjkl', 'zxcvbnm1', '1q2w3e4r', '1q2w3e4r5t',
  'abc12345', 'abcd1234', 'abcdefgh', 'iloveyou', 'admin123', 'admin1234', 'administrador', 'administrator', 'letmein1', 'welcome1',
  'welcome123', 'bienvenido', 'bienvenido1', 'barbero123', 'barbero1234', 'barbero12', 'barberia', 'barberia123', 'blackiron',
  'blackiron1', 'blackiron123', 'blackironbarbers', 'barbershop', 'colombia1', 'colombia123', 'cartagena', 'cartagena1', 'cartagena123',
  'changeme', 'cambiame1', 'cambia123', 'secreto123', 'secret123', 'test1234', 'prueba123', 'usuario123', 'monkey123', 'dragon123',
  'football1', 'futbol123', 'princesa1', 'superman1', 'nacional1', 'millonarios', 'junio2026', 'enero2026', 'julio2026',
]);

const clave = (texto) => texto.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

const esSecuenciaTrivial = (c) => {
  if (new Set(c).size === 1) return true; // aaaaaaaa
  const codigos = [...c].map((x) => x.charCodeAt(0));
  const paso = codigos[1] - codigos[0];
  return Math.abs(paso) === 1 && codigos.every((n, i) => i === 0 || n - codigos[i - 1] === paso); // 12345678, abcdefgh
};

// Devuelve null si es aceptable, o { codigo, error, motivo } (el motivo es solo para pruebas/logs).
export const evaluarContrasena = (valor, { usuario } = {}) => {
  if (typeof valor !== 'string') return { codigo: 'DATOS_INVALIDOS', error: 'La contraseña debe ser texto', motivo: 'tipo' };
  const bytes = Buffer.byteLength(valor, 'utf8');
  if (valor.length < MIN_CONTRASENA || bytes > MAX_CONTRASENA) {
    return { codigo: 'DATOS_INVALIDOS', error: `La contraseña debe tener entre ${MIN_CONTRASENA} y ${MAX_CONTRASENA} caracteres`, motivo: 'longitud' };
  }
  const c = clave(valor);
  const sinSimbolos = c.replace(/[!@#$%^&*._-]+$/, '');
  const sinFinal = c.replace(/[0-9!@#$%^&*._-]+$/, '');
  if (COMUNES.has(c) || COMUNES.has(sinSimbolos) || (sinFinal.length >= 6 && COMUNES.has(sinFinal)) || esSecuenciaTrivial(c)) {
    return { codigo: 'CONTRASENA_DEBIL', error: 'La contraseña es demasiado común o fácil de adivinar. Elige otra más larga o menos predecible', motivo: 'comun' };
  }
  const u = typeof usuario === 'string' ? clave(usuario.trim()) : '';
  if (u && (c === u || (u.length >= 4 && c.includes(u) && c.split(u).join('').length < 6))) {
    return { codigo: 'CONTRASENA_DEBIL', error: 'La contraseña no puede ser igual al nombre de usuario ni apenas distinta de él', motivo: 'usuario' };
  }
  return null;
};

export const LARGO_MIN_ADMIN = 12;

// La contraseña del admin viene del .env: además de la política común, mínimo 12 caracteres. Devuelve el texto del problema o null.
export const problemaContrasenaAdmin = (usuario, contrasena) => {
  const debil = evaluarContrasena(contrasena, { usuario });
  if (debil) return debil.error;
  return contrasena.length < LARGO_MIN_ADMIN ? `debe tener al menos ${LARGO_MIN_ADMIN} caracteres` : null;
};
