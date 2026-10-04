const API_URL = import.meta.env.VITE_API_URL;

let unauthorizedHandler = null;

export const setUnauthorizedHandler = (fn) => {
  unauthorizedHandler = fn;
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
  } catch {
    throw new Error('No se pudo conectar con el servidor');
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

    const error = new Error(data?.error || 'Error en la solicitud');
    error.status = res.status;
    // Código estable del back-end (p. ej. SERVICIO_NO_DISPONIBLE): evita depender del texto del mensaje.
    if (data?.codigo) error.codigo = data.codigo;
    // Campo del formulario al que se refiere el error y datos de apoyo (p. ej. cuántos servicios activos tiene una categoría).
    if (data?.campo) error.campo = data.campo;
    if (data?.total_servicios !== undefined) error.total_servicios = data.total_servicios;
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

export const obtenerDisponibilidad = (servicioId, fecha, barberoId) => {
  const params = new URLSearchParams({ servicio: servicioId, fecha });
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

export const obtenerCitas = (token, filtros = {}) => {
  const params = new URLSearchParams(filtros).toString();
  return request(`/citas${params ? `?${params}` : ''}`, {
    headers: authHeader(token),
  });
};

export const actualizarCita = (token, id, cambios) =>
  request(`/citas/${id}`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify(cambios),
  });

// Estadísticas del dashboard (solo admin). `periodo`: hoy | 7d | 30d | mes · `agrupar`: dia | mes.
export const obtenerEstadisticas = (token, periodo) =>
  request(`/admin/estadisticas${construirQuery({ periodo })}`, { headers: authHeader(token) });

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
