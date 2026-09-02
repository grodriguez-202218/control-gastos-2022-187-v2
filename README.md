# Control Gastos

Sistema de control de gastos personal con arquitectura cliente-servidor. Permite a los usuarios registrar ingresos y gastos, visualizar resúmenes financieros, gráficos de flujo de caja y distribución por categorías, con autenticación JWT y control de acceso basado en roles (usuario/admin).

## Características principales

### Autenticación y autorización
- Registro e inicio de sesión con validación de contraseña (mín. 6 caracteres)
- Autenticación JWT con expiración corta (1 minuto) y renovación automática
- Hash de contraseñas con bcrypt (10 rounds)
- Roles: `user` y `admin` con guardas de ruta en frontend y middleware en backend
- Cierre de sesión automático al expirar el token


### Dashboards y visualización
- **Dashboard Usuario**: Resumen financiero (balance total, ingresos/gastos del mes, presupuesto mensual fijo 8000), últimas 5 transacciones, gráficos interactivos

- **Dashboard Admin**: Vista global con estadísticas agregadas, gráficos de ingresos mensuales y gastos por categoría
- Gráficos con Chart.js: línea (flujo de caja 12 meses) y doughnut (distribución por categoría)

### Base de datos
- Auto-inicialización al arrancar: crea BD si no existe, tablas, índices, constraints
- Tablas: `users`, `transactions`, `admin_stats`
- Índice compuesto en `transactions(user_id, date)`
- Constraints CHECK para tipos de transacción y montos positivos

## Stack tecnológico

### Backend
Node.js  20.x 
TypeScript 5.5 
Express 4.19 
pg 8.12 
jsonwebtoken 9.0
bcrypt 5.1
cors 2.8  
dotenv 16.4 
ts-node-dev 2.0 
### Frontend
Angular 22.1 
TypeScript  6.0
RxJS 7.8 
Chart.js 4.5 
TailwindCSS 4.3 
Vite (via @angular/build)
Vitest 4.0 

### Herramientas
- **pnpm** 9.x (workspaces)
- **ESLint** + **Prettier** (config en frontend)
- **PostCSS** + **Autoprefixer**

---

## Prerequisitos

- **Node.js** 
- **pnpm**
- **PostgreSQL** 
- **Git**

---

## Instalación

```bash
# Clonar repositorio
git clone <repository-url>
cd control-gastos-2022-187-v2

# Instalar dependencias (usa workspaces pnpm)
pnpm install

## Configuración de variables de entorno
Crear archivo `.env` 
```env
# Servidor
PORT=3000
FRONTEND_URL=http://localhost:4200

# Base de datos PostgreSQL
DB_USER=postgres
DB_PASSWORD=tu_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=control_gastos

# JWT (clave secreta fuerte, mínimo 32 chars en producción)
JWT_SECRET=tu_clave_secreta_muy_larga_y_segura
```

## Estructura del proyecto

```
control-gastos-2022-187-v2/
├── .gitignore
├── backend/
│   ├── package.json
│   ├── pnpm-lock.yaml
│   ├── pnpm-workspace.yaml
│   ├── tsconfig.json
│   └── src/
│       ├── server.ts                 # Entry point
│       ├── app.ts                    # Express app, middlewares, routes
│       ├── config/
│       │   ├── db.ts                 # Pool PG
│       │   └── initDb.ts             # Auto-inicialización BD
│       └── modules/
│           ├── middlewares/
│           │   └── auth.middleware.ts   # verifyToken (JWT)
│           ├── models/
│           │   ├── user.model.ts        # User + UserModel
│           │   └── transaction.model.ts # Transaction + TransactionModel
│           ├── controllers/
│           │   ├── auth.controller.ts
│           │   └── transaction.controller.ts
│           ├── services/
│           │   └── auth.service.ts
│           └── routers/
│               ├── auth.router.ts       # /api/auth/*
│               └── transaction.router.ts# /api/transactions/*
└── frontend/
    ├── package.json
    ├── pnpm-lock.yaml
    ├── pnpm-workspace.yaml
    ├── tsconfig.json
    ├── tsconfig.app.json
    ├── tsconfig.spec.json
    ├── angular.json
    ├── .editorconfig
    ├── .prettierrc
    ├── .postcssrc.json
    └── src/
        ├── main.ts
        ├── index.html
        ├── styles.css
        └── app/
            ├── app.ts
            ├── app.config.ts
            ├── app.routes.ts
            ├── app.html
            ├── app.css
            ├── app.spec.ts
            ├── core/
            │   ├── guards/
            │   │   └── auth-guard.ts
            │   ├── interceptors/
            │   │   └── auth.interceptor.ts
            │   ├── services/
            │   │   ├── auth.service.ts
            │   │   └── expense.service.ts
            │   ├── utils/
            │   │   └── blobs.ts
            │   └── styles/
            │       ├── auth.css
            │       └── dashboard.css
            └── pages/
                ├── login/
                ├── register/
                ├── transactions/
                ├── dashboard-user/
                └── dashboard-admin/
```


## Ejecución

### Desarrollo (ambos en paralelo)

```bash
# Terminal 1 - Backend
cd backend
pnpm run dev
# Servidor en http://localhost:3000

# Terminal 2 - Frontend
cd frontend
pnpm run start
# App en http://localhost:4200
```

### Producción

```bash
# Backend
cd backend
pnpm run build
pnpm run start
# Sirve dist/server.js en puerto 3000

# Frontend
cd frontend
pnpm run build
# Output en dist/frontend/browser/
# Servir con nginx, Apache, o cualquier static server


### Códigos de respuesta habituales

- `200` OK
- `201` Created
- `400` Bad Request (validación)
- `401` Unauthorized (token faltante/inválido/expirado)
- `403` Forbidden (acceso a recurso ajeno)
- `404` Not Found
- `500` Server Error

---

## Base de datos

### Esquema

```sql
-- Usuarios
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Transacciones
CREATE TABLE transactions (
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

CREATE INDEX idx_transactions_user_date ON transactions (user_id, date);

-- Estadísticas admin (tabla única fila)
CREATE TABLE admin_stats (
  id SERIAL PRIMARY KEY,
  total_users INTEGER DEFAULT 0,
  total_transactions INTEGER DEFAULT 0,
  total_income NUMERIC(15,2) DEFAULT 0,
  total_expenses NUMERIC(15,2) DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Inicialización automática

Al arrancar el backend (`server.ts` → `initDatabase()`):
1. Conecta a BD `postgres` (admin)
2. Crea BD `DB_NAME` si no existe
3. Crea/verifica tablas, índices, constraints
4. Inserta fila inicial en `admin_stats` si vacía

### Seguridad
- Contraseñas hasheadas con bcrypt (cost 10)
- JWT expiración corta (1 min) → reduce ventana de ataque
- Validación both client + server
- CORS restringido a `FRONTEND_URL`
- Helmet.js **TODO**: agregar en producción
