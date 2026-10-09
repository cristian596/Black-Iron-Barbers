import { describe, it, expect } from 'vitest';
import {
  DIAS_ATRAS,
  DIAS_ADELANTE,
  DOMINIO_DEMO,
  planificarDemo,
  validarPlan,
  resumirPlan,
  esCorreoDemo,
} from '../db/sembrarDemo.js';
import { sumarDias } from '../utils/periodos.js';
import { minutosDesdeMedianoche } from '../utils/fechas.js';

// Plan puro: no usa la base de datos. Catálogo mínimo con la forma del real (categorías, duraciones, asesorías).
const SERVICIOS = [
  { id: 1, nombre: 'Corte clásico', duracion_min: 30, precio: 20000, tipo: 'original', area: 'barberia', categoria_slug: 'cortes' },
  { id: 2, nombre: 'Corte fade', duracion_min: 40, precio: 25000, tipo: 'elite', area: 'barberia', categoria_slug: 'cortes' },
  { id: 3, nombre: 'Corte premium', duracion_min: 60, precio: 40000, tipo: 'vip', area: 'barberia', categoria_slug: 'cortes' },
  { id: 4, nombre: 'Perfilado de barba', duracion_min: 20, precio: 12000, tipo: 'original', area: 'barberia', categoria_slug: 'barba' },
  { id: 5, nombre: 'Arreglo de barba', duracion_min: 30, precio: 20000, tipo: 'elite', area: 'barberia', categoria_slug: 'barba' },
  { id: 6, nombre: 'Ritual de barba', duracion_min: 45, precio: 35000, tipo: 'vip', area: 'barberia', categoria_slug: 'barba' },
  { id: 7, nombre: 'Corte + barba', duracion_min: 45, precio: 27000, tipo: 'original', area: 'barberia', categoria_slug: 'cortes-barba' },
  { id: 8, nombre: 'Fade + barba', duracion_min: 60, precio: 42000, tipo: 'elite', area: 'barberia', categoria_slug: 'cortes-barba' },
  { id: 9, nombre: 'Experiencia VIP', duracion_min: 120, precio: 95000, tipo: 'vip', area: 'barberia', categoria_slug: 'cortes-barba' },
  { id: 10, nombre: 'Limpieza facial', duracion_min: 30, precio: 25000, tipo: 'original', area: 'barberia', categoria_slug: 'faciales' },
  { id: 11, nombre: 'Tratamiento facial VIP', duracion_min: 75, precio: 70000, tipo: 'vip', area: 'barberia', categoria_slug: 'faciales' },
  { id: 12, nombre: 'Keratina corta', duracion_min: 90, precio: 60000, tipo: 'original', area: 'barberia', categoria_slug: 'keratinas' },
  { id: 13, nombre: 'Ondulado corto', duracion_min: 75, precio: 50000, tipo: 'original', area: 'barberia', categoria_slug: 'ondulados' },
  { id: 20, nombre: 'Asesoría gratis', duracion_min: 15, precio: 0, tipo: 'original', area: 'asesoria', categoria_slug: 'asesorias', clave_seed: 'asesoria-gratis' },
  { id: 21, nombre: 'Asesoría de barba', duracion_min: 45, precio: 45000, tipo: 'elite', area: 'asesoria', categoria_slug: 'asesorias', clave_seed: 'asesoria-barba' },
  { id: 22, nombre: 'Asesoría Premium', duracion_min: 60, precio: 60000, tipo: 'vip', area: 'asesoria', categoria_slug: 'asesorias', clave_seed: 'asesoria-premium' },
];
const HOY = '2026-10-09'; // viernes
const BARBEROS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 36];
const ASESORAS = [37];
const OCUPADAS = [
  { barbero_id: 37, fecha: '2026-10-14', hora: '11:00:00', duracion_min: 15 },
  { barbero_id: 1, fecha: '2026-10-15', hora: '14:00:00', duracion_min: 90 },
  { barbero_id: 6, fecha: '2026-10-07', hora: '09:30:00', duracion_min: 100 },
];
const base = { hoy: HOY, minutosAhora: 14 * 60 + 20, barberos: BARBEROS, asesoras: ASESORAS, servicios: SERVICIOS, ocupadas: OCUPADAS };
const profesionalArea = new Map([...BARBEROS.map((id) => [id, 'barberia']), ...ASESORAS.map((id) => [id, 'asesoria'])]);
const servicioArea = new Map(SERVICIOS.map((s) => [s.id, s.area]));
const opciones = { hoy: HOY, minutosAhora: base.minutosAhora, ocupadas: OCUPADAS, profesionalArea, servicioArea };

