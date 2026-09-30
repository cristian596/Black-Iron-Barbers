-- Esquema de Black Iron Barbers (solo servicios de barbería)

CREATE TABLE IF NOT EXISTS barberos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  cargo VARCHAR(100),
  especialidad VARCHAR(150),
  foto VARCHAR(255),
  activo BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  usuario VARCHAR(50) UNIQUE NOT NULL,
  contrasena VARCHAR(255) NOT NULL,
  rol VARCHAR(20) NOT NULL CHECK (rol IN ('admin', 'barbero')),
  barbero_id INT REFERENCES barberos(id) ON DELETE SET NULL,
  activo BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS servicios (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  duracion_min INT NOT NULL,
  precio INT NOT NULL
);

CREATE TABLE IF NOT EXISTS citas (
  id SERIAL PRIMARY KEY,
  cliente VARCHAR(100) NOT NULL,
  correo VARCHAR(150) NOT NULL,
  servicio_id INT REFERENCES servicios(id),
  barbero_id INT REFERENCES barberos(id),
  fecha DATE NOT NULL,
  hora TIME NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'completada', 'cancelada')),
  creada_en TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (barbero_id, fecha, hora)
);
