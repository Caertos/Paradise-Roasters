# Parte 2: Variables de Entorno y Base de Datos

## 1. Introducción

En la [Parte 1](01-fundamentos-setup-arquitectura.md) sentamos las bases del proyecto: instalamos Laravel 11, definimos la estructura de directorios (`App\Services\AuthService`, controllers single-action en `App\Http\Controllers\Auth\`, FormRequests en `App\Http\Requests\Auth\`, middleware JWT en `App\Http\Middleware\`), y establecimos las convenciones de respuesta JSON y tipado estricto que gobernarán todo el desarrollo. El esqueleto está listo.

El objetivo de **esta segunda parte** es triple:

1. **Configurar todas las variables de entorno** que el sistema de autenticación necesita — desde la conexión a base de datos hasta los parámetros JWT.
2. **Conectar Laravel con MySQL 8** creando la base de datos y verificando la conexión.
3. **Diseñar y crear la tabla `users`** mediante migraciones, junto con el modelo `User`, los enums `UserRole` y `UserStatus`, y los casts necesarios.

Al terminar esta parte tendremos la capa de datos completamente preparada para que la Parte 3 pueda instalar y configurar el paquete JWT sin fricción.

---

## 2. El archivo `.env` — Teoría y Práctica

### 2.1 ¿Qué es `.env`?

El archivo `.env` es la implementación de Laravel del tercer factor de la metodología [The Twelve-Factor App](https://12factor.net/config): **almacenar la configuración en el entorno**. La premisa es simple pero poderosa: el código debe ser el mismo en desarrollo, staging y producción; lo que cambia entre entornos son los valores de configuración (credenciales de base de datos, claves secretas, URLs de API, etc.).

Laravel carga este archivo al iniciar la aplicación usando la librería [vlucas/phpdotenv](https://github.com/vlucas/phpdotenv), que parsea las líneas `CLAVE=valor` y las inyecta en las variables de entorno del proceso PHP (`$_ENV` y `getenv()`).

**¿Por qué no hardcodear credenciales en `config/database.php`?**

```
// ❌ JAMÁS hagas esto:
'mysql' => [
    'password' => 'miSuperPassword123',
],

// ✅ Esto es lo correcto:
'mysql' => [
    'password' => env('DB_PASSWORD', ''),
],
```

Si el password está hardcodeado, cada desarrollador que clone el repo ve las credenciales. Si cambian, hay que modificar el código. Si el repo es público (o se vuelve público por accidente), las credenciales quedan expuestas para siempre en el historial de Git.

### 2.2 `.env.example` vs `.env`

| Archivo | ¿Se commitea? | Propósito |
|---|---|---|
| `.env` | **NO** | Contiene valores reales (passwords, keys, secrets). Es único por entorno y por desarrollador. |
| `.env.example` | **SÍ** | Es una plantilla con todas las claves necesarias y valores de ejemplo/documentación. Sirve como referencia para que cualquier dev sepa qué variables debe definir. |

Flujo típico al clonar un proyecto:

```bash
cp .env.example .env
php artisan key:generate
# Editar .env con los valores reales de tu entorno
```

Laravel incluye `.env` en `.gitignore` por defecto. **Nunca** elimines esa línea. Si por accidente alguna vez commiteaste un `.env` con secretos reales, considera esas credenciales **comprometidas** y rótalas inmediatamente.

### 2.3 Variables de entorno vs archivos de configuración de Laravel

Laravel tiene una capa de indirección entre `.env` y el código de la aplicación: los archivos dentro de `config/`. Observa cómo funciona:

```php
// config/database.php
'mysql' => [
    'driver'      => 'mysql',
    'host'        => env('DB_HOST', '127.0.0.1'),
    'port'        => env('DB_PORT', '3306'),
    'database'    => env('DB_DATABASE', 'forge'),
    'username'    => env('DB_USERNAME', 'forge'),
    'password'    => env('DB_PASSWORD', ''),
    // ...
],
```

El helper `env('DB_HOST', '127.0.0.1')` lee de `.env` y, si la variable no existe, usa el segundo argumento como fallback. Luego, en cualquier parte del código usas `config('database.connections.mysql.host')`, **nunca** `env('DB_HOST')` directamente.

### 2.4 `php artisan config:cache` — cuándo y por qué

```bash
php artisan config:cache
```

Este comando fusiona todos los archivos de `config/` en un único archivo PHP compilado en `bootstrap/cache/config.php`. Beneficios:

- **Rendimiento**: elimina decenas de llamadas a `env()` y lecturas de archivos en cada request.
- **Atomicidad**: la configuración se carga de una sola pieza.

**Regla de oro**: después de ejecutar `config:cache`, la función `env()` **siempre retorna `null`** (porque las variables ya se leyeron y se "cachearon" en el archivo compilado). Por eso:

> **NUNCA uses `env()` fuera de los archivos de `config/`.**

Si necesitas un valor de entorno en un Service, Controller o Command, agrégalo a un archivo de configuración existente (o crea uno nuevo en `config/`) y accede vía `config('clave')`.

En desarrollo (`APP_ENV=local`) no se suele cachear la configuración porque cambia con frecuencia. En producción, se ejecuta como parte del deploy.

---

## 3. Variables de Entorno para Autenticación

### 3.1 Bloque Database

```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=paradise_roasters
DB_USERNAME=root
DB_PASSWORD=
```

| Variable | Propósito | Valor recomendado |
|---|---|---|
| `DB_CONNECTION` | Driver de base de datos. Laravel soporta `mysql`, `pgsql`, `sqlite`, `sqlsrv`. | `mysql` para este proyecto |
| `DB_HOST` | Dirección del servidor MySQL. `127.0.0.1` si está en la misma máquina. En producción suele ser una IP privada o un nombre de host del proveedor de cloud. | `127.0.0.1` (dev), IP/hostname (prod) |
| `DB_PORT` | Puerto de MySQL. El estándar es `3306`. | `3306` |
| `DB_DATABASE` | Nombre de la base de datos. Usar snake_case, sin espacios ni caracteres especiales. | `paradise_roasters` o el nombre de tu app |
| `DB_USERNAME` | Usuario de conexión. En desarrollo suele ser `root` por simplicidad. | `root` (dev), usuario dedicado (prod) |
| `DB_PASSWORD` | Contraseña del usuario. En blanco solo si usas root sin password en dev local. En producción: contraseña fuerte, almacenada en un gestor de secretos. | (vacío en dev local), valor seguro en prod |

**¿Por qué MySQL y no SQLite/PostgreSQL?**

- **SQLite** es excelente para pruebas y desarrollo ligero, pero no soporta concurrencia real de escritura — dos requests simultáneos que intenten registrar usuarios pueden bloquearse mutuamente. Para producción con múltiples usuarios, necesitas un motor cliente-servidor.
- **PostgreSQL** es una alternativa perfectamente válida y muchos equipos la prefieren. La decisión aquí es MySQL porque es lo definido en el stack del proyecto. Laravel abstrae la diferencia — cambiar de motor más adelante es mayormente transparente si usas Eloquent y migraciones.
- **MySQL 8** trae soporte nativo de JSON, window functions, CTEs recursivas, y mejor manejo de `utf8mb4` que su predecesor. Es la versión mínima recomendada.

#### Charset y Collation

En `config/database.php`, Laravel ya configura:

```php
'charset'   => 'utf8mb4',
'collation' => 'utf8mb4_unicode_ci',
```

| Término | Significado |
|---|---|
| **utf8mb4** | La implementación **completa** de UTF-8 en MySQL. El `utf8` simple de MySQL (utf8mb3) solo soporta el Basic Multilingual Plane (3 bytes por carácter), dejando fuera emojis (😀, 🚀) y caracteres de escrituras asiáticas extendidas. `utf8mb4` usa hasta 4 bytes por carácter y cubre TODO el estándar Unicode. |
| **utf8mb4_unicode_ci** | Collation que define cómo se comparan y ordenan los strings. El sufijo `_ci` significa **case-insensitive**: `'usuario@email.com'` = `'USUARIO@EMAIL.COM'` para búsquedas y constraints UNIQUE. La variante `unicode` usa el algoritmo de comparación oficial de Unicode; `general` es más rápido pero menos preciso en ordenamiento multilingüe. |

**Para autenticación esto es crítico**: el índice UNIQUE sobre `email` con collation case-insensitive evita que alguien registre `Usuario@Email.com` y `usuario@email.com` como cuentas diferentes.

### 3.2 Bloque JWT

```env
JWT_SECRET=
JWT_TTL=15
JWT_REFRESH_TTL=10080
```

| Variable | Significado | Valor recomendado |
|---|---|---|
| `JWT_SECRET` | Clave criptográfica usada para firmar los tokens con HMAC-SHA256. **Es el equivalente JWT de `APP_KEY`**. Si se filtra, cualquiera puede forjar tokens y suplantar usuarios. | Debe ser un string aleatorio largo (al menos 256 bits/32 bytes). El comando `php artisan jwt:secret` lo genera automáticamente. **Nunca** lo escribas a mano ni uses palabras de diccionario. |
| `JWT_TTL` | **Time To Live** del access token, en **minutos**. Pasado este tiempo, el token expira y debe renovarse con un refresh token. | `15` minutos. Es el balance estándar entre seguridad (ventana de exposición corta si un token se filtra) y usabilidad (no estar renovando cada 30 segundos). Para SPAs y mobile apps es común usar 15-60 minutos. |
| `JWT_REFRESH_TTL` | Tiempo de vida del refresh token, en **minutos**. El refresh token es un token de larga duración que permite obtener nuevos access tokens sin pedir credenciales de nuevo. | `10080` (7 días). Suficiente para que un usuario no tenga que loguearse cada día, pero acotado para que sesiones abandonadas no persistan indefinidamente. |

**¿Por qué access token de corta duración + refresh token de larga duración?**

Este patrón de dos tokens minimiza el riesgo: si un access token se filtra (ej: queda en logs del frontend, se intercepta en una red), solo es válido por 15 minutos. El refresh token, que vive más tiempo, idealmente **nunca** sale del servidor o se almacena de forma más segura (httpOnly cookie). En la Parte 5 implementaremos la rotación de refresh tokens para mayor seguridad.

En la Parte 3 generaremos `JWT_SECRET` con:

```bash
php artisan jwt:secret
```

Este comando añade automáticamente la clave al archivo `.env`:

```
JWT_SECRET=base64:g7XpL9mNqR...restoDelHash
```

### 3.3 Bloque App

```env
APP_NAME="Paradise Roasters"
APP_ENV=local
APP_DEBUG=true
APP_URL=http://localhost:8000
```

| Variable | Relevancia para autenticación |
|---|---|
| `APP_NAME` | Se usa en notificaciones y correos (ej: "Paradise Roasters - Restablecer contraseña"). No es crítico para el flujo de login, pero aparece en respuestas de email si implementas verificación o reseteo. |
| `APP_ENV` | `local` para desarrollo, `production` para producción. Afecta `APP_DEBUG` y el nivel de detalle en errores. En producción, los errores de autenticación nunca deben exponer stack traces ni detalles de infraestructura. |
| `APP_DEBUG` | `true` en desarrollo (ver errores detallados en Postman/Insomnia), `false` en producción. Si `APP_DEBUG=true` en producción, un 500 de login podría mostrar consultas SQL, paths del servidor, y credenciales en los mensajes de error — **catastrófico** para seguridad. |
| `APP_URL` | URL base de la aplicación. Si implementaras email verification o password reset, Laravel usaría `APP_URL` para generar los links de verificación. Para una API pura sin frontend server-rendered, no es tan crítico, pero es buena práctica tenerlo bien definido. |

### 3.4 Variables adicionales de seguridad

```env
SESSION_DRIVER=file
CORS_ALLOWED_ORIGINS=http://localhost:3000
```

| Variable | Explicación |
|---|---|
| `SESSION_DRIVER` | Laravel por defecto inicia sesiones incluso en APIs. Con JWT **no dependemos de sesiones** — el estado de autenticación viaja en el token, no en una cookie de sesión en el servidor. Dejamos `file` como valor explícito para documentar la decisión, pero en producción puedes configurarlo como `array` (en memoria) o `null` para que Laravel no toque el storage de sesiones. La arquitectura es **stateless**. |
| `CORS_ALLOWED_ORIGINS` | Si tu frontend Vue/React/Next.js corre en `localhost:3000`, necesitas permitir ese origen en las respuestas CORS. Laravel 11 usa el middleware `HandleCors` y el archivo `config/cors.php`. Sin esta configuración, el navegador bloqueará las peticiones de login desde el frontend. En producción, aquí irá la URL real de tu SPA. |

---

## 4. Configuración de MySQL

### 4.1 Crear la base de datos

Conéctate a MySQL (como root o con un usuario administrador) y ejecuta:

```sql
CREATE DATABASE paradise_roasters
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;
```

Puedes verificarla con:

```sql
SHOW CREATE DATABASE paradise_roasters;
```

El resultado debe mostrar `CHARACTER SET utf8mb4` y `COLLATE utf8mb4_unicode_ci`.

**¿Por qué definir charset y collation a nivel de base de datos?**

Es una defensa en profundidad: aunque Laravel lo especifique en la conexión, definir el default de la base de datos evita que futuras herramientas de administración, backups restaurados a mano, o migraciones ejecutadas desde otro cliente creen objetos con el charset incorrecto (`latin1`, que es el default de MySQL y **no** soporta caracteres como `ñ`, `é`, o emojis).

### 4.2 Crear un usuario dedicado (buena práctica)

En desarrollo local con `root` sin password es aceptable, pero **en producción nunca uses root**. Crea un usuario específico con permisos acotados a la base de datos de la aplicación:

```sql
CREATE USER 'pr_app'@'localhost' IDENTIFIED BY 'unaContraseñaMuyFuerte123!';
GRANT ALL PRIVILEGES ON paradise_roasters.* TO 'pr_app'@'localhost';
FLUSH PRIVILEGES;
```

| Buenas prácticas para el password en producción |
|---|
| Mínimo 16 caracteres, con mayúsculas, minúsculas, números y símbolos |
| Almacenarlo en un gestor de secretos (HashiCorp Vault, AWS Secrets Manager, Doppler, etc.), no en `.env` directamente si el equipo es grande |
| Rotarlo periódicamente (cada 90 días como mínimo) |
| **No** usar el mismo password que `APP_KEY` o `JWT_SECRET` |

Luego, actualiza `.env` con este usuario:

```env
DB_USERNAME=pr_app
DB_PASSWORD=unaContraseñaMuyFuerte123!
```

### 4.3 Probar la conexión

Sin migraciones todavía, podemos verificar que Laravel llega a MySQL:

```bash
php artisan migrate:status
```

Deberías ver un error similar a:

```
Migration table not found.
```

Esto **confirma** que la conexión funciona — Laravel se conectó a MySQL, buscó la tabla `migrations`, no la encontró, y te lo dijo claramente. La crearemos en la sección 8 al ejecutar `php artisan migrate`.

Si en cambio ves `SQLSTATE[HY000] [1045] Access denied` o `SQLSTATE[HY000] [2002] Connection refused`, revisa credenciales, host y puerto en tu `.env`.

---

## 5. La Migración de Users — Diseño de la Tabla

### 5.1 Crear la migración

```bash
php artisan make:migration create_users_table
```

Laravel detecta el nombre `create_users_table` y genera el esqueleto con `Schema::create('users', ...)` automáticamente. Sobrescribe el contenido del archivo generado en `database/migrations/` con el siguiente código completo:

```php
<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->string('role')->default('user');
            $table->string('status')->default('active');
            $table->rememberToken();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
```

### 5.2 Análisis columna por columna

#### `$table->id()`

Equivalente a `$table->bigIncrements('id')`. Genera:

```sql
`id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY
```

- **`BIGINT`** (8 bytes, rango ≈ 9.2 × 10¹⁸) en vez de `INT` (4 bytes, rango ≈ 2.1 × 10⁹). ¿Por qué? Una aplicación con millones de usuarios alcanzaría el límite de `INT` más rápido de lo que parece. El costo de almacenamiento extra (4 bytes por fila) es insignificante comparado con el costo de migrar una tabla de `INT` a `BIGINT` en producción con millones de registros. Es **escalabilidad preventiva**.
- **`UNSIGNED`**: los IDs no deberían ser negativos. Duplica el rango positivo disponible.
- **`AUTO_INCREMENT`**: MySQL asigna el siguiente valor secuencial automáticamente.

#### `$table->string('name')`

Genera `VARCHAR(255) NOT NULL`.

- `255` es el default de Laravel para `string()`. Es más que suficiente para nombres reales (el nombre más largo registrado tiene ~200 caracteres; un VARCHAR(255) cubre cualquier caso práctico).
- **Validación de longitud mínima**: MySQL no la impone. La responsabilidad de rechazar un nombre vacío o de 1 carácter está en la capa de validación (`RegisterRequest` en la Parte 4), no en la base de datos. La DB debe ser flexible; la aplicación, estricta.
- **NOT NULL**: un usuario sin nombre no tiene sentido en este dominio. Si necesitaras registro solo con email, usarías `nullable()`.

#### `$table->string('email')->unique()`

Genera:

```sql
`email` VARCHAR(255) NOT NULL,
UNIQUE KEY `users_email_unique` (`email`)
```

- **`UNIQUE`**: a nivel de base de datos, **garantiza** que no puedan existir dos filas con el mismo email, incluso si dos requests llegan simultáneamente. El índice UNIQUE es atómico — MySQL rechaza el segundo INSERT duplicado. Esto es defensa en profundidad: aunque el código falle, la integridad de datos está protegida en la capa más baja.
- **Índice automático**: MySQL crea implícitamente un índice B-tree sobre la columna `email` para hacer eficiente el constraint UNIQUE. Ese mismo índice acelera `SELECT ... WHERE email = ?` — que es exactamente la consulta del login. **No necesitas añadir `->index()` manualmente.**
- **Collation case-insensitive**: como MySQL usa `utf8mb4_unicode_ci`, la comparación `WHERE email = 'USUARIO@email.com'` encuentra `usuario@email.com`. Sin esto, `Usuario@Email.com` y `usuario@email.com` serían emails diferentes para la base de datos — una pesadilla de soporte.
- **¿Longitud del email?** El RFC 5321 permite hasta 254 caracteres en un email completo. `VARCHAR(255)` cubre el caso máximo.

#### `$table->timestamp('email_verified_at')->nullable()`

- **Tipo `TIMESTAMP`**: almacena fecha y hora en UTC internamente (Laravel convierte a la zona horaria de la app al leer).
- **`nullable()`**: un usuario recién registrado no tiene email verificado todavía. `NULL` significa "no verificado"; un valor no-nulo significa "verificado en fecha X".
- **No lo implementaremos en este manual**, pero la columna está lista para cuando quieras añadir verificación por email. Es más fácil incluirla ahora que añadir una migración nueva después.

#### `$table->string('password')`

Genera `VARCHAR(255) NOT NULL`.

**"¿Por qué 255 caracteres si bcrypt genera hashes de exactamente 60?"**

Buena observación. bcrypt produce strings de 60 caracteres:

```
$2y$12$LJ3m4ys3GZfnYMz8kVsKaOmxAZjFPqFq7dQ8eY0.XyK0mWXj5O1Nu
```

Pero:

| Razón | Detalle |
|---|---|
| **Argon2** | El algoritmo Argon2id (recomendado por OWASP y PHP ≥ 7.3) genera hashes de ~96 caracteres. Si en el futuro Laravel cambia el driver de hashing por defecto, nuestra tabla lo soporta sin migración. |
| **Futuros algoritmos** | No sabemos qué algoritmo será estándar en 5 años. Podría generar hashes de 120 o 200 caracteres. `VARCHAR(255)` es barato en almacenamiento y nos da margen. |
| **Convención de Laravel** | El propio Laravel usa `$table->string('password')` (255) en sus migraciones por defecto. Seguir la convención del framework evita sorpresas. |

> **NUNCA guardes contraseñas en texto plano.** Ni siquiera temporalmente, ni siquiera en logs. Laravel 11 con el cast `'password' => 'hashed'` lo maneja automáticamente (sección 6), pero si alguna vez escribes lógica manual de asignación de password, siempre usa `Hash::make()` o `bcrypt()`.

#### `$table->string('role')->default('user')`

- **Tipo `VARCHAR`** con default `'user'`. Los valores provienen del enum PHP `UserRole` (sección 7): `'admin'` y `'user'`.
- **¿Por qué no el tipo ENUM nativo de MySQL?**

  ```sql
  -- Esto es lo que NO vamos a usar:
  role ENUM('user', 'admin') NOT NULL DEFAULT 'user'
  ```

  Razones para evitarlo:

  1. **Añadir valores requiere ALTER TABLE**. Si mañana necesitas un rol `moderator`, `editor` o `super_admin`, un ENUM de MySQL te obliga a `ALTER TABLE ... MODIFY COLUMN ... ENUM('user','admin','moderator','editor','super_admin')` — una operación que en tablas grandes puede bloquear escrituras durante minutos.
  2. **El orden de los valores importa**. Si cambias el orden de los miembros del ENUM o eliminas uno del medio, MySQL reenumera los índices numéricos internos, lo que puede corromper datos silenciosamente.
  3. **Acoplamiento DB-aplicación**. La lógica de "qué roles existen y qué pueden hacer" pertenece al código PHP (Enums, Policies, Gates), no al schema de la base de datos.

  Con `VARCHAR` + validación PHP + cast de Enum en Eloquent, añadir un nuevo rol es instantáneo: agregas un case al enum PHP y listo. La base de datos no se entera.

#### `$table->string('status')->default('active')`

- Mismo razonamiento que `role`. Valores posibles (definidos en `UserStatus`, sección 7): `'active'`, `'inactive'`, `'banned'`.
- **`active`**: usuario normal, puede loguearse.
- **`inactive`**: cuenta desactivada (por el usuario o por un admin). El login debe rechazarlo con un mensaje específico.
- **`banned`**: cuenta bloqueada por violación de términos. Similar a `inactive` pero con semántica distinta (útil para auditoría y UI).

#### `$table->rememberToken()`

Genera `VARCHAR(100) NULL`. Es parte del sistema nativo de Laravel para la funcionalidad "Remember Me" en sesiones web tradicionales.

- En este manual **no lo usaremos** (es una API stateless con JWT), pero mantenerlo no cuesta nada y mantiene compatibilidad con herramientas de Laravel como `Auth::login()` si alguna vez necesitas un panel admin con sesiones.
- Si estás 100% seguro de que nunca usarás autenticación basada en sesiones, puedes eliminarlo. Personalmente recomiendo dejarlo: no ocupa espacio significativo y eliminar columnas nativas del framework puede romper paquetes de terceros que asuman su existencia.

#### `$table->timestamps()`

Genera dos columnas:

```sql
`created_at` TIMESTAMP NULL
`updated_at` TIMESTAMP NULL
```

- **`created_at`**: se establece automáticamente al insertar (`CURRENT_TIMESTAMP` por defecto en MySQL).
- **`updated_at`**: se actualiza automáticamente en cada `UPDATE` (Eloquent lo maneja).
- **Utilidad en autenticación**: saber cuándo se registró un usuario (para estadísticas, rate limiting, detección de cuentas spam creadas en lote) y cuándo fue su último cambio (último cambio de password, actualización de perfil). En la Parte 5 podríamos añadir auditoría extra, pero con `created_at` y `updated_at` ya tenemos lo mínimo indispensable.

#### `$table->softDeletes()`

Genera:

```sql
`deleted_at` TIMESTAMP NULL
```

El trait `SoftDeletes` de Eloquent convierte las operaciones `delete()` en `UPDATE deleted_at = NOW()` en vez de `DELETE FROM`. El usuario "eliminado" sigue en la base de datos, pero Eloquent lo excluye automáticamente de todas las consultas normales.

**Implicaciones para autenticación:**

| Situación | Comportamiento |
|---|---|
| Usuario activo (`deleted_at IS NULL`) | Puede loguearse normalmente. |
| Usuario con soft-delete (`deleted_at IS NOT NULL`) | `User::where('email', $email)->first()` **no** lo encuentra (Eloquent añade `WHERE deleted_at IS NULL` automáticamente). El login devuelve "credenciales inválidas". |
| Mismo email registrado de nuevo | Como el email sigue en la tabla con `deleted_at = NOW()`, el índice UNIQUE **lo bloquea**. Necesitas manejar este caso: o restauras el usuario soft-deleted, o usas un índice UNIQUE compuesto `UNIQUE(email, deleted_at)` que es el patrón correcto. |

> **Atención con índices UNIQUE + softDeletes**: MySQL no ignora valores `NULL` en índices UNIQUE (permite múltiples `NULL`). Sin embargo, si necesitas permitir que un email "eliminado" se re-registre, deberías modificar la migración para usar un índice compuesto. En este manual usaremos el índice UNIQUE simple por simplicidad — si un usuario se elimina, su email no puede reutilizarse a menos que se restaure la cuenta o se purgue físicamente.

---

## 6. El Modelo User

Crea (o sobrescribe) el archivo `app/Models/User.php` con el siguiente contenido:

```php
<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Notifications\Notifiable;
use Tymon\JWTAuth\Contracts\JWTSubject;

class User extends Authenticatable implements JWTSubject
{
    use Notifiable, SoftDeletes;

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'status',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password'          => 'hashed',
            'role'              => UserRole::class,
            'status'            => UserStatus::class,
        ];
    }

    /**
     * Get the identifier that will be stored in the subject claim of the JWT.
     *
     * @return mixed
     */
    public function getJWTIdentifier()
    {
        // Se implementará en la Parte 3
        return $this->getKey();
    }

    /**
     * Return a key value array, containing any custom claims to be added to the JWT.
     *
     * @return array
     */
    public function getJWTCustomClaims()
    {
        // Se implementará en la Parte 3
        return [];
    }
}
```

### 6.1 `extends Authenticatable`

`Illuminate\Foundation\Auth\User` (alias `Authenticatable`) extiende el Model de Eloquent añadiendo los métodos que Laravel necesita internamente para autenticación:

| Método | Propósito |
|---|---|
| `getAuthIdentifier()` | Retorna la PK del usuario (el `id`). Lo usa el guard JWT para identificar al usuario autenticado. |
| `getAuthPassword()` | Retorna el hash del password. Lo usa `Hash::check()` en el intento de login. |
| `getRememberToken()` / `setRememberToken()` | Para sesiones web tradicionales (no las usaremos). |

Al extender esta clase en vez de `Model` directamente, nuestro modelo es compatible con guards, Gates, Policies, y cualquier paquete de autenticación.

### 6.2 `implements JWTSubject`

La interfaz `Tymon\JWTAuth\Contracts\JWTSubject` requiere dos métodos:

- `getJWTIdentifier()`: qué valor poner en el claim `sub` del JWT. Típicamente, `$this->getKey()` (el `id` del usuario).
- `getJWTCustomClaims()`: array asociativo de claims personalizados que se incluirán en el payload del token. Útil para roles, permisos, o metadatos.

**La implementación actual es un placeholder** — los métodos están definidos con return values que funcionan (ver Parte 3 para la versión final), pero la lógica de claims personalizados (rol, status) la refinaremos en la Parte 3 cuando configuremos el guard JWT.

**¿Por qué declararlo ahora y no en la Parte 3?** Porque el modelo necesita esta interfaz para que el guard JWT lo reconozca como sujeto de token, y queremos que el modelo esté completo antes de instalar y configurar el paquete. Así evitamos el clásico error de "Class User does not implement JWTSubject" al primer intento de login.

### 6.3 `SoftDeletes`

El trait añade automáticamente:

- **Scope global**: `WHERE deleted_at IS NULL` en todas las consultas de Eloquent (select, update, delete).
- **Scopes locales**: `User::withTrashed()`, `User::onlyTrashed()`.
- **Métodos**: `$user->trashed()` (bool), `$user->restore()`.
- **Eventos**: `deleting` → soft-delete, `restoring` → `deleted_at = null`.

En el contexto de autenticación: un usuario soft-deleted **no** será encontrado por `User::where('email', ...)->first()` en el intento de login. Para el sistema, es como si no existiera. En la Parte 5 evaluaremos si queremos dar un mensaje específico ("esta cuenta fue eliminada") o tratarlo como credenciales inválidas genéricas (recomendado por seguridad: no revelar si una cuenta existe o no).

### 6.4 `$fillable` vs `$guarded`

```php
protected $fillable = [
    'name',
    'email',
    'password',
    'role',
    'status',
];
```

Esto es una **whitelist explícita**: solo estas columnas pueden asignarse masivamente. Cualquier intento de asignar otra columna vía `User::create($data)` o `$user->update($data)` es **silenciosamente ignorado** por Eloquent.

**La alternativa `$guarded`** (blacklist):

```php
// Si usaras $guarded, dirías "todas las columnas
// pueden asignarse masivamente excepto estas":
protected $guarded = ['id', 'created_at', 'updated_at', 'deleted_at'];
```

**¿Por qué `$fillable` es mejor?**

1. **Principio de mínimo privilegio**: solo expones lo que necesitas. Si añades una columna `is_admin` o `balance` a la tabla en el futuro, `$guarded` la expondría automáticamente a mass assignment. `$fillable` la mantiene protegida hasta que explícitamente la añadas.
2. **Documentación implícita**: leer `$fillable` te dice exactamente qué campos espera recibir un `RegisterRequest` o `UpdateProfileRequest`.
3. **Seguridad por defecto**: el día que estás cansado y olvidas actualizar `$guarded`, `$fillable` te protege. En seguridad defensiva, el default debe ser "no" a menos que explícitamente digas "sí".

### 6.5 `$hidden`

```php
protected $hidden = [
    'password',
    'remember_token',
];
```

Cuando serializas un modelo a JSON (respuesta de API, `->toArray()`, `->toJson()`), estas columnas se omiten:

```json
// ✅ Lo que el frontend recibe:
{
    "id": 1,
    "name": "Carlos",
    "email": "carlos@email.com",
    "role": "user",
    "status": "active",
    "created_at": "2025-01-15T10:30:00.000000Z",
    "updated_at": "2025-06-01T14:22:00.000000Z"
}

// ❌ Lo que NUNCA debe ver:
{
    "password": "$2y$12$LJ3m4ys3GZfnYMz8kVsKaOmxAZjFPqFq7dQ8eY0.XyK0mWXj5O1Nu",
    "remember_token": "aB3xK9..."
}
```

**Esto es crítico para seguridad**: exponer el hash del password es un desastre — aunque bcrypt sea resistente a fuerza bruta, revela información (cost factor, algoritmo) que facilita ataques dirigidos. `$hidden` es tu última línea de defensa si accidentalmente retornas `$user` en una respuesta JSON.

### 6.6 `casts()` — la magia de Laravel 11

```php
protected function casts(): array
{
    return [
        'email_verified_at' => 'datetime',
        'password'          => 'hashed',
        'role'              => UserRole::class,
        'status'            => UserStatus::class,
    ];
}
```

#### Cast `'password' => 'hashed'`

Nuevo en Laravel 10+ (mejorado en 11). Lo que hace:

```php
// Sin el cast:
$user->password = Hash::make('plaintext123');

// Con el cast 'password' => 'hashed':
$user->password = 'plaintext123'; // Se hashea automáticamente al guardar
```

**¿Qué pasa internamente?** El cast `hashed` envuelve la asignación con `Hash::make()`. Se ejecuta cuando el modelo se guarda (`save()`, `create()`, `update()`, `fill()` + `save()`). Si el password ya está hasheado (empieza con `$2y$`), no lo re-hashea — detecta que ya es un hash bcrypt válido y lo deja pasar.

Esto elimina una fuente común de bugs: olvidar `Hash::make()` al crear usuarios en seeders, factories, tests o comandos artisan.

**Nota para Laravel 10.x**: el cast `'hashed'` existe desde Laravel 10, pero la sintaxis exacta de `protected function casts(): array` (método, no propiedad) es de Laravel 11. En Laravel 10 usarías:

```php
protected $casts = [
    'password' => 'hashed',
];
```

#### Cast `UserRole::class` y `UserStatus::class`

Los Backed Enums de PHP 8.1 se integran con Eloquent automáticamente:

```php
// Al leer de la DB:
$user = User::first();
// $user->role es un objeto UserRole, no un string
if ($user->role === UserRole::Admin) { /* ... */ }

// Al escribir:
$user->role = UserRole::User;  // Se guarda como 'user' en la DB
$user->role = 'admin';         // También funciona: se convierte a UserRole::Admin

// Al comparar con strings directamente NO funciona sin cast:
// $user->role === 'admin'     // false (es UserRole::Admin, no string)
// $user->role->value === 'admin' // true
```

---

## 7. Los Enums de Usuario

### 7.1 UserRole

Crea el archivo `app/Enums/UserRole.php`:

```php
<?php

declare(strict_types=1);

namespace App\Enums;

enum UserRole: string
{
    case Admin = 'admin';
    case User  = 'user';
}
```

### 7.2 UserStatus

Crea el archivo `app/Enums/UserStatus.php`:

```php
<?php

declare(strict_types=1);

namespace App\Enums;

enum UserStatus: string
{
    case Active   = 'active';
    case Inactive = 'inactive';
    case Banned   = 'banned';
}
```

### 7.3 ¿Por qué Backed Enums (`: string`)?

Un Backed Enum asigna un valor escalar (string o int) a cada caso. Esto es necesario para serialización a base de datos:

```php
UserRole::Admin->value      // 'admin'
UserRole::from('user')      // UserRole::User
UserRole::tryFrom('super')  // null (no lanza excepción)
```

Un enum puro (`enum Suit { case Hearts; }`) no tiene `.value` ni `.from()` — solo existe como identidad en memoria PHP. No puede persistirse a una columna VARCHAR automáticamente.

### 7.4 Ventajas sobre constantes de clase

El enfoque antiguo (pre-PHP 8.1):

```php
class UserRole {
    const ADMIN = 'admin';
    const USER = 'user';
}
```

Problemas:

| Constantes de clase | Backed Enums |
|---|---|
| `UserRole::ADMIN` es un string, no un tipo. Cualquier función que reciba `string $role` acepta cualquier string. | `UserRole` es un **tipo**. Una función `assignRole(UserRole $role)` rechaza strings arbitrarios en tiempo de compilación. |
| No hay forma de iterar todos los roles posibles. | `UserRole::cases()` devuelve un array de todos los casos. Perfecto para reglas de validación. |
| No hay pattern matching exhaustivo. | `match ($role) { UserRole::Admin => ..., UserRole::User => ... }` — si olvidas un caso, PHP lanza UnhandledMatchError. |
| Sin métodos propios. | `UserRole` puede tener métodos: `canManageUsers(): bool`, `label(): string`, etc. |

---

## 8. Ejecución y Verificación

### 8.1 Ejecutar migraciones

```bash
php artisan migrate
```

Salida esperada:

```
Migrating: 2014_10_12_000000_create_users_table
Migrated:  2014_10_12_000000_create_users_table (123.45ms)
```

### 8.2 Verificar con migrate:status

```bash
php artisan migrate:status
```

Salida esperada:

```
+------+----------------------------------------------+-------+
| Ran? | Migration                                    | Batch |
+------+----------------------------------------------+-------+
| Yes  | 2014_10_12_000000_create_users_table         | 1     |
+------+----------------------------------------------+-------+
```

### 8.3 Probar con Tinker

```bash
php artisan tinker
```

Dentro de Tinker:

```php
// Crear un usuario de prueba
$user = User::create([
    'name'     => 'Carlos Prueba',
    'email'    => 'carlos@prueba.com',
    'password' => 'password123',
    'role'     => UserRole::Admin,
    'status'   => UserStatus::Active,
]);

// Verificar que el password está hasheado
echo $user->password;
// Deberías ver algo como: $2y$12$LJ3m4ys3GZfnYMz8kVsKaOmxAZjFPqFq7dQ8eY0...

// Verificar casts de enum
echo get_class($user->role);   // App\Enums\UserRole
echo $user->role->value;       // admin

echo get_class($user->status); // App\Enums\UserStatus
echo $user->status->value;     // active

// Verificar que el usuario se persiste correctamente
$found = User::where('email', 'carlos@prueba.com')->first();
echo $found->name; // Carlos Prueba
```

### 8.4 (Opcional) Crear UserFactory

Si quieres generar usuarios de prueba rápidamente, crea o modifica `database/factories/UserFactory.php`:

```php
<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;

class UserFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name'              => fake()->name(),
            'email'             => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password'          => Hash::make('password'), // Factory no usa el cast 'hashed' directamente
            'role'              => UserRole::User,
            'status'            => UserStatus::Active,
        ];
    }
}
```

Desde Tinker:

```php
User::factory()->count(5)->create();
User::count(); // 6 (los 5 nuevos + el de prueba anterior)
```

---

## 9. Seguridad en la Capa de Datos

### 9.1 SQL Injection: protección automática de Eloquent

Toda consulta a través del Query Builder de Laravel usa **prepared statements** con parámetros enlazados (bindings):

```php
// ✅ Seguro — Eloquent usa PDO prepared statements
User::where('email', $email)->first();

// El SQL que llega a MySQL es:
// SELECT * FROM users WHERE email = ? AND deleted_at IS NULL
// El valor de $email se envía como parámetro separado, no interpolado
```

El **riesgo real** está en consultas raw con interpolación manual:

```php
// ❌ PELIGROSO — SQL Injection directa
$users = DB::select("SELECT * FROM users WHERE email = '$email'");

// ❌ IGUAL DE PELIGROSO — DB::raw() no escapa por sí solo
User::whereRaw("email = '$email'")->get();
```

La forma segura de usar raw queries es con bindings nombrados o posicionales:

```php
// ✅ Seguro — bindings posicionales
User::whereRaw('email = ?', [$email])->get();

// ✅ Seguro — bindings nombrados
DB::select('SELECT * FROM users WHERE email = :email', ['email' => $email]);
```

**Regla práctica**: si ves concatenación de strings (`.`) con input de usuario dentro de `DB::raw()`, `whereRaw()`, `orderByRaw()`, o `selectRaw()`, detente. Hay una forma mejor con bindings.

### 9.2 Mass Assignment: `$fillable` como protección

Sin `$fillable`, un atacante podría enviar un campo extra en el JSON del registro:

```json
// POST /api/auth/register
{
    "name": "Atacante",
    "email": "atacante@evil.com",
    "password": "password123",
    "role": "admin"  // ← Campo malicioso
}
```

Si el modelo tuviera `$guarded = []` o no definiera `$fillable`, ese `'role' => 'admin'` se asignaría. Con nuestro `$fillable` explícito que **incluye** `'role'`, el campo se acepta pero pasa por validación del `RegisterRequest` (Parte 4) que lo rechazará. La combinación de `$fillable` + FormRequest validation es defensa en profundidad.

CVEs históricos de mass assignment en Laravel han ocurrido cuando:
- Se usaba `$guarded = []` (sin blacklist).
- Se olvidaba definir `$fillable` o `$guarded` (el default de Laravel 4 era permitir todo).
- Paquetes de terceros asignaban `Input::all()` directamente al modelo.

**Siempre define `$fillable` con la lista exacta de columnas asignables.**

### 9.3 Timing Attacks en login

Un timing attack mide el tiempo que tarda el servidor en responder para inferir información. Por ejemplo, si la comparación de passwords usa `===` de PHP:

```php
// ❌ Vulnerable a timing attack: strcmp para temprano si difiere el primer byte
if ($userInputPassword === $storedHash) { ... }
```

Laravel usa `Hash::check()`, que internamente emplea `password_verify()` de PHP (o `hash_equals()` para comparaciones genéricas). Ambas funciones son **timing-attack-safe**: comparan carácter por carácter y **siempre recorren el string completo**, sin cortocircuitar ante diferencias. El tiempo de respuesta es constante independientemente de si el hash coincide o no.

En la Parte 5 veremos cómo todo el flujo de login debe ser timing-safe: email inválido y password incorrecta deben tomar el mismo tiempo para no filtrar qué usuarios existen en la base de datos.

### 9.4 Hasheo automático con cast `'hashed'`

El cast `'password' => 'hashed'` previene el error humano más común en autenticación:

```php
// ❌ Error humano clásico: olvidar Hash::make()
$user->password = $request->password; // Guarda "password123" en texto plano
$user->save();

// ✅ Con el cast 'hashed', esto automáticamente se convierte en:
$user->password = $request->password;
// Internamente: $this->attributes['password'] = Hash::make('password123')
$user->save();
```

El cast es tu **red de seguridad** — incluso si un desarrollador nuevo o cansado olvida `Hash::make()`, el modelo lo hace automáticamente. Solo debes tener cuidado en contextos donde no se usa Eloquent (raw `DB::table('users')->insert([...])`), donde el cast no aplica.

---

## 10. Resumen y Puente a la Parte 3

### Lo construido en esta parte

| Componente | Archivo | Estado |
|---|---|---|
| Variables de entorno | `.env` | Configuradas (DB, JWT, App, seguridad) |
| Base de datos MySQL | Servidor MySQL 8 | Creada con charset `utf8mb4` |
| Tabla `users` | Migración `create_users_table` | Creada con 11 columnas, índices, soft deletes |
| Modelo `User` | `app/Models/User.php` | Extiende `Authenticatable`, `implements JWTSubject`, casts de enum y hashed password |
| Enum `UserRole` | `app/Enums/UserRole.php` | `Admin` y `User` |
| Enum `UserStatus` | `app/Enums/UserStatus.php` | `Active`, `Inactive`, `Banned` |

### Decisiones de diseño que las Partes 3-6 deben conocer

A continuación, un resumen taxativo de **todo lo que las siguientes partes del manual deben asumir como verdad establecida**. Esto incluye nombres exactos de columnas, clases, métodos, constantes, y decisiones arquitectónicas que **no deben alterarse** en las Partes 3, 4, 5 y 6.

#### Base de datos

| Elemento | Valor exacto |
|---|---|
| Nombre de la tabla | `users` |
| Columna PK | `id` (BIGINT UNSIGNED AUTO_INCREMENT) |
| Columna de email | `email` (VARCHAR(255), UNIQUE, NOT NULL) |
| Columna de password | `password` (VARCHAR(255), NOT NULL) |
| Columna de nombre | `name` (VARCHAR(255), NOT NULL) |
| Columna de rol | `role` (VARCHAR(255), NOT NULL, DEFAULT 'user') |
| Columna de estado | `status` (VARCHAR(255), NOT NULL, DEFAULT 'active') |
| Columna de soft delete | `deleted_at` (TIMESTAMP, NULLABLE) |
| Timestamps | `created_at`, `updated_at` |
| Collation | `utf8mb4_unicode_ci` (case-insensitive para email) |

#### Modelo User

| Elemento | Valor exacto |
|---|---|
| Namespace | `App\Models\User` |
| Clase base | `Illuminate\Foundation\Auth\User` (alias `Authenticatable`) |
| Interfaces | `Tymon\JWTAuth\Contracts\JWTSubject` |
| Traits | `Notifiable`, `SoftDeletes` |
| `$fillable` | `['name', 'email', 'password', 'role', 'status']` |
| `$hidden` | `['password', 'remember_token']` |
| Cast `password` | `'hashed'` |
| Cast `role` | `UserRole::class` |
| Cast `status` | `UserStatus::class` |
| `getJWTIdentifier()` | Retorna `$this->getKey()` |
| `getJWTCustomClaims()` | Retorna `[]` (se enriquecerá en Parte 3) |

#### Enums

| Enum | Namespace | Valores |
|---|---|---|
| `UserRole` | `App\Enums\UserRole` | `Admin = 'admin'`, `User = 'user'` |
| `UserStatus` | `App\Enums\UserStatus` | `Active = 'active'`, `Inactive = 'inactive'`, `Banned = 'banned'` |

#### Convenciones de código

| Regla | Detalle |
|---|---|
| `declare(strict_types=1)` | En cada archivo PHP del proyecto |
| Respuesta JSON éxito | `{ "data": { ... } }` |
| Respuesta JSON error | `{ "error": { "code": "string_id", "message": "string" } }` |
| Controllers | Single-action (`__invoke`) en `App\Http\Controllers\Auth\` |
| FormRequests | `LoginRequest`, `RegisterRequest`, `RefreshTokenRequest` en `App\Http\Requests\Auth\` |
| Service | `App\Services\AuthService` |
| Middleware JWT | `App\Http\Middleware\JwtAuthenticate` |
| Guard en `config/auth.php` | `api` → driver `jwt`, provider `users` → `App\Models\User` |

#### Variables de entorno

| Variable | Valor para desarrollo |
|---|---|
| `DB_CONNECTION` | `mysql` |
| `DB_HOST` | `127.0.0.1` |
| `DB_PORT` | `3306` |
| `DB_DATABASE` | `paradise_roasters` |
| `JWT_SECRET` | Se generará con `php artisan jwt:secret` en la Parte 3 |
| `JWT_TTL` | `15` (minutos) |
| `JWT_REFRESH_TTL` | `10080` (minutos, 7 días) |

---

### Lo que viene en la Parte 3

En la [Parte 3: Instalación y Configuración de JWT](03-jwt-auth.md):

1. Instalar el paquete `tymon/jwt-auth`.
2. Publicar el archivo de configuración `config/jwt.php`.
3. Configurar el guard `api` con driver `jwt` en `config/auth.php`.
4. Generar `JWT_SECRET` con `php artisan jwt:secret`.
5. Implementar correctamente los métodos `getJWTIdentifier()` y `getJWTCustomClaims()` del modelo `User`.
6. Crear el middleware `JwtAuthenticate`.
7. Verificar que el guard JWT funciona emitiendo un token desde Tinker.

---

> **Nota para el revisor de la Parte 3**: el modelo `User` ya está completo (implementa `JWTSubject`, tiene `SoftDeletes`, casts de enum, y password hashed). Los enums `UserRole` y `UserStatus` están definidos y en uso. La migración `create_users_table` ya fue ejecutada. Solo falta instalar el paquete JWT, configurarlo, y refinar los métodos de `JWTSubject` según las necesidades que surjan al probar.
