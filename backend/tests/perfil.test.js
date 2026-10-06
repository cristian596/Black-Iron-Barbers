import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { crearApp } from '../app.js';
import { pool } from '../db/connection.js';

// Las fotos de estas pruebas van SIEMPRE a una carpeta temporal, nunca a backend/uploads.
const CARPETA = fs.mkdtempSync(path.join(os.tmpdir(), 'perfil-test-'));
process.env.UPLOADS_DIR = CARPETA;

const app = crearApp();
const CLAVE = 'clave-segura-1';
const MB2 = 2 * 1024 * 1024;

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const login = async (usuario, contrasena) => (await request(app).post('/api/auth/login').send({ usuario, contrasena })).body.token;
const archivosEnCarpeta = () => fs.readdirSync(CARPETA);

// Imágenes mínimas con firma real (no hace falta que se puedan dibujar: la validación es por firma).
const png = (extra = 0) =>
  Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]), Buffer.from('IHDR'), Buffer.alloc(17 + extra)]);
const jpg = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]), Buffer.from('JFIF'), Buffer.alloc(30)]);
const webp = () => Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x20, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.alloc(30)]);

const subir = (token, cuerpo, tipo = 'image/png') => request(app).post('/api/perfil/foto').set(auth(token)).set('Content-Type', tipo).send(cuerpo);
const cambiarNombre = (token, cuerpo) => request(app).patch('/api/perfil').set(auth(token)).send(cuerpo);
const cambios = async () => (await pool.query('SELECT * FROM cambios_perfil ORDER BY id')).rows;
const barberos = async () => (await pool.query('SELECT * FROM barberos ORDER BY id')).rows;

let tokenAdmin;
let tokenB1;
let tokenB2;

beforeAll(async () => {
  await pool.query(
    `INSERT INTO usuarios (usuario, contrasena, rol, barbero_id) VALUES ('prueba_perfil_b1b', $1, 'barbero', 1)
     ON CONFLICT (usuario) DO UPDATE SET contrasena = EXCLUDED.contrasena, activo = true`,
    [await bcrypt.hash(CLAVE, 10)]
  );
  tokenAdmin = await login(process.env.ADMIN_USER, process.env.ADMIN_PASSWORD);
  tokenB1 = await login('barbero1_test', 'barbero12345');
  tokenB2 = await login('barbero2_test', 'barbero12345');
});

beforeEach(async () => {
  await pool.query('DELETE FROM cambios_perfil');
  await pool.query('UPDATE usuarios SET nombre_perfil = NULL, foto_perfil = NULL');
  for (const f of archivosEnCarpeta()) fs.rmSync(path.join(CARPETA, f), { recursive: true, force: true });
});

afterAll(async () => {
  await pool.query('DELETE FROM cambios_perfil');
  await pool.query('UPDATE usuarios SET nombre_perfil = NULL, foto_perfil = NULL');
  await pool.query("DELETE FROM usuarios WHERE usuario LIKE 'prueba_perfil%'");
  fs.rmSync(CARPETA, { recursive: true, force: true });
});

describe('GET /api/perfil', () => {
  it('sin token 401', async () => {
    expect((await request(app).get('/api/perfil')).status).toBe(401);
  });

  it('barbero sin perfil: usa nombre y foto públicos', async () => {
    const res = await request(app).get('/api/perfil').set(auth(tokenB1));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      usuario: 'barbero1_test',
      rol: 'barbero',
      nombre: 'Barbero Uno',
      foto_url: '/Barberos/uno.jpg',
      foto_propia: false,
      nombre_perfil: null,
      usa_nombre_publico: true,
      usa_foto_publica: true,
    });
    expect(JSON.stringify(res.body)).not.toMatch(/contrasena|hash/i);
  });

  it('admin: nombre efectivo = su usuario y sin foto', async () => {
    const res = await request(app).get('/api/perfil').set(auth(tokenAdmin));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ rol: 'admin', nombre: process.env.ADMIN_USER, foto_url: null, foto_propia: false });
  });
});

