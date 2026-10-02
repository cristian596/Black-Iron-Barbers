import { describe, it, expect, afterEach, vi } from 'vitest';
import { hoyISO, horaActualBogota, esFechaHoy, esFechaAnterior } from '../utils/fechas.js';

describe('utils/fechas — zona horaria America/Bogota', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('a las 20:00 hora Colombia, hoyISO() usa la fecha de Bogotá aunque en UTC ya sea el día siguiente', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-16T01:00:00Z')); // 2026-06-15 20:00 Bogotá (UTC-5)

    expect(hoyISO()).toBe('2026-06-15');
    expect(horaActualBogota()).toBe(20 * 60);
    expect(esFechaHoy('2026-06-15')).toBe(true);
    expect(esFechaAnterior('2026-06-15')).toBe(false);
  });

  it('a las 23:30 hora Colombia, hoyISO() sigue devolviendo la fecha de Bogotá', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-16T04:30:00Z')); // 2026-06-15 23:30 Bogotá (UTC-5)

    expect(hoyISO()).toBe('2026-06-15');
    expect(horaActualBogota()).toBe(23 * 60 + 30);
    expect(esFechaHoy('2026-06-15')).toBe(true);
    expect(esFechaAnterior('2026-06-16')).toBe(false);
  });
});