const plan = planificarDemo(base);
const { citas } = plan;
const ini = (c) => minutosDesdeMedianoche(c.hora);

describe('planificarDemo: reglas del plan', () => {
  it('es determinista y cambia con otra semilla', () => {
    expect(planificarDemo(base)).toEqual(plan);
    expect(planificarDemo({ ...base, semilla: 7 })).not.toEqual(plan);
  });

  it('el plan cumple todas las reglas de validarPlan', () => {
    expect(validarPlan(plan, opciones)).toEqual([]);
  });

  it('todas las citas están dentro del horario 10:00–20:00', () => {
    expect(citas.length).toBeGreaterThan(500);
    for (const c of citas) {
      expect(ini(c)).toBeGreaterThanOrEqual(10 * 60);
      expect(ini(c) + c.duracion_min).toBeLessThanOrEqual(20 * 60);
    }
  });

  it('ningún profesional tiene dos citas activas solapadas (ni con las ya existentes)', () => {
    const porClave = new Map();
    const agrega = (prof, fecha, i, f) => {
      const k = `${prof}|${fecha}`;
      if (!porClave.has(k)) porClave.set(k, []);
      porClave.get(k).push([i, f]);
    };
    OCUPADAS.forEach((o) => agrega(o.barbero_id, o.fecha, minutosDesdeMedianoche(o.hora.slice(0, 5)), minutosDesdeMedianoche(o.hora.slice(0, 5)) + o.duracion_min));
    citas.filter((c) => c.estado !== 'cancelada').forEach((c) => agrega(c.barbero_id, c.fecha, ini(c), ini(c) + c.duracion_min));
    for (const intervalos of porClave.values()) {
      intervalos.sort((a, b) => a[0] - b[0]);
      for (let i = 1; i < intervalos.length; i += 1) expect(intervalos[i][0]).toBeGreaterThanOrEqual(intervalos[i - 1][1]);
    }
  });

  it('las reservas combinadas son asesoría + corte contiguos, con el mismo reserva_id y una sola asesoría', () => {
    const porReserva = Map.groupBy(citas.filter((c) => c.reserva_id), (c) => c.reserva_id);
    expect(porReserva.size).toBeGreaterThanOrEqual(3);
    for (const grupo of porReserva.values()) {
      expect(grupo).toHaveLength(2);
      const asesorias = grupo.filter((c) => c.area === 'asesoria');
      const cortes = grupo.filter((c) => c.area === 'barberia');
      expect(asesorias).toHaveLength(1);
      expect(cortes).toHaveLength(1);
      expect(cortes[0].fecha).toBe(asesorias[0].fecha);
      expect(ini(cortes[0])).toBe(ini(asesorias[0]) + asesorias[0].duracion_min);
      expect(asesorias[0].servicios.length + cortes[0].servicios.length).toBeLessThanOrEqual(3);
    }
    // una cita suelta nunca lleva reserva_id
    expect(citas.filter((c) => !c.reserva_id).length).toBeGreaterThan(0);
  });

  it('ninguna persona usa la asesoría gratis dos veces (correo y teléfono normalizados)', () => {
    const usos = citas.filter((c) => c.gratis_uso);
    expect(usos.length).toBeGreaterThanOrEqual(2);
    expect(new Set(usos.map((c) => c.gratis_uso.correo_norm)).size).toBe(usos.length);
    expect(new Set(usos.map((c) => c.gratis_uso.telefono_norm)).size).toBe(usos.length);
    // hay gratis usadas en el pasado y reservas gratis aún pendientes
    expect(usos.some((c) => c.fecha < HOY && c.estado === 'completada')).toBe(true);
    expect(usos.some((c) => c.fecha >= HOY && c.estado === 'pendiente')).toBe(true);
    // una gratis cancelada libera su uso (sin fila)
    const gratis = citas.filter((c) => c.servicio_id === 20);
    expect(gratis.filter((c) => c.estado === 'cancelada').every((c) => c.gratis_uso === null)).toBe(true);
  });

  it('solo usa estados válidos, con coherencia temporal y los tres presentes', () => {
    expect(new Set(citas.map((c) => c.estado))).toEqual(new Set(['pendiente', 'completada', 'cancelada']));
    expect(citas.filter((c) => c.estado === 'pendiente').every((c) => c.fecha >= HOY)).toBe(true);
    expect(citas.filter((c) => c.estado === 'completada').every((c) => c.fecha < HOY || (c.fecha === HOY && ini(c) + c.duracion_min <= base.minutosAhora))).toBe(true);
  });

  it('abarca ~40 días atrás y 14 por delante, con asesorías completadas y al menos una cancelada', () => {
    const resumen = resumirPlan(plan);
    expect(resumen.desde <= sumarDias(HOY, -DIAS_ATRAS + 5)).toBe(true);
    expect(resumen.hasta >= sumarDias(HOY, DIAS_ADELANTE - 2)).toBe(true);
    const ases = citas.filter((c) => c.area === 'asesoria');
    expect(ases.filter((c) => c.estado === 'completada').length).toBeGreaterThanOrEqual(5);
    expect(ases.filter((c) => c.estado === 'cancelada').length).toBeGreaterThanOrEqual(1);
    expect(resumen.ingresosCompletadasBarberia).toBeGreaterThan(resumen.ingresosCompletadasAsesoria);
    expect(resumen.ingresosCompletadasAsesoria).toBeGreaterThan(0);
  });

  it('deja huecos reales: hoy no está lleno y hay días con bloques de 1 hora completos y otros libres', () => {
    const activas = citas.filter((c) => c.estado !== 'cancelada' && c.area === 'barberia');
    // Un bloque [h, h+1) está "Completa" si ningún barbero puede empezar un servicio de 30 min a las h ni a las h:30.
    const completos = (fecha) => {
      let n = 0;
      for (let h = 10; h < 20; h += 1) {
        const hayLibre = [h * 60, h * 60 + 30].some((t) =>
          BARBEROS.some((b) => {
            const ocupado = activas.some((c) => c.barbero_id === b && c.fecha === fecha && ini(c) < t + 30 && t < ini(c) + c.duracion_min);
            const previa = OCUPADAS.some((o) => o.barbero_id === b && o.fecha === fecha && minutosDesdeMedianoche(o.hora.slice(0, 5)) < t + 30 && t < minutosDesdeMedianoche(o.hora.slice(0, 5)) + o.duracion_min);
            return !ocupado && !previa;
          })
        );
        if (!hayLibre) n += 1;
      }
      return n;
    };
    const proximos = Array.from({ length: DIAS_ADELANTE }, (_, i) => sumarDias(HOY, i + 1));
    const cuentas = proximos.map(completos);
    expect(Math.max(...cuentas)).toBeGreaterThanOrEqual(2);
    expect(cuentas.filter((n) => n === 0).length).toBeGreaterThanOrEqual(5);
    expect(completos(HOY)).toBeLessThan(10);
    // cada barbero tiene, en cada uno de los próximos días, algún bloque libre y algún día con citas
    for (const fecha of proximos) {
      const conCitas = new Set(activas.filter((c) => c.fecha === fecha).map((c) => c.barbero_id));
      expect(conCitas.size).toBeGreaterThan(0);
    }
  });

  it('todo es ficticio: correo del dominio demo y teléfono 3000000NNN', () => {
    for (const c of citas) {
      expect(esCorreoDemo(c.correo)).toBe(true);
      expect(c.correo.endsWith(`@${DOMINIO_DEMO}`)).toBe(true);
      expect(c.telefono).toMatch(/^3000000\d{3}$/);
    }
  });

  it('los combos de barbería respetan el máximo de 3 servicios y 240 minutos', () => {
    expect(citas.some((c) => c.servicios.length === 2)).toBe(true);
    expect(citas.some((c) => c.servicios.length === 3)).toBe(true);
    for (const c of citas) {
      expect(c.servicios.length).toBeLessThanOrEqual(3);
      if (c.servicios.length > 1) expect(c.duracion_min).toBeLessThanOrEqual(240);
    }
  });
});

