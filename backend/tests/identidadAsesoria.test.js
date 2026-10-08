import { describe, it, expect } from 'vitest';
import { normalizarCorreo, identidadAsesoria } from '../utils/identidadAsesoria.js';

describe('normalizarCorreo', () => {
  it.each([
    ['ANA@Example.COM', 'ana@example.com'],
    ['  ana@example.com  ', 'ana@example.com'],
    ['\tAna@Example.com\n', 'ana@example.com'],
  ])('recorta y pasa a minúsculas: %j → %s', (entrada, esperado) => {
    expect(normalizarCorreo(entrada)).toBe(esperado);
  });

  it.each([
    ['ana+promo@example.com', 'ana@example.com'],
    ['ana+a+b@example.com', 'ana@example.com'],
    ['ana+@example.com', 'ana@example.com'],
    ['Ana+Gratis@Empresa.co', 'ana@empresa.co'],
    ['ana+promo@gmail.com', 'ana@gmail.com'],
  ])('quita el sufijo +etiqueta en TODOS los dominios: %s → %s', (entrada, esperado) => {
    expect(normalizarCorreo(entrada)).toBe(esperado);
  });

  it.each([
    ['a.n.a@gmail.com', 'ana@gmail.com'],
    ['A.Na@GMAIL.com', 'ana@gmail.com'],
    ['a.na+x@gmail.com', 'ana@gmail.com'],
    ['a.n.a@googlemail.com', 'ana@gmail.com'],
    ['ana@googlemail.com', 'ana@gmail.com'],
    ['..ana..@gmail.com', 'ana@gmail.com'],
  ])('en Gmail y Googlemail quita los puntos de la parte local (googlemail = gmail): %s → %s', (entrada, esperado) => {
    expect(normalizarCorreo(entrada)).toBe(esperado);
  });

  it.each([
    ['a.na@example.com', 'a.na@example.com'],
    ['a.na+x@example.com', 'a.na@example.com'],
    ['a.n.a@outlook.com', 'a.n.a@outlook.com'],
    ['a.na@hotmail.com', 'a.na@hotmail.com'],
    ['a.na@mail.gmail.com', 'a.na@mail.gmail.com'], // subdominio de gmail.com: no es Gmail
    ['a.na@gmail.com.co', 'a.na@gmail.com.co'],
  ])('en los demás dominios los puntos NO se quitan: %s → %s', (entrada, esperado) => {
    expect(normalizarCorreo(entrada)).toBe(esperado);
  });

  it('los puntos de la parte del dominio no cambian y googlemail solo se unifica cuando es el dominio completo', () => {
    expect(normalizarCorreo('ana@mail.googlemail.com')).toBe('ana@mail.googlemail.com');
  });

  it('variantes de una misma persona dan la misma forma', () => {
    const variantes = ['Ana.Perez@gmail.com', 'anaperez@GMAIL.COM', 'ana.perez+gratis@gmail.com', 'a.n.a.p.e.r.e.z@googlemail.com', ' anaperez+x@gmail.com '];
    expect(new Set(variantes.map(normalizarCorreo))).toEqual(new Set(['anaperez@gmail.com']));
  });

  it('personas distintas no se funden', () => {
    expect(normalizarCorreo('ana@gmail.com')).not.toBe(normalizarCorreo('anb@gmail.com'));
    expect(normalizarCorreo('ana@example.com')).not.toBe(normalizarCorreo('ana@example.org'));
    expect(normalizarCorreo('a.na@example.com')).not.toBe(normalizarCorreo('ana@example.com'));
  });

  it('si el +etiqueta o los puntos dejarían la parte local vacía, se conserva la original (no se funden direcciones sin relación)', () => {
    expect(normalizarCorreo('+x@example.com')).toBe('+x@example.com');
    expect(normalizarCorreo('+a@example.com')).not.toBe(normalizarCorreo('+b@example.com'));
    expect(normalizarCorreo('...@gmail.com')).toBe('...@gmail.com');
  });

  it.each([[undefined], [null], [123], [{}], [['a@b.co']], [''], ['   '], ['sin-arroba'], ['@dominio.com'], ['ana@']])(
    'lo que no tiene forma usuario@dominio da cadena vacía: %j',
    (entrada) => {
      expect(normalizarCorreo(entrada)).toBe('');
    }
  );

  it('es idempotente', () => {
    for (const correo of ['A.n.A+x@Gmail.com', 'a.na+x@Example.com', '+x@example.com', 'ana@googlemail.com']) {
      const una = normalizarCorreo(correo);
      expect(normalizarCorreo(una)).toBe(una);
    }
  });
});

describe('identidadAsesoria', () => {
  it.each([
    ['3001234567'],
    ['300 123 4567'],
    ['300-123-4567'],
    ['+57 300 123 4567'],
    ['+573001234567'],
    ['573001234567'],
    [' 300 - 123 - 4567 '.trim()],
  ])('el teléfono %j se reduce a los 10 dígitos', (telefono) => {
    expect(identidadAsesoria('Ana@Example.com', telefono)).toEqual({ correo_norm: 'ana@example.com', telefono_norm: '3001234567' });
  });

  it.each([
    ['ana@example.com', '1234567890'], // no empieza por 3
    ['ana@example.com', '300123456'], // 9 dígitos
    ['ana@example.com', '30012345678'], // 11 dígitos
    ['ana@example.com', ''],
    ['ana@example.com', undefined],
    ['ana@example.com', 3001234567], // número, no texto
    ['no-es-correo', '3001234567'],
    ['', '3001234567'],
    [undefined, '3001234567'],
  ])('devuelve null si el correo o el teléfono no son válidos: %j / %j', (correo, telefono) => {
    expect(identidadAsesoria(correo, telefono)).toBeNull();
  });

  it('usa la misma normalización de correo (+tag y puntos de Gmail)', () => {
    expect(identidadAsesoria('a.n.a+gratis@GoogleMail.com', '+57 300 000 0000')).toEqual({
      correo_norm: 'ana@gmail.com',
      telefono_norm: '3000000000',
    });
  });
});