describe('PATCH /api/perfil (nombre)', () => {
  it('guarda el nombre recortado y con espacios colapsados, y lo devuelve como efectivo', async () => {
    const res = await cambiarNombre(tokenB1, { nombre_perfil: '  Juan    Pérez  ' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ nombre: 'Juan Pérez', nombre_perfil: 'Juan Pérez', usa_nombre_publico: false });
    expect((await request(app).get('/api/perfil').set(auth(tokenB1))).body.nombre).toBe('Juan Pérez');
  });

  it.each([
    ['vacío', ''],
    ['solo espacios', '    '],
    ['1 carácter', ' a '],
    ['41 caracteres', 'a'.repeat(41)],
    ['salto de línea', 'Ab\ncd'],
    ['tabulación', 'Ab\tcd'],
    ['carácter nulo', 'Ab\u0000cd'],
    ['espacio de ancho cero', 'Ab​cd'],
    ['número', 123],
    ['arreglo', ['Juan']],
    ['objeto', { a: 1 }],
    ['booleano', true],
  ])('rechaza %s', async (_etiqueta, valor) => {
    const res = await cambiarNombre(tokenB1, { nombre_perfil: valor });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ codigo: 'DATOS_INVALIDOS', campo: 'nombre_perfil' });
    expect((await pool.query("SELECT nombre_perfil FROM usuarios WHERE usuario = 'barbero1_test'")).rows[0].nombre_perfil).toBeNull();
  });

  it('rechaza cuerpo sin el campo, vacío o con campos extra (no se puede tocar rol ni usuario)', async () => {
    expect((await cambiarNombre(tokenB1, {})).status).toBe(400);
    expect((await request(app).patch('/api/perfil').set(auth(tokenB1))).status).toBe(400);
    const extra = await cambiarNombre(tokenB1, { nombre_perfil: 'Valido', rol: 'admin', usuario: 'otro' });
    expect(extra.status).toBe(400);
    const { rows } = await pool.query("SELECT usuario, rol FROM usuarios WHERE usuario = 'barbero1_test'");
    expect(rows[0]).toEqual({ usuario: 'barbero1_test', rol: 'barbero' });
  });

  it('acepta los límites exactos (2 y 40) y cuenta caracteres, no bytes', async () => {
    expect((await cambiarNombre(tokenB1, { nombre_perfil: 'Al' })).status).toBe(200);
    expect((await cambiarNombre(tokenB1, { nombre_perfil: 'a'.repeat(40) })).status).toBe(200);
    expect((await cambiarNombre(tokenB1, { nombre_perfil: '💈'.repeat(40) })).status).toBe(200);
    expect((await cambiarNombre(tokenB1, { nombre_perfil: '💈'.repeat(41) })).status).toBe(400);
  });

  it('guarda el HTML tal cual (React lo escapa al mostrarlo) y permite nombres duplicados', async () => {
    const html = await cambiarNombre(tokenB1, { nombre_perfil: '<b>Hola</b>' });
    expect(html.body.nombre).toBe('<b>Hola</b>');
    expect((await cambiarNombre(tokenB1, { nombre_perfil: 'Mismo Nombre' })).status).toBe(200);
    expect((await cambiarNombre(tokenB2, { nombre_perfil: 'Mismo Nombre' })).status).toBe(200);
  });

  it('null vuelve al nombre público', async () => {
    await cambiarNombre(tokenB1, { nombre_perfil: 'Otro Nombre' });
    const res = await cambiarNombre(tokenB1, { nombre_perfil: null });
    expect(res.body).toMatchObject({ nombre: 'Barbero Uno', nombre_perfil: null, usa_nombre_publico: true });
  });

  it('el admin cambia su nombre de perfil', async () => {
    const res = await cambiarNombre(tokenAdmin, { nombre_perfil: 'Jefe Supremo' });
    expect(res.status).toBe(200);
    expect(res.body.nombre).toBe('Jefe Supremo');
  });
});

