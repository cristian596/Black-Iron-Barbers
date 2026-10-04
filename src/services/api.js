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

export const obtenerResumenAdmin = (token) =>
  request('/admin/resumen', {
    headers: authHeader(token),
  });

export const obtenerUsuarios = (token) =>
  request('/admin/usuarios', {
    headers: authHeader(token),
  });

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
