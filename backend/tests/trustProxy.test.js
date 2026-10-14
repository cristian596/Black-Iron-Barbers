import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';

// TRUST_PROXY en la app real: sin él, X-Forwarded-For se ignora; con un número exacto de saltos, el limitador de login
// (que cuenta por req.ip) distingue a los clientes que indica el proxy. Límites bajos y limitador forzado antes de importar.
process.env.FORZAR_RATE_LIMIT_PRUEBA = 'true';
process.env.LIMITE_LOGIN_USUARIO_RATE = '1000';
process.env.LIMITE_LOGIN_IP_RATE = '3';

const { crearApp } = await import('../app.js');

afterEach(() => {
  process.env.TRUST_PROXY = '';
});

let contador = 0;
// Usuarios inexistentes y distintos: cada intento falla (401) pero solo se acota por IP.
const fallo = (app, ip) => {
  contador += 1;
  const peticion = request(app).post('/api/auth/login');
  if (ip) peticion.set('X-Forwarded-For', ip);
  return peticion.send({ usuario: `prueba_tp_${contador}`, contrasena: 'incorrecta-123' });
};

describe('TRUST_PROXY vacío (por defecto): no se confía en X-Forwarded-For', () => {
  it('trust proxy queda desactivado', () => {
    expect(crearApp().get('trust proxy')).toBe(false);
  });

  it('una X-Forwarded-For falsa NO cambia la IP que ve el limitador', async () => {
    const app = crearApp();
    // Tres intentos con "clientes" distintos inventados: para el servidor son la misma IP (la del socket)...
    for (const ip of ['203.0.113.10', '203.0.113.11', '203.0.113.12']) expect((await fallo(app, ip)).status).toBe(401);
    // ...así que el cuarto, con otra IP inventada más, ya está limitado.
    expect((await fallo(app, '203.0.113.13')).status).toBe(429);
    expect((await fallo(app)).status).toBe(429);
  });
});

describe('TRUST_PROXY=1: se usa la IP del cliente que indica el proxy', () => {
  it('trust proxy queda con el número exacto de saltos', () => {
    process.env.TRUST_PROXY = '1';
    expect(crearApp().get('trust proxy')).toBe(1);
    process.env.TRUST_PROXY = '2';
    expect(crearApp().get('trust proxy')).toBe(2);
  });

  it('cada cliente de X-Forwarded-For tiene su propio cupo', async () => {
    process.env.TRUST_PROXY = '1';
    const app = crearApp();
    for (let i = 0; i < 3; i += 1) expect((await fallo(app, '198.51.100.1')).status).toBe(401);
    // El cliente que agotó su cupo queda limitado...
    expect((await fallo(app, '198.51.100.1')).status).toBe(429);
    // ...y otro cliente detrás del mismo proxy no se ve afectado.
    expect((await fallo(app, '198.51.100.2')).status).toBe(401);
  });

  it('con 1 salto, solo cuenta la última IP añadida por el proxy: lo que el cliente antepone no sirve para evadir', async () => {
    process.env.TRUST_PROXY = '1';
    const app = crearApp();
    // El proxy añade al final la IP real (198.51.100.50); el cliente antepone valores distintos para parecer otro.
    for (let i = 0; i < 3; i += 1) expect((await fallo(app, `192.0.2.${i + 1}, 198.51.100.50`)).status).toBe(401);
    expect((await fallo(app, '192.0.2.99, 198.51.100.50')).status).toBe(429);
  });
});

describe('TRUST_PROXY inválido impide crear la app', () => {
  it.each(['true', '*', 'all', 'loopback', '10.0.0.0/8', '203.0.113.5', '1.5', '0', '-1', 'abc'])('rechaza %j', (valor) => {
    process.env.TRUST_PROXY = valor;
    expect(() => crearApp()).toThrow(/TRUST_PROXY no es válido/);
  });
});
