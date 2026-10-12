import { describe, it, expect } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { crearApp } from '../app.js';
import { pool } from '../db/connection.js';
import { evaluarContrasena } from '../utils/politicaContrasenas.js';

// Pentest (fase 1): política mínima de contraseñas en todos los puntos donde se fija una.
const app = crearApp();
const loginAdmin = async () =>
  (await request(app).post('/api/auth/login').send({ usuario: process.env.ADMIN_USER, contrasena: process.env.ADMIN_PASSWORD })).body.token;

describe('evaluarContrasena (unidad)', () => {
  it.each([
    ['12345678', 'comun'],
    ['Password123', 'comun'],
    ['password', 'comun'],
    ['aaaaaaaa', 'comun'],
    ['abcdefgh', 'comun'],
    ['BarberIA123', 'comun'],
    ['qwerty123!', 'comun'],
    ['corta', 'longitud'],
    ['ñ'.repeat(40), 'longitud'],
  ])('rechaza %s', (valor, motivo) => {
    expect(evaluarContrasena(valor, { usuario: 'otro' })?.motivo).toBe(motivo);
  });

  it('rechaza una contraseña igual al usuario o que lo contiene', () => {
    expect(evaluarContrasena('Danny2026', { usuario: 'Danny' })?.motivo).toBe('usuario');
    expect(evaluarContrasena('Rafa-7777', { usuario: 'rafa' })?.motivo).toBe('usuario');
    expect(evaluarContrasena('rafa1234x', { usuario: 'rafa' })?.motivo).toBe('usuario');
    expect(evaluarContrasena('Mi-Rafa-secreto-77', { usuario: 'rafa' })).toBeNull(); // el usuario dentro de una frase larga sí vale
  });

  it('acepta contraseñas razonables (72 bytes exactos y con acentos incluidas)', () => {
    expect(evaluarContrasena('Cuatro-gatos-azules-77', { usuario: 'x' })).toBeNull();
    expect(evaluarContrasena('a1'.repeat(36))).toBeNull();
    expect(evaluarContrasena('Ñandú-veloz-2026')).toBeNull();
  });
});

describe('La política se aplica en cada punto de entrada', () => {
  it('POST /api/admin/usuarios rechaza contraseñas comunes', async () => {
    const token = await loginAdmin();
    const res = await request(app)
      .post('/api/admin/usuarios')
      .set('Authorization', `Bearer ${token}`)
      .send({ usuario: 'pol_user1', contrasena: 'Password123', barbero_id: 1 });
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('CONTRASENA_DEBIL');
  });

  it('POST /api/admin/empleados rechaza contraseñas comunes, iguales al usuario y de más de 72 bytes', async () => {
    const token = await loginAdmin();
    for (const contrasena of ['12345678', 'pol_emp1-2026', 'ñ'.repeat(40)]) {
      const res = await request(app)
        .post('/api/admin/empleados')
        .set('Authorization', `Bearer ${token}`)
        .send({ nombre: 'Pol Emp', usuario: 'pol_emp1', contrasena });
      expect(res.status).toBe(400);
    }
    const { rows } = await pool.query("SELECT 1 FROM usuarios WHERE usuario = 'pol_emp1'");
    expect(rows).toHaveLength(0);
  });

  it('PATCH /api/admin/usuarios/:id (restablecer) rechaza contraseñas comunes', async () => {
    const token = await loginAdmin();
    const res = await request(app).patch('/api/admin/usuarios/2').set('Authorization', `Bearer ${token}`).send({ contrasena: 'qwerty123' });
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('CONTRASENA_DEBIL');
  });

  it('PATCH /api/auth/contrasena (la propia) rechaza contraseñas comunes', async () => {
    const token = await loginAdmin();
    const res = await request(app)
      .patch('/api/auth/contrasena')
      .set('Authorization', `Bearer ${token}`)
      .send({ actual: process.env.ADMIN_PASSWORD, nueva: 'administrador' });
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('CONTRASENA_DEBIL');
    expect(res.body.campo).toBe('nueva');
  });

  it('una contraseña razonable sigue funcionando al crear un acceso', async () => {
    const token = await loginAdmin();
    const res = await request(app)
      .post('/api/admin/usuarios')
      .set('Authorization', `Bearer ${token}`)
      .send({ usuario: 'pol_user_ok', contrasena: 'Cuatro-gatos-azules-77', barbero_id: 2 });
    expect(res.status).toBe(201);
    const { rows } = await pool.query("SELECT contrasena FROM usuarios WHERE usuario = 'pol_user_ok'");
    expect(await bcrypt.compare('Cuatro-gatos-azules-77', rows[0].contrasena)).toBe(true);
    await pool.query("DELETE FROM usuarios WHERE usuario = 'pol_user_ok'");
  });
});

describe('Contraseña del admin sembrado (ADMIN_PASSWORD)', () => {
  it('exige la política común y al menos 12 caracteres', async () => {
    const { problemaContrasenaAdmin } = await import('../utils/politicaContrasenas.js');
    expect(problemaContrasenaAdmin('admin', 'admin123')).toBeTruthy();
    expect(problemaContrasenaAdmin('admin', 'Corta-1234')).toMatch(/12 caracteres/);
    expect(problemaContrasenaAdmin('jefe', 'password1234')).toBeTruthy();
    expect(problemaContrasenaAdmin('admin', 'Cuatro-gatos-azules-77')).toBeNull();
  });
});
