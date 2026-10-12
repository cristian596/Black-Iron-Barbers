import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import { crearApp } from '../app.js';
import { pool } from '../db/connection.js';
import { insertarCita, reiniciarContador } from './utilsPrueba.js';

// Pentest (fases 3, 5 y 7): cabeceras, errores sin filtraciones, ids estrictos y cuerpos que no son JSON.
const app = crearApp();
const login = async (usuario, contrasena) => (await request(app).post('/api/auth/login').send({ usuario, contrasena })).body.token;

afterEach(() => vi.restoreAllMocks());

describe('Cabeceras de seguridad de la API', () => {
  it('no anuncia el framework y fija las cabeceras básicas', async () => {
    const res = await request(app).get('/api/servicios');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
  });

  it('las respuestas autenticadas y de login no se guardan en caché', async () => {
    const res = await request(app).post('/api/auth/login').send({ usuario: process.env.ADMIN_USER, contrasena: process.env.ADMIN_PASSWORD });
    expect(res.headers['cache-control']).toMatch(/no-store/);
    const token = res.body.token;
    const admin = await request(app).get('/api/admin/citas').set('Authorization', `Bearer ${token}`);
    expect(admin.headers['cache-control']).toMatch(/no-store/);
  });

  it('CORS: solo FRONTEND_URL, sin reflejar el origen ni permitir credenciales', async () => {
    for (const origen of ['http://evil.example', 'null', `${process.env.FRONTEND_URL}.evil.example`]) {
      const res = await request(app).get('/api/servicios').set('Origin', origen);
      expect(res.headers['access-control-allow-origin']).toBe(process.env.FRONTEND_URL);
      expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    }
  });
});

describe('Errores sin filtraciones', () => {
  it('una ruta inexistente responde JSON genérico (no el HTML "Cannot GET")', async () => {
    const res = await request(app).get('/api/no-existe');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(JSON.stringify(res.body)).not.toMatch(/Cannot GET|Express/);
  });

  it('un fallo interno (p. ej. de la base) responde 500 genérico, sin el mensaje de pg', async () => {
    vi.spyOn(pool, 'query').mockRejectedValueOnce(Object.assign(new Error('relation "secretos_internos" does not exist'), { code: '42P01' }));
    const res = await request(app).get('/api/barberos');
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/secretos_internos|relation|42P01/);
  });

  it('JSON malformado y cuerpo enorme en cualquier ruta: 400/413 genéricos', async () => {
    const malo = await request(app).post('/api/citas').set('Content-Type', 'application/json').send('{"a":');
    expect(malo.status).toBe(400);
    expect(malo.body.error).not.toMatch(/position|Unexpected|JSON at/i);
    const grande = await request(app).post('/api/citas').set('Content-Type', 'application/json').send(JSON.stringify({ x: 'a'.repeat(300_000) }));
    expect(grande.status).toBe(413);
  });
});

describe('Cuerpos que no son JSON nunca dan 500', () => {
  it('POST/PATCH con form-urlencoded, texto plano o sin cuerpo', async () => {
    const admin = await login(process.env.ADMIN_USER, process.env.ADMIN_PASSWORD);
    const rutas = [
      ['post', '/api/citas'],
      ['patch', '/api/citas/1'],
      ['patch', '/api/perfil'],
      ['post', '/api/auth/login'],
      ['patch', '/api/auth/contrasena'],
      ['post', '/api/asesorias/gratis/comprobar'],
      ['post', '/api/verificacion-correo/solicitar'],
      ['post', '/api/verificacion-correo/confirmar'],
      ['post', '/api/admin/servicios'],
      ['patch', '/api/admin/servicios/1'],
      ['post', '/api/admin/categorias'],
      ['patch', '/api/admin/categorias/1'],
      ['post', '/api/admin/empleados'],
      ['patch', '/api/admin/empleados/1'],
      ['post', '/api/admin/usuarios'],
      ['patch', '/api/admin/usuarios/2'],
      ['post', '/api/admin/cambios-perfil/revisar'],
      ['post', '/api/admin/barberos/1/restablecer-perfil'],
    ];
    for (const [metodo, ruta] of rutas) {
      for (const [tipo, cuerpo] of [['application/x-www-form-urlencoded', 'a=1&b[]=2'], ['text/plain', 'hola'], [null, null]]) {
        let req = request(app)[metodo](ruta).set('Authorization', `Bearer ${admin}`);
        if (tipo) req = req.set('Content-Type', tipo).send(cuerpo);
        const res = await req;
        expect(res.status, `${metodo} ${ruta} ${tipo}`).toBeLessThan(500);
        expect(JSON.stringify(res.body), `${metodo} ${ruta} ${tipo}`).not.toMatch(/destructure|undefined|TypeError|Cannot read/);
      }
    }
  });
});