describe('POST /api/perfil/foto', () => {
  it('sin token 401, y no escribe nada', async () => {
    const res = await request(app).post('/api/perfil/foto').set('Content-Type', 'image/png').send(png());
    expect(res.status).toBe(401);
    expect(archivosEnCarpeta()).toEqual([]);
  });

  it.each([
    ['jpg', jpg(), 'image/jpeg'],
    ['png', png(), 'image/png'],
    ['webp', webp(), 'image/webp'],
  ])('acepta %s: nombre UUID + extensión según los bytes', async (ext, bytes, tipo) => {
    const res = await subir(tokenB1, bytes, tipo);
    expect(res.status).toBe(201);
    expect(res.body.foto_propia).toBe(true);
    const archivo = res.body.foto_url.replace('/api/perfil/foto/', '');
    expect(archivo).toMatch(new RegExp(`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.${ext}$`));
    expect(archivosEnCarpeta()).toEqual([archivo]);
    expect(fs.readFileSync(path.join(CARPETA, archivo)).equals(bytes)).toBe(true);
  });

  it('un PNG real con Content-Type engañoso (text/plain, jpeg) se guarda como .png: manda la firma', async () => {
    for (const tipo of ['text/plain', 'image/jpeg', 'application/octet-stream']) {
      const res = await subir(tokenB1, png(), tipo);
      expect(res.status).toBe(201);
      expect(res.body.foto_url).toMatch(/\.png$/);
    }
  });

  it('un JPEG con "extensión mentirosa" (nombre .png en la URL y en Content-Disposition) se guarda como .jpg', async () => {
    const res = await request(app)
      .post('/api/perfil/foto?nombre=foto.png')
      .set(auth(tokenB1))
      .set('Content-Type', 'image/png')
      .set('Content-Disposition', 'attachment; filename="foto.png"')
      .send(jpg());
    expect(res.status).toBe(201);
    expect(res.body.foto_url).toMatch(/\.jpg$/);
  });

  it.each([
    ['texto con Content-Type image/png', Buffer.from('<script>alert(1)</script>'), 'image/png'],
    ['SVG (image/svg+xml)', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'image/svg+xml'],
    ['SVG disfrazado de image/png', Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>'), 'image/png'],
    ['ejecutable de Windows (MZ) como image/jpeg', Buffer.concat([Buffer.from('MZ'), Buffer.alloc(64)]), 'image/jpeg'],
    ['ejecutable ELF como image/png', Buffer.concat([Buffer.from([0x7f, 0x45, 0x4c, 0x46]), Buffer.alloc(64)]), 'image/png'],
    ['GIF', Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(30)]), 'image/gif'],
    ['PNG truncado (sin IHDR)', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5, 6, 7, 8, 9]), 'image/png'],
    ['RIFF que no es WebP (WAV)', Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVEfmt '), Buffer.alloc(20)]), 'image/webp'],
    ['menos de 12 bytes', Buffer.from([0xff, 0xd8, 0xff]), 'image/jpeg'],
  ])('rechaza %s con 415 FORMATO_NO_PERMITIDO y no deja archivos', async (_etiqueta, bytes, tipo) => {
    const res = await subir(tokenB1, bytes, tipo);
    expect(res.status).toBe(415);
    expect(res.body.codigo).toBe('FORMATO_NO_PERMITIDO');
    expect(archivosEnCarpeta()).toEqual([]);
    expect((await pool.query("SELECT foto_perfil FROM usuarios WHERE usuario = 'barbero1_test'")).rows[0].foto_perfil).toBeNull();
  });

  it('cuerpo vacío o ausente → 400 ARCHIVO_VACIO', async () => {
    expect((await subir(tokenB1, Buffer.alloc(0))).body.codigo).toBe('ARCHIVO_VACIO');
    const sinCuerpo = await request(app).post('/api/perfil/foto').set(auth(tokenB1));
    expect(sinCuerpo.status).toBe(400);
    expect(sinCuerpo.body.codigo).toBe('ARCHIVO_VACIO');
  });

  it('un JSON no es una imagen (400) y no rompe nada', async () => {
    const res = await request(app).post('/api/perfil/foto').set(auth(tokenB1)).send({ foto: 'x' });
    expect(res.status).toBe(400);
    expect(archivosEnCarpeta()).toEqual([]);
  });

  it('más de 2 MB → 413 con { error, codigo }; exactamente 2 MB sí pasa', async () => {
    const grande = await subir(tokenB1, png(MB2), 'image/png');
    expect(grande.status).toBe(413);
    expect(grande.body).toMatchObject({ codigo: 'ARCHIVO_DEMASIADO_GRANDE', maximo_bytes: MB2 });
    expect(typeof grande.body.error).toBe('string');
    expect(archivosEnCarpeta()).toEqual([]);

    const justo = Buffer.concat([png(), Buffer.alloc(MB2 - png().length)]);
    expect(justo.length).toBe(MB2);
    expect((await subir(tokenB1, justo)).status).toBe(201);
  });

  it('la ruta con body crudo no afecta a express.json del resto de la API', async () => {
    const res = await cambiarNombre(tokenB1, { nombre_perfil: 'Sigue Andando' });
    expect(res.status).toBe(200);
    const login2 = await request(app).post('/api/auth/login').send({ usuario: 'barbero1_test', contrasena: 'barbero12345' });
    expect(login2.status).toBe(200);
  });

  it('una foto nueva borra la anterior solo después de guardar la nueva', async () => {
    const a = (await subir(tokenB1, png())).body.foto_url.split('/').pop();
    const b = (await subir(tokenB1, jpg(), 'image/jpeg')).body.foto_url.split('/').pop();
    expect(a).not.toBe(b);
    expect(archivosEnCarpeta()).toEqual([b]);
  });

  it('si el UPDATE falla se borra el archivo recién escrito y se conserva el anterior', async () => {
    const a = (await subir(tokenB1, png())).body.foto_url.split('/').pop();
    await pool.query("ALTER TABLE usuarios ADD CONSTRAINT prueba_sin_webp CHECK (foto_perfil IS NULL OR foto_perfil NOT LIKE '%.webp')");
    try {
      const res = await subir(tokenB1, webp(), 'image/webp');
      expect(res.status).toBe(500);
    } finally {
      await pool.query('ALTER TABLE usuarios DROP CONSTRAINT prueba_sin_webp');
    }
    expect(archivosEnCarpeta()).toEqual([a]);
    expect((await pool.query("SELECT foto_perfil FROM usuarios WHERE usuario = 'barbero1_test'")).rows[0].foto_perfil).toBe(a);
    expect(await cambios()).toHaveLength(1); // solo el de la foto A: el intento fallido no dejó registro
  });

  it('subidas simultáneas del mismo usuario: queda un solo archivo y la cadena de cambios es coherente', async () => {
    const respuestas = await Promise.all(Array.from({ length: 5 }, () => subir(tokenB1, png())));
    expect(respuestas.every((r) => r.status === 201)).toBe(true);
    const actual = (await pool.query("SELECT foto_perfil FROM usuarios WHERE usuario = 'barbero1_test'")).rows[0].foto_perfil;
    expect(archivosEnCarpeta()).toEqual([actual]);

    const filas = await cambios();
    expect(filas).toHaveLength(5);
    expect(filas[0].valor_anterior).toBe('/Barberos/uno.jpg');
    for (let i = 1; i < filas.length; i += 1) expect(filas[i].valor_anterior).toBe(filas[i - 1].valor_nuevo);
    expect(filas.at(-1).valor_nuevo).toBe(actual);
  });
});

