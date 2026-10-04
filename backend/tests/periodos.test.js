import { describe, it, expect } from 'vitest';
import { calcularPeriodos, esFechaCalendario, sumarDias, sumarMeses, primerDiaDelMes } from '../utils/periodos.js';

describe('esFechaCalendario', () => {
  it.each(['2026-10-04', '2024-02-29', '2026-12-31'])('acepta %s', (f) => expect(esFechaCalendario(f)).toBe(true));
  it.each(['2026-02-31', '2026-02-29', '2026-13-01', '2026-00-10', '2026-10-32', '26-10-04', 'hoy', '', null, 20261004])(
    'rechaza %s',
    (f) => expect(esFechaCalendario(f)).toBe(false)
  );
});

describe('aritmética de fechas', () => {
  it('suma y resta días cruzando mes y año', () => {
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
    expect(sumarDias('2026-01-01', -1)).toBe('2025-12-31');
    expect(sumarDias('2024-02-28', 1)).toBe('2024-02-29');
  });

  it('suma meses al día 1', () => {
    expect(primerDiaDelMes('2026-10-17')).toBe('2026-10-01');
    expect(sumarMeses('2026-01-01', -1)).toBe('2025-12-01');
    expect(sumarMeses('2026-10-01', -23)).toBe('2024-11-01');
  });
});

describe('calcularPeriodos', () => {
  it('hoy → ayer', () => {
    expect(calcularPeriodos('hoy', '2026-03-01')).toEqual({
      actual: { desde: '2026-03-01', hasta: '2026-03-01' },
      anterior: { desde: '2026-02-28', hasta: '2026-02-28' },
    });
  });

  it('7d y 30d: ventanas contiguas del mismo largo', () => {
    expect(calcularPeriodos('7d', '2026-10-04')).toEqual({
      actual: { desde: '2026-09-28', hasta: '2026-10-04' },
      anterior: { desde: '2026-09-21', hasta: '2026-09-27' },
    });
    const { actual, anterior } = calcularPeriodos('30d', '2026-10-04');
    expect(actual).toEqual({ desde: '2026-09-05', hasta: '2026-10-04' });
    expect(anterior).toEqual({ desde: '2026-08-06', hasta: '2026-09-04' });
  });

  it('mes: mismo tramo del mes anterior', () => {
    expect(calcularPeriodos('mes', '2026-10-04')).toEqual({
      actual: { desde: '2026-10-01', hasta: '2026-10-04' },
      anterior: { desde: '2026-09-01', hasta: '2026-09-04' },
    });
  });

  it('mes: si el mes anterior es más corto, recorta al último día', () => {
    expect(calcularPeriodos('mes', '2026-03-31').anterior).toEqual({ desde: '2026-02-01', hasta: '2026-02-28' });
    expect(calcularPeriodos('mes', '2024-03-31').anterior).toEqual({ desde: '2024-02-01', hasta: '2024-02-29' });
    expect(calcularPeriodos('mes', '2026-10-31').anterior).toEqual({ desde: '2026-09-01', hasta: '2026-09-30' });
  });

  it('mes: en enero el anterior es diciembre del año previo', () => {
    expect(calcularPeriodos('mes', '2026-01-15').anterior).toEqual({ desde: '2025-12-01', hasta: '2025-12-15' });
  });

  it('un período desconocido lanza un error', () => {
    expect(() => calcularPeriodos('año', '2026-10-04')).toThrow();
  });
});
