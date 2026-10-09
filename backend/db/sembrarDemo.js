// Datos de demostración COHERENTES para mostrar el proyecto en el portafolio (SOLO desarrollo).
//
//   npm run sembrar:demo                          simulación: planifica y muestra el resumen, sin escribir nada
//   npm run sembrar:demo -- --confirmar           borra las filas demo anteriores (por id) y vuelve a crearlas
//   npm run sembrar:demo -- --limpiar             simulación de la limpieza
//   npm run sembrar:demo -- --limpiar --confirmar borra solo las filas demo
//
// ⚠️ NUNCA se ejecuta en producción: se niega con NODE_ENV=production y contra una base con "test" en el nombre.
//
// Qué crea (todo ficticio): ~40 días de historial y 14 días por delante con citas de barbería (individuales y combos de
// 2–3 servicios), asesorías de Camila (pagas y gratis, solas y combinadas con un corte) y huecos reales en la agenda,
// con tres días (dos sábados y un viernes) en los que todo el equipo tiene bloques completos ("Completa" en la reserva).
//
// Cómo reconoce sus filas: el correo de la cita termina en `@demo.blackiron.example` (dominio reservado, no
// existe). Al re-ejecutarlo borra SOLO esas citas, por id exacto (sus líneas y filas de asesoría gratis caen en
// cascada), y las vuelve a crear con fechas relativas a hoy (Bogotá), todo en una transacción. Las citas reales y
// las de `seed:demo` (marca "[demo] ") no se tocan. No desactiva ninguna restricción de la base.
//
// La planificación (`planificarDemo`) es una función pura y determinista (misma semilla = mismos datos): se prueba sin
// base de datos en tests/sembrarDemo.test.js.
import { pathToFileURL } from 'node:url';
import { HORARIO_ATENCION } from '../config/horario.js';
import { minutosDesdeMedianoche, hoyISO, horaActualBogota } from '../utils/fechas.js';
import { sumarDias } from '../utils/periodos.js';
import { identidadAsesoria } from '../utils/identidadAsesoria.js';
import { AREA_BARBERIA, AREA_ASESORIA, CLAVE_ASESORIA_GRATIS, MAX_ASESORIAS_POR_RESERVA } from '../utils/areas.js';
import { MAX_SERVICIOS_POR_CITA, MAX_DURACION_TOTAL_MIN } from '../utils/serviciosCita.js';

export const DOMINIO_DEMO = 'demo.blackiron.example';
export const PREFIJO_TELEFONO_DEMO = '3000000';
export const DIAS_ATRAS = 40;
export const DIAS_ADELANTE = 14;
export const ESTADOS_VALIDOS = ['pendiente', 'completada', 'cancelada'];

const NOMBRES = [
  'Andrés', 'Camilo', 'Juan', 'Santiago', 'Mateo', 'Sebastián', 'Felipe', 'Nicolás', 'David', 'Esteban', 'Tomás', 'Julián',
  'Valentina', 'Laura', 'Daniela', 'Natalia', 'Paula', 'Sara', 'Mariana', 'Luisa', 'Carolina', 'Isabela', 'Manuela', 'Lucía',
];
const APELLIDOS = [
  'Gómez', 'Rodríguez', 'Martínez', 'López', 'Hernández', 'Ramírez', 'Torres', 'Díaz', 'Vargas', 'Castro', 'Rojas', 'Moreno',
  'Ortiz', 'Silva', 'Mejía', 'Cardona', 'Arias', 'Benítez', 'Cabrera', 'Duarte', 'Escobar', 'Fuentes', 'Guerra', 'Herrera',
];
const TOTAL_CLIENTES = 170;
const FRECUENTES = 25; // clientes que vuelven seguido
const OCASIONALES_HASTA = 140; // [FRECUENTES, OCASIONALES_HASTA) ocasionales; el resto solo reserva la asesoría gratis

// Carga relativa de cada barbero (por orden de id): Boby es el más pedido y el último en llegar, el menos.
const PESO_BARBERO = [1.3, 1.1, 1.0, 0.9, 1.0, 1.1, 0.9, 1.0, 0.8, 0.6];
// Ocupación objetivo del día (fracción de las 10 h) por día de la semana, domingo = 0.
const OCUPACION_DIA = [0.16, 0.2, 0.2, 0.22, 0.22, 0.3, 0.42];
// Asesorías esperadas por día (Camila) según el día de la semana, domingo = 0.
const ASESORIAS_DIA = [0.5, 0.8, 0.8, 0.8, 0.9, 1.1, 1.8];
// Horas más pedidas (peso por hora de inicio): mediodía y tarde-noche.
const PESO_HORA = [0.6, 1.0, 1.2, 0.7, 0.9, 1.0, 1.2, 1.4, 1.2, 0.6]; // 10h, 11h, … 19h
const PESO_TIPO = { original: 5, elite: 3, vip: 1.5 };
const GRATIS_MAX_PASADAS = 5;
const GRATIS_MAX_FUTURAS = 2;
const PROB_CANCELAR_PASADA = 0.09;
const PROB_CANCELAR_FUTURA = 0.06;