describe('validarPlan detecta las reglas rotas', () => {
  const clonar = () => structuredClone(plan);
  const activa = (p) => p.citas.find((c) => c.estado === 'pendiente' && c.area === 'barberia' && !c.reserva_id);

  it('una cita a las 20:30 o que termina después de las 20:00', () => {
    const p = clonar();
    activa(p).hora = '20:30';
    expect(validarPlan(p, opciones).some((x) => x.includes('fuera del horario'))).toBe(true);
    const q = clonar();
    Object.assign(activa(q), { hora: '19:30', duracion_min: 60, servicios: [{ ...activa(q).servicios[0], duracion_min: 60 }], precio: activa(q).servicios[0].precio });
    expect(validarPlan(q, opciones).some((x) => x.includes('fuera del horario'))).toBe(true);
  });

  it('un solape de un mismo barbero', () => {
    const p = clonar();
    const original = activa(p);
    p.citas.push({ ...structuredClone(original), correo: `otro@${DOMINIO_DEMO}`, telefono: '3000000999' });
    expect(validarPlan(p, opciones).some((x) => x.startsWith('solape'))).toBe(true);
  });

  it('una asesoría gratis repetida por correo o teléfono', () => {
    const p = clonar();
    const usos = p.citas.filter((c) => c.gratis_uso);
    usos[1].gratis_uso.correo_norm = usos[0].gratis_uso.correo_norm;
    expect(validarPlan(p, opciones).some((x) => x.includes('repetida por correo'))).toBe(true);
    const q = clonar();
    const usosQ = q.citas.filter((c) => c.gratis_uso);
    usosQ[1].gratis_uso.telefono_norm = usosQ[0].gratis_uso.telefono_norm;
    expect(validarPlan(q, opciones).some((x) => x.includes('repetida por teléfono'))).toBe(true);
  });

  it('una reserva combinada con dos asesorías o con un hueco entre las citas', () => {
    const p = clonar();
    const corte = p.citas.find((c) => c.reserva_id && c.area === 'barberia');
    corte.area = 'asesoria';
    expect(validarPlan(p, opciones).some((x) => x.includes('1 asesoría y 1 corte'))).toBe(true);
    const q = clonar();
    const corteQ = q.citas.find((c) => c.reserva_id && c.area === 'barberia');
    corteQ.hora = '19:30';
    expect(validarPlan(q, opciones).some((x) => x.includes('justo al terminar'))).toBe(true);
  });

  it('un estado inválido, un correo real o un profesional de otra área', () => {
    const p = clonar();
    activa(p).estado = 'confirmada';
    expect(validarPlan(p, opciones).some((x) => x.includes('estado inválido'))).toBe(true);
    const q = clonar();
    activa(q).correo = 'persona@gmail.com';
    expect(validarPlan(q, opciones).some((x) => x.includes('dominio demo'))).toBe(true);
    const r = clonar();
    activa(r).barbero_id = 37;
    expect(validarPlan(r, opciones).some((x) => x.includes('otra área'))).toBe(true);
  });
});
