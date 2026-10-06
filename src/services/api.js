const API_URL = import.meta.env.VITE_API_URL;

let unauthorizedHandler = null;

export const setUnauthorizedHandler = (fn) => {
  unauthorizedHandler = fn;
};

// Un 403 CONTRASENA_CADUCADA no cierra la sesión: lleva a la pantalla de cambio obligatorio.
let contrasenaCaducadaHandler = null;

export const setContrasenaCaducadaHandler = (fn) => {
  contrasenaCaducadaHandler = fn;
};

const request = async (path, options = {}) => {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  } catch (err) {
    // Una petición cancelada (AbortController) no es un fallo de red: se propaga tal cual.
    if (err?.name === 'AbortError') throw err;
    const error = new Error('No se pudo conectar con el servidor');
    error.red = true;
    throw error;
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // Respuesta sin cuerpo JSON (por ejemplo, un 204 o un error de red)
  }

  if (!res.ok) {
    if (res.status === 401 && options.headers?.Authorization && unauthorizedHandler) {
      unauthorizedHandler();
    }

    if (res.status === 403 && data?.codigo === 'CONTRASENA_CADUCADA' && options.headers?.Authorization && contrasenaCaducadaHandler) {
      contrasenaCaducadaHandler();
    }

    const error = new Error(data?.error || 'Error en la solicitud');
    error.status = res.status;
    // Código estable del back-end (p. ej. SERVICIO_NO_DISPONIBLE): evita depender del texto del mensaje.
    if (data?.codigo) error.codigo = data.codigo;
    // Campo del formulario al que se refiere el error y datos de apoyo (p. ej. cuántos servicios activos tiene una categoría).
    if (data?.campo) error.campo = data.campo;
    if (data?.total_servicios !== undefined) error.total_servicios = data.total_servicios;
    // Ids de servicios que ya no están disponibles (SERVICIO_NO_DISPONIBLE al reservar o pedir horas).
    if (Array.isArray(data?.servicios_no_disponibles)) error.servicios_no_disponibles = data.servicios_no_disponibles;
    // Segundos que faltan para poder reintentar (429 del login); viene en el cuerpo porque el CORS no expone Retry-After.
    if (Number.isFinite(data?.reintentar_en_seg)) error.reintentar_en_seg = data.reintentar_en_seg;
    throw error;
  }

  return data;
};

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

export const login = (usuario, contrasena) =>
  request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ usuario, contrasena }),
  });

export const cambiarContrasena = (token, actual, nueva) =>
  request('/auth/contrasena', {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify({ actual, nueva }),
  });

// Quién es el usuario de la sesión y el estado de su contraseña ({ usuario, vigencia }; vigencia es null para el admin).
export const obtenerSesion = (token) => request('/auth/sesion', { headers: authHeader(token) });

export const obtenerBarberos = () => request('/barberos');

// Arma "?a=1&b=2" ignorando valores vacíos; URLSearchParams se encarga de codificar tildes, % y espacios.
export const construirQuery = (filtros = {}) => {
  const params = new URLSearchParams();
  Object.entries(filtros).forEach(([clave, valor]) => {
    if (valor !== undefined && valor !== null && String(valor).trim() !== '') params.set(clave, valor);
  });
  const texto = params.toString();
  return texto ? `?${texto}` : '';
};

// Sin argumentos devuelve todos los servicios activos; los filtros (categoria, tipo, q, ordenar,
// direccion) los resuelve el back-end.
export const obtenerServicios = (filtros) => request(`/servicios${construirQuery(filtros)}`);

// `servicioIds`: lista de 1 a 3 ids (se atienden seguidos como un solo bloque); se admite un id suelto.
export const obtenerDisponibilidad = (servicioIds, fecha, barberoId) => {
  const ids = Array.isArray(servicioIds) ? servicioIds : [servicioIds];
  const params = new URLSearchParams({ servicios: ids.join(','), fecha });
  if (barberoId !== null && barberoId !== undefined && barberoId !== '') {
    params.set('barbero', barberoId);
  }
  return request(`/disponibilidad?${params.toString()}`);
};

export const crearCita = (cita) =>
  request('/citas', {
    method: 'POST',
    body: JSON.stringify(cita),
  });

export const actualizarCita = (token, id, cambios) =>
  request(`/citas/${id}`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify(cambios),
  });

// Estadísticas del dashboard (solo admin). `periodo`: hoy | 7d | 30d | mes · `agrupar`: dia | mes.
export const obtenerEstadisticas = (token, periodo) =>
  request(`/admin/estadisticas${construirQuery({ periodo })}`, { headers: authHeader(token) });

// Reporte diario (solo admin). `fecha`: AAAA-MM-DD.
export const obtenerReporteDiario = (token, fecha) =>
  request(`/admin/reportes/diario${construirQuery({ fecha })}`, { headers: authHeader(token) });

// El CSV exige el token, así que no se puede abrir con un enlace directo: se pide con fetch y se devuelve el blob.
export const descargarReporteDiarioCsv = async (token, fecha) => {
  let res;
  try {
    res = await fetch(`${API_URL}/admin/reportes/diario.csv${construirQuery({ fecha })}`, { headers: authHeader(token) });
  } catch {
    throw new Error('No se pudo conectar con el servidor');
  }
  if (!res.ok) {
    if (res.status === 401 && unauthorizedHandler) unauthorizedHandler();
    let data = null;
    try {
      data = await res.json();
    } catch {
      // Sin cuerpo JSON
    }
    const error = new Error(data?.error || 'No se pudo descargar el reporte');
    error.status = res.status;
    if (data?.codigo) error.codigo = data.codigo;
    throw error;
  }
  return { blob: await res.blob(), nombre: `reporte-diario-${fecha}.csv` };
};