// Qué se pide en un cita de barbería (slugs de categoría). Los combos de más de un servicio respetan el tope de 240 min.
const PLANTILLAS = [
  { peso: 30, cats: ['cortes'] },
  { peso: 12, cats: ['barba'] },
  { peso: 20, cats: ['cortes-barba'] },
  { peso: 12, cats: ['cortes', 'barba'] },
  { peso: 6, cats: ['cortes', 'faciales'] },
  { peso: 3, cats: ['cortes', 'barba', 'faciales'] },
  { peso: 6, cats: ['faciales'] },
  { peso: 3, cats: ['keratinas'] },
  { peso: 2, cats: ['ondulados'] },
];

// Generador pseudoaleatorio con semilla: la misma semilla produce siempre los mismos datos.
const crearAzar = (semilla) => {
  let estado = semilla >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const hhmm = (minutos) => `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
const aMinutos = (hora) => minutosDesdeMedianoche(hora.slice(0, 5));
const sinTildes = (texto) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const diaDeSemana = (fecha) => {
  const [a, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
};
const suma = (lista, campo) => lista.reduce((total, x) => total + x[campo], 0);

const APERTURA = aMinutos(HORARIO_ATENCION.apertura);
const CIERRE = aMinutos(HORARIO_ATENCION.cierre);
const PASO = HORARIO_ATENCION.intervaloMin;

// ¿Es de esta marca? Lo usan el script y las pruebas para reconocer una cita demo por su correo.
export const esCorreoDemo = (correo) => typeof correo === 'string' && correo.toLowerCase().endsWith(`@${DOMINIO_DEMO}`);

/**
 * Planifica las citas de demostración (función pura, sin base de datos).
 *  - hoy: AAAA-MM-DD (Bogotá) · minutosAhora: hora actual de Bogotá en minutos desde medianoche
 *  - barberos: ids de barberos activos de barbería · asesoras: ids de asesoras activas
 *  - servicios: [{ id, nombre, duracion_min, precio, tipo, area, categoria_slug, clave_seed }] activos
 *  - ocupadas: citas ya existentes no canceladas [{ barbero_id, fecha, hora: 'HH:MM[:SS]', duracion_min }]
 * Devuelve { citas } ordenadas por fecha y hora. Cada cita trae sus líneas (`servicios`), su `reserva_id` (las dos
 * citas de una reserva combinada lo comparten) y `gratis_uso` (identidad normalizada, solo en asesorías gratis vigentes).
 */
export const planificarDemo = ({ hoy, minutosAhora, barberos, asesoras, servicios, ocupadas = [], semilla = 2026 }) => {
  const azar = crearAzar(semilla);
  const entero = (n) => Math.floor(azar() * n);
  const elegir = (lista) => lista[entero(lista.length)];
  const elegirPonderado = (lista, pesoDe) => {
    const total = lista.reduce((t, x) => t + pesoDe(x), 0);
    let r = azar() * total;
    for (const x of lista) {
      r -= pesoDe(x);
      if (r < 0) return x;
    }
    return lista[lista.length - 1];
  };

  // ── Clientes ficticios: nombre inventado, correo del dominio demo y teléfono 3000000NNN (obviamente falso) ──
  const pares = NOMBRES.flatMap((n) => APELLIDOS.map((a) => [n, a]));
  for (let i = pares.length - 1; i > 0; i -= 1) {
    const j = entero(i + 1);
    [pares[i], pares[j]] = [pares[j], pares[i]];
  }
  const clientes = pares.slice(0, TOTAL_CLIENTES).map(([nombre, apellido], i) => ({
    cliente: `${nombre} ${apellido}`,
    correo: `${sinTildes(nombre)}.${sinTildes(apellido)}${i + 1}@${DOMINIO_DEMO}`,
    telefono: `${PREFIJO_TELEFONO_DEMO}${String(i + 1).padStart(3, '0')}`,
  }));
  const frecuentes = clientes.slice(0, FRECUENTES);
  const ocasionales = clientes.slice(FRECUENTES, OCASIONALES_HASTA);
  const reservadosGratis = clientes.slice(OCASIONALES_HASTA);
  let siguienteGratis = 0;

  // ── Agenda interna: intervalos por profesional y día, y por cliente y día (nadie está en dos sitios a la vez) ──
  const agenda = new Map();
  const agendaCliente = new Map();
  const intervalosDe = (mapa, clave) => {
    if (!mapa.has(clave)) mapa.set(clave, []);
    return mapa.get(clave);
  };
  const libre = (mapa, clave, ini, fin) => intervalosDe(mapa, clave).every(([i, f]) => fin <= i || ini >= f);
  const claveProf = (prof, fecha) => `${prof}|${fecha}`;
  const profLibre = (prof, fecha, ini, fin) => libre(agenda, claveProf(prof, fecha), ini, fin);
  const minutosReservados = (prof, fecha) =>
    intervalosDe(agenda, claveProf(prof, fecha)).reduce((t, [i, f]) => t + (f - i), 0);

  for (const o of ocupadas) {
    const ini = aMinutos(o.hora);
    intervalosDe(agenda, claveProf(o.barbero_id, o.fecha)).push([ini, ini + o.duracion_min]);
  }

  // ── Catálogo por área y categoría ──
  const deBarberia = servicios.filter((s) => s.area === AREA_BARBERIA);
  const deAsesoria = servicios.filter((s) => s.area === AREA_ASESORIA);
  const porCategoria = (slug) => deBarberia.filter((s) => s.categoria_slug === slug);
  const pesoServicio = (s) => PESO_TIPO[s.tipo] ?? 3;
  const linea = (s, orden) => ({ servicio_id: s.id, nombre: s.nombre, duracion_min: s.duracion_min, precio: s.precio, orden });

  // Servicios de barbería de una cita: respeta el máximo de servicios, el tope de 240 min de los combos y `maxMin`.
  const componer = ({ maxServicios = MAX_SERVICIOS_POR_CITA, maxMin = Infinity } = {}) => {
    const plantillas = PLANTILLAS.filter((p) => p.cats.length <= maxServicios && p.cats.every((c) => porCategoria(c).length > 0));
    for (let intento = 0; intento < 12 && plantillas.length > 0; intento += 1) {
      const plantilla = elegirPonderado(plantillas, (p) => p.peso);
      const elegidos = plantilla.cats.map((c) => elegirPonderado(porCategoria(c), pesoServicio));
      const total = suma(elegidos, 'duracion_min');
      if (new Set(elegidos.map((s) => s.id)).size !== elegidos.length) continue;
      if (elegidos.length > 1 && total > MAX_DURACION_TOTAL_MIN) continue;
      if (total > maxMin) continue;
      return elegidos.map((s, i) => linea(s, i + 1));
    }
    return null;
  };

  // Primer inicio de una cita de `duracion` min (rejilla de 30 min) con el profesional libre; con preferencia por las horas fuertes.
  const elegirInicio = (prof, fecha, duracion) => {
    const candidatos = [];
    for (let ini = APERTURA; ini + duracion <= CIERRE; ini += PASO) {
      if (profLibre(prof, fecha, ini, ini + duracion)) candidatos.push(ini);
    }
    if (candidatos.length === 0) return null;
    return elegirPonderado(candidatos, (ini) => PESO_HORA[Math.floor((ini - APERTURA) / 60)] ?? 1);
  };

  const estadoDe = (fecha, fin, cancela) => {
    if (cancela) return 'cancelada';
    if (fecha < hoy) return 'completada';
    if (fecha === hoy && fin <= minutosAhora) return 'completada';
    return 'pendiente';
  };

  const citas = [];
  const uuidDemo = () => {
    const hex = (n) => Array.from({ length: n }, () => entero(16).toString(16)).join('');
    return `${hex(8)}-${hex(4)}-4${hex(3)}-${'89ab'[entero(4)]}${hex(3)}-${hex(12)}`;
  };
  const creadaEn = (fecha) => {
    const dia = sumarDias(fecha <= hoy ? fecha : hoy, -(1 + entero(3)));
    return `${dia} ${hhmm(480 + entero(840))}:00`;
  };

  const elegirCliente = (fecha, ini, fin) => {
    let cliente;
    for (let intento = 0; intento < 8; intento += 1) {
      cliente = azar() < 0.35 ? elegir(frecuentes) : elegir(ocasionales);
      if (libre(agendaCliente, `${cliente.correo}|${fecha}`, ini, fin)) break;
    }
    return cliente;
  };

  const crearCita = ({ cliente, prof, area, fecha, ini, lineas, estado, reservaId = null, creada, gratis = false }) => {
    const duracion = suma(lineas, 'duracion_min');
    const cita = {
      cliente: cliente.cliente,
      correo: cliente.correo,
      telefono: cliente.telefono,
      servicio_id: lineas[0].servicio_id,
      barbero_id: prof,
      area,
      fecha,
      hora: hhmm(ini),
      duracion_min: duracion,
      precio: suma(lineas, 'precio'),
      estado,
      creada_en: creada,
      reserva_id: reservaId,
      servicios: lineas,
      gratis_uso: gratis && estado !== 'cancelada' ? identidadAsesoria(cliente.correo, cliente.telefono) : null,
    };
    citas.push(cita);
    if (estado !== 'cancelada') {
      intervalosDe(agenda, claveProf(prof, fecha)).push([ini, ini + duracion]);
      intervalosDe(agendaCliente, `${cliente.correo}|${fecha}`).push([ini, ini + duracion]);
    }
    return cita;
  };

  // Combinaciones de servicios de barbería que suman EXACTAMENTE una hora: para los bloques "Completa".
  const bloquesDeUnaHora = () => {
    const opciones = deBarberia.filter((s) => s.duracion_min === 60 && !['keratinas', 'ondulados'].includes(s.categoria_slug)).map((s) => [s]);
    const base = deBarberia.filter((s) => ['cortes', 'barba', 'faciales'].includes(s.categoria_slug));
    for (const a of base) {
      for (const b of base) {
        if (a.id < b.id && a.categoria_slug !== b.categoria_slug && a.duracion_min + b.duracion_min === 60) opciones.push([a, b]);
      }
    }
    return opciones;
  };
  const opcionesBloque = bloquesDeUnaHora();

  // Días con bloques de 1 h completos para TODO el equipo (se ven "Completa" aunque se elija cualquier barbero): los
  // dos próximos sábados y el primer viernes que no sea hoy ni mañana.
  const diasLlenos = new Map();
  const sabados = [];
  let viernes = null;
  for (let offset = 1; offset <= DIAS_ADELANTE; offset += 1) {
    const fecha = sumarDias(hoy, offset);
    if (diaDeSemana(fecha) === 6 && sabados.length < 2) sabados.push(fecha);
    if (diaDeSemana(fecha) === 5 && offset >= 2 && viernes === null) viernes = fecha;
  }
  if (sabados[0]) diasLlenos.set(sabados[0], [11 * 60, 15 * 60, 17 * 60]);
  if (sabados[1]) diasLlenos.set(sabados[1], [12 * 60, 16 * 60]);
  if (viernes) diasLlenos.set(viernes, [16 * 60, 18 * 60]);

  const asesoriaGratis = deAsesoria.find((s) => s.clave_seed === CLAVE_ASESORIA_GRATIS);
  const asesoriasDePago = deAsesoria.filter((s) => s !== asesoriaGratis);
  let gratisPasadas = 0;
  let gratisFuturas = 0;
  let asesoriasPasadas = 0;

  for (let offset = -DIAS_ATRAS; offset <= DIAS_ADELANTE; offset += 1) {
    const fecha = sumarDias(hoy, offset);
    const dia = diaDeSemana(fecha);
    const futuro = offset >= 0;
    const factorFuturo = offset > 0 ? 1 - (0.5 * (offset - 1)) / Math.max(DIAS_ADELANTE - 1, 1) : offset === 0 ? 0.85 : 1;
    const pCancelar = offset < 0 ? PROB_CANCELAR_PASADA : PROB_CANCELAR_FUTURA;

    // 1) Días con bloques completos para todos los barberos.
    if (diasLlenos.has(fecha) && opcionesBloque.length > 0) {
      for (const inicioBloque of diasLlenos.get(fecha)) {
        for (const prof of barberos) {
          if (!profLibre(prof, fecha, inicioBloque, inicioBloque + 60)) continue;
          const opcion = elegir(opcionesBloque);
          const cliente = elegirCliente(fecha, inicioBloque, inicioBloque + 60);
          crearCita({
            cliente, prof, area: AREA_BARBERIA, fecha, ini: inicioBloque, lineas: opcion.map((s, i) => linea(s, i + 1)),
            estado: estadoDe(fecha, inicioBloque + 60, false), creada: creadaEn(fecha),
          });
        }
      }
    }

    // 2) Asesorías de las asesoras, solas o combinadas con un corte justo cuando terminan.
    if (asesoras.length > 0 && deAsesoria.length > 0) {
      const cantidad = Math.floor(ASESORIAS_DIA[dia] * factorFuturo + azar());
      for (let k = 0; k < cantidad; k += 1) {
        const topeGratis = futuro ? gratisFuturas < GRATIS_MAX_FUTURAS : gratisPasadas < GRATIS_MAX_PASADAS;
        const quedaGratis = asesoriaGratis && topeGratis && siguienteGratis < reservadosGratis.length;
        const servicio = quedaGratis && azar() < 0.25 ? asesoriaGratis : elegirPonderado(asesoriasDePago, (s) => (s.precio >= 60000 ? 0.8 : 1));
        const esGratis = servicio === asesoriaGratis;
        const combinada = azar() < (esGratis ? 0.55 : 0.3);
        const asesora = elegir(asesoras);
        const duracionA = servicio.duracion_min;

        let corte = combinada ? componer({ maxServicios: MAX_SERVICIOS_POR_CITA - MAX_ASESORIAS_POR_RESERVA }) : null;
        let colocacion = null;
        for (let intento = 0; intento < 3 && colocacion === null; intento += 1) {
          const inicios = [];
          for (let ini = APERTURA; ini + duracionA <= CIERRE; ini += PASO) {
            if (!profLibre(asesora, fecha, ini, ini + duracionA)) continue;
            if (!corte) {
              inicios.push({ ini, barbero: null });
              continue;
            }
            const duracionC = suma(corte, 'duracion_min');
            const libres = barberos.filter((b) => profLibre(b, fecha, ini + duracionA, ini + duracionA + duracionC));
            if (ini + duracionA + duracionC <= CIERRE && libres.length > 0) inicios.push({ ini, barbero: elegir(libres) });
          }
          if (inicios.length > 0) colocacion = elegirPonderado(inicios, (c) => PESO_HORA[Math.floor((c.ini - APERTURA) / 60)] ?? 1);
          else if (corte) corte = null; // no cabe combinada: se reserva solo la asesoría
          else break;
        }
        if (colocacion === null) continue;

        const finA = colocacion.ini + duracionA;
        const cliente = esGratis ? reservadosGratis[siguienteGratis] : elegirCliente(fecha, colocacion.ini, finA + (corte ? suma(corte, 'duracion_min') : 0));
        if (esGratis) siguienteGratis += 1;
        let cancela = azar() < pCancelar;
        if (offset < 0) {
          asesoriasPasadas += 1;
          if (asesoriasPasadas % 9 === 5) cancela = true; // garantiza algunas asesorías canceladas en el historial
        }
        if (esGratis) {
          if (futuro) gratisFuturas += 1;
          else gratisPasadas += 1;
        }
        const creada = creadaEn(fecha);
        const reservaId = corte ? uuidDemo() : null;
        crearCita({
          cliente, prof: asesora, area: AREA_ASESORIA, fecha, ini: colocacion.ini, lineas: [linea(servicio, 1)],
          estado: estadoDe(fecha, finA, cancela), reservaId, creada, gratis: esGratis,
        });
        if (corte) {
          crearCita({
            cliente, prof: colocacion.barbero, area: AREA_BARBERIA, fecha, ini: finA, lineas: corte,
            estado: estadoDe(fecha, finA + suma(corte, 'duracion_min'), cancela), reservaId, creada,
          });
        }
      }
    }

    // 3) Cortes y demás servicios de barbería hasta la ocupación objetivo de cada barbero.
    barberos.forEach((prof, i) => {
      const objetivo = (CIERRE - APERTURA) * OCUPACION_DIA[dia] * (PESO_BARBERO[i % PESO_BARBERO.length]) * factorFuturo * (0.8 + azar() * 0.4);
      let intentosFallidos = 0;
      while (minutosReservados(prof, fecha) < objetivo && intentosFallidos < 4) {
        const lineas = componer();
        const duracion = lineas ? suma(lineas, 'duracion_min') : 0;
        const ini = lineas ? elegirInicio(prof, fecha, duracion) : null;
        if (ini === null) {
          intentosFallidos += 1;
          continue;
        }
        const cliente = elegirCliente(fecha, ini, ini + duracion);
        crearCita({
          cliente, prof, area: AREA_BARBERIA, fecha, ini, lineas,
          estado: estadoDe(fecha, ini + duracion, azar() < pCancelar), creada: creadaEn(fecha),
        });
      }
    });
  }

  citas.sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora) || a.barbero_id - b.barbero_id);
  return { citas };
};

/**
 * Reglas que el plan debe cumplir antes de tocar la base. Devuelve la lista de problemas (vacía = plan válido).
 * `servicioArea` y `profesionalArea` (opcionales, Map id → área) comprueban que cada profesional atienda su área.
 */
export const validarPlan = ({ citas }, { hoy, minutosAhora, ocupadas = [], profesionalArea, servicioArea } = {}) => {
  const problemas = [];
  const agrega = (c, texto) => problemas.push(`${c.fecha} ${c.hora} prof ${c.barbero_id}: ${texto}`);
  const activas = new Map();
  const gratisCorreos = new Set();
  const gratisTelefonos = new Set();
  const porReserva = new Map();

  for (const o of ocupadas) {
    const ini = aMinutos(o.hora);
    if (!activas.has(`${o.barbero_id}|${o.fecha}`)) activas.set(`${o.barbero_id}|${o.fecha}`, []);
    activas.get(`${o.barbero_id}|${o.fecha}`).push([ini, ini + o.duracion_min, 'existente']);
  }

  for (const c of citas) {
    const ini = aMinutos(c.hora);
    const fin = ini + c.duracion_min;
    if (!ESTADOS_VALIDOS.includes(c.estado)) agrega(c, `estado inválido ${c.estado}`);
    if (ini < APERTURA || fin > CIERRE) agrega(c, `fuera del horario (${c.hora}, ${c.duracion_min} min)`);
    if (c.duracion_min !== suma(c.servicios, 'duracion_min') || c.precio !== suma(c.servicios, 'precio')) agrega(c, 'duración o precio no suman sus líneas');
    if (c.servicios.length < 1 || c.servicios.length > MAX_SERVICIOS_POR_CITA) agrega(c, 'cantidad de servicios fuera de 1–3');
    if (c.servicios.length > 1 && c.duracion_min > MAX_DURACION_TOTAL_MIN) agrega(c, 'combo de más de 240 min');
    if (c.servicios.some((s, i) => s.orden !== i + 1) || new Set(c.servicios.map((s) => s.servicio_id)).size !== c.servicios.length) agrega(c, 'líneas mal numeradas o repetidas');
    if (c.servicio_id !== c.servicios[0].servicio_id) agrega(c, 'servicio principal distinto de la primera línea');
    if (!esCorreoDemo(c.correo)) agrega(c, `correo fuera del dominio demo (${c.correo})`);
    if (!/^3\d{9}$/.test(c.telefono) || !c.telefono.startsWith(PREFIJO_TELEFONO_DEMO)) agrega(c, `teléfono no demo (${c.telefono})`);
    if (c.estado === 'completada' && c.fecha > hoy) agrega(c, 'completada en el futuro');
    if (c.estado === 'completada' && c.fecha === hoy && minutosAhora !== undefined && fin > minutosAhora) agrega(c, 'completada antes de terminar');
    if (c.estado === 'pendiente' && c.fecha < hoy) agrega(c, 'pendiente en el pasado');
    if (profesionalArea && profesionalArea.get(c.barbero_id) !== c.area) agrega(c, 'profesional de otra área');
    if (servicioArea && c.servicios.some((s) => servicioArea.get(s.servicio_id) !== c.area)) agrega(c, 'servicio de otra área');

    if (c.estado !== 'cancelada') {
      const clave = `${c.barbero_id}|${c.fecha}`;
      if (!activas.has(clave)) activas.set(clave, []);
      activas.get(clave).push([ini, fin, c.hora]);
    }
    if (c.gratis_uso) {
      if (gratisCorreos.has(c.gratis_uso.correo_norm)) agrega(c, 'asesoría gratis repetida por correo');
      if (gratisTelefonos.has(c.gratis_uso.telefono_norm)) agrega(c, 'asesoría gratis repetida por teléfono');
      gratisCorreos.add(c.gratis_uso.correo_norm);
      gratisTelefonos.add(c.gratis_uso.telefono_norm);
    }
    if (c.reserva_id) {
      if (!porReserva.has(c.reserva_id)) porReserva.set(c.reserva_id, []);
      porReserva.get(c.reserva_id).push(c);
    }
  }

  for (const [clave, intervalos] of activas) {
    intervalos.sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < intervalos.length; i += 1) {
      if (intervalos[i][0] < intervalos[i - 1][1]) problemas.push(`solape en ${clave} (${intervalos[i - 1][2]} y ${intervalos[i][2]})`);
    }
  }

  for (const [reservaId, grupo] of porReserva) {
    const asesorias = grupo.filter((c) => c.area === AREA_ASESORIA);
    const cortes = grupo.filter((c) => c.area === AREA_BARBERIA);
    if (grupo.length !== 2 || asesorias.length !== MAX_ASESORIAS_POR_RESERVA || cortes.length !== 1) {
      problemas.push(`reserva ${reservaId}: debe tener 1 asesoría y 1 corte`);
      continue;
    }
    const [a] = asesorias;
    const [b] = cortes;
    if (a.fecha !== b.fecha || aMinutos(a.hora) + a.duracion_min !== aMinutos(b.hora)) problemas.push(`reserva ${reservaId}: el corte no empieza justo al terminar la asesoría`);
    if (a.correo !== b.correo || a.telefono !== b.telefono) problemas.push(`reserva ${reservaId}: clientes distintos`);
    if (a.servicios.length + b.servicios.length > MAX_SERVICIOS_POR_CITA) problemas.push(`reserva ${reservaId}: más de 3 servicios`);
    if ((a.estado === 'cancelada') !== (b.estado === 'cancelada')) problemas.push(`reserva ${reservaId}: una cita cancelada y la otra no`);
  }
  return problemas;
};

export const resumirPlan = ({ citas }) => {
  const contar = (clave) => citas.reduce((acc, c) => ({ ...acc, [c[clave]]: (acc[c[clave]] ?? 0) + 1 }), {});
  const completadas = citas.filter((c) => c.estado === 'completada');
  const ingresos = (area) => completadas.filter((c) => c.area === area).reduce((t, c) => t + c.precio, 0);
  const fechas = citas.map((c) => c.fecha).sort();
  return {
    total: citas.length,
    porEstado: contar('estado'),
    porArea: contar('area'),
    reservasCombinadas: new Set(citas.filter((c) => c.reserva_id).map((c) => c.reserva_id)).size,
    asesoriasGratis: citas.filter((c) => c.gratis_uso).length,
    ingresosCompletadasBarberia: ingresos(AREA_BARBERIA),
    ingresosCompletadasAsesoria: ingresos(AREA_ASESORIA),
    desde: fechas[0] ?? null,
    hasta: fechas.at(-1) ?? null,
  };
};

// ── Acceso a la base ───────────────────────────────────────────────────────────────────────────────────────

const SQL_IDS_DEMO = 'SELECT id FROM citas WHERE lower(correo) LIKE $1 ORDER BY id';
const PATRON_DEMO = `%@${DOMINIO_DEMO}`;

const idsDemo = async (db) => (await db.query(SQL_IDS_DEMO, [PATRON_DEMO])).rows.map((r) => r.id);

// Borra las citas demo por id exacto (sus líneas y filas de asesoría gratis caen en cascada).
const borrarDemo = async (db) => {
  const ids = await idsDemo(db);
  if (ids.length > 0) await db.query('DELETE FROM citas WHERE id = ANY($1::int[])', [ids]);
  return ids;
};

const leerEntradas = async (db, hoy) => {
  // En serie: dentro de la transacción `db` es un solo cliente y no admite consultas en paralelo.
  const barberos = await db.query("SELECT id FROM barberos WHERE activo = true AND area = 'barberia' ORDER BY id");
  const asesoras = await db.query("SELECT id FROM barberos WHERE activo = true AND area = 'asesoria' AND nombre = 'Camila' ORDER BY id");
  const servicios = await db.query(
    `SELECT s.id, s.nombre, s.duracion_min, s.precio, s.tipo, s.area, s.clave_seed, c.slug AS categoria_slug
       FROM servicios s JOIN categorias c ON c.id = s.categoria_id
       WHERE s.activo = true AND c.activo = true AND s.clave_seed IS NOT NULL ORDER BY s.id`
  );
  const ocupadas = await db.query(
    `SELECT barbero_id, fecha::text AS fecha, hora::text AS hora, duracion_min FROM citas
       WHERE estado <> 'cancelada' AND lower(correo) NOT LIKE $3 AND fecha BETWEEN $1::date AND $2::date`,
    [sumarDias(hoy, -DIAS_ATRAS - 1), sumarDias(hoy, DIAS_ADELANTE + 1), PATRON_DEMO]
  );
  if (barberos.rows.length === 0 || servicios.rows.length === 0) throw new Error('Hacen falta barberos y servicios activos (corre primero npm run seed).');
  if (asesoras.rows.length === 0) throw new Error('No hay una asesora activa llamada Camila (área asesoría).');
  return {
    barberos: barberos.rows.map((r) => r.id),
    asesoras: asesoras.rows.map((r) => r.id),
    servicios: servicios.rows,
    ocupadas: ocupadas.rows,
  };
};

const planDesdeBase = async (db, { semilla } = {}) => {
  const hoy = hoyISO();
  const minutosAhora = horaActualBogota();
  const entradas = await leerEntradas(db, hoy);
  const plan = planificarDemo({ hoy, minutosAhora, semilla, ...entradas });
  const profesionalArea = new Map([
    ...entradas.barberos.map((id) => [id, AREA_BARBERIA]),
    ...entradas.asesoras.map((id) => [id, AREA_ASESORIA]),
  ]);
  const servicioArea = new Map(entradas.servicios.map((s) => [s.id, s.area]));
  const problemas = validarPlan(plan, { hoy, minutosAhora, ocupadas: entradas.ocupadas, profesionalArea, servicioArea });
  if (problemas.length > 0) throw new Error(`El plan incumple ${problemas.length} reglas, no se escribe nada:\n- ${problemas.slice(0, 10).join('\n- ')}`);
  return plan;
};

const insertarPlan = async (cliente, { citas }) => {
  for (const c of citas) {
    const { rows } = await cliente.query(
      `INSERT INTO citas
         (cliente, correo, telefono, servicio_id, barbero_id, fecha, hora, duracion_min, precio, estado, creada_en, consentimiento_en, reserva_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11, $12)
       RETURNING id`,
      [c.cliente, c.correo, c.telefono, c.servicio_id, c.barbero_id, c.fecha, c.hora, c.duracion_min, c.precio, c.estado, c.creada_en, c.reserva_id]
    );
    const citaId = rows[0].id;
    for (const s of c.servicios) {
      await cliente.query(
        'INSERT INTO cita_servicios (cita_id, servicio_id, orden, nombre, duracion_min, precio) VALUES ($1, $2, $3, $4, $5, $6)',
        [citaId, s.servicio_id, s.orden, s.nombre, s.duracion_min, s.precio]
      );
    }
    if (c.gratis_uso) {
      await cliente.query(
        "INSERT INTO asesoria_gratis_usos (cita_id, correo_norm, telefono_norm, creado_en) VALUES ($1, $2, $3, $4::timestamp AT TIME ZONE 'America/Bogota')",
        [citaId, c.gratis_uso.correo_norm, c.gratis_uso.telefono_norm, c.creada_en]
      );
    }
  }
};

// Con `simular: true` planifica y devuelve el resumen sin escribir nada.
export const sembrarDemo = async (pool, { simular = false, semilla } = {}) => {
  if (simular) {
    const plan = await planDesdeBase(pool, { semilla });
    return { ...resumirPlan(plan), borradas: (await idsDemo(pool)).length };
  }
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const borradas = await borrarDemo(cliente);
    const plan = await planDesdeBase(cliente, { semilla });
    await insertarPlan(cliente, plan);
    await cliente.query('COMMIT');
    return { ...resumirPlan(plan), borradas: borradas.length };
  } catch (err) {
    await cliente.query('ROLLBACK');
    throw err;
  } finally {
    cliente.release();
  }
};

export const limpiarDemo = async (pool, { simular = false } = {}) => {
  if (simular) return { eliminadas: (await idsDemo(pool)).length };
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const ids = await borrarDemo(cliente);
    await cliente.query('COMMIT');
    return { eliminadas: ids.length };
  } catch (err) {
    await cliente.query('ROLLBACK');
    throw err;
  } finally {
    cliente.release();
  }
};

const principal = async () => {
  const args = process.argv.slice(2);
  const limpiar = args.includes('--limpiar');
  const confirmar = args.includes('--confirmar');
  const desconocidos = args.filter((a) => !['--limpiar', '--confirmar'].includes(a));
  if (desconocidos.length > 0) {
    console.error(`❌ Argumentos desconocidos: ${desconocidos.join(', ')}. Usa --limpiar y/o --confirmar.`);
    process.exit(1);
  }
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ sembrar:demo es solo para desarrollo: se niega a correr con NODE_ENV=production.');
    process.exit(1);
  }

  const { env } = await import('../config/env.js');
  if (env.db.database.toLowerCase().includes('test')) {
    console.error(`❌ sembrar:demo no se ejecuta contra la base de pruebas (${env.db.database}).`);
    process.exit(1);
  }

  const { pool } = await import('./connection.js');
  try {
    console.log(`Base: ${env.db.database} (${env.db.host}:${env.db.port})${confirmar ? '' : ' · SIMULACIÓN (agrega --confirmar para escribir)'}`);
    if (limpiar) {
      const { eliminadas } = await limpiarDemo(pool, { simular: !confirmar });
      console.log(confirmar ? `🧹 ${eliminadas} citas demo eliminadas.` : `Se eliminarían ${eliminadas} citas demo.`);
    } else {
      const resumen = await sembrarDemo(pool, { simular: !confirmar });
      console.log(`${confirmar ? '✅ Sembradas' : 'Se sembrarían'} ${resumen.total} citas demo (${resumen.borradas} anteriores reemplazadas):`);
      console.log(JSON.stringify(resumen, null, 2));
    }
  } finally {
    await pool.end();
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal().catch((err) => {
    console.error('❌ Error en sembrar:demo:', err.message);
    process.exit(1);
  });
}
