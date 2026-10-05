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

-- Catálogo ampliado: categorías, tipo (original/elite/vip), descripción y baja lógica.
-- Todo es aditivo y repetible; los servicios previos conservan su id y quedan activos
-- (el seed es quien desactiva el catálogo viejo). categoria_id, tipo y descripcion son
-- NULL en filas anteriores a este cambio, por eso no llevan NOT NULL.
CREATE TABLE IF NOT EXISTS categorias (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  orden INT NOT NULL
);

ALTER TABLE servicios ADD COLUMN IF NOT EXISTS categoria_id INT REFERENCES categorias(id);
ALTER TABLE servicios ADD COLUMN IF NOT EXISTS tipo VARCHAR(10);
ALTER TABLE servicios ADD COLUMN IF NOT EXISTS descripcion TEXT;
ALTER TABLE servicios ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'servicios_tipo_check') THEN
    ALTER TABLE servicios ADD CONSTRAINT servicios_tipo_check
      CHECK (tipo IN ('original', 'elite', 'vip'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'servicios_precio_check') THEN
    ALTER TABLE servicios ADD CONSTRAINT servicios_precio_check CHECK (precio >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'servicios_duracion_min_check') THEN
    ALTER TABLE servicios ADD CONSTRAINT servicios_duracion_min_check CHECK (duracion_min > 0);
  END IF;
  -- Necesario para el upsert por nombre del seed. Distingue mayúsculas: "Exfoliación Facial"
  -- y "Exfoliación facial" son nombres distintos.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'servicios_nombre_key') THEN
    ALTER TABLE servicios ADD CONSTRAINT servicios_nombre_key UNIQUE (nombre);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_servicios_categoria ON servicios (categoria_id);
CREATE INDEX IF NOT EXISTS idx_servicios_activo ON servicios (activo);

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

-- Snapshot de duración y precio del servicio al momento de reservar: una
-- cita ya creada no debe cambiar si luego se edita el servicio en el catálogo.
ALTER TABLE citas ADD COLUMN IF NOT EXISTS duracion_min INT;
ALTER TABLE citas ADD COLUMN IF NOT EXISTS precio INT;
ALTER TABLE citas ADD COLUMN IF NOT EXISTS telefono VARCHAR(10);
ALTER TABLE citas ADD COLUMN IF NOT EXISTS consentimiento_en TIMESTAMP;

UPDATE citas AS c SET
  duracion_min = s.duracion_min,
  precio = s.precio
FROM servicios AS s
WHERE c.servicio_id = s.id AND c.duracion_min IS NULL;

ALTER TABLE citas ALTER COLUMN duracion_min SET NOT NULL;
ALTER TABLE citas ALTER COLUMN precio SET NOT NULL;

-- Protección contra solapamiento de horario por barbero (una cita de más de
-- 30 min puede chocar con otra que empiece en medio, cosa que el UNIQUE no
-- detecta). Requiere btree_gist para poder indexar barbero_id junto al rango.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE citas ADD COLUMN IF NOT EXISTS rango TSRANGE
  GENERATED ALWAYS AS (
    TSRANGE(
      (fecha + hora),
      (fecha + hora) + MAKE_INTERVAL(mins => duracion_min),
      '[)'
    )
  ) STORED;

-- Una cita cancelada libera el hueco: la restricción solo mira citas activas.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'citas_sin_solapamiento'
  ) THEN
    ALTER TABLE citas
      ADD CONSTRAINT citas_sin_solapamiento
      EXCLUDE USING gist (barbero_id WITH =, rango WITH &&)
      WHERE (estado <> 'cancelada');
  END IF;
END $$;

-- El UNIQUE original (barbero_id, fecha, hora) queda redundante y además NO
-- ignora citas canceladas (bloquearía reutilizar el mismo slot exacto tras
-- cancelar). citas_sin_solapamiento ya cubre ese caso (hora igual = rango que
-- se solapa consigo mismo) y sí libera el hueco al cancelar, así que se retira.
ALTER TABLE citas DROP CONSTRAINT IF EXISTS citas_barbero_id_fecha_hora_key;

-- Las estadísticas y el listado del admin filtran por rango de fechas y estado.
CREATE INDEX IF NOT EXISTS idx_citas_fecha_estado ON citas (fecha, estado);

-- Gestión del catálogo desde el panel del admin (aditivo e idempotente).
--  - clave_seed: identificador estable de las filas que vienen del catálogo del seed (backend/db/data). El seed y
--    la migración casan por él, no por el nombre, así un servicio renombrado por el admin no se vuelve a crear.
--    NULL = fila creada por el admin (el seed nunca la toca). UNIQUE permite varios NULL.
--  - categorias.activo: una categoría inactiva no aparece en la web pública.
--  - migraciones_aplicadas: pasos de datos que se ejecutan una sola vez (backfill de claves, apagado del catálogo
--    anterior). Las ejecuta backend/db/migracionesCatalogo.js y deja aquí su registro.
ALTER TABLE servicios ADD COLUMN IF NOT EXISTS clave_seed VARCHAR(100);
ALTER TABLE categorias ADD COLUMN IF NOT EXISTS clave_seed VARCHAR(100);
ALTER TABLE categorias ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'servicios_clave_seed_key') THEN
    ALTER TABLE servicios ADD CONSTRAINT servicios_clave_seed_key UNIQUE (clave_seed);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categorias_clave_seed_key') THEN
    ALTER TABLE categorias ADD CONSTRAINT categorias_clave_seed_key UNIQUE (clave_seed);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS migraciones_aplicadas (
  clave VARCHAR(100) PRIMARY KEY,
  aplicada_en TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Caducidad de contraseñas de los barberos (60 días; el admin está exento). Al añadir la columna con DEFAULT now(),
-- Postgres rellena las filas existentes con el momento de la migración: nadie caduca de golpe. Es idempotente
-- (en los arranques siguientes la columna ya existe y no se toca nada). Se actualiza desde Node (no con NOW()) cada
-- vez que se fija una contraseña: cambio propio, restablecimiento del admin, alta de empleado o de acceso.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS contrasena_cambiada_en TIMESTAMPTZ NOT NULL DEFAULT now();
