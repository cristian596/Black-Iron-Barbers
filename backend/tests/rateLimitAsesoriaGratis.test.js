import { describe, it, expect } from 'vitest';
import request from 'supertest';

// El limitador de POST /api/asesorias/gratis/comprobar se omite bajo NODE_ENV=test salvo que se fuerce (igual que el de
// citas y el de login, ver routes/asesorias.js). Aquí se fuerza con un límite bajo, antes de importar la app, y se prueba
// el 429 de verdad.
process.env.FORZAR_RATE_LIMIT_PRUEBA = 'true';
process.env.LIMITE_COMPROBAR_GRATIS_RATE = '3';

const { crearApp } = await import('../app.js');
const app = crearApp();

describe('Rate limiting en POST /api/asesorias/gratis/comprobar', () => {
  it('responde 429 con DEMASIADOS_INTENTOS después del límite, cuente lo que cuente la petición (válida o no)', async () => {
    const cuerpos = [
      { correo: 'rate@example.com', telefono: '3001234567' },
      { correo: 'rate@example.com', telefono: '3001234567' },
      {}, // una petición inválida también gasta cupo: si no, serviría para sondear sin límite
      { correo: 'rate@example.com', telefono: '3001234567' },
      { correo: 'rate@example.com', telefono: '3001234567' },
    ];
    const estados = [];
    let ultima;
    for (const cuerpo of cuerpos) {
      ultima = await request(app).post('/api/asesorias/gratis/comprobar').send(cuerpo);
      estados.push(ultima.status);
    }
    expect(estados).toEqual([200, 200, 400, 429, 429]);
    expect(ultima.body).toMatchObject({ codigo: 'DEMASIADOS_INTENTOS' });
    expect(ultima.body.reintentar_en_seg).toBeGreaterThan(0);
    expect(ultima.body).not.toHaveProperty('disponible');
  });
});
