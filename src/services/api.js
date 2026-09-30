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

export const obtenerServicios = () => request('/servicios');

export const obtenerDisponibilidad = (barberoId, fecha) =>
  request(`/disponibilidad?barbero=${barberoId}&fecha=${fecha}`);

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
