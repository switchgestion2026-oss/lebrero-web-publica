CREATE TABLE IF NOT EXISTS propiedades (
  id SERIAL PRIMARY KEY,
  titulo TEXT NOT NULL,
  tipo TEXT,
  zona TEXT,
  precio NUMERIC,
  ambientes INTEGER,
  fotos TEXT[],
  descripcion TEXT,
  publicada BOOLEAN DEFAULT false,
  creado_en TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  telefono TEXT NOT NULL,
  email TEXT,
  tipo_buscado TEXT,
  zona TEXT,
  presupuesto NUMERIC,
  creado_en TIMESTAMP DEFAULT now()
);
