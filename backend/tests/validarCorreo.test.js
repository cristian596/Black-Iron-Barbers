import { describe, it, expect } from 'vitest';
import { validarCorreo } from '../utils/validarCorreo.js';

// Validador único de correo (solicitar código, confirmar código y POST /api/citas).
describe('validarCorreo', () => {
  it('acepta correos corrientes y los devuelve recortados y en minúsculas', () => {
    expect(validarCorreo('juan@example.com')).toBe('juan@example.com');
    expect(validarCorreo('  Juan.Perez+reservas@Example.CO  ')).toBe('juan.perez+reservas@example.co');
    expect(validarCorreo('a_b-c@sub.dominio-1.com.co')).toBe('a_b-c@sub.dominio-1.com.co');
    expect(validarCorreo('x@xn--bcher-kva.example')).toBe('x@xn--bcher-kva.example');
  });

  it.each([
    ['con espacio interno', 'juan perez@example.com'],
    ['con coma', 'a@b.com,c.d'],
    ['con punto y coma', 'a@b.com;c@d.com'],
    ['con ángulo de cierre', 'x@y.com>'],
    ['con ángulos', '<x@y.com>'],
    ['con comillas dobles', '"juan"@example.com'],
    ['con comilla simple', "o'brien@example.com"],
    ['con salto de línea', 'a@b.com\nBcc: otro@x.com'],
    ['con retorno de carro', 'a@b.com\rotro'],
    ['con tabulación interna', 'a\t@b.com'],
    ['con dos arrobas', 'a@b@c.com'],
    ['sin arroba', 'juan.example.com'],
    ['sin parte local', '@example.com'],
    ['sin dominio', 'juan@'],
    ['dominio sin punto', 'juan@localhost'],
    ['dominio con punto final', 'juan@example.com.'],
    ['dominio con etiqueta vacía', 'juan@example..com'],
    ['dominio con guion inicial', 'juan@-example.com'],
    ['dominio con caracteres inválidos', 'juan@exa_mple.com'],
    ['dominio con espacios', 'juan@exa mple.com'],
    ['TLD numérico', 'juan@example.123'],
    ['TLD de una letra', 'juan@example.c'],
    ['parte local con punto inicial', '.juan@example.com'],
    ['parte local con punto final', 'juan.@example.com'],
    ['parte local con dos puntos seguidos', 'ju..an@example.com'],
    ['parte local con dos puntos (:)', 'a:b@example.com'],
    ['paréntesis', 'juan(x)@example.com'],
  ])('rechaza un correo %s', (_, valor) => {
    expect(validarCorreo(valor)).toBeNull();
  });

  it('rechaza más de 254 caracteres en total y más de 64 en la parte local', () => {
    expect(validarCorreo(`${'a'.repeat(64)}@example.com`)).toBe(`${'a'.repeat(64)}@example.com`);
    expect(validarCorreo(`${'a'.repeat(65)}@example.com`)).toBeNull();
    const dominioLargo = `${'d'.repeat(63)}.${'e'.repeat(63)}.${'f'.repeat(63)}.com`;
    expect(validarCorreo(`a@${dominioLargo}`)).not.toBeNull();
    // 64 + 1 + 63*4 + 4 + 4 = más de 254
    expect(validarCorreo(`${'a'.repeat(64)}@${'d'.repeat(63)}.${'e'.repeat(63)}.${'f'.repeat(63)}.${'g'.repeat(63)}.com`)).toBeNull();
    expect(validarCorreo(`a@${'d'.repeat(64)}.com`)).toBeNull(); // etiqueta de 64
  });

  it.each([[undefined], [null], [123], [{}], [['a@b.com']], [true], ['']])('rechaza lo que no es texto o está vacío (%j)', (valor) => {
    expect(validarCorreo(valor)).toBeNull();
  });
});
