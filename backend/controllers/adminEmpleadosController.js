// Gestión de empleados (barberos) desde el panel del admin. Un empleado es un barbero (lo que se ve en la web) más
// su usuario de acceso. Sin DELETE a propósito: se desactivan para conservar el historial de citas.
// Barbero y usuario se mantienen siempre en el mismo estado: crear, desactivar y reactivar tocan ambos en una
// sola transacción. Todos los errores llevan un `codigo` estable para que el front no dependa del texto.
import bcrypt from 'bcryptjs';
import { pool } from '../db/connection.js';
import { ahoraBogota, hoyISO } from '../utils/fechas.js';
import { primerDiaDelMes, sumarMeses } from '../utils/periodos.js';
import { validarParametros } from '../utils/parametrosQuery.js';
import { estadoContrasena, MIN_CONTRASENA, MAX_CONTRASENA } from '../utils/contrasenas.js';
import { AREAS, AREA_BARBERIA, esAreaValida, contarCitasAbiertas } from '../utils/areas.js';

const ID_MAXIMO_INT = 2147483647;
const MAX_NOMBRE = 100;
const MAX_CARGO = 100;
const MAX_ESPECIALIDAD = 150;
const MAX_USUARIO = 50;

const fallo = (res, estado, codigo, error, extra = {}) => res.status(estado).json({ error, codigo, ...extra });
const datoInvalido = (res, campo, mensaje) => fallo(res, 400, 'DATOS_INVALIDOS', mensaje, { campo });
const esObjetoPlano = (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor);

// Texto opcional: se recorta y vacío significa "sin valor" (null).
const textoOpcional = (maximo, etiqueta) => (v) =>
  v === null || (typeof v === 'string' && v.trim().length <= maximo)
    ? { valor: v === null || v.trim() === '' ? null : v.trim() }
    : { mensaje: `${etiqueta} no puede superar ${maximo} caracteres` };

const REGLAS_EMPLEADO = {
  nombre: (v) =>
    typeof v === 'string' && v.trim().length >= 1 && v.trim().length <= MAX_NOMBRE
      ? { valor: v.trim() }
      : { mensaje: `El nombre es obligatorio y debe tener entre 1 y ${MAX_NOMBRE} caracteres` },
  cargo: textoOpcional(MAX_CARGO, 'El cargo'),
  especialidad: textoOpcional(MAX_ESPECIALIDAD, 'La especialidad'),
  activo: (v) => (typeof v === 'boolean' ? { valor: v } : { mensaje: 'El campo activo debe ser verdadero o falso' }),
  area: (v) => (esAreaValida(v) ? { valor: v } : { mensaje: `El área debe ser una de: ${AREAS.join(', ')}` }),
};
const REGLAS_ALTA = {
  ...REGLAS_EMPLEADO,
  usuario: (v) =>
    typeof v === 'string' && v.trim().length >= 1 && v.trim().length <= MAX_USUARIO
      ? { valor: v.trim() }
      : { mensaje: `El usuario es obligatorio y debe tener entre 1 y ${MAX_USUARIO} caracteres` },
  contrasena: (v) =>
    typeof v === 'string' && v.length >= MIN_CONTRASENA && v.length <= MAX_CONTRASENA
      ? { valor: v }
      : { mensaje: `La contraseña debe tener entre ${MIN_CONTRASENA} y ${MAX_CONTRASENA} caracteres` },
};
delete REGLAS_ALTA.activo; // un empleado nuevo siempre nace activo

const leerCampos = (cuerpo, reglas) => {
  const datos = {};
  for (const campo of Object.keys(cuerpo)) {
    if (!(campo in reglas)) {
      return { campo, mensaje: `Campo desconocido '${campo}'. Campos admitidos: ${Object.keys(reglas).join(', ')}` };
    }
    const resultado = reglas[campo](cuerpo[campo]);
    if (!('valor' in resultado)) return { campo, mensaje: resultado.mensaje };
    datos[campo] = resultado.valor;
  }
  return { datos };
};

