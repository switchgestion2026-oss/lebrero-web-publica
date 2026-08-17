-- 002_full_schema.sql
-- Decision: renombrar propiedades -> properties (ALTER, no duplicar datos).
-- leads se mantiene como log crudo del form publico (no se fusiona con clients/requirements).

BEGIN;

-- 1. properties (ex propiedades + columnas nuevas)
ALTER TABLE propiedades RENAME TO properties;

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS operacion TEXT,
  ADD COLUMN IF NOT EXISTS localidad TEXT,
  ADD COLUMN IF NOT EXISTS barrio TEXT,
  ADD COLUMN IF NOT EXISTS direccion TEXT,
  ADD COLUMN IF NOT EXISTS dormitorios INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS banos INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS garage BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS patio BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS lavadero BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS pileta BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS quincho BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS parrilla BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS amoblado BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ascensor BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS balcon BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS esquina BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS agua BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS alambrado BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS propietario_id INTEGER,
  ADD COLUMN IF NOT EXISTS estado_comercial TEXT DEFAULT 'Disponible',
  ADD COLUMN IF NOT EXISTS activo_match BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS fecha_fin_contrato DATE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT now();

-- 2. clients
CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  whatsapp TEXT,
  email TEXT,
  tipo TEXT CHECK (tipo IN ('COMPRADOR','INQUILINO','PROPIETARIO','INTERESADO')),
  created_at TIMESTAMP DEFAULT now()
);

ALTER TABLE properties
  ADD CONSTRAINT fk_properties_propietario FOREIGN KEY (propietario_id) REFERENCES clients(id);

-- 3. requirements
CREATE TABLE IF NOT EXISTS requirements (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER REFERENCES clients(id),
  operacion TEXT,
  tipo_propiedad JSONB DEFAULT '[]',
  localidad TEXT,
  todas_localidades BOOLEAN DEFAULT false,
  zonas JSONB DEFAULT '[]',
  solo_por_valor BOOLEAN DEFAULT false,
  presupuesto_min NUMERIC,
  presupuesto_max NUMERIC,
  moneda TEXT DEFAULT 'USD',
  dormitorios_min INTEGER DEFAULT 0,
  banos_min INTEGER DEFAULT 0,
  garage BOOLEAN DEFAULT false,
  patio BOOLEAN DEFAULT false,
  lavadero BOOLEAN DEFAULT false,
  pileta BOOLEAN DEFAULT false,
  quincho BOOLEAN DEFAULT false,
  parrilla BOOLEAN DEFAULT false,
  amoblado BOOLEAN DEFAULT false,
  ascensor BOOLEAN DEFAULT false,
  balcon BOOLEAN DEFAULT false,
  esquina BOOLEAN DEFAULT false,
  agua BOOLEAN DEFAULT false,
  alambrado BOOLEAN DEFAULT false,
  apto_credito BOOLEAN DEFAULT false,
  flexibilidad_zona TEXT,
  observaciones TEXT,
  estado TEXT DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO','PAUSADO','CERRADO')),
  prioridad TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- 4. matches
CREATE TABLE IF NOT EXISTS matches (
  id SERIAL PRIMARY KEY,
  propiedad_id INTEGER REFERENCES properties(id),
  requerimiento_id INTEGER REFERENCES requirements(id),
  score INTEGER,
  estado TEXT DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE','CONTACTADO','INTERESADO','DESCARTADO','CERRADO')),
  fecha_calculo TIMESTAMP DEFAULT now(),
  UNIQUE (propiedad_id, requerimiento_id)
);

-- 5. match_activities
CREATE TABLE IF NOT EXISTS match_activities (
  id SERIAL PRIMARY KEY,
  match_id INTEGER REFERENCES matches(id),
  canal TEXT,
  estado TEXT,
  fecha TIMESTAMP DEFAULT now(),
  notas TEXT
);

-- 6. property_requests (propietarios que ofrecen propiedad desde la web publica)
CREATE TABLE IF NOT EXISTS property_requests (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  whatsapp TEXT,
  email TEXT,
  tipo_propiedad TEXT,
  localidad TEXT,
  barrio TEXT,
  direccion TEXT,
  dormitorios INTEGER,
  banos INTEGER,
  superficie NUMERIC,
  operacion TEXT,
  precio_estimado NUMERIC,
  observaciones TEXT,
  estado TEXT DEFAULT 'PENDIENTE_REVISION' CHECK (estado IN ('PENDIENTE_REVISION','ACEPTADA','RECHAZADA')),
  property_id INTEGER REFERENCES properties(id),
  created_at TIMESTAMP DEFAULT now()
);

-- 7. zones
CREATE TABLE IF NOT EXISTS zones (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  localidad TEXT
);

-- 8. config (umbral de match y otros parametros)
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT
);
INSERT INTO config (key, value) VALUES ('match_threshold', '55') ON CONFLICT (key) DO NOTHING;

-- 9. users (admin panel)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT now()
);

-- Regla: estado_comercial VENDIDA/ALQUILADA -> activo_match = false (trigger)
CREATE OR REPLACE FUNCTION trg_desactivar_match() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estado_comercial IN ('Vendido','Alquilado') THEN
    NEW.activo_match := false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS properties_estado_trigger ON properties;
CREATE TRIGGER properties_estado_trigger
  BEFORE INSERT OR UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION trg_desactivar_match();

COMMIT;
