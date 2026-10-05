import { describe, it, expect } from 'vitest';
import request from 'supertest';

// Se fuerza el limitador (bajo NODE_ENV=test se omite) para comprobar que el 429 del login lleva el tiempo restante
// en el cuerpo y que el límite sigue siendo 10 intentos cada 15 minutos.
process.env.FORZAR_RATE_LIMIT_PRUEBA = 'true';

const { crearApp } = await import('../app.js');
const app = crearApp();

describe('Límite de intentos en POST /api/auth/login', () => {
  it('permite 10 intentos y el 11.º responde 429 con codigo y reintentar_en_seg (≤ 900)', async () => {
    const estados = [];
    let ultimo;
    for (let i = 0; i < 11; i += 1) {
      ultimo = await request(app).post('/api/auth/login').send({ usuario: 'nadie-limite', contrasena: 'incorrecta1' });
      estados.push(ultimo.status);
    }

    expect(estados.slice(0, 10)).toEqual(Array(10).fill(401));
    expect(estados[10]).toBe(429);
    expect(ultimo.body.codigo).toBe('DEMASIADOS_INTENTOS');
    expect(ultimo.body.error).toMatch(/demasiados intentos/i);
    expect(Number.isInteger(ultimo.body.reintentar_en_seg)).toBe(true);
    expect(ultimo.body.reintentar_en_seg).toBeGreaterThan(890);
    expect(ultimo.body.reintentar_en_seg).toBeLessThanOrEqual(900);
    expect(ultimo.headers['retry-after']).toBeDefined();
  });
});