// Si hay varios usuarios ligados al mismo barbero (pasó con usuarios de prueba), se muestra uno solo: el activo, y si
// no hay ninguno activo el más reciente. `usuarios_total` deja ver que existen más.
const SELECT_EMPLEADOS = `
  SELECT b.id, b.nombre, b.cargo, b.especialidad, b.foto, b.activo, b.area,
         u.id AS usuario_id, u.usuario AS usuario_nombre, u.activo AS usuario_activo, u.contrasena_cambiada_en,
         (SELECT COUNT(*)::int FROM usuarios WHERE barbero_id = b.id AND rol = 'barbero') AS usuarios_total,
         (SELECT COUNT(*)::int FROM citas c
           WHERE c.barbero_id = b.id AND c.estado = 'completada' AND c.fecha >= $1::date AND c.fecha < $2::date
             AND EXISTS (SELECT 1 FROM servicios sv WHERE sv.id = c.servicio_id AND sv.area = b.area)) AS cortes_mes, -- cortes o asesorías según SU área (no cuenta citas anteriores de otra área)
         (SELECT COUNT(*)::int FROM citas c
           WHERE c.barbero_id = b.id AND c.estado = 'pendiente' AND (c.fecha + c.hora) >= $3::timestamp) AS citas_pendientes
  FROM barberos b
  LEFT JOIN LATERAL (
    SELECT id, usuario, activo, contrasena_cambiada_en FROM usuarios
    WHERE barbero_id = b.id AND rol = 'barbero'
    ORDER BY activo DESC, id DESC
    LIMIT 1
  ) u ON true`;

const aEmpleado = (f) => ({
  id: f.id,
  nombre: f.nombre,
  cargo: f.cargo,
  especialidad: f.especialidad,
  foto: f.foto,
  activo: f.activo,
  area: f.area,
  usuario:
    f.usuario_id === null
      ? null
      : {
          id: f.usuario_id,
          usuario: f.usuario_nombre,
          activo: f.usuario_activo,
          vigencia: estadoContrasena(f.contrasena_cambiada_en), // estado, dias_restantes, vence_en (nunca el hash)
        },
  usuarios_total: f.usuarios_total,
  cortes_mes: f.cortes_mes,
  citas_pendientes: f.citas_pendientes,
});

// Los límites del mes y "ahora" salen de Node (hora de Bogotá), nunca de CURRENT_DATE/NOW().
const parametrosPeriodo = () => {
  const desde = primerDiaDelMes(hoyISO());
  return [desde, sumarMeses(desde, 1), ahoraBogota()];
};

const buscarEmpleado = async (db, id) => {
  const { rows } = await db.query(`${SELECT_EMPLEADOS} WHERE b.id = $4`, [...parametrosPeriodo(), id]);
  return rows[0] ? aEmpleado(rows[0]) : null;
};

const leerId = (req, res) => {
  const { id } = req.params;
  if (!/^\d+$/.test(id)) {
    fallo(res, 400, 'ID_INVALIDO', 'El id debe ser numérico');
    return null;
  }
  const numero = Number(id);
  if (numero > ID_MAXIMO_INT) {
    fallo(res, 404, 'EMPLEADO_NO_ENCONTRADO', 'Empleado no encontrado');
    return null;
  }
  return numero;
};

