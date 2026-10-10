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

-- Versión de la sesión: el JWT lleva `v` y solo vale si coincide. Sube al cambiar o restablecer la contraseña y al
-- desactivar al usuario, así los tokens ya emitidos mueren (y reactivar no los resucita). Aditivo e idempotente; los tokens
-- emitidos antes de esta columna no llevan `v` y se tratan como versión 0.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS version_token INTEGER NOT NULL DEFAULT 0;

-- Perfil del dashboard (nombre y foto que solo existen dentro del panel; aditivo e idempotente). NULL = se usan los
-- valores públicos (barberos.nombre / barberos.foto; para el admin, usuarios.usuario). Nunca tocan la web pública.
--  - foto_perfil guarda solo el nombre del archivo (UUID + extensión) dentro de la carpeta de subidas, no la ruta.
--  - cambios_perfil registra los cambios de los barberos (el admin no registra) para avisar al admin. Guarda el valor
--    efectivo anterior y nuevo; "revisado" lo marca el admin (por barbero) y el índice parcial acelera el conteo.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS nombre_perfil VARCHAR(40);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS foto_perfil VARCHAR(100);

CREATE TABLE IF NOT EXISTS cambios_perfil (
  id SERIAL PRIMARY KEY,
  usuario_id INT NOT NULL REFERENCES usuarios(id),
  barbero_id INT NOT NULL REFERENCES barberos(id),
  campo VARCHAR(10) NOT NULL CHECK (campo IN ('foto', 'nombre')),
  valor_anterior VARCHAR(255),
  valor_nuevo VARCHAR(255),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  revisado_en TIMESTAMPTZ,
  revisado_por INT REFERENCES usuarios(id)
);

CREATE INDEX IF NOT EXISTS idx_cambios_perfil_pendientes ON cambios_perfil (barbero_id) WHERE revisado_en IS NULL;

-- Varios servicios por cita (máx. 3, ver utils/serviciosCita.js). Aditivo e idempotente.
--  - citas.duracion_min y citas.precio son la SUMA de las líneas (así rango, el EXCLUDE, ingresos y ticket promedio no
--    cambian) y citas.servicio_id queda como "servicio principal" (el primero) por compatibilidad.
--  - Cada línea guarda un snapshot (nombre, duración y precio al reservar): renombrar o editar el servicio después no
--    altera la cita ya hecha. UNIQUE (cita_id, orden) con orden 1..3 fuerza el máximo de 3 también en la base.
--  - ON DELETE CASCADE: la única baja de citas es la limpieza de las demo.
CREATE TABLE IF NOT EXISTS cita_servicios (
  id SERIAL PRIMARY KEY,
  cita_id INT NOT NULL REFERENCES citas(id) ON DELETE CASCADE,
  servicio_id INT NOT NULL REFERENCES servicios(id),
  orden SMALLINT NOT NULL CHECK (orden BETWEEN 1 AND 3),
  nombre VARCHAR(150) NOT NULL,
  duracion_min INT NOT NULL CHECK (duracion_min > 0),
  precio INT NOT NULL CHECK (precio >= 0),
  UNIQUE (cita_id, servicio_id),
  UNIQUE (cita_id, orden)
);

CREATE INDEX IF NOT EXISTS idx_cita_servicios_servicio ON cita_servicios (servicio_id);

-- Backfill: una línea por cada cita que aún no tiene ninguna. Duración y precio salen de la propia cita (su snapshot);
-- el nombre, del catálogo actual (solo para este snapshot inicial). Repetible: no duplica ni pisa nada.
INSERT INTO cita_servicios (cita_id, servicio_id, orden, nombre, duracion_min, precio)
SELECT c.id, c.servicio_id, 1, s.nombre, c.duracion_min, c.precio
FROM citas c
JOIN servicios s ON s.id = c.servicio_id
WHERE NOT EXISTS (SELECT 1 FROM cita_servicios cs WHERE cs.cita_id = c.id);


