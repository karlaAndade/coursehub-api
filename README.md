# CourseHub API

API REST construida con NestJS, TypeORM y PostgreSQL para gestionar cursos, estudiantes y matrículas. Los tres módulos guardan sus datos en la misma base de datos, así que la información sigue disponible después de reiniciar la API.

    Course 1 ---- * Enrollment * ---- 1 Student

## Requisitos

- Node.js 20 o superior
- PostgreSQL 17 (también funciona con versiones recientes)
- Una base de datos creada con el mismo nombre que pongas en `DATABASE_NAME`

## Variables de entorno

Copia `.env.example` como `.env` y completa los valores reales. El archivo `.env` está ignorado por Git y no debe publicarse.

| Variable | Descripción | Ejemplo |
|---|---|---|
| `DATABASE_HOST` | Servidor de PostgreSQL | `localhost` |
| `DATABASE_PORT` | Puerto de PostgreSQL | `5432` |
| `DATABASE_NAME` | Nombre de la base de datos | `coursehub` |
| `DATABASE_USER` | Usuario de PostgreSQL | `postgres` |
| `DATABASE_PASSWORD` | Contraseña del usuario | (tu contraseña) |
| `DATABASE_SYNCHRONIZE` | `true` crea y actualiza las tablas automáticamente | `true` |

`DATABASE_SYNCHRONIZE=true` es solo para desarrollo local. En cualquier otro entorno debe estar en `false` o ausente, y las tablas se manejarían con migraciones (fuera del alcance de esta entrega).

## Instalación y ejecución

    npm install
    npm run start:dev

La API queda disponible en `http://localhost:3000`. Con `DATABASE_SYNCHRONIZE=true`, las tablas `courses`, `students` y `enrollments` se crean solas al arrancar.

## Endpoints

### Cursos

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/courses` | Crea un curso (`level`: `beginner`, `intermediate` o `advanced`) |
| GET | `/courses` | Lista los cursos |
| GET | `/courses/:id` | Consulta un curso |
| PATCH | `/courses/:id` | Modifica un curso |
| DELETE | `/courses/:id` | Elimina un curso |

### Estudiantes

| Método | Ruta | Descripción | Códigos |
|---|---|---|---|
| POST | `/students` | Crea un estudiante | 201, 400, 409 |
| GET | `/students` | Lista con filtros opcionales `career` e `isActive` | 200, 400 |
| GET | `/students/:id` | Consulta un estudiante | 200, 400, 404 |
| PATCH | `/students/:id` | Modifica un estudiante | 200, 400, 404, 409 |
| DELETE | `/students/:id` | Elimina un estudiante y sus matrículas | 204, 400, 404 |

Campos del estudiante: `name`, `email` (único), `age`, `career`, `semester` (1 a 10) e `isActive`.

### Matrículas

| Método | Ruta | Descripción | Códigos |
|---|---|---|---|
| POST | `/enrollments` | Crea una matrícula con `studentId` y `courseId` | 201, 400, 404, 409 |
| GET | `/enrollments` | Lista matrículas, con filtros combinables `studentId` y `courseId` | 200, 400 |
| GET | `/students/:studentId/enrollments` | Matrículas de un estudiante | 200, 400, 404 |
| GET | `/courses/:courseId/enrollments` | Matrículas de un curso | 200, 400, 404 |
| DELETE | `/enrollments/:id` | Cancela una matrícula | 204, 400, 404 |

Las consultas de matrículas devuelven los datos completos de `student` y `course`.

## Reglas de negocio y códigos HTTP

| Situación | Código |
|---|---|
| El estudiante o el curso no existe | 404 Not Found |
| El estudiante está inactivo | 400 Bad Request |
| La matrícula ya existe para esa pareja estudiante-curso | 409 Conflict |
| El correo ya pertenece a otro estudiante (al crear o actualizar) | 409 Conflict |
| Cuerpo, parámetro o filtro inválido | 400 Bad Request |
| La matrícula a cancelar no existe | 404 Not Found |

El orden de las comprobaciones al matricular es: existe el estudiante, existe el curso, el estudiante está activo y no hay una matrícula previa.

## Integridad en la base de datos

Además de las reglas del servicio, PostgreSQL las refuerza:

- `students.email` tiene una restricción `UNIQUE`.
- `enrollments` tiene claves foráneas hacia `students` y `courses`, generadas por las relaciones de TypeORM.
- `enrollments` tiene una restricción `UNIQUE` sobre la pareja `studentId` y `courseId`.

Si PostgreSQL rechaza un duplicado, el servicio lo traduce a 409 en lugar de devolver un error 500.

## Fecha de matrícula

Cada matrícula guarda `createdAt`, y el listado se devuelve ordenado de la más reciente a la más antigua. La fecha la genera el servidor al crear el registro (`@CreateDateColumn`) y no se acepta como dato del cliente. Si el cliente la enviara, podría falsificar el momento de una inscripción o alterar el orden del historial. El `ValidationPipe` rechaza con 400 cualquier campo que no esté declarado en el DTO.

## Validación global

`main.ts` activa un `ValidationPipe` global con `whitelist`, `forbidNonWhitelisted` y `transform`. Los identificadores de ruta (`:id`, `:studentId`, `:courseId`) pasan por `ParseIntPipe`, y los filtros de matrículas se validan con `QueryEnrollmentsDto`.

## Demostración

El script `demo-semana5.ps1` ejecuta los siete casos de la práctica y cinco pruebas adicionales del contrato HTTP. Guarda todo en `evidencia-semana5.txt`, que incluye las respuestas reales de cada caso y la verificación de las restricciones directamente en PostgreSQL.

    powershell -ExecutionPolicy Bypass -File .\demo-semana5.ps1

Con la API corriendo en otra terminal, el script se detiene en el caso 3 para que reinicies la API y confirmes que los datos siguen ahí.

1. Crear un curso y un estudiante activo.
2. Crear una matrícula válida.
3. Reiniciar la API y consultar la misma matrícula.
4. Matrícula duplicada: responde 409.
5. Estudiante inactivo: responde 400.
6. Filtrar matrículas por estudiante y por curso.
7. Cancelar la matrícula y comprobar que ya no se encuentra.