// GET /api/admin/empleados  (incluye inactivos; el filtro por estado lo hace el front)
export const listarEmpleados = async (req, res, next) => {
  try {
    const errorParametros = validarParametros(req.query, []);
    if (errorParametros) return fallo(res, 400, 'PARAMETRO_INVALIDO', errorParametros);

    const { rows } = await pool.query(`${SELECT_EMPLEADOS} ORDER BY b.nombre, b.id`, parametrosPeriodo());
    res.json(rows.map(aEmpleado));
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/empleados  → crea barbero y usuario en una sola transacción
export const crearEmpleado = async (req, res, next) => {
  let cliente;
  try {
    if (!esObjetoPlano(req.body)) return datoInvalido(res, null, 'El cuerpo debe ser un objeto JSON');
    const { datos, campo, mensaje } = leerCampos(req.body, REGLAS_ALTA);
    if (!datos) return datoInvalido(res, campo, mensaje);
    for (const obligatorio of ['nombre', 'usuario', 'contrasena']) {
      if (!(obligatorio in datos)) return datoInvalido(res, obligatorio, `El campo ${obligatorio} es obligatorio`);
    }

    const hash = await bcrypt.hash(datos.contrasena, 10);

    cliente = await pool.connect();
    await cliente.query('BEGIN');
    const { rows } = await cliente.query(
      `INSERT INTO barberos (nombre, cargo, especialidad, area) VALUES ($1, $2, $3, $4) RETURNING id`,
      [datos.nombre, datos.cargo ?? null, datos.especialidad ?? null, datos.area ?? AREA_BARBERIA]
    );
    const barberoId = rows[0].id;
    await cliente.query(
      `INSERT INTO usuarios (usuario, contrasena, rol, barbero_id, contrasena_cambiada_en) VALUES ($1, $2, 'barbero', $3, $4)`,
      [datos.usuario, hash, barberoId, new Date()]
    );
    await cliente.query('COMMIT');

    res.status(201).json(await buscarEmpleado(pool, barberoId));
  } catch (err) {
    if (cliente) await cliente.query('ROLLBACK').catch(() => {}); // el barbero recién insertado no queda huérfano
    if (err.code === '23505' && err.constraint === 'usuarios_usuario_key') {
      return fallo(res, 409, 'USUARIO_DUPLICADO', 'Ese nombre de usuario ya existe', { campo: 'usuario' });
    }
    next(err);
  } finally {
    cliente?.release();
  }
};

// PATCH /api/admin/empleados/:id  { nombre?, cargo?, especialidad?, activo? }
export const actualizarEmpleado = async (req, res, next) => {
  let cliente;
  try {
    const id = leerId(req, res);
    if (id === null) return;
    if (!esObjetoPlano(req.body)) return datoInvalido(res, null, 'El cuerpo debe ser un objeto JSON');
    if (Object.keys(req.body).length === 0) return datoInvalido(res, null, 'Debes enviar al menos un campo para actualizar');
    const { datos, campo, mensaje } = leerCampos(req.body, REGLAS_EMPLEADO);
    if (!datos) return datoInvalido(res, campo, mensaje);

    cliente = await pool.connect();
    await cliente.query('BEGIN');
    const { rows: existente } = await cliente.query('SELECT id, area FROM barberos WHERE id = $1 FOR UPDATE', [id]);
    if (existente.length === 0) {
      await cliente.query('ROLLBACK');
      return fallo(res, 404, 'EMPLEADO_NO_ENCONTRADO', 'Empleado no encontrado');
    }

    // Cambiar de área con citas abiertas (pendientes o de hoy en adelante) dejaría citas con un profesional que ya
    // no atiende ese servicio: se rechaza hasta que las reasigne o las cierre.
    if (datos.area !== undefined && datos.area !== existente[0].area) {
      const abiertas = await contarCitasAbiertas(cliente, id, hoyISO());
      if (abiertas > 0) {
        await cliente.query('ROLLBACK');
        return fallo(
          res,
          409,
          'AREA_CON_CITAS_PENDIENTES',
          `No se puede cambiar el área: tiene ${abiertas} cita(s) pendientes o futuras. Reasígnalas o ciérralas primero.`,
          { campo: 'area', citas_pendientes: abiertas }
        );
      }
    }

    const columnas = Object.keys(datos);
    if (columnas.length > 0) {
      const asignaciones = columnas.map((columna, i) => `${columna} = $${i + 1}`).join(', '); // nombres fijos de REGLAS_EMPLEADO
      await cliente.query(`UPDATE barberos SET ${asignaciones} WHERE id = $${columnas.length + 1}`, [
        ...columnas.map((columna) => datos[columna]),
        id,
      ]);
    }

    if (datos.activo === false) {
      await cliente.query(`UPDATE usuarios SET activo = false WHERE barbero_id = $1 AND rol = 'barbero'`, [id]);
    } else if (datos.activo === true) {
      // Se reactiva solo el usuario que el listado muestra (el más reciente); los demás ligados quedan como estaban.
      await cliente.query(
        `UPDATE usuarios SET activo = true
         WHERE id = (SELECT id FROM usuarios WHERE barbero_id = $1 AND rol = 'barbero' ORDER BY activo DESC, id DESC LIMIT 1)`,
        [id]
      );
    }
    await cliente.query('COMMIT');

    const empleado = await buscarEmpleado(pool, id);
    // Al desactivar, las citas pendientes futuras se conservan asignadas: se avisa cuántas son para reasignarlas.
    res.json(datos.activo === false ? { ...empleado, citas_pendientes_conservadas: empleado.citas_pendientes } : empleado);
  } catch (err) {
    if (cliente) await cliente.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    cliente?.release();
  }
};
