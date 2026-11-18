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
| `CORS_ORIGINS` | Orígenes web permitidos, separados por coma y sin rutas | `http://localhost:3000,http://localhost:5173` |

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

### Roles y propiedad de cursos

Las cuentas nuevas reciben el rol `student`. Para las cuentas de práctica, registra tres usuarios con contraseñas desechables locales y luego asigna sus roles directamente en la base de desarrollo:

```sql
UPDATE users SET role = 'admin' WHERE email = 'admin@example.test';
UPDATE users SET role = 'teacher' WHERE email = 'teacher@example.test';
UPDATE users SET role = 'student' WHERE email = 'student@example.test';
```

Inicia sesión nuevamente después de cambiar roles. El JWT identifica al usuario; la API obtiene el rol vigente de la base de datos en cada solicitud autenticada. `GET /auth/me` permite comprobar la identidad y el rol. No guardes contraseñas ni tokens reales en scripts o evidencia.

| Acción | Admin | Docente propietario | Docente ajeno | Estudiante | Sin token |
|---|---:|---:|---:|---:|---:|
| `POST /courses` | 201 | 201 | 201 | 403 | 401 |
| `PATCH /courses/:id` | 200 | 200 | 403 | 403 | 401 |
| `DELETE /courses/:id` | 200 | 403 | 403 | 403 | 401 |

`DELETE /courses/:id` es la ruta exclusiva de administración: requiere un JWT válido y el rol `admin`. Para la demostración de propiedad, usa siempre `PATCH /courses/4` con el mismo cuerpo `{"title":"Updated course"}` y realiza estos cinco casos:

| Caso | Token | Resultado | Motivo |
|---|---|---|---|
| Sin token | Ninguno | `401 Unauthorized` | La solicitud no tiene una identidad autenticada. |
| Estudiante | JWT válido de `student` | `403 Forbidden` | Está autenticado, pero su rol no puede modificar cursos. |
| Docente ajeno | JWT válido de un docente distinto al creador | `403 Forbidden` | Tiene rol de docente, pero el curso pertenece a otra persona. |
| Docente propietario | JWT válido del docente creador | `200 OK` | Tiene el rol permitido y es propietario del curso. |
| Administrador | JWT válido de `admin` | `200 OK` | El administrador puede modificar cursos sin ser su propietario. |

Para obtener un caso de propiedad claro, inicia sesión como docente, crea el curso con `POST /courses` y conserva su `id`; usa ese ID en los cinco `PATCH`. El propietario se establece desde la identidad autenticada al crear el curso, no desde el cuerpo enviado por el cliente.

Al crear un curso, el servidor guarda al usuario autenticado como propietario; el cuerpo no acepta ni decide el identificador de propietario. Los cursos anteriores a esta regla pueden quedar sin propietario y solo el administrador podrá modificarlos o eliminarlos. `401` significa que no hay una identidad válida y `403` que la identidad autenticada no tiene permiso.

La identidad autenticada contiene `id`, `email` y `role`. El rol aplica la política general y `createdByUserId` del curso permite comprobar propiedad en el servicio. Los cambios de esquema deben desplegarse mediante migraciones en producción; `DATABASE_SYNCHRONIZE` es solo para desarrollo local.

### Controles para una API pública

- **CORS:** `CORS_ORIGINS` limita los orígenes que el navegador puede usar para leer respuestas. El valor local inicial permite `http://localhost:3000` y `http://localhost:5173`; ajústalo a los orígenes exactos de tu frontend. No uses `*`. CORS no autentica ni bloquea solicitudes de Thunder Client, `curl` o servidores.
- **Rate limit:** la API permite 20 solicitudes por minuto por cliente de red, y `POST /auth/login` permite 5 por minuto. El sexto intento de inicio de sesión dentro de la ventana responde `429 Too Many Requests`, con un mensaje genérico que no revela correo ni contraseña. El contador predeterminado vive en memoria del proceso; en producción con varias instancias usa un almacenamiento compartido o limita en el proxy/API gateway, configurando de forma segura la IP de cliente detrás del proxy.
- **HTTPS/TLS:** fuera de `localhost`, publica la API solo por HTTPS. Configura TLS en el proxy, balanceador o plataforma de despliegue; no transmitas tokens por HTTP. CORS no cifra el tráfico.

Para comprobar CORS desde un navegador, haz una solicitud `fetch` desde un frontend servido en uno de los orígenes permitidos y repite desde un origen que no esté en `CORS_ORIGINS`: el navegador solo permitirá leer la respuesta del origen autorizado. Thunder Client puede probar la ruta y los límites, pero no aplica las restricciones CORS del navegador. Seis solicitudes seguidas a `POST /auth/login` con el mismo cliente deben dar cinco respuestas `200` y luego `429`; espera un minuto antes de repetir. Las rutas que requieren JWT siguen respondiendo `401` sin un token válido incluso desde un origen permitido.

### Componentes transversales y arquitectura de cursos

Las solicitudes pasan por un middleware de registro que asigna `x-request-id` y registra método, ruta sin query string, código HTTP y duración. No registra cuerpos, contraseñas ni tokens. El filtro global convierte errores HTTP y errores de dominio a la forma `{ "statusCode", "error", "message", "timestamp", "path" }`; los errores inesperados responden con un mensaje genérico, mientras los detalles técnicos quedan solo en el log del servidor. El `ValidationPipe` global conserva la validación y transformación de DTOs.

El módulo de cursos está organizado por responsabilidad:

```text
HTTP controller -> CoursesUseCases -> CourseRepository (port) <- TypeOrmCourseRepository -> TypeORM/PostgreSQL
```

El controlador traduce HTTP a entradas del caso de uso; los casos de uso aplican propiedad y reglas de negocio sin depender de HTTP ni TypeORM; el puerto describe las operaciones necesarias; el adaptador implementa ese puerto y traduce errores de persistencia a errores de dominio. Las pruebas de casos de uso usan un repositorio falso, y las pruebas HTTP comprueban guards, filtro y middleware sin conectarse a PostgreSQL.

### Estudiantes

| Método | Ruta | Descripción | Códigos |
|---|---|---|---|
| POST | `/students` | Crea un estudiante | 201, 400, 409 |
| GET | `/students` | Lista con filtros opcionales y combinables `career`, `semester` e `isActive` | 200, 400 |
| GET | `/students/:id` | Consulta un estudiante | 200, 400, 404 |
| PATCH | `/students/:id` | Modifica un estudiante | 200, 400, 404, 409 |
| DELETE | `/students/:id` | Elimina un estudiante activo y sus matrículas (un estudiante inactivo no se puede eliminar: 400) | 204, 400, 404 |

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