describe('DELETE /api/perfil/foto', () => {
  it('quita la foto, borra el archivo y vuelve a la foto pública; es idempotente', async () => {
    await subir(tokenB1, png());
    const res = await request(app).delete('/api/perfil/foto').set(auth(tokenB1));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ foto_propia: false, foto_url: '/Barberos/uno.jpg', usa_foto_publica: true });
    expect(archivosEnCarpeta()).toEqual([]);

    const otra = await request(app).delete('/api/perfil/foto').set(auth(tokenB1));
    expect(otra.status).toBe(200);
    expect((await cambios()).map((c) => [c.campo, c.valor_nuevo])).toEqual([
      ['foto', expect.stringMatching(/\.png$/)],
      ['foto', '/Barberos/uno.jpg'],
    ]); // el segundo DELETE no registró nada
  });

  it('sin token 401', async () => {
    expect((await request(app).delete('/api/perfil/foto')).status).toBe(401);
  });
});

describe('GET /api/perfil/foto/:archivo', () => {
  it('sirve la foto sin token con Content-Type fijo, nosniff y caché larga', async () => {
    const bytes = png();
    const archivo = (await subir(tokenB1, bytes, 'text/plain')).body.foto_url.split('/').pop();
    const res = await request(app).get(`/api/perfil/foto/${archivo}`).buffer(true).parse((r, cb) => {
      const trozos = [];
      r.on('data', (t) => trozos.push(t));
      r.on('end', () => cb(null, Buffer.concat(trozos)));
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['cache-control']).toMatch(/max-age=31536000/);
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.body.equals(bytes)).toBe(true);
  });

  it('un archivo inexistente con nombre válido → 404', async () => {
    const res = await request(app).get('/api/perfil/foto/00000000-0000-4000-8000-000000000000.png');
    expect(res.status).toBe(404);
    expect(res.body.codigo).toBe('FOTO_NO_ENCONTRADA');
  });

  it('path traversal y nombres fuera de la lista blanca → 404 (aunque el archivo exista)', async () => {
    // Archivos que NO deben poder leerse: uno fuera de la carpeta con nombre válido y uno dentro con extensión no permitida.
    const fuera = path.join(path.dirname(CARPETA), 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png');
    fs.writeFileSync(fuera, png());
    fs.writeFileSync(path.join(CARPETA, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab.svg'), '<svg/>');
    fs.writeFileSync(path.join(CARPETA, 'secreto.txt'), 'secreto');
    try {
      const intentos = [
        `..%2F${path.basename(fuera)}`,
        `%2e%2e%2f${path.basename(fuera)}`,
        `..%5C${path.basename(fuera)}`,
        `%2e%2e%2f%2e%2e%2f.env`,
        `..%2F..%2Fpackage.json`,
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab.svg',
        'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA.png',
        'secreto.txt',
        '%00',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png%00.jpg',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png.svg',
      ];
      for (const intento of intentos) {
        const res = await request(app).get(`/api/perfil/foto/${intento}`);
        expect(res.status, intento).toBe(404);
        expect(res.headers['content-type'] ?? '').not.toMatch(/image|svg|text\/plain/);
      }
      // con barras reales ya no coincide con la ruta de la foto: cae en la autenticación (401), sin servir nada
      const barras = await request(app).get('/api/perfil/foto/....//....//package.json');
      expect([401, 404]).toContain(barras.status);
      expect(barras.headers['content-type'] ?? '').not.toMatch(/image|svg|text\/plain/);
      // un "../" literal lo normaliza el cliente HTTP: pide otra ruta del perfil y exige sesión
      expect((await request(app).get(`/api/perfil/foto/../${path.basename(fuera)}`)).status).toBe(401);
    } finally {
      fs.rmSync(fuera, { force: true });
    }
  });
});

describe('Contraseña caducada, usuario inactivo y roles', () => {
  const crear = async (usuario, { dias = 0, activo = true } = {}) => {
    await pool.query(
      `INSERT INTO usuarios (usuario, contrasena, rol, barbero_id, activo, contrasena_cambiada_en) VALUES ($1, $2, 'barbero', 2, $3, $4)`,
      [usuario, await bcrypt.hash(CLAVE, 10), activo, new Date(Date.now() - dias * 24 * 60 * 60 * 1000)]
    );
    return login(usuario, CLAVE);
  };

  it('caducada: todo el perfil responde 403 CONTRASENA_CADUCADA (menos servir la foto, que es pública)', async () => {
    const token = await crear('prueba_perfil_cad', { dias: 61 });
    expect(token).toBeTruthy();
    for (const [metodo, ruta] of [['get', '/api/perfil'], ['patch', '/api/perfil'], ['post', '/api/perfil/foto'], ['delete', '/api/perfil/foto']]) {
      const peticion = request(app)[metodo](ruta).set(auth(token));
      const res = await (metodo === 'patch' ? peticion.send({ nombre_perfil: 'Hola' }) : peticion.set('Content-Type', 'image/png').send(png()));
      expect(res.status, `${metodo} ${ruta}`).toBe(403);
      expect(res.body.codigo).toBe('CONTRASENA_CADUCADA');
    }
    expect(archivosEnCarpeta()).toEqual([]);
  });

  it('por vencer (día 58) puede cambiar nombre y foto', async () => {
    const token = await crear('prueba_perfil_pv', { dias: 58 });
    expect((await cambiarNombre(token, { nombre_perfil: 'Por Vencer' })).status).toBe(200);
    expect((await subir(token, png())).status).toBe(201);
  });

  it('usuario desactivado tras iniciar sesión → 401 SESION_INVALIDA en todo', async () => {
    const token = await crear('prueba_perfil_inact');
    await pool.query("UPDATE usuarios SET activo = false WHERE usuario = 'prueba_perfil_inact'");
    for (const [metodo, ruta] of [['get', '/api/perfil'], ['patch', '/api/perfil'], ['post', '/api/perfil/foto'], ['delete', '/api/perfil/foto']]) {
      const res = await request(app)[metodo](ruta).set(auth(token)).send(metodo === 'patch' ? { nombre_perfil: 'Hola' } : undefined);
      expect(res.status, `${metodo} ${ruta}`).toBe(401);
      expect(res.body.codigo).toBe('SESION_INVALIDA');
    }
  });

  it('un barbero no puede usar los endpoints de revisión del admin, ni sin token', async () => {
    for (const [metodo, ruta, cuerpo] of [
      ['get', '/api/admin/cambios-perfil'],
      ['post', '/api/admin/cambios-perfil/revisar', { barbero_id: 1 }],
      ['post', '/api/admin/barberos/1/restablecer-perfil'],
    ]) {
      const res = await request(app)[metodo](ruta).set(auth(tokenB1)).send(cuerpo);
      expect(res.status, ruta).toBe(403);
      const anonimo = await request(app)[metodo](ruta).send(cuerpo);
      expect(anonimo.status, ruta).toBe(401);
    }
  });
});

describe('Registro en cambios_perfil', () => {
  it('registra el cambio de nombre del barbero con valor anterior y nuevo', async () => {
    await cambiarNombre(tokenB1, { nombre_perfil: 'Pepe' });
    const filas = await cambios();
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ barbero_id: 1, campo: 'nombre', valor_anterior: 'Barbero Uno', valor_nuevo: 'Pepe', revisado_en: null, revisado_por: null });
    expect(filas[0].usuario_id).toBe((await pool.query("SELECT id FROM usuarios WHERE usuario = 'barbero1_test'")).rows[0].id);
  });

  it('solo registra cuando el valor efectivo cambia de verdad', async () => {
    await cambiarNombre(tokenB1, { nombre_perfil: 'Pepe' });
    await cambiarNombre(tokenB1, { nombre_perfil: 'Pepe' }); // mismo valor
    await cambiarNombre(tokenB1, { nombre_perfil: '  Pepe  ' }); // mismo valor tras normalizar
    expect(await cambios()).toHaveLength(1);

    await cambiarNombre(tokenB1, { nombre_perfil: null }); // vuelve al público: cambia (Pepe → Barbero Uno)
    await cambiarNombre(tokenB1, { nombre_perfil: null }); // ya estaba así
    await cambiarNombre(tokenB1, { nombre_perfil: 'Barbero Uno' }); // distinto en crudo, igual de efectivo
    const filas = await cambios();
    expect(filas.map((f) => [f.valor_anterior, f.valor_nuevo])).toEqual([
      ['Barbero Uno', 'Pepe'],
      ['Pepe', 'Barbero Uno'],
    ]);
  });

  it('registra la foto nueva y la baja de la foto (de vuelta a la pública)', async () => {
    const archivo = (await subir(tokenB1, png())).body.foto_url.split('/').pop();
    await request(app).delete('/api/perfil/foto').set(auth(tokenB1));
    const filas = await cambios();
    expect(filas.map((f) => [f.campo, f.valor_anterior, f.valor_nuevo])).toEqual([
      ['foto', '/Barberos/uno.jpg', archivo],
      ['foto', archivo, '/Barberos/uno.jpg'],
    ]);
  });

  it('validaciones fallidas no registran nada', async () => {
    await cambiarNombre(tokenB1, { nombre_perfil: 'x' });
    await subir(tokenB1, Buffer.from('no soy imagen'));
    expect(await cambios()).toEqual([]);
  });

  it('el admin NO registra cambios', async () => {
    await cambiarNombre(tokenAdmin, { nombre_perfil: 'Jefe' });
    await subir(tokenAdmin, jpg(), 'image/jpeg');
    await request(app).delete('/api/perfil/foto').set(auth(tokenAdmin));
    expect(await cambios()).toEqual([]);
  });

  it('el conteo del aviso son barberos DISTINTOS (varios cambios o varios usuarios del mismo barbero cuentan una vez)', async () => {
    const tokenB1b = await login('prueba_perfil_b1b', CLAVE);
    await cambiarNombre(tokenB1, { nombre_perfil: 'Pepe' });
    await subir(tokenB1, png());
    await cambiarNombre(tokenB1b, { nombre_perfil: 'Pepe Bis' }); // otro usuario del mismo barbero 1
    expect((await request(app).get('/api/admin/cambios-perfil').set(auth(tokenAdmin))).body.total_barberos).toBe(1);

    await cambiarNombre(tokenB2, { nombre_perfil: 'Maria' });
    const res = await request(app).get('/api/admin/cambios-perfil').set(auth(tokenAdmin));
    expect(res.status).toBe(200);
    expect(res.body.total_barberos).toBe(2);
    expect(res.body.barberos.map((b) => b.barbero_id).sort()).toEqual([1, 2]);

    const b1 = res.body.barberos.find((b) => b.barbero_id === 1);
    expect(b1.nombre).toBe('Barbero Uno'); // el nombre público, nunca el de perfil
    expect(b1.cambios).toHaveLength(3);
    expect(b1.cambios[0]).toEqual({
      id: expect.any(Number),
      usuario: 'prueba_perfil_b1b',
      campo: 'nombre',
      valor_anterior: 'Barbero Uno',
      valor_nuevo: 'Pepe Bis',
      creado_en: expect.any(String),
    });
    expect(JSON.stringify(res.body)).not.toMatch(/contrasena|hash/i);
  });

  it('GET admin: sin cambios → cero; parámetros desconocidos → 400', async () => {
    const vacio = await request(app).get('/api/admin/cambios-perfil').set(auth(tokenAdmin));
    expect(vacio.body).toEqual({ total_barberos: 0, barberos: [] });
    const res = await request(app).get('/api/admin/cambios-perfil?barbero=1').set(auth(tokenAdmin));
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('PARAMETRO_INVALIDO');
  });
});

describe('POST /api/admin/cambios-perfil/revisar', () => {
  it('marca como revisados solo los del barbero indicado, con quién y cuándo', async () => {
    await cambiarNombre(tokenB1, { nombre_perfil: 'Pepe' });
    await cambiarNombre(tokenB1, { nombre_perfil: 'Pepe2' });
    await cambiarNombre(tokenB2, { nombre_perfil: 'Maria' });

    const res = await request(app).post('/api/admin/cambios-perfil/revisar').set(auth(tokenAdmin)).send({ barbero_id: 1 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ barbero_id: 1, revisados: 2 });

    const filas = await cambios();
    const adminId = (await pool.query('SELECT id FROM usuarios WHERE usuario = $1', [process.env.ADMIN_USER])).rows[0].id;
    expect(filas.filter((f) => f.barbero_id === 1).every((f) => f.revisado_en && f.revisado_por === adminId)).toBe(true);
    expect(filas.find((f) => f.barbero_id === 2).revisado_en).toBeNull();
    expect((await request(app).get('/api/admin/cambios-perfil').set(auth(tokenAdmin))).body.total_barberos).toBe(1);

    expect((await request(app).post('/api/admin/cambios-perfil/revisar').set(auth(tokenAdmin)).send({ barbero_id: 1 })).body.revisados).toBe(0);
  });

  it('un cambio posterior a la revisión vuelve a avisar', async () => {
    await cambiarNombre(tokenB1, { nombre_perfil: 'Pepe' });
    await request(app).post('/api/admin/cambios-perfil/revisar').set(auth(tokenAdmin)).send({ barbero_id: 1 });
    await cambiarNombre(tokenB1, { nombre_perfil: 'Pepe Nuevo' });
    expect((await request(app).get('/api/admin/cambios-perfil').set(auth(tokenAdmin))).body.total_barberos).toBe(1);
  });

  it.each([
    ['sin cuerpo', undefined, 400],
    ['sin barbero_id', {}, 400],
    ['barbero_id texto', { barbero_id: '1' }, 400],
    ['barbero_id negativo', { barbero_id: -1 }, 400],
    ['barbero_id decimal', { barbero_id: 1.5 }, 400],
    ['barbero_id gigante', { barbero_id: 99999999999 }, 400],
    ['campo extra', { barbero_id: 1, otro: 1 }, 400],
    ['barbero inexistente', { barbero_id: 9999 }, 404],
  ])('%s', async (_etiqueta, cuerpo, estado) => {
    const res = await request(app).post('/api/admin/cambios-perfil/revisar').set(auth(tokenAdmin)).send(cuerpo);
    expect(res.status).toBe(estado);
    expect(res.body.codigo).toBeTruthy();
  });
});

describe('POST /api/admin/barberos/:id/restablecer-perfil', () => {
  it('limpia nombre y foto de TODOS los usuarios del barbero, borra los archivos y marca revisados; no toca a otros', async () => {
    const tokenB1b = await login('prueba_perfil_b1b', CLAVE);
    await cambiarNombre(tokenB1, { nombre_perfil: 'Pepe' });
    await subir(tokenB1, png());
    await subir(tokenB1b, jpg(), 'image/jpeg');
    await cambiarNombre(tokenB2, { nombre_perfil: 'Maria' });
    const fotoB2 = (await subir(tokenB2, webp(), 'image/webp')).body.foto_url.split('/').pop();
    expect(archivosEnCarpeta()).toHaveLength(3);
    const antes = await barberos();

    const res = await request(app).post('/api/admin/barberos/1/restablecer-perfil').set(auth(tokenAdmin));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ barbero_id: 1, archivos_eliminados: 2, revisados: 3 });
    expect(res.body.usuarios_restablecidos).toBeGreaterThanOrEqual(2);

    const { rows } = await pool.query('SELECT usuario, nombre_perfil, foto_perfil, barbero_id FROM usuarios WHERE barbero_id = 1');
    expect(rows.every((u) => u.nombre_perfil === null && u.foto_perfil === null)).toBe(true);
    expect(archivosEnCarpeta()).toEqual([fotoB2]); // solo queda la del otro barbero
    expect((await pool.query("SELECT nombre_perfil FROM usuarios WHERE usuario = 'barbero2_test'")).rows[0].nombre_perfil).toBe('Maria');
    expect(await barberos()).toEqual(antes); // la web pública no se tocó

    const admin = await request(app).get('/api/admin/cambios-perfil').set(auth(tokenAdmin));
    expect(admin.body.barberos.map((b) => b.barbero_id)).toEqual([2]);

    // el barbero vuelve a ver sus valores públicos y el restablecimiento no genera un cambio nuevo
    const perfil = await request(app).get('/api/perfil').set(auth(tokenB1));
    expect(perfil.body).toMatchObject({ nombre: 'Barbero Uno', foto_url: '/Barberos/uno.jpg', foto_propia: false });
  });

  it('un barbero sin cambios responde 200 con ceros', async () => {
    const res = await request(app).post('/api/admin/barberos/2/restablecer-perfil').set(auth(tokenAdmin));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ archivos_eliminados: 0, revisados: 0 });
  });

  it.each([
    ['9999', 404, 'BARBERO_NO_ENCONTRADO'],
    ['abc', 400, 'ID_INVALIDO'],
    ['0', 400, 'ID_INVALIDO'],
    ['-1', 400, 'ID_INVALIDO'],
    ['1.5', 400, 'ID_INVALIDO'],
    ['99999999999', 400, 'ID_INVALIDO'],
  ])('id %s', async (id, estado, codigo) => {
    const res = await request(app).post(`/api/admin/barberos/${id}/restablecer-perfil`).set(auth(tokenAdmin));
    expect(res.status).toBe(estado);
    expect(res.body.codigo).toBe(codigo);
  });
});

