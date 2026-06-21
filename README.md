# Financial Helper

Módulo de gestión de movimientos financieros personales desarrollado como parte de una prueba técnica para una fintech colombiana. El producto está orientado a un contexto MVP real: código listo para revisión de pares, análisis de calidad automatizado y despliegue continuo.

## Tabla de contenidos

- [Stack tecnológico y justificación](#stack-tecnológico-y-justificación)
- [Arquitectura](#arquitectura)
- [Requisitos previos](#requisitos-previos)
- [Configuración y variables de entorno](#configuración-y-variables-de-entorno)
- [Inicio rápido](#inicio-rápido)
- [Credenciales por defecto](#credenciales-por-defecto)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Módulos funcionales](#módulos-funcionales)
- [Tests](#tests)
- [CI/CD y calidad de código](#cicd-y-calidad-de-código)
- [URL de despliegue](#url-de-despliegue)
- [Pendientes y decisiones de ambigüedad](#pendientes-y-decisiones-de-ambigüedad)
- [AI Usage](#ai-usage)

---

## Stack tecnológico y justificación

Las decisiones de stack se tomaron considerando tres factores: **seguridad**, **mantenibilidad** y **velocidad de entrega** en un contexto financiero.

### Backend — NestJS (Node.js + TypeScript)

NestJS impone una arquitectura modular basada en principios SOLID desde el inicio: módulos, controladores, servicios y repositorios están separados por diseño, no por convención. Esto es especialmente valioso en una fintech donde los dominios (autenticación, movimientos, presupuestos) deben estar aislados para facilitar auditorías y cumplimiento regulatorio.

El sistema de **guards** y **decoradores** de NestJS permite implementar autenticación y autorización de forma declarativa (`@UseGuards(JwtAuthGuard)`), reduciendo la probabilidad de olvidar proteger un endpoint. En un producto financiero, un endpoint desprotegido por error es un riesgo crítico.

TypeScript en el backend agrega tipado estricto que detecta errores de lógica financiera en tiempo de compilación, antes de que lleguen a producción.

El candidato cuenta con experiencia práctica en NestJS adquirida a través de cursos especializados, lo que reduce la deuda técnica por desconocimiento de la plataforma.

### Frontend — Next.js (React + TypeScript)

Next.js permite colocar la lógica de presentación y las llamadas a API en el mismo repositorio con una experiencia de desarrollo cohesiva. El App Router de Next.js 15 habilita **Server Components** para reducir el JavaScript enviado al cliente y **Route Handlers** para casos donde el frontend necesita actuar como BFF (Backend for Frontend).

Para un módulo financiero personal, el rendering del lado del servidor mejora la percepción de rendimiento en conexiones lentas, que es la realidad de muchos usuarios en Colombia.

El candidato tiene experiencia con Next.js y React a través de formación en cursos, lo que garantiza dominio del modelo mental de hidratación y del sistema de rutas.

### Base de datos — PostgreSQL 16

PostgreSQL es la única opción técnicamente justificable para datos financieros:

- **ACID completo**: atomicidad, consistencia, aislamiento y durabilidad garantizados. En una transacción financiera que involucra múltiples escrituras (movimiento + actualización de balance + verificación de presupuesto), o todo se guarda o nada se guarda.
- **Transacciones robustas**: si el proceso falla entre operaciones relacionadas, PostgreSQL hace rollback automático. MongoDB en modo de escritura eventual puede dejar el estado inconsistente.
- **Consultas complejas**: los filtros por rango de fechas, agrupaciones por categoría y cálculos de balance se expresan naturalmente en SQL con índices parciales y funciones de ventana.
- **Integridad referencial**: las foreign keys con `ON DELETE RESTRICT` previenen huérfanos en datos financieros (un movimiento sin usuario válido, una categoría sin dueño).

MongoDB no se consideró porque su modelo de consistencia eventual y la ausencia de transacciones multi-documento en configuraciones sin replica set introduce riesgos inaceptables para un producto financiero.

### ORM — Prisma

Prisma genera tipos TypeScript directamente del esquema de base de datos, haciendo imposible escribir una query que acceda a un campo que no existe. Las migraciones son versionadas y reproducibles, lo que es fundamental para un pipeline CI/CD que necesita reconstruir la base de datos desde cero en cada ejecución de tests.

### Autenticación — JWT con Access + Refresh Token

Access token de corta duración (15 minutos) + refresh token de larga duración (7 días) almacenado en cookie HttpOnly. Este modelo cumple con el requerimiento de sesión segura y controlada:

- El access token expira rápido, limitando la ventana de exposición si es interceptado.
- La cookie HttpOnly previene acceso desde JavaScript (mitigación de XSS).
- El refresh token permite renovar la sesión sin que el usuario vuelva a autenticarse cada 15 minutos.

### Contenedores — Docker Compose

Un solo archivo `docker-compose.yml` levanta PostgreSQL, el backend NestJS y el frontend Next.js. Esto cumple el requerimiento de "un comando levanta todo" y garantiza que el entorno de desarrollo sea idéntico al de producción.

### CI/CD — GitHub Actions

Pipeline con tres jobs: `test` (unit + integration), `lint` (ESLint + Prettier) y `quality` (análisis estático con SonarCloud). El job de calidad bloquea el merge si la cobertura cae por debajo del umbral o si hay code smells críticos.

### Análisis de calidad — SonarCloud + ESLint

SonarCloud detecta vulnerabilidades de seguridad (hardcoded secrets, SQL injection patterns, dependencias con CVEs), duplicación de código y complejidad ciclomática. ESLint con reglas de seguridad (`no-eval`, `no-implied-eval`) actúa como primera barrera en cada commit.

---

## Arquitectura

```
finantial-helper/
├── backend/                    # NestJS API REST
│   ├── src/
│   │   ├── auth/               # JWT, guards, estrategias Passport
│   │   ├── users/              # Gestión de usuarios
│   │   ├── movements/          # CRUD de movimientos financieros
│   │   ├── categories/         # Categorías personalizadas
│   │   ├── budgets/            # Presupuestos y alertas
│   │   └── prisma/             # Servicio Prisma + schema
│   ├── test/                   # Tests e2e
│   └── Dockerfile
├── frontend/                   # Next.js App Router
│   ├── app/
│   │   ├── (auth)/             # Login, registro
│   │   ├── dashboard/          # Balance y resumen
│   │   ├── movements/          # Listado, filtros, CRUD
│   │   └── categories/         # Gestión de categorías y presupuestos
│   ├── components/
│   ├── lib/                    # Cliente API, hooks, utilidades
│   └── Dockerfile
├── docker-compose.yml
├── docker-compose.prod.yml
├── .github/
│   └── workflows/
│       └── ci.yml
└── README.md
```

La comunicación entre frontend y backend es exclusivamente a través de la API REST. El frontend no tiene acceso directo a la base de datos. Cada módulo del backend expone únicamente los datos del usuario autenticado (row-level security a nivel de aplicación con validación en cada query).

---

## Requisitos previos

| Herramienta | Versión mínima | Propósito |
|-------------|---------------|-----------|
| Node.js | 22.x LTS | Runtime de producción (NestJS build) |
| Bun | 1.2.x | Package manager y runtime de desarrollo |
| Docker | 27.x | Contenedores |
| Docker Compose | 2.x (plugin) | Orquestación local |
| Git | 2.x | Control de versiones |

Verificar versiones instaladas:

```bash
node --version    # >= 22.0.0
bun --version     # >= 1.2.0
docker --version  # >= 27.0.0
docker compose version  # >= 2.0.0
```

Instalar Bun (si no está instalado):

```bash
# Windows (PowerShell)
powershell -c "irm bun.sh/install.ps1 | iex"

# macOS / Linux
curl -fsSL https://bun.sh/install | bash
```

---

## Configuración y variables de entorno

### Backend (`backend/.env`)

Copiar el archivo de ejemplo y ajustar los valores:

```bash
cp backend/.env.example backend/.env
```

| Variable | Descripción | Valor por defecto (desarrollo) |
|----------|-------------|-------------------------------|
| `DATABASE_URL` | Cadena de conexión PostgreSQL | `postgresql://fintech:fintech123@localhost:5432/financial_helper` |
| `JWT_SECRET` | Secreto para firmar access tokens | *(obligatorio, sin valor por defecto)* |
| `JWT_REFRESH_SECRET` | Secreto para firmar refresh tokens | *(obligatorio, sin valor por defecto)* |
| `JWT_EXPIRES_IN` | Duración del access token | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Duración del refresh token | `7d` |
| `PORT` | Puerto del servidor NestJS | `3001` |
| `NODE_ENV` | Entorno de ejecución | `development` |
| `BCRYPT_ROUNDS` | Rondas de hashing de contraseñas | `12` |

> **Importante**: `JWT_SECRET` y `JWT_REFRESH_SECRET` deben ser cadenas aleatorias de al menos 64 caracteres. Nunca usar los mismos valores entre entornos.

Generar secretos seguros:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Frontend (`frontend/.env.local`)

```bash
cp frontend/.env.example frontend/.env.local
```

| Variable | Descripción | Valor por defecto (desarrollo) |
|----------|-------------|-------------------------------|
| `NEXT_PUBLIC_API_URL` | URL base del backend | `http://localhost:3001` |

---

## Inicio rápido

### Opción A — Docker Compose (recomendado)

Un solo comando levanta PostgreSQL, el backend y el frontend:

```bash
docker compose up --build
```

La primera ejecución descarga las imágenes base, instala dependencias y ejecuta las migraciones de base de datos automáticamente.

| Servicio | URL |
|---------|-----|
| Frontend | http://localhost:4321 |
| Backend API | http://localhost:8080 |
| PostgreSQL | localhost:5432 |

> **Nota**: Los puertos 3000 y 3001 están reservados por Hyper-V/WSL en Windows (rango excluido 2970–3169). Se usan 8080 y 4321 para evitar conflictos en entornos locales Windows.

Para detener todos los servicios:

```bash
docker compose down
```

Para detener y eliminar los volúmenes (base de datos):

```bash
docker compose down -v
```

### Opción B — Desarrollo local sin Docker

Requiere una instancia de PostgreSQL corriendo localmente.

```bash
# 1. Clonar e instalar dependencias
git clone <repo-url>
cd finantial-helper

# 2. Instalar dependencias del backend
cd backend
bun install
bunx prisma migrate dev
bun run prisma:seed    # crea usuario de prueba

# 3. En otra terminal, instalar dependencias del frontend
cd frontend
bun install

# 4. Levantar ambos servicios
# Terminal 1 (backend):
cd backend && bun run start:dev

# Terminal 2 (frontend):
cd frontend && bun run dev
```

---

## Credenciales por defecto

El script de seed crea un usuario de prueba para facilitar la evaluación:

| Campo | Valor |
|-------|-------|
| Email | `admin@financial.dev` |
| Contraseña | `Admin1234!` |

> Las contraseñas de usuarios reales en producción nunca tienen valores por defecto. Este usuario solo existe en entornos de desarrollo (`NODE_ENV=development`).

---

## Módulos funcionales

### Módulo 1 — Autenticación

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/auth/register` | POST | Registro con email y contraseña |
| `/auth/login` | POST | Inicio de sesión, retorna tokens |
| `/auth/refresh` | POST | Renovar access token con refresh token |
| `/auth/logout` | POST | Invalidar refresh token |

La contraseña se hashea con bcrypt (12 rondas) antes de persistir. El refresh token se almacena hasheado en base de datos para invalidarlo en logout.

### Módulo 2 — Movimientos financieros

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/movements` | GET | Listar con paginación, filtros y ordenamiento |
| `/movements/:id` | GET | Detalle de un movimiento |
| `/movements` | POST | Crear movimiento |
| `/movements/:id` | PATCH | Editar movimiento |
| `/movements/:id` | DELETE | Eliminar movimiento |
| `/movements/summary` | GET | Balance actual (ingresos - egresos) |

Parámetros de filtrado disponibles en `GET /movements`:
- `type`: `income` | `expense`
- `categoryId`: UUID de la categoría
- `dateFrom` / `dateTo`: rango de fechas (ISO 8601)
- `page` / `limit`: paginación
- `sortBy`: `date` | `amount` (default: `date`)
- `order`: `asc` | `desc` (default: `desc`)

### Módulo 3 — Categorías y presupuestos

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/categories` | GET | Listar categorías del usuario |
| `/categories` | POST | Crear categoría |
| `/categories/:id` | PATCH | Editar categoría |
| `/categories/:id` | DELETE | Eliminar categoría |
| `/budgets` | GET | Estado de presupuestos del mes actual |
| `/budgets/:categoryId` | PUT | Asignar/actualizar presupuesto mensual |

La respuesta de `POST /movements` incluye un campo `budgetAlert` cuando el gasto acumulado en la categoría supera el 80% o el 100% del presupuesto mensual:

```json
{
  "movement": { "...": "..." },
  "budgetAlert": {
    "categoryId": "uuid",
    "categoryName": "Alimentación",
    "budgetAmount": 500000,
    "spentAmount": 420000,
    "percentage": 84,
    "level": "warning"
  }
}
```

`level` puede ser `"warning"` (≥80%) o `"exceeded"` (≥100%).

---

## Tests

```bash
# Tests unitarios
cd backend && bun run test

# Tests con cobertura
cd backend && bun run test:cov

# Tests e2e (requiere base de datos de test)
cd backend && bun run test:e2e
```

La cobertura mínima aceptada por el pipeline es **80%** en líneas y ramas. Los tests e2e usan una base de datos PostgreSQL separada (`financial_helper_test`) que se crea y destruye en cada ejecución.

---

## CI/CD y calidad de código

El pipeline de GitHub Actions se ejecuta en cada push a `main` y en cada pull request:

```
push / PR
    │
    ├── job: lint
    │       ESLint + Prettier check
    │
    ├── job: test
    │       Unit tests + cobertura
    │       E2E tests contra PostgreSQL (service container)
    │
    └── job: quality
            SonarCloud analysis
            Bloquea si cobertura < 80% o hay issues críticos de seguridad
```

El análisis de SonarCloud está configurado para detectar:
- Hardcoded credentials
- SQL injection patterns
- Dependencias con vulnerabilidades conocidas (CVE)
- Código duplicado superior al 3%
- Complejidad ciclomática superior a 10 por función

---

## URL de despliegue

| Entorno | URL |
|---------|-----|
| Frontend (producción) | *(por definir — Vercel / Railway)* |
| Backend API (producción) | *(por definir — Railway / Render)* |

> Se actualizará con las URLs definitivas antes de la entrega.

---

## Pendientes y decisiones de ambigüedad

### Decisiones tomadas ante ambigüedades del enunciado

**¿Las categorías son globales o por usuario?**
Se decidió que cada usuario gestiona sus propias categorías. Un producto financiero personal no debe exponer las categorías de un usuario a otro. Esto implica que no hay categorías "sistema" por defecto; el seed crea categorías de muestra vinculadas al usuario de prueba.

**¿El presupuesto es mensual calendario o mensual rolling?**
Se optó por mensual calendario (enero 1–31, febrero 1–28, etc.) porque es el modelo mental más natural para un usuario personal y es más simple de calcular y auditar.

**¿Qué pasa al eliminar una categoría que tiene movimientos?**
Los movimientos existentes retienen la referencia a la categoría (soft constraint). La categoría se marca como inactiva (`isActive: false`) en lugar de eliminarse físicamente, preservando la integridad del historial financiero. El usuario puede ver los movimientos pasados pero no puede asignar nuevos movimientos a una categoría inactiva.

---

## AI Usage

### Herramientas utilizadas

- **Claude Code (claude-sonnet-4-6)**: asistente principal durante el desarrollo.

### Ejemplos concretos de uso

**Ejemplo 1 — Generación del README base**

*Prompt*: "Leete el enunciado, ayudame con la documentación del proyecto. Incluye que tengo experiencia por cursos de estas tecnologías. Stack: Next.js, NestJS, PostgreSQL."

*Resultado*: Claude generó el esqueleto completo del README con secciones de justificación técnica, tabla de variables de entorno y estructura de carpetas. Se usó como punto de partida y se ajustaron los detalles de los endpoints y las decisiones de ambigüedad según el criterio propio del candidato.

**Ejemplo 2 — Estrategia de autenticación**

*Prompt*: "¿Cómo implemento la invalidación de refresh tokens en NestJS con Prisma de forma segura?"

*Resultado*: Claude propuso almacenar el hash del refresh token en la base de datos y compararlo en cada renovación. Se adoptó este enfoque porque es más robusto que una blocklist en memoria que no escala ni persiste entre reinicios del servidor.

### Sugerencia rechazada o modificada

**Sugerencia**: Claude recomendó usar `uuid` de Node.js para generar IDs en la aplicación antes de insertar en PostgreSQL.

**Decisión**: Se rechazó en favor de `gen_random_uuid()` de PostgreSQL (extensión `pgcrypto`) directamente en el schema de Prisma (`@default(uuid())`). La razón técnica es que delegar la generación de IDs a la base de datos garantiza unicidad incluso en escenarios de inserción paralela desde múltiples instancias del backend, sin necesidad de coordinación a nivel de aplicación.

### Valoración del impacto de la IA

El uso de Claude Code aceleró significativamente la fase de documentación y la toma de decisiones de arquitectura al presentar opciones comparadas con sus trade-offs. Sin embargo, cada decisión final fue revisada contra el contexto específico del producto financiero y los requerimientos del enunciado. La IA funciona mejor como acelerador de ideas que como tomador de decisiones: genera un primer borrador sólido que el desarrollador evalúa, ajusta y en ocasiones descarta con argumentos técnicos propios.
