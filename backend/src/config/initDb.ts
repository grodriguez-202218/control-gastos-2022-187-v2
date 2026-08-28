import { Client } from "pg";
import dotenv from "dotenv";
import { pool } from "./db";

dotenv.config();

export const initDatabase = async (): Promise<void> => {
  const adminClient = new Client({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: "postgres",
  });

  await adminClient.connect();

  const dbName = process.env.DB_NAME as string;

  const result = await adminClient.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [dbName]
  );

  if (result.rowCount === 0) {
    console.log(`La base de datos "${dbName}" no existe. Creándola...`);
    await adminClient.query(`CREATE DATABASE "${dbName}"`);
    console.log(`Base de datos "${dbName}" creada.`);
  } else {
    console.log(`La base de datos "${dbName}" ya existe.`);
  }

  await adminClient.end();

  // Tabla de usuarios
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      full_name VARCHAR(150) NOT NULL,
      email VARCHAR(150) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log('✓ Tabla "users" verificada/creada.');

  // 🔧 TABLA UNIFICADA - transactions (antes estaban en dos tablas)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense', 'ingreso', 'gasto')),
      description VARCHAR(255) NOT NULL,
      category VARCHAR(100) NOT NULL,
      amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
      date DATE NOT NULL DEFAULT CURRENT_DATE,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions (user_id, date);
  `);
  
  // Migración preventiva por si la tabla ya existía previamente sin la columna 'notes' u otras o con constraint restrictivo
  await pool.query(`
    ALTER TABLE transactions ADD COLUMN IF NOT EXISTS notes TEXT;
    ALTER TABLE transactions ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE;
    ALTER TABLE transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
    ALTER TABLE transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
    ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
    ALTER TABLE transactions ADD CONSTRAINT transactions_type_check CHECK (type IN ('ingreso', 'gasto', 'income', 'expense'));
  `);
  console.log('✓ Tabla "transactions" verificada/creada con índice, columnas y constraints aseguradas.');

  // Tabla de estadísticas para admin
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_stats (
      id SERIAL PRIMARY KEY,
      total_users INTEGER DEFAULT 0,
      total_transactions INTEGER DEFAULT 0,
      total_income NUMERIC(15,2) DEFAULT 0,
      total_expenses NUMERIC(15,2) DEFAULT 0,
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log('✓ Tabla "admin_stats" verificada/creada.');

  // Insertar estadísticas iniciales si no existen
  await pool.query(`
    INSERT INTO admin_stats (total_users, total_transactions, total_income, total_expenses, updated_at)
    SELECT 0, 0, 0, 0, NOW()
    WHERE NOT EXISTS (SELECT 1 FROM admin_stats LIMIT 1);
  `);
  console.log('✓ Estadísticas iniciales verificadas.');

  console.log(" Base de datos inicializada correctamente");
};