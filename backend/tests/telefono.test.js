import { describe, it, expect } from 'vitest';
import { normalizarTelefono, esTelefonoValido } from '../utils/telefono.js';

describe('utils/telefono', () => {
  it('normaliza un número con espacios', () => {
    expect(normalizarTelefono('300 123 4567')).toBe('3001234567');
  });

  it('normaliza un número con prefijo +57', () => {
    expect(normalizarTelefono('+57 300 123 4567')).toBe('3001234567');
  });

  it('normaliza un número con prefijo 57 sin signo +', () => {
    expect(normalizarTelefono('573001234567')).toBe('3001234567');
  });

  it('acepta un celular colombiano válido', () => {
    expect(esTelefonoValido('3001234567')).toBe(true);
  });

  it('rechaza un número que no empieza por 3', () => {
    expect(esTelefonoValido('2001234567')).toBe(false);
  });

  it('rechaza un número con menos de 10 dígitos', () => {
    expect(esTelefonoValido('300123')).toBe(false);
  });
});