describe('La web pública no cambia', () => {
  const instantanea = async () => {
    const [barberosPublicos, empleados, disponibilidad] = await Promise.all([
      request(app).get('/api/barberos'),
      request(app).get('/api/admin/empleados').set(auth(tokenAdmin)),
      request(app).get('/api/disponibilidad').query({ fecha: '2030-06-15' }),
    ]);
    return {
      barberosPublicos: { estado: barberosPublicos.status, cuerpo: barberosPublicos.body },
      empleados: { estado: empleados.status, cuerpo: empleados.body },
      disponibilidad: { estado: disponibilidad.status, cuerpo: disponibilidad.body },
      filas: await barberos(),
    };
  };

  it('/api/barberos, /api/admin/empleados, disponibilidad y la tabla barberos son idénticos tras cambiar nombre y foto', async () => {
    const antes = await instantanea();
    expect(antes.barberosPublicos.estado).toBe(200);
    expect(antes.empleados.estado).toBe(200);

    await cambiarNombre(tokenB1, { nombre_perfil: 'Nombre De Perfil' });
    await subir(tokenB1, png());
    await cambiarNombre(tokenB2, { nombre_perfil: 'Otro De Perfil' });
    await subir(tokenB2, jpg(), 'image/jpeg');
    await cambiarNombre(tokenAdmin, { nombre_perfil: 'Admin De Perfil' });
    await request(app).delete('/api/perfil/foto').set(auth(tokenB2));

    expect(await instantanea()).toEqual(antes);
    expect(JSON.stringify(antes)).not.toContain('Nombre De Perfil');
    expect(JSON.stringify(antes.barberosPublicos.cuerpo)).not.toMatch(/perfil/);
    // y el usuario de login no se tocó
    expect((await pool.query("SELECT usuario FROM usuarios WHERE barbero_id = 1 AND activo ORDER BY id")).rows.map((u) => u.usuario)).toContain('barbero1_test');
  });

  it('la sesión y el login siguen devolviendo el mismo usuario (no el nombre de perfil)', async () => {
    await cambiarNombre(tokenB1, { nombre_perfil: 'Nombre De Perfil' });
    const sesion = await request(app).get('/api/auth/sesion').set(auth(tokenB1));
    expect(sesion.body.usuario).toEqual({ id: expect.any(Number), usuario: 'barbero1_test', rol: 'barbero', barbero_id: 1 });
  });
});