-- Asesorías (fase 1: solo estructura; sin datos nuevos, el comportamiento actual no cambia). Aditivo e idempotente.
--  - area: 'barberia' | 'asesoria' en barberos, servicios y categorias (servicios.tipo ya existe y significa
--    original/elite/vip, por eso no se llama tipo). El DEFAULT deja todo lo existente como barbería.
--  - citas.reserva_id: enlaza las dos citas de una reserva combinada (asesoría + corte). NULL = cita suelta.
--  - citas_reserva_sin_autosolapamiento: las citas activas de una misma reserva no pueden solaparse en el tiempo.
--  - asesoria_gratis_usos: una asesoría gratis por persona; UNIQUE por correo y teléfono normalizados (el backend
--    los normaliza). Se libera borrando la fila (al cancelar la cita) y cae sola si se borra la cita.
--  - Emparejamiento estricto: barberos.area de la cita = servicios.area de cada una de sus líneas. Se valida con
--    triggers (no con FK compuesta) para no invalidar filas anteriores, p. ej. los cortes antiguos de una asesora:
--    solo se revisan las líneas nuevas y las reasignaciones. El error lleva SQLSTATE 'BI001' y el mensaje empieza por
--    PROFESIONAL_INCOMPATIBLE (err.code / err.constraint para reconocerlo desde Node).
ALTER TABLE barberos ADD COLUMN IF NOT EXISTS area VARCHAR(20) NOT NULL DEFAULT 'barberia';
ALTER TABLE servicios ADD COLUMN IF NOT EXISTS area VARCHAR(20) NOT NULL DEFAULT 'barberia';
ALTER TABLE categorias ADD COLUMN IF NOT EXISTS area VARCHAR(20) NOT NULL DEFAULT 'barberia';
ALTER TABLE citas ADD COLUMN IF NOT EXISTS reserva_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'barberos_area_check') THEN
    ALTER TABLE barberos ADD CONSTRAINT barberos_area_check CHECK (area IN ('barberia', 'asesoria'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'servicios_area_check') THEN
    ALTER TABLE servicios ADD CONSTRAINT servicios_area_check CHECK (area IN ('barberia', 'asesoria'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categorias_area_check') THEN
    ALTER TABLE categorias ADD CONSTRAINT categorias_area_check CHECK (area IN ('barberia', 'asesoria'));
  END IF;
  -- uuid se indexa con = gracias a btree_gist (ya instalada arriba).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'citas_reserva_sin_autosolapamiento') THEN
    ALTER TABLE citas
      ADD CONSTRAINT citas_reserva_sin_autosolapamiento
      EXCLUDE USING gist (reserva_id WITH =, rango WITH &&)
      WHERE (reserva_id IS NOT NULL AND estado <> 'cancelada');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_citas_reserva ON citas (reserva_id) WHERE reserva_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS asesoria_gratis_usos (
  id SERIAL PRIMARY KEY,
  cita_id INT NOT NULL,
  correo_norm VARCHAR(150) NOT NULL,
  telefono_norm VARCHAR(10) NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT asesoria_gratis_usos_cita_id_fkey FOREIGN KEY (cita_id) REFERENCES citas(id) ON DELETE CASCADE,
  CONSTRAINT asesoria_gratis_usos_cita_id_key UNIQUE (cita_id),
  CONSTRAINT asesoria_gratis_usos_correo_norm_key UNIQUE (correo_norm),
  CONSTRAINT asesoria_gratis_usos_telefono_norm_key UNIQUE (telefono_norm)
);

-- Lanza el error de emparejamiento si el barbero de la cita y alguno de sus servicios son de áreas distintas.
-- `servicio` (opcional) limita la revisión a un servicio; sin él se revisan todas las líneas de la cita.
CREATE OR REPLACE FUNCTION validar_area_cita(p_cita_id INT, p_barbero_id INT, p_servicio_id INT DEFAULT NULL)
RETURNS VOID AS $fn$
DECLARE
  v_area_barbero VARCHAR(20);
  v_area_servicio VARCHAR(20);
BEGIN
  SELECT area INTO v_area_barbero FROM barberos WHERE id = p_barbero_id;
  IF v_area_barbero IS NULL THEN
    RETURN; -- sin barbero no hay nada que emparejar
  END IF;

  SELECT s.area INTO v_area_servicio
  FROM cita_servicios cs
  JOIN servicios s ON s.id = cs.servicio_id
  WHERE cs.cita_id = p_cita_id
    AND (p_servicio_id IS NULL OR cs.servicio_id = p_servicio_id)
    AND s.area <> v_area_barbero
  LIMIT 1;

  IF v_area_servicio IS NOT NULL THEN
    RAISE EXCEPTION 'PROFESIONAL_INCOMPATIBLE: el profesional (%) no atiende servicios de %', v_area_barbero, v_area_servicio
      USING ERRCODE = 'BI001', CONSTRAINT = 'cita_servicios_area_profesional';
  END IF;
END;
$fn$ LANGUAGE plpgsql;

-- Al COMMIT (cita y líneas ya existen): cada línea nueva debe ser del área del barbero de su cita.
CREATE OR REPLACE FUNCTION trg_cita_servicios_area() RETURNS TRIGGER AS $fn$
DECLARE
  v_barbero_id INT;
BEGIN
  SELECT barbero_id INTO v_barbero_id FROM citas WHERE id = NEW.cita_id;
  IF FOUND THEN
    PERFORM validar_area_cita(NEW.cita_id, v_barbero_id, NEW.servicio_id);
  END IF;
  RETURN NULL;
END;
$fn$ LANGUAGE plpgsql;

-- Reasignación (admin): el nuevo barbero debe ser del área de todos los servicios de la cita.
CREATE OR REPLACE FUNCTION trg_citas_area_barbero() RETURNS TRIGGER AS $fn$
BEGIN
  PERFORM validar_area_cita(NEW.id, NEW.barbero_id);
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'cita_servicios_area_profesional') THEN
    CREATE CONSTRAINT TRIGGER cita_servicios_area_profesional
      AFTER INSERT ON cita_servicios
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION trg_cita_servicios_area();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'citas_area_barbero') THEN
    CREATE TRIGGER citas_area_barbero
      BEFORE UPDATE OF barbero_id ON citas
      FOR EACH ROW
      WHEN (OLD.barbero_id IS DISTINCT FROM NEW.barbero_id)
      EXECUTE FUNCTION trg_citas_area_barbero();
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------------------------
-- Verificación del correo con código de 6 dígitos (obligatoria al reservar). Aditivo e idempotente.
--  - verificaciones_correo: un código por solicitud. SOLO se guarda su HMAC-SHA256 (nunca el código). `correo` es el
--    exacto (recorte + minúsculas). `intentos` se incrementa de forma atómica antes de comparar (máx. 5).
--    `invalidado_en` marca los códigos reemplazados por uno nuevo. Los límites por correo (60 s entre solicitudes,
--    5 por hora) se calculan contra `creado_en`, así que viven en la base y no se reinician con el servidor.
--  - verificaciones_usadas: comprobantes (jti) ya consumidos por una reserva. El UNIQUE decide cuando dos reservas
--    usan el mismo comprobante a la vez.
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS verificaciones_correo (
  id SERIAL PRIMARY KEY,
  correo VARCHAR(254) NOT NULL,
  codigo_hash CHAR(64) NOT NULL,
  intentos INTEGER NOT NULL DEFAULT 0,
  expira_en TIMESTAMPTZ NOT NULL,
  usado_en TIMESTAMPTZ,
  invalidado_en TIMESTAMPTZ,
  creado_en TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_verificaciones_correo_correo_fecha ON verificaciones_correo (correo, creado_en DESC);

CREATE TABLE IF NOT EXISTS verificaciones_usadas (
  id SERIAL PRIMARY KEY,
  jti VARCHAR(64) NOT NULL,
  correo VARCHAR(254) NOT NULL,
  usado_en TIMESTAMPTZ NOT NULL,
  CONSTRAINT verificaciones_usadas_jti_key UNIQUE (jti)
);
