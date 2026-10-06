import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { crearApp } from '../app.js';
import { pool } from '../db/connection.js';
import { crearServiciosCombo, borrarServiciosCombo, insertarCita, reiniciarContador } from './utilsPrueba.js';

const app = crearApp();
const FECHA = '2030-06-15';

const horas = (query) => request(app).get('/api/disponibilidad').query({ fecha: FECHA, ...query });

beforeAll(crearServiciosCombo);
beforeEach(async () => {
  reiniciarContador();
  await pool.query('TRUNCATE citas RESTART IDENTITY CASCADE');
});
afterAll(async () => {
  await pool.query('TRUNCATE citas RESTART IDENTITY CASCADE');
  await borrarServiciosCombo();
});

describe('GET /api/disponibilidad con varios servicios', () => {
  it('usa la duración total: 80 min dejan fuera las horas que cruzan una cita existente', async () => {
    // Barbero 1 ocupado 10:00-10:30.
    await insertarCita({ fecha: FECHA, hora: '10:00', barbero_id: 1, estado: 'pendiente', duracion_min: 30 });

    const uno = await horas({ servicios: '201', barbero: 1 }); // 30 min
    expect(uno.status).toBe(200);
    expect(uno.body.horas).toContain('09:30');
    expect(uno.body.horas).not.toContain('10:00');

    const tres = await horas({ servicios: '201,202,203', barbero: 1 }); // 80 min
    expect(tres.status).toBe(200);
    for (const ocupada of ['09:00', '09:30', '10:00']) expect(tres.body.horas).not.toContain(ocupada);
    expect(tres.body.horas).toContain('10:30');
  });

  it('el cierre usa la duración total: 180 min ya no caben a las 16:30 ni a las 17:00', async () => {
    const solo = await horas({ servicios: '201', barbero: 1 });
    expect(solo.body.horas).toContain('17:00');

    const combo = await horas({ servicios: '204,201,202', barbero: 1 });
    expect(combo.status).toBe(200);
    expect(combo.body.horas).toContain('16:00');
    expect(combo.body.horas).not.toContain('16:30');
    expect(combo.body.horas).not.toContain('17:00');
    expect(combo.body.horas[combo.body.horas.length - 1]).toBe('16:00');
  });

  it('con "cualquier barbero" ofrece la hora si algún barbero tiene libre TODO el bloque', async () => {
    await insertarCita({ fecha: FECHA, hora: '10:00', barbero_id: 1, estado: 'pendiente', duracion_min: 30 });
    const libre = await horas({ servicios: '201,202,203' });
    expect(libre.body.barbero_id).toBeNull();
    expect(libre.body.horas).toContain('10:00'); // barbero 2 libre

    await insertarCita({ fecha: FECHA, hora: '10:30', barbero_id: 2, estado: 'pendiente', duracion_min: 30 });
    const ocupados = await horas({ servicios: '201,202,203' });
    expect(ocupados.body.horas).not.toContain('10:00'); // barbero 1 choca a las 10:00 y barbero 2 a las 10:30 (bloque de 80 min)
  });

  it('el orden de los ids no cambia el resultado (la duración es la suma)', async () => {
    const a = await horas({ servicios: '201,204', barbero: 1 });
    const b = await horas({ servicios: '204,201', barbero: 1 });
    expect(a.body.horas).toEqual(b.body.horas);
  });

  it('240 min exactos son válidos; más → 400 DURACION_EXCEDIDA', async () => {
    const justo = await horas({ servicios: '204,205', barbero: 1 });
    expect(justo.status).toBe(200);
    expect(justo.body.horas).toContain('09:00');
    expect(justo.body.horas).toContain('15:00');
    expect(justo.body.horas).not.toContain('15:30');

    const exceso = await horas({ servicios: '204,205,203' });
    expect(exceso.status).toBe(400);
    expect(exceso.body.codigo).toBe('DURACION_EXCEDIDA');
  });

  it('un servicio individual de 300 min tiene horas (servicio= y servicios=); como combo se rechaza', async () => {
    const nuevo = await horas({ servicios: '207', barbero: 1 });
    expect(nuevo.status).toBe(200);
    expect(nuevo.body.horas).toContain('09:00');
    expect(nuevo.body.horas).toContain('14:00'); // 14:00 + 300 min = 19:00, justo el cierre
    expect(nuevo.body.horas).not.toContain('14:30');
    const legado = await horas({ servicio: 207, barbero: 1 });
    expect(legado.status).toBe(200);
    expect(legado.body).toEqual(nuevo.body);

    const combo = await horas({ servicios: '207,203' });
    expect(combo.status).toBe(400);
    expect(combo.body.codigo).toBe('DURACION_EXCEDIDA');
  });

  it.each([
    ['repetidos', '201,201', 'SERVICIOS_REPETIDOS'],
    ['más de 3', '201,202,203,204', 'LIMITE_SERVICIOS'],
    ['inactivo', '201,206', 'SERVICIO_NO_DISPONIBLE'],
    ['inexistente', '99999', 'SERVICIO_NO_DISPONIBLE'],
    ['letras', '201,abc', 'DATOS_INVALIDOS'],
    ['coma doble', '201,,202', 'DATOS_INVALIDOS'],
    ['espacios', '201, 202', 'DATOS_INVALIDOS'],
    ['coma final', '201,', 'DATOS_INVALIDOS'],
    ['cero', '0', 'DATOS_INVALIDOS'],
    ['negativo', '-1,201', 'DATOS_INVALIDOS'],
    ['decimal', '1.5', 'DATOS_INVALIDOS'],
  ])('servicios=%s → 400 %s', async (_n, valor, codigo) => {
    const res = await horas({ servicios: valor });
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe(codigo);
  });

  it('servicios repetido como parámetro (?servicios=1&servicios=2) → 400', async () => {
    const res = await request(app).get(`/api/disponibilidad?fecha=${FECHA}&servicios=201&servicios=202`);
    expect(res.status).toBe(400);
  });

  it('servicio= y servicios= a la vez → 400', async () => {
    const res = await horas({ servicio: 201, servicios: '202' });
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('DATOS_INVALIDOS');
  });

  it('sin servicio ni servicios → 400 (mensaje de siempre)', async () => {
    const res = await horas({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Los parámetros servicio y fecha son obligatorios');
  });
});

describe('Compatibilidad: servicio= (formato anterior)', () => {
  it('sigue funcionando y da lo mismo que servicios=<mismo id>', async () => {
    const antiguo = await horas({ servicio: 201, barbero: 1 });
    const nuevo = await horas({ servicios: '201', barbero: 1 });
    expect(antiguo.status).toBe(200);
    expect(antiguo.body).toEqual(nuevo.body);
  });

  it('404 para un servicio inexistente y 400 SERVICIO_NO_DISPONIBLE para uno inactivo, como antes', async () => {
    expect((await horas({ servicio: 99999 })).status).toBe(404);
    const inactivo = await horas({ servicio: 206 });
    expect(inactivo.status).toBe(400);
    expect(inactivo.body.codigo).toBe('SERVICIO_NO_DISPONIBLE');
  });

  it('servicio=1,2 (lista en el formato anterior) → 400', async () => {
    expect((await horas({ servicio: '201,202' })).status).toBe(400);
  });
});