describe('Ids estrictos', () => {
  const patch = (ruta, cuerpo, token) => request(app).patch(ruta).set('Authorization', `Bearer ${token}`).send(cuerpo);

  it('PATCH /api/citas/:id solo acepta ids decimales positivos', async () => {
    const admin = await login(process.env.ADMIN_USER, process.env.ADMIN_PASSWORD);
    for (const id of ['1e0', '0x1', '+1', '01x', '1.0', '99999999999999999999', '-1', '0', 'abc', '%00']) {
      const res = await patch(`/api/citas/${encodeURIComponent(id)}`, { barbero_id: 1 }, admin);
      expect([400, 404], `id ${id} → ${res.status}`).toContain(res.status);
      expect(res.status, `id ${id}`).not.toBe(200);
    }
  });

  it('barbero_id solo acepta un entero (número o texto de dígitos): nada de true, arreglos, hex ni espacios', async () => {
    reiniciarContador();
    await pool.query('TRUNCATE citas RESTART IDENTITY CASCADE');
    const id = await insertarCita({ fecha: '2030-05-05', hora: '10:00', estado: 'pendiente', barbero_id: 1 });
    const admin = await login(process.env.ADMIN_USER, process.env.ADMIN_PASSWORD);
    for (const valor of [true, [2], '0x2', ' 2', '2 ', '1e0', {}, 1.5, -1, 0, '', '2.0']) {
      const res = await patch(`/api/citas/${id}`, { barbero_id: valor }, admin);
      expect(res.status, `barbero_id ${JSON.stringify(valor)} → ${res.status}`).toBe(400);
    }
    const bien = await patch(`/api/citas/${id}`, { barbero_id: 2 }, admin);
    expect(bien.status).toBe(200);
    expect((await patch(`/api/citas/${id}`, { barbero_id: '1' }, admin)).status).toBe(200);
  });

  it('PATCH /api/admin/usuarios/:id rechaza ids raros', async () => {
    const admin = await login(process.env.ADMIN_USER, process.env.ADMIN_PASSWORD);
    for (const id of ['1e0', '0x2', '2.0', '99999999999999999999', '+2']) {
      const res = await patch(`/api/admin/usuarios/${encodeURIComponent(id)}`, { activo: true }, admin);
      expect([400, 404], `id ${id} → ${res.status}`).toContain(res.status);
    }
  });

  it('POST /api/admin/usuarios: barbero_id debe ser un entero', async () => {
    const admin = await login(process.env.ADMIN_USER, process.env.ADMIN_PASSWORD);
    for (const valor of [true, [1], '0x1', ' 1']) {
      const res = await request(app)
        .post('/api/admin/usuarios')
        .set('Authorization', `Bearer ${admin}`)
        .send({ usuario: 'ids_raros', contrasena: 'Cuatro-gatos-azules-77', barbero_id: valor });
      expect(res.status, `barbero_id ${JSON.stringify(valor)}`).toBe(400);
    }
  });
});

describe('Validación de entradas públicas (sin 500)', () => {
  it('GET /api/disponibilidad: fecha inexistente (31 de febrero) y ids enormes o raros → 400/404', async () => {
    const f = await request(app).get('/api/disponibilidad?fecha=2030-02-31&servicios=1');
    expect(f.status).toBe(400);
    for (const servicio of ['99999999999999999999', '0x1', '1e0', ' 1']) {
      const r = await request(app).get(`/api/disponibilidad?fecha=2030-06-10&servicio=${encodeURIComponent(servicio)}`);
      expect([400, 404], `servicio=${servicio} → ${r.status}`).toContain(r.status);
    }
  });

  it('POST /api/citas: fecha inexistente, nombre de más de 100 caracteres o con caracteres de control → 400', async () => {
    const base = { cliente: 'Ana', correo: 'ana.entradas@example.com', telefono: '3001234567', servicios_ids: [1], barbero_id: 1, fecha: '2030-06-10', hora: '10:00', consentimiento: true };
    for (const [cambio, campo] of [[{ fecha: '2030-02-31' }, 'fecha'], [{ fecha: '2030-13-01' }, 'fecha'], [{ cliente: 'x'.repeat(101) }, 'cliente'], [{ cliente: 'Ana\r\nBcc: x@y.com' }, 'cliente']]) {
      const res = await request(app).post('/api/citas').send({ ...base, ...cambio });
      expect(res.status, `${campo} → ${res.status} ${res.text.slice(0, 80)}`).toBe(400);
    }
  });

  it('POST /api/citas: servicio_id con texto no decimal ("0x1", "1e0", " 1") se rechaza', async () => {
    for (const servicio_id of ['0x1', '1e0', ' 1', '1.0', true, [1]]) {
      const res = await request(app)
        .post('/api/citas')
        .send({ cliente: 'Ana', correo: 'ana.entradas@example.com', telefono: '3001234567', servicio_id, barbero_id: 1, fecha: '2030-06-10', hora: '10:00', consentimiento: true });
      expect(res.status, `servicio_id ${JSON.stringify(servicio_id)}`).toBe(400);
    }
  });
});