export const obtenerIngresos = (token, agrupar) =>
  request(`/admin/estadisticas/ingresos${construirQuery({ agrupar })}`, { headers: authHeader(token) });

export const obtenerServiciosTop = (token, periodo, limite) =>
  request(`/admin/estadisticas/servicios-top${construirQuery({ periodo, limite })}`, { headers: authHeader(token) });

// Lista paginada del admin: { pestana, q, desde, hasta, barbero, pagina, limite } → { items, total, pagina, limite }.
export const obtenerCitasAdmin = (token, filtros) =>
  request(`/admin/citas${construirQuery(filtros)}`, { headers: authHeader(token) });

// Catálogo del admin (incluye inactivos). Sin DELETE: los servicios y categorías se activan o desactivan.
export const obtenerServiciosAdmin = (token, filtros) =>
  request(`/admin/servicios${construirQuery(filtros)}`, { headers: authHeader(token) });

export const crearServicioAdmin = (token, datos) =>
  request('/admin/servicios', { method: 'POST', headers: authHeader(token), body: JSON.stringify(datos) });

export const actualizarServicioAdmin = (token, id, cambios) =>
  request(`/admin/servicios/${id}`, { method: 'PATCH', headers: authHeader(token), body: JSON.stringify(cambios) });

export const obtenerCategoriasAdmin = (token) => request('/admin/categorias', { headers: authHeader(token) });

export const crearCategoriaAdmin = (token, datos) =>
  request('/admin/categorias', { method: 'POST', headers: authHeader(token), body: JSON.stringify(datos) });

export const actualizarCategoriaAdmin = (token, id, cambios) =>
  request(`/admin/categorias/${id}`, { method: 'PATCH', headers: authHeader(token), body: JSON.stringify(cambios) });

export const obtenerEmpleados = (token) => request('/admin/empleados', { headers: authHeader(token) });

export const crearEmpleado = (token, datos) =>
  request('/admin/empleados', { method: 'POST', headers: authHeader(token), body: JSON.stringify(datos) });

export const actualizarEmpleado = (token, id, cambios) =>
  request(`/admin/empleados/${id}`, { method: 'PATCH', headers: authHeader(token), body: JSON.stringify(cambios) });

export const crearUsuarioBarbero = (token, datos) =>
  request('/admin/usuarios', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(datos),
  });

export const actualizarUsuarioBarbero = (token, id, cambios) =>
  request(`/admin/usuarios/${id}`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify(cambios),
  });

// Panel del barbero (solo lectura). El barbero sale del token en el back-end. `signal` permite cancelar la petición.
export const obtenerResumenBarbero = (token, signal) => request('/barbero/resumen', { headers: authHeader(token), signal });

export const obtenerCitasPorConfirmar = (token, signal) =>
  request('/barbero/citas-por-confirmar', { headers: authHeader(token), signal });

export const obtenerAgendaHoy = (token, signal) => request('/barbero/agenda-hoy', { headers: authHeader(token), signal });

// Lista paginada de "Mis citas" del barbero: { pestana, q, desde, hasta, pagina, limite } → { items, pagina, limite, total, conteos }.
export const obtenerMisCitas = (token, filtros, signal) =>
  request(`/barbero/citas${construirQuery(filtros)}`, { headers: authHeader(token), signal });

// Estadísticas personales del barbero (mismas formas que las del admin, solo con sus citas; el barbero sale del token).
export const obtenerMisEstadisticas = (token, periodo, signal) =>
  request(`/barbero/estadisticas${construirQuery({ periodo })}`, { headers: authHeader(token), signal });

export const obtenerMisIngresos = (token, agrupar, signal) =>
  request(`/barbero/estadisticas/ingresos${construirQuery({ agrupar })}`, { headers: authHeader(token), signal });

export const obtenerMisServiciosTop = (token, periodo, limite, signal) =>
  request(`/barbero/estadisticas/servicios-top${construirQuery({ periodo, limite })}`, { headers: authHeader(token), signal });

// Perfil del dashboard (nombre y foto que solo existen en el panel; no cambian lo que ve el cliente en la web).
export const obtenerPerfil = (token, signal) => request('/perfil', { headers: authHeader(token), signal });

// nombre_perfil: texto (2–40) o null para volver al nombre público.
export const actualizarPerfil = (token, nombrePerfil) =>
  request('/perfil', {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify({ nombre_perfil: nombrePerfil }),
  });

// La foto va como cuerpo crudo (no multipart), con el Content-Type del propio archivo.
export const subirFotoPerfil = (token, archivo) =>
  request('/perfil/foto', {
    method: 'POST',
    headers: { ...authHeader(token), 'Content-Type': archivo.type },
    body: archivo,
  });

export const quitarFotoPerfil = (token) => request('/perfil/foto', { method: 'DELETE', headers: authHeader(token) });

// Revisión de los cambios de perfil de los barberos (solo admin).
export const obtenerCambiosPerfil = (token, signal) => request('/admin/cambios-perfil', { headers: authHeader(token), signal });

export const revisarCambiosPerfil = (token, barberoId) =>
  request('/admin/cambios-perfil/revisar', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify({ barbero_id: barberoId }),
  });

export const restablecerPerfilBarbero = (token, barberoId) =>
  request(`/admin/barberos/${barberoId}/restablecer-perfil`, { method: 'POST', headers: authHeader(token) });
