import express from 'express';
import cors from 'cors';
import pg from 'pg';

const { Pool } = pg;

const app = express();
app.use(cors());
app.use(express.json());

// Configuración de la conexión usando las variables de Docker
const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});

const conectarConReintentos = async () => {
  let reintentos = 5;
  while (reintentos) {
    try {
      await pool.query('SELECT NOW()');
      console.log('✅ Conectado exitosamente a PostgreSQL (Black Iron DB)');

      // Creación de tablas estructuradas
      // 1. Tabla de Barberos
      await pool.query(`
        CREATE TABLE IF NOT EXISTS barberos (
          id SERIAL PRIMARY KEY,
          usuario VARCHAR(50) UNIQUE NOT NULL,
          contrasena VARCHAR(255) NOT NULL,
          nombre VARCHAR(100) NOT NULL
        );
      `);

      // 2. Tabla de Citas asociadas a un Barbero
      await pool.query(`
        CREATE TABLE IF NOT EXISTS citas (
          id SERIAL PRIMARY KEY,
          cliente VARCHAR(100) NOT NULL,
          servicio VARCHAR(100) NOT NULL,
          fecha VARCHAR(50) NOT NULL,
          hora VARCHAR(50) NOT NULL,
          barbero_id INT REFERENCES barberos(id) ON DELETE SET NULL
        );
      `);

      console.log('📋 Tablas de la barbería verificadas/creadas correctamente.');
      break;
    } catch (err) {
      console.log('⏳ Esperando que la base de datos esté lista...');
      reintentos -= 1;
      await new Promise(res => setTimeout(res, 5000));
    }
  }
};

conectarConReintentos();

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('Servidor de Black Iron Barbers corriendo con éxito 💈');
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});