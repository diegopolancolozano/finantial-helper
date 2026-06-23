# Financial Helper

Módulo de gestión de movimientos financieros personales desarrollado como prueba técnica para una fintech colombiana. El producto está orientado a un contexto MVP real: código listo para revisión de pares, análisis de calidad automatizado y despliegue continuo en la nube.

**Repositorio**: https://github.com/diegopolancolozano/finantial-helper  
**Última ejecución exitosa del pipeline CI/CD**: https://github.com/diegopolancolozano/finantial-helper/actions/runs/28000739023/job/82872515144

## Aplicación desplegada

| Servicio | URL |
|---------|-----|
| **Frontend** | https://financial-helper-frontend-agzh5otcaq-uc.a.run.app |
| **Backend API** | https://financial-helper-backend-agzh5otcaq-uc.a.run.app/api |

> El step **Print deployment URLs** al final del job `Deploy` imprime ambas URLs en el log de GitHub Actions. Para desplegar desde cero: `bash scripts/setup.sh` → push a `main` activa el pipeline automáticamente, o `bash scripts/deploy.sh` para deploy manual. Ver sección [Despliegue en GCP](#despliegue-en-gcp-cloud-run).

## Tabla de contenidos

- [Stack y justificación de decisiones](#stack-y-justificación-de-decisiones)
- [Arquitectura](#arquitectura)
- [Requisitos previos](#requisitos-previos)
- [Variables de entorno](#variables-de-entorno)
- [Ejecución local](#ejecución-local)
- [Tests](#tests)
- [CI/CD](#cicd)
- [Despliegue en GCP (Cloud Run)](#despliegue-en-gcp-cloud-run)
- [Módulos funcionales y decisiones de diseño](#módulos-funcionales-y-decisiones-de-diseño)
- [AI Usage](#ai-usage)

---

## Stack y justificación de decisiones

Las decisiones de stack se tomaron considerando tres factores: **seguridad**, **mantenibilidad** y **velocidad de entrega** en un contexto financiero.

### Backend — NestJS + TypeScript

NestJS impone una arquitectura modular basada en principios SOLID desde el inicio: módulos, controladores, servicios e inyección de dependencias están separados por diseño, no por convención. Esto es especialmente valioso en una fintech donde los dominios (autenticación, movimientos, presupuestos) deben estar aislados para facilitar auditorías.

El sistema de **guards** y **decoradores** permite implementar autenticación de forma declarativa (`@UseGuards(JwtAuthGuard)`), reduciendo la probabilidad de olvidar proteger un endpoint. En un producto financiero, un endpoint desprotegido por descuido es un riesgo crítico.

El candidato cuenta con experiencia práctica en NestJS adquirida a través de cursos especializados.

### Frontend — Next.js 15 + TypeScript

Next.js permite colocar la lógica de presentación en el mismo repositorio con una experiencia de desarrollo cohesiva. El **App Router** de Next.js 15 y el patrón de **route groups** (`(auth)`, `(app)`) permiten separar las rutas protegidas de las públicas a nivel de sistema de archivos, sin necesidad de lógica adicional de enrutamiento.

El frontend actúa como un cliente puro: todas las llamadas van a `/api/*` localmente, que Next.js proxea al backend mediante `rewrites` en `next.config.ts`. Esto evita problemas de CORS en desarrollo y permite cambiar la URL del backend sin modificar el código cliente.

El candidato tiene experiencia con Next.js a través de formación en cursos.

### Base de datos — PostgreSQL 16

PostgreSQL es la opción técnicamente correcta para datos financieros por las siguientes razones:

- **ACID completo**: atomicidad, consistencia, aislamiento y durabilidad garantizados. En operaciones que involucran múltiples escrituras (movimiento + verificación de presupuesto), o todo se persiste o nada se persiste.
- **Integridad referencial**: las foreign keys con `ON DELETE RESTRICT` previenen huérfanos en datos financieros (un movimiento sin usuario válido, una categoría sin dueño).
- **Tipos de dato precisos**: `DECIMAL(15,2)` para montos financieros evita los errores de redondeo de punto flotante que son inaceptables en contextos de dinero.
- **Consultas complejas**: filtros por rango de fechas, agrupaciones por categoría y cálculos de balance se expresan naturalmente en SQL con índices compuestos.

MongoDB no se consideró porque su modelo de consistencia eventual introduce riesgos inaceptables para un producto financiero.

### ORM — Prisma

Prisma genera tipos TypeScript directamente del esquema, haciendo imposible escribir una query que acceda a un campo inexistente. Las migraciones son versionadas y reproducibles, fundamental para el pipeline CI/CD que reconstruye la base de datos desde cero en cada ejecución de tests E2E.

**Decisión sobre tipos decimales**: Prisma mapea `Decimal @db.Decimal(15,2)` al tipo `Decimal` de `@prisma/client/runtime/library`, no a `number`. Esto obliga a hacer la conversión explícita (`Number(amount)`) al serializar, lo que previene pérdida de precisión silenciosa.

### Package manager — Bun 1.2

Bun se eligió sobre npm/pnpm por su velocidad de instalación (3-5× más rápido) y compatibilidad con el ecosistema Node.js. Los scripts de `package.json` usan `bunx` en lugar de `npx` porque Bun no añade `node_modules/.bin` al PATH de la misma forma que npm, lo que causaba `command not found: next` en el frontend.

### Autenticación — JWT (Access + Refresh Token)

Access token de corta duración (15 min) + refresh token de larga duración (7 días) en cookie HttpOnly. Este modelo cumple el requerimiento de sesión segura:

- El access token expira rápido, limitando la ventana de exposición si es interceptado.
- La cookie `HttpOnly + SameSite=Strict` previene acceso desde JavaScript (mitigación de XSS) y ataques CSRF.
- El refresh token se almacena **hasheado con bcrypt** en la base de datos. Si la DB se filtra, los tokens quedan inutilizables. Al logout, el hash se elimina, invalidando la sesión inmediatamente.
- Mismo mensaje de error para "email no existe" y "contraseña incorrecta" (`Credenciales inválidas`) para evitar enumeración de usuarios.

### Contenedores — Docker + Docker Compose

`docker-compose.yml` levanta PostgreSQL y el backend con un solo comando. El backend declara `depends_on` con healthcheck sobre PostgreSQL para evitar race conditions al iniciar. El frontend se desarrolla localmente sin contenedor para mantener el ciclo de feedback rápido (hot reload).

### CI/CD — GitHub Actions

Pipeline con 5 jobs que garantiza calidad antes de cada deploy. Ver sección [CI/CD](#cicd).

### Cloud — GCP Cloud Run

Cloud Run se eligió sobre Compute Engine y GKE por:

- **Compute Engine (VM)**: requiere administrar el sistema operativo, parches de seguridad y docker-compose en producción. Genera costos fijos aunque no haya tráfico.
- **GKE (Kubernetes)**: overkill para un MVP de un solo servicio. La complejidad operativa (cluster, nodes, ingress, manifests) consume tiempo que no genera valor en esta etapa.
- **Cloud Run**: despliegue serverless de contenedores Docker. Escala a cero cuando no hay tráfico (costo $0 en idle), escala automáticamente ante carga, y el deploy se reduce a `gcloud run deploy`. Se integra nativamente con Cloud SQL mediante el Cloud SQL connector sin necesidad de gestionar VPCs o IPs.

---

## Arquitectura

```
finantial-helper/
├── backend/                        # NestJS API REST
│   ├── src/
│   │   ├── auth/                   # JWT, guards, estrategias Passport
│   │   │   ├── dto/                # RegisterDto, LoginDto
│   │   │   ├── strategies/         # JwtStrategy (Passport)
│   │   │   ├── auth.service.ts
│   │   │   └── auth.controller.ts
│   │   ├── users/                  # UsersService (acceso a tabla User)
│   │   ├── movements/              # CRUD de movimientos financieros
│   │   │   ├── dto/                # CreateMovementDto, FilterMovementsDto
│   │   │   ├── movements.service.ts
│   │   │   └── movements.controller.ts
│   │   ├── categories/             # Categorías con soft delete
│   │   ├── budgets/                # Presupuestos mensuales y alertas
│   │   ├── prisma/                 # PrismaService + mock para tests
│   │   └── common/                 # Guards, decoradores, filtros globales
│   ├── test/                       # Tests E2E (supertest)
│   │   ├── app.e2e-spec.ts
│   │   └── jest-e2e.json
│   ├── prisma/
│   │   └── schema.prisma           # Modelos: User, Movement, Category, Budget
│   ├── eslint.config.mjs           # ESLint 9 flat config
│   ├── .prettierrc
│   └── Dockerfile
├── frontend/                       # Next.js 15 App Router
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/             # /login, /register (rutas públicas)
│   │   │   └── (app)/              # /dashboard, /movements, /categories
│   │   └── lib/
│   │       ├── api.ts              # Cliente fetch centralizado
│   │       └── types.ts            # Tipos compartidos frontend
│   └── Dockerfile
├── scripts/
│   ├── gcp.env.example             # Plantilla de configuración GCP
│   ├── setup.sh                    # Crea recursos GCP (una sola vez)
│   ├── deploy.sh                   # Deploy manual sin push al repo
│   └── teardown.sh                 # Elimina todos los recursos GCP
├── .github/
│   └── workflows/
│       └── ci.yml                  # Pipeline CI/CD completo
├── docker-compose.yml              # Entorno de desarrollo local
└── .gitignore
```

**Principio de aislamiento de datos**: cada endpoint filtra por `userId` extraído del JWT. No existe ningún endpoint que devuelva datos de otro usuario. El `JwtAuthGuard` aplica a todos los controladores protegidos vía decorador de clase, eliminando el riesgo de olvidar proteger un método individual.

---

## Requisitos previos

| Herramienta | Versión mínima | Propósito |
|-------------|---------------|-----------|
| Bun | 1.2.x | Package manager y runner de scripts |
| Docker | 27.x | Contenedores locales |
| Docker Compose | 2.x (plugin) | Orquestación local |
| Node.js | 22.x LTS | Runtime del builder de imagen Docker |

```bash
# Verificar versiones
bun --version          # >= 1.2.0
docker --version       # >= 27.0.0
docker compose version # >= 2.0.0
```

```bash
# Instalar Bun (si no está instalado)
# Windows (PowerShell)
powershell -c "irm bun.sh/install.ps1 | iex"

# macOS / Linux
curl -fsSL https://bun.sh/install | bash
```

---

## Variables de entorno

### Backend — `backend/.env`

```bash
cp backend/.env.example backend/.env
```

| Variable | Descripción | Valor desarrollo |
|----------|-------------|-----------------|
| `DATABASE_URL` | Conexión PostgreSQL | `postgresql://fintech:fintech123@localhost:5432/financial_helper` |
| `JWT_SECRET` | Firma de access tokens | *(obligatorio)* |
| `JWT_REFRESH_SECRET` | Firma de refresh tokens | *(obligatorio)* |
| `JWT_EXPIRES_IN` | Duración access token | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Duración refresh token | `7d` |
| `PORT` | Puerto del servidor | `8080` |
| `NODE_ENV` | Entorno | `development` |
| `BCRYPT_ROUNDS` | Rondas de hash de contraseñas | `12` (4 en tests para velocidad) |
| `FRONTEND_URL` | URL del frontend para CORS | `http://localhost:4321` |

> **Nota sobre puertos**: Los puertos 3000 y 3001 están reservados por Hyper-V/WSL en Windows (rango excluido 2970–3169 en muchas configuraciones). El backend usa 8080 y el frontend 4321.

Generar secretos seguros:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Ejecución local

### Con Docker Compose (recomendado)

```bash
# Levantar PostgreSQL + backend
docker compose up --build

# En otra terminal, levantar el frontend
cd frontend && bun install && bun run dev
```

| Servicio | URL |
|---------|-----|
| Frontend | http://localhost:4321 |
| Backend API | http://localhost:8080/api |
| PostgreSQL | localhost:5432 |

```bash
# Detener servicios (conserva la base de datos)
docker compose down

# Detener y eliminar datos
docker compose down -v
```

### Sin Docker (desarrollo directo)

Requiere PostgreSQL corriendo localmente con usuario `fintech` / contraseña `fintech123` y base de datos `financial_helper`.

```bash
# Terminal 1 — Backend
cd backend
bun install
bunx prisma migrate dev   # aplica migraciones
bun run start:dev          # hot reload

# Terminal 2 — Frontend
cd frontend
bun install
bun run dev               # http://localhost:4321
```

### Usuario de prueba

El seed crea un usuario para facilitar la evaluación:

| Campo | Valor |
|-------|-------|
| Email | `admin@financial.dev` |
| Contraseña | `Admin1234!` |

```bash
cd backend && bun run prisma:seed
```

---

## Tests

### Unitarios (sin base de datos)

```bash
cd backend && bun run test
```

Los servicios se prueban con mocks de Prisma (`prisma.service.mock.ts`). No se mockean las entidades del dominio, solo la capa de persistencia.

```bash
# Con cobertura
cd backend && bun run test:cov
```

Umbral mínimo de cobertura: **80% en líneas y funciones** medido únicamente sobre los archivos `*.service.ts` con tests asociados. Los módulos, controladores, DTOs y archivos de infraestructura están excluidos del umbral porque son código de cableado, no lógica de negocio.

### Integración (servicios contra base de datos real, sin HTTP)

```bash
cd backend && bun run test:integration
```

Los tests de integración instancian los servicios reales de NestJS (`AuthService`, `CategoriesService`, `MovementsService`) a través de `@nestjs/testing` con una base de datos PostgreSQL real, pero **sin levantar el servidor HTTP**. Verifican que la lógica de negocio y las queries de Prisma funcionan correctamente en conjunto:

- `AuthService`: registro, login, duplicate email, logout (invalidación de token)
- `CategoriesService`: create, findAll, soft delete, reactivación, acceso cruzado entre usuarios
- `MovementsService`: create con budget alert, filtros por tipo y fecha, cálculo de balance

Se ubican en `backend/test/integration/` y usan el sufijo `*.integration.spec.ts`.

### E2E (stack HTTP completo contra base de datos real)

```bash
cd backend && bun run test:e2e
```

Los tests E2E usan `supertest` para ejercitar la API a través del stack HTTP completo (middleware, guards, validación de DTOs, serialización). Cubren el flujo secuencial:

1. Registro e inicio de sesión
2. Rechazo de requests sin token (401)
3. CRUD de categorías con validación de conflictos
4. Creación de movimientos y verificación de alertas de presupuesto
5. Resumen de balance (ingresos - egresos)
6. Logout e invalidación de refresh token

**Diferencia entre capas de test:**

| Tipo | Qué prueba | DB real | HTTP |
|------|-----------|---------|------|
| Unitario | Lógica de un servicio aislado | No (mock) | No |
| Integración | Servicio + Prisma + DB | Sí | No |
| E2E | Controlador + Guard + Servicio + DB | Sí | Sí |

En CI, los jobs `test-integration` y `test-e2e` levantan contenedores PostgreSQL 16 independientes y ejecutan `prisma migrate deploy` antes de los tests, garantizando entornos limpios en cada ejecución.

---

## CI/CD

El pipeline en `.github/workflows/ci.yml` se ejecuta en cada push a `main` y en cada pull request.

```
push a main / pull request
    │
    ├── lint              ESLint 9 + Prettier sobre src/ y test/
    │
    ├── test              Unit tests con cobertura (umbral 80%)
    │                     Artefacto: reporte HTML de cobertura
    │
    ├── test-integration  PostgreSQL como service container
    │                     prisma migrate deploy → tests de integración
    │                     (AuthService, CategoriesService, MovementsService)
    │
    ├── test-e2e          PostgreSQL como service container
    │                     prisma migrate deploy → 13 tests E2E HTTP
    │
    ├── build             bun run build (backend) + bun run build (frontend)
    │   needs: [lint, test, test-integration, test-e2e]
    │
    └── deploy            Solo en push a main (no en pull requests)
        needs: [build]
        │
        ├── Build y push imágenes a Artifact Registry
        ├── Deploy backend → Cloud Run (con Cloud SQL connector)
        ├── Deploy frontend → Cloud Run (con URL del backend)
        ├── Actualiza CORS del backend con URL del frontend
        └── Print deployment URLs (Frontend + Backend API)
```

### Variables y secretos de GitHub Actions requeridos

**Variables** (`Settings → Secrets and variables → Actions → Variables`):

| Variable | Ejemplo |
|----------|---------|
| `GCP_PROJECT_ID` | `mi-proyecto-123` |
| `GCP_REGION` | `us-central1` |
| `GCP_AR_REPO` | `finantial-helper` |
| `GCP_CLOUD_SQL_INSTANCE` | `mi-proyecto-123:us-central1:financial-helper-db` |

**Secrets** (`Settings → Secrets and variables → Actions → Secrets`):

| Secret | Descripción |
|--------|-------------|
| `GCP_SA_KEY` | Contenido completo del JSON de la service account (generado por `setup.sh`) |

> **Importante**: `GCP_SA_KEY` debe estar en la pestaña **Secrets**, no en Variables. Los demás valores no son sensibles y van en **Variables**.

---

## Despliegue en GCP (Cloud Run)

### Arquitectura en producción

```
Internet
    │
    ├── Cloud Run: financial-helper-frontend  (Next.js, puerto 3000)
    │       │ proxea /api/* a →
    │       └── Cloud Run: financial-helper-backend  (NestJS, puerto 8080)
    │               │ se conecta a →
    │               └── Cloud SQL: PostgreSQL 16 (via Cloud SQL connector)
    │                       Secrets: DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET
    │                       (Secret Manager)
    └── Artifact Registry: imágenes Docker (backend:sha, frontend:sha)
```

El backend se conecta a Cloud SQL mediante el **Cloud SQL connector** (flag `--add-cloudsql-instances`), que monta automáticamente un proxy Unix socket en el contenedor. La `DATABASE_URL` usa el formato `?host=/cloudsql/PROJECT:REGION:INSTANCE`, evitando exponer la base de datos a internet.

### Setup inicial (una sola vez)

```bash
# 1. Copiar y completar la configuración
cp scripts/gcp.env.example scripts/gcp.env
# Editar scripts/gcp.env con PROJECT_ID, DB_PASS, etc.

# 2. Crear todos los recursos GCP
bash scripts/setup.sh

# 3. Agregar el contenido de gcp-key.json como secreto GCP_SA_KEY en GitHub
# 4. Eliminar la clave del disco
rm gcp-key.json

# 5. Habilitar el deploy automático (ver sección CI/CD)
```

`setup.sh` crea: Artifact Registry, Cloud SQL (PostgreSQL 16 en `db-f1-micro`), los secrets en Secret Manager con valores generados aleatoriamente para JWT, y el Service Account con los roles mínimos necesarios.

### Deploy manual

Para desplegar sin hacer push al repo (útil para rollbacks o deploys de emergencia):

```bash
bash scripts/deploy.sh
```

El script construye ambas imágenes Docker, las sube a Artifact Registry y despliega backend y frontend en Cloud Run, resolviendo automáticamente el orden correcto (backend primero para obtener su URL, luego frontend, luego actualización de CORS).

### Teardown (eliminar todos los recursos)

```bash
bash scripts/teardown.sh
# Pide confirmación escribiendo 'si'
```

Elimina: servicios Cloud Run, instancia Cloud SQL, repositorio Artifact Registry y los secrets de Secret Manager. El Service Account se conserva por defecto (con instrucciones para eliminarlo manualmente si se requiere).

---

## Módulos funcionales y decisiones de diseño

### Módulo 1 — Autenticación

| Endpoint | Método | Auth | Descripción |
|----------|--------|------|-------------|
| `/api/auth/register` | POST | ❌ | Registro con email y contraseña |
| `/api/auth/login` | POST | ❌ | Login, retorna access token + cookie refresh |
| `/api/auth/refresh` | POST | ❌ | Renueva access token usando cookie |
| `/api/auth/logout` | POST | ✅ | Invalida refresh token en DB |

**Decisión**: el refresh token va en cookie `HttpOnly + SameSite=Strict` y el access token en el body de la respuesta (localStorage del cliente). Esta separación permite revocar sesiones desde el servidor (logout real) sin exponer el refresh token a JavaScript.

### Módulo 2 — Movimientos financieros

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `GET /api/movements` | GET | Lista paginada con filtros |
| `GET /api/movements/summary` | GET | Balance total (ingresos − egresos) |
| `GET /api/movements/:id` | GET | Detalle |
| `POST /api/movements` | POST | Crear (incluye `budgetAlert` en respuesta) |
| `PATCH /api/movements/:id` | PATCH | Editar |
| `DELETE /api/movements/:id` | DELETE | Eliminar |

Filtros disponibles en `GET /api/movements`:

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `type` | `income \| expense` | Filtrar por tipo |
| `categoryId` | UUID | Filtrar por categoría |
| `dateFrom` / `dateTo` | ISO 8601 | Rango de fechas |
| `page` / `limit` | number | Paginación (default: 1 / 10) |
| `sortBy` | `date \| amount` | Campo de ordenamiento |
| `order` | `asc \| desc` | Dirección |

**Decisión sobre `GET /movements/summary` antes de `GET /movements/:id`**: la ruta `/summary` se registra primero en el controlador para evitar que NestJS (y Express internamente) interprete la cadena `"summary"` como un UUID y falle con un error 400 en la validación del `ParseUUIDPipe`.

**Respuesta de alerta en `POST /movements`**:

```json
{
  "movement": { "id": "...", "amount": 85000, "type": "expense" },
  "budgetAlert": {
    "categoryId": "uuid",
    "categoryName": "Alimentación",
    "budgetAmount": 100000,
    "spentAmount": 85000,
    "percentage": 85,
    "level": "warning"
  }
}
```

`level: "warning"` cuando el gasto acumulado es ≥80% del presupuesto mensual. `level: "exceeded"` cuando supera el 100%. `budgetAlert: null` si no hay presupuesto configurado o si el umbral no se alcanza.

### Módulo 3 — Categorías y presupuestos

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `GET /api/categories` | GET | Lista categorías activas del usuario |
| `POST /api/categories` | POST | Crear categoría |
| `PATCH /api/categories/:id` | PATCH | Renombrar |
| `DELETE /api/categories/:id` | DELETE | Soft delete (`isActive: false`) |
| `GET /api/budgets` | GET | Estado de presupuestos (mes actual por defecto) |
| `PUT /api/budgets/:categoryId` | PUT | Crear o actualizar presupuesto mensual |

**Decisión sobre soft delete de categorías**: eliminar físicamente una categoría que tiene movimientos históricos rompería la integridad del historial financiero. Se usa `isActive: false` para "eliminar" la categoría visualmente sin perder la referencia en los movimientos pasados. Si el usuario crea una categoría con el mismo nombre que una inactiva, se reactiva en lugar de crear un duplicado.

**Decisión sobre presupuesto mensual calendario**: el presupuesto es por mes calendario (ej: junio 2026 = días 1 al 30), no rolling de 30 días. El modelo calendario es más intuitivo para el usuario final y más simple de auditar.

**Decisión sobre categorías por usuario**: cada usuario gestiona sus propias categorías. No hay categorías "sistema" globales. Esto garantiza privacidad y permite que cada usuario organice sus finanzas según su contexto personal.

### Esquema de base de datos

```
User          Movement          Category         Budget
────          ────────          ────────         ──────
id (uuid)     id (uuid)         id (uuid)        id (uuid)
email         type (enum)       name             amount (Decimal 15,2)
passwordHash  amount (15,2)     isActive         month (1–12)
refreshToken  description       userId → User    year
              date              @@unique(         userId → User
              userId → User       userId, name)  categoryId → Category
              categoryId →      @@index(userId)  @@unique(
                Category                           categoryId,
              @@index(userId,                      month, year)
                date)
              @@index(userId,
                type)
```

Los índices compuestos en `Movement` aceleran las dos consultas más frecuentes: listar movimientos de un usuario ordenados por fecha, y filtrar por tipo (ingresos vs egresos) para el cálculo del balance.

---

## AI Usage

### Herramienta

**Claude Code (claude-sonnet-4-6)** — asistente de desarrollo en todas las fases del proyecto.

### Problemas resueltos con asistencia de IA

---

**`Cannot find module '/app/dist/main'` — incompatibilidad de Bun con `tsc`**

El Dockerfile original usaba `oven/bun:1.2` en el stage `builder` y ejecutaba `nest build`. En producción el contenedor fallaba al arrancar con el error anterior. Claude diagnosticó dos causas encadenadas: primero, Bun intercepta la ejecución de binarios de Node.js y `tsc` producía output vacío o en rutas inesperadas; segundo, sin `rootDir` explícito en `tsconfig.build.json`, TypeScript infería la raíz como `.` (en lugar de `src/`) porque `prisma/seed.ts` estaba incluido implícitamente, lo que hacía que el resultado fuera `dist/src/main.js` en vez de `dist/main.js`.

*Solución adoptada*: cambiar el stage `builder` a `node:22-slim` para que `tsc` corra bajo Node.js real, agregar `"rootDir": "src"` y excluir `"prisma"` en `tsconfig.build.json`. Se añadió además una guardia en el Dockerfile: `RUN test -f dist/main.js || (echo "BUILD FAILED" && exit 1)` para detectar el problema en build time y no en runtime.

---

**`Cannot find module '@prisma/client'` / crash silencioso — incompatibilidad de binarios Prisma con Alpine**

El stage `runner` usaba `node:22-alpine`. Prisma genera binarios nativos ligados a glibc (Debian/Ubuntu); Alpine usa musl libc, que es incompatible. El contenedor arrancaba, pasaba el health check, pero crasheaba en la primera query a la base de datos sin un mensaje de error claro.

*Solución adoptada*: cambiar a `node:22-slim` (Debian slim, misma libc que `oven/bun:1.2`). Además instalar `openssl` con `apt-get` en los stages `builder` y `runner` porque el Prisma Query Engine lo requiere en runtime.

---

**`Permission denied` en Secret Manager — Cloud Run usando la SA equivocada**

El deploy funcionaba, pero todos los requests fallaban con 500. Los logs mostraban: `Permission denied on secret for Revision service account 702304288187-compute@developer.gserviceaccount.com`. Cloud Run estaba usando la Compute Engine default SA en vez de la SA de la aplicación.

*Solución adoptada*: crear una SA dedicada `cloudrun-runner` con los roles `roles/secretmanager.secretAccessor` y `roles/cloudsql.client`, y agregar `--service-account cloudrun-runner@PROJECT.iam.gserviceaccount.com` a los comandos `gcloud run deploy`. Esto también corrigió el principio de mínimo privilegio: la SA de GitHub Actions (`github-deployer`) quedó solo con `roles/run.admin` y `roles/artifactregistry.writer`, sin acceso a secretos en runtime.

---

**`P1013: empty host in DATABASE_URL` — formato incorrecto para Cloud SQL**

El `setup.sh` generaba la URL como `postgresql://user:pass@/db?host=/cloudsql/...` (host vacío). Prisma rechazaba la conexión con el error anterior. El problema es que libpq requiere un host no vacío aunque se use un socket Unix; Cloud SQL no es una excepción.

*Solución adoptada*: cambiar el formato a `postgresql://user:pass@localhost/db?host=/cloudsql/PROJECT:REGION:INSTANCE`. El valor `localhost` es un placeholder que libpq acepta; el parámetro `host=` del query string sobreescribe el host de conexión real con el path del socket Unix del Cloud SQL connector.

---

**`rewrites()` de Next.js evaluado en build time — frontend apuntando a `localhost:8080` en producción**

El frontend hacía `POST /api/auth/register` a través del proxy de Next.js y recibía 500. El backend directo respondía correctamente. La causa: `next.config.ts` usa `process.env.NEXT_PUBLIC_API_URL` en la función `rewrites()`, que Next.js evalúa al ejecutar `next build` para generar el `routes-manifest.json`. Como el Docker build en CI no tenía ese env var, la URL quedaba hardcodeada como `http://localhost:8080` en el artefacto compilado. El env var que Cloud Run inyecta en runtime llega demasiado tarde — el manifest ya está baked.

*Solución adoptada*: pasar la URL del backend como `--build-arg NEXT_PUBLIC_API_URL=<url>` al `docker build` del frontend. Esto funciona porque en el pipeline CI, el backend ya está desplegado cuando se construye el frontend, por lo que la URL definitiva está disponible.

---

**Cloud SQL en `PENDING_CREATE` — `setup.sh` sin esperar RUNNABLE**

Al interrumpir `setup.sh` durante la creación de la instancia Cloud SQL y volver a ejecutarlo, el script detectaba la instancia como "existente" (el `describe` retornaba resultado), pasaba al siguiente paso e intentaba crear la base de datos inmediatamente, recibiendo `HTTPError 400: Invalid request since instance is not running`.

*Solución adoptada*: agregar un loop de polling después del bloque de creación de instancia:

```bash
while true; do
  STATE=$(gcloud sql instances describe "$DB_INSTANCE" --format='value(state)' --quiet 2>/dev/null)
  [ "$STATE" = "RUNNABLE" ] && break
  echo "  Estado: ${STATE} — reintentando en 15s..."
  sleep 15
done
```

### Sugerencia rechazada

**Sugerencia**: usar `node:22-alpine` como imagen base de producción para reducir el tamaño de la imagen final (~50 MB menos que slim).

**Decisión**: rechazada. Alpine usa musl libc mientras que los binarios nativos de Prisma están compilados para glibc. El ahorro de tamaño no justifica el riesgo de incompatibilidad en runtime (fallo silencioso en la primera query). La imagen `node:22-slim` (Debian slim) mantiene un tamaño razonable y garantiza compatibilidad binaria con el ecosistema de Node.js en producción.

### Valoración

El mayor aporte de Claude Code en este proyecto no fue en la generación de boilerplate sino en el diagnóstico de errores de infraestructura: incompatibilidades de binarios entre runtimes, timing de evaluación de configuración en frameworks (Next.js build time vs runtime), y la interacción entre Cloud SQL connector, libpq y Prisma. Estos problemas tienen síntomas confusos (un 500 genérico, un módulo no encontrado) cuya causa raíz está varias capas por debajo de donde aparece el error. La revisión humana fue especialmente importante en las decisiones de IAM (mínimo privilegio para los service accounts) y en validar que los tests de integración realmente probaran la lógica de negocio y no simplemente que Prisma puede conectarse.
