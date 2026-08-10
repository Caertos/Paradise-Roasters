# Parte 4: Registro de Usuarios

## 1. Introducción

### 1.1 Dónde estamos

En las tres partes anteriores construimos la base completa del sistema de autenticación:

| Parte | Lo construido | Estado |
|-------|---------------|--------|
| [Parte 1](01-fundamentos-setup-arquitectura.md) | Proyecto Laravel 11, arquitectura en capas, convenciones de código, estructura de directorios | ✅ |
| [Parte 2](02-env-y-base-de-datos.md) | Variables de entorno, base de datos MySQL, migración `users`, modelo `User`, enums `UserRole` y `UserStatus` | ✅ |
| [Parte 3](03-jwt-configuracion-y-tokens.md) | Paquete `tymon/jwt-auth` instalado y configurado, guard `api` con driver `jwt`, claims del JWT, diseño de tabla `refresh_tokens` | ✅ |

En este momento, la aplicación **puede** generar tokens JWT para cualquier usuario desde Tinker, pero **no puede** registrar usuarios a través de un endpoint HTTP. Eso es exactamente lo que construiremos aquí.

### 1.2 Objetivo de esta parte

Implementar el endpoint `POST /api/register` completo, de extremo a extremo:

```
Cliente → Ruta → RegisterRequest → RegisterController → AuthService::register() → DB
```

Al terminar esta parte, un cliente HTTP (curl, Postman, frontend SPA) podrá enviar `name`, `email`, `password` y `password_confirmation` y recibir como respuesta el usuario creado junto con sus access token y refresh token.

### 1.3 Qué construiremos

1. **Migración `create_refresh_tokens_table`** — diseñada en la Parte 3, ahora la materializamos.
2. **Modelo `RefreshToken`** — encapsula la lógica de dominio de los refresh tokens.
3. **`RegisterRequest`** — valida los datos de entrada del registro.
4. **`AuthService::register()`** — lógica de negocio: crear usuario, emitir tokens, guardar refresh token.
5. **`RegisterController`** — punto de entrada HTTP, single-action.
6. **Ruta en `routes/api.php`** — conecta el endpoint con el controller.
7. **Tests de integración** — verificar que todo funciona y manejar casos de error.

---

## 2. Migración de `refresh_tokens`

### 2.1 Crear la migración

```bash
php artisan make:migration create_refresh_tokens_table
```

Laravel genera un archivo en `database/migrations/` con el timestamp actual. Sobrescribe su contenido con el siguiente código:

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
        Schema::create('refresh_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('token', 500);
            $table->timestamp('expires_at');
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();

            $table->index('token');
            $table->index('expires_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('refresh_tokens');
    }
};
```

### 2.2 Análisis columna por columna

#### `$table->id()`

Genera `BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY`. Como se justificó en la Parte 2, `BIGINT` previene el desbordamiento de `INT` en tablas con millones de registros — y una tabla de tokens puede crecer rápidamente si se emite un refresh token por login y por cada refresh subsecuente.

#### `$table->foreignId('user_id')->constrained()->cascadeOnDelete()`

Esta elegante sintaxis de Laravel equivale a:

```sql
`user_id` BIGINT UNSIGNED NOT NULL,
CONSTRAINT fk_refresh_tokens_user_id
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
```

Desglose de lo que ocurre:

| Método | Qué hace |
|--------|----------|
| `foreignId('user_id')` | Crea una columna `BIGINT UNSIGNED` llamada `user_id`. Laravel infiere que es una FK por el sufijo `_id`. |
| `constrained()` | Vincula la FK a la tabla `users` en la columna `id`. Laravel deduce `users` del nombre de la columna (`user_id` → tabla `users`, columna `id`). Si la tabla tuviera otro nombre, usarías `constrained('other_table')`. |
| `cascadeOnDelete()` | Añade `ON DELETE CASCADE`. Cuando un usuario es eliminado, MySQL borra automáticamente todos sus refresh tokens. Sin esto, quedarían huérfanos ocupando espacio. |

Además, `foreignId()` **crea implícitamente un índice** sobre `user_id` en la mayoría de motores de base de datos. Esto acelera `SELECT * FROM refresh_tokens WHERE user_id = ?`, que es la consulta para listar sesiones activas de un usuario y para revocar todos sus tokens ante un ataque de reuse.

#### `$table->string('token', 500)`

Almacena el refresh token JWT completo.

**¿Por qué `VARCHAR(500)` y no `TEXT`?**

| Tipo | Tamaño máximo | Índice posible | Caso de uso |
|------|---------------|----------------|-------------|
| `VARCHAR(500)` | 500 caracteres | ✅ Se puede indexar completo | Tokens JWT (~200-400 chars) |
| `VARCHAR(255)` | 255 caracteres | ✅ Se puede indexar | Podría quedarse corto con claims personalizados |
| `TEXT` | 65,535 bytes | ❌ Solo se puede indexar con prefijo | Nunca necesario para un JWT |

500 caracteres es el sweet spot: suficiente para un JWT con payload completo (sub, role, name, claims estándar) y compatible con índices B-tree completos. La consulta más frecuente sobre esta columna — `WHERE token = ?` — se beneficia directamente de un índice sobre la columna completa, no sobre un prefijo.

#### `$table->timestamp('expires_at')`

Fecha y hora de expiración del refresh token. Se establece en el momento de creación como `now() + JWT_REFRESH_TTL minutos`.

Dos usos críticos:

1. **Validación sin decodificar el JWT**: `WHERE token = ? AND expires_at > NOW() AND revoked_at IS NULL` — una sola consulta SQL valida el token sin necesidad de que el paquete JWT lo decodifique y verifique claims temporales. Si `expires_at` ya pasó, la fila ni siquiera se devuelve.

2. **Limpieza programada**: `DELETE FROM refresh_tokens WHERE expires_at < NOW()` — el comando `tokens:cleanup` programado diariamente elimina tokens expirados sin lógica compleja.

#### `$table->timestamp('revoked_at')->nullable()`

Soft-revoke. Semántica:

| Valor | Significado |
|-------|-------------|
| `NULL` | El token está activo y puede usarse para refresh |
| Una timestamp | El token fue revocado en ese momento exacto |

**¿Por qué soft-revoke (timestamp) en vez de hard-delete?**

1. **Auditoría forense**: "¿Se revocó este token porque el usuario cerró sesión, o porque el sistema detectó un ataque de reuse?" La timestamp responde esta pregunta.
2. **Debugging**: Si un usuario reporta "me echaron de la sesión", puedes consultar `SELECT * FROM refresh_tokens WHERE user_id = ? ORDER BY revoked_at DESC` y ver exactamente qué pasó.
3. **Consistencia con soft deletes**: Igual que `users.deleted_at`, mantenemos el registro histórico sin perder información.

**¿Por qué no usar `$table->softDeletes()` de Laravel?**

El trait `SoftDeletes` de Eloquent usa `deleted_at` y añade un scope global `WHERE deleted_at IS NULL`. Pero aquí necesitamos una semántica distinta:

- `expires_at` marca el fin natural del ciclo de vida del token.
- `revoked_at` marca una terminación forzosa (logout, ataque detectado).

Son dos conceptos diferentes que merecen dos columnas diferentes. Usar `deleted_at` parasitaría la semántica de soft-delete de Laravel y confundiría a futuros desarrolladores.

#### `$table->timestamps()`

Genera `created_at` y `updated_at`. `created_at` registra cuándo se emitió el refresh token (debería coincidir aproximadamente con `expires_at - 7 días`). `updated_at` se actualiza cuando se revoca el token.

### 2.3 Índices — la clave del rendimiento

| Índice | Columnas | Origen | Consulta que acelera |
|--------|----------|--------|---------------------|
| `PRIMARY` | `id` | `$table->id()` | Identificación única de fila |
| (implícito) | `user_id` | `foreignId()` crea índice automáticamente | `WHERE user_id = ?` — listar sesiones activas de un usuario |
| `refresh_tokens_token_index` | `token` | `$table->index('token')` | `WHERE token = ?` — validar refresh token entrante |
| `refresh_tokens_expires_at_index` | `expires_at` | `$table->index('expires_at')` | `WHERE expires_at < NOW()` — limpieza programada |

**¿Por qué un índice en `token`?**

Cada petición de refresh incluye un refresh token en el cuerpo. El servidor debe buscar ese token en la base de datos para verificar que existe, no ha expirado y no ha sido revocado:

```sql
SELECT * FROM refresh_tokens WHERE token = ? LIMIT 1;
```

Sin índice, MySQL haría un full table scan sobre TODOS los refresh tokens emitidos en la historia de la aplicación. Con miles o millones de tokens, esto es inaceptable. Con un índice B-tree sobre `token`, la búsqueda es O(log n) — microsegundos incluso con millones de filas.

**¿Por qué un índice en `expires_at`?**

El comando de limpieza `DELETE FROM refresh_tokens WHERE expires_at < NOW()` necesita encontrar eficientemente los tokens expirados. Sin índice, es otro full table scan diario. Con índice, solo toca las filas que realmente expiraron.

> **Nota sobre `VARCHAR(500)` indexado**: MySQL limita los índices a 767 bytes por defecto en InnoDB con `utf8mb4` (4 bytes por carácter). 500 × 4 = 2000 bytes, que excede 767. Sin embargo, InnoDB automáticamente indexa los primeros 191 caracteres con `utf8mb4` — y 191 caracteres de un token JWT son más que suficientes para distinguir tokens únicos (la probabilidad de colisión en los primeros 191 caracteres de dos JWTs con `jti` aleatorio es infinitesimal).

### 2.4 Ejecutar la migración

```bash
php artisan migrate
```

Salida esperada:

```
Migrating: 2025_01_15_000002_create_refresh_tokens_table
Migrated:  2025_01_15_000002_create_refresh_tokens_table (45.23ms)
```

Verifica:

```bash
php artisan migrate:status
```

```
+------+----------------------------------------------+-------+
| Ran? | Migration                                    | Batch |
+------+----------------------------------------------+-------+
| Yes  | 2014_10_12_000000_create_users_table         | 1     |
| Yes  | 2025_01_15_000002_create_refresh_tokens_table | 2     |
+------+----------------------------------------------+-------+
```

---

## 3. Modelo `RefreshToken`

Crea el archivo `app/Models/RefreshToken.php`:

```php
<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RefreshToken extends Model
{
    protected $table = 'refresh_tokens';

    protected $fillable = [
        'user_id',
        'token',
        'expires_at',
        'revoked_at',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }

    public function isRevoked(): bool
    {
        return $this->revoked_at !== null;
    }

    public function isValid(): bool
    {
        return !$this->isExpired() && !$this->isRevoked();
    }

    public function revoke(): void
    {
        $this->update(['revoked_at' => now()]);
    }
}
```

### 3.1 Explicación del modelo

#### `$fillable`

Solo las columnas que deben asignarse masivamente. `user_id`, `token`, y `expires_at` se asignan al crear el token. `revoked_at` se asigna al revocarlo (también vía `$fillable` porque el método `revoke()` usa `update()` que es mass-assignment).

#### `casts()`

Los casts `datetime` convierten automáticamente los strings de fecha de la base de datos a instancias de `Carbon`:

```php
$token = RefreshToken::first();
$token->expires_at->isPast();      // true/false — ¿ya expiró?
$token->expires_at->diffForHumans(); // "hace 3 días"
$token->revoked_at?->format('Y-m-d H:i:s'); // null-safe
```

#### `user(): BelongsTo`

Relación inversa a la que definiremos en el modelo `User`. Un refresh token pertenece a un usuario. Esta relación permite:

```php
$token = RefreshToken::where('token', $jwtString)->first();
$token->user; // El modelo User dueño del token
$token->user->email; // Email del dueño
```

#### Métodos de dominio

| Método | Propósito |
|--------|-----------|
| `isExpired()` | ¿La fecha de expiración ya pasó? Encapsula `$this->expires_at->isPast()`. |
| `isRevoked()` | ¿Se revocó este token? Un simple `!== null` sobre `revoked_at`. |
| `isValid()` | ¿Está activo? Combina las dos comprobaciones anteriores. Útil en el `AuthService` para validar de un vistazo. |
| `revoke()` | Marca el token como revocado estableciendo `revoked_at = now()`. Encapsula el `update()` para que el service no tenga que saber detalles de implementación del modelo. |

**¿Por qué estos métodos en el modelo y no en el Service?**

Principio de "Tell, Don't Ask": el código cliente no debería preguntar por el estado interno de un objeto para tomar decisiones. En vez de:

```php
// ❌ El Service conoce los internos del modelo
if ($token->expires_at > now() && $token->revoked_at === null) {
    // hacer algo
}
```

Hacemos:

```php
// ✅ El modelo expone comportamiento, no estado
if ($token->isValid()) {
    // hacer algo
}
```

Si en el futuro `isValid()` incluye más condiciones (límite de usos, verificación de IP), el código cliente no cambia.

---

## 4. Actualización del Modelo `User`

El modelo `User` (creado en la Parte 2) necesita la relación con `RefreshToken`. Añade al archivo `app/Models/User.php`:

```php
use Illuminate\Database\Eloquent\Relations\HasMany;

// Dentro de la clase User, añade:
public function refreshTokens(): HasMany
{
    return $this->hasMany(RefreshToken::class);
}
```

La relación completa queda así en el modelo `User`:

```php
// app/Models/User.php — fragmento relevante
use App\Models\RefreshToken;
use Illuminate\Database\Eloquent\Relations\HasMany;

class User extends Authenticatable implements JWTSubject
{
    // ... (resto del código existente de la Parte 2 + Parte 3) ...

    public function refreshTokens(): HasMany
    {
        return $this->hasMany(RefreshToken::class);
    }
}
```

Esta relación permite las siguientes operaciones en el `AuthService`:

```php
// Crear un refresh token para un usuario
$user->refreshTokens()->create([
    'token' => $refreshToken,
    'expires_at' => now()->addMinutes(config('jwt.refresh_ttl')),
]);

// Listar todos los refresh tokens activos de un usuario
$user->refreshTokens()
    ->whereNull('revoked_at')
    ->where('expires_at', '>', now())
    ->get();

// Revocar todos los tokens de un usuario (logout global)
$user->refreshTokens()
    ->whereNull('revoked_at')
    ->update(['revoked_at' => now()]);
```

La última operación — revocar todos los tokens de un usuario — es el mecanismo de defensa ante la detección de reuse de refresh tokens (Parte 5).

---

## 5. `RegisterRequest` — Validación de Entrada

### 5.1 Crear el FormRequest

```bash
php artisan make:request Auth/RegisterRequest
```

Sobrescribe el contenido generado en `app/Http/Requests/Auth/RegisterRequest.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class RegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name'     => ['required', 'string', 'min:2', 'max:100'],
            'email'    => ['required', 'string', 'email:rfc,dns', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'password_confirmation' => ['required', 'string'],
        ];
    }

    public function messages(): array
    {
        return [
            'email.unique'      => 'Este correo electrónico ya está registrado.',
            'password.min'      => 'La contraseña debe tener al menos :min caracteres.',
            'password.confirmed' => 'Las contraseñas no coinciden.',
        ];
    }
}
```

### 5.2 Explicación de cada regla

#### `authorize(): bool`

```php
public function authorize(): bool
{
    return true;
}
```

Cualquier persona, autenticada o no, puede registrarse. `true` indica que no hay restricciones de autorización a nivel de FormRequest.

**¿Cuándo retornarías `false`?** Si el registro fuera solo por invitación, podrías validar aquí un token de invitación o verificar que el email está en una lista blanca:

```php
// Ejemplo hipotético — NO implementado en este manual
public function authorize(): bool
{
    return Invitation::where('email', $this->input('email'))
        ->whereNull('used_at')
        ->exists();
}
```

Para este manual, registro público.

#### `name`: `['required', 'string', 'min:2', 'max:100']`

| Regla | Qué valida | Por qué |
|-------|-----------|---------|
| `required` | El campo debe estar presente y no vacío | Sin nombre, no podemos crear el usuario |
| `string` | Debe ser un string (no un array, objeto, o número) | Previene ataques de type juggling |
| `min:2` | Mínimo 2 caracteres | El nombre más corto razonable (ej: "Li", "Jo"). Menos de 2 caracteres no es un nombre real |
| `max:100` | Máximo 100 caracteres | El nombre real más largo registrado ronda los 200 caracteres, pero 100 es un límite práctico que cubre el 99.99% de los casos sin permitir abuso |

#### `email`: `['required', 'string', 'email:rfc,dns', 'max:255', 'unique:users,email']`

##### `email:rfc,dns`

La regla `email` de Laravel acepta parámetros:

| Parámetro | Qué valida |
|-----------|-----------|
| `rfc` | Valida el formato del email según RFC 5322. Rechaza `notanemail`, `@missingusername.com`, `spaces in@email.com`. |
| `dns` | Verifica que el dominio del email tenga registros MX (Mail Exchange) en DNS. Rechaza `user@thisdomaindoesnotexist12345.com`. |
| `spoof` | Verifica que el email no use caracteres Unicode sospechosos para ataques de homógrafo (ej: `user@gοοgle.com` donde las `o` son letras griegas). |
| `filter` | Usa `filter_var()` de PHP con `FILTER_VALIDATE_EMAIL`. Es la validación más básica y la que Laravel aplica si no pasas parámetros. |
| `strict` | Valida usando `filter_var()` con `FILTER_FLAG_EMAIL_UNICODE` + verificación de conformidad con RFC. |

Usar `email:rfc,dns` es la validación más estricta que Laravel ofrece sin dependencias externas. Sin embargo, tiene un caveat importante:

**El parámetro `dns` puede fallar en desarrollo local** si no tienes resolución DNS configurada o si el dominio de prueba usa un proveedor de email temporal que no tiene registros MX. En entornos de desarrollo, considera omitir `dns` o usar `email:rfc` solamente:

```php
// Desarrollo (menos estricto)
'email' => ['required', 'string', 'email:rfc', 'max:255', 'unique:users,email'],
```

Para producción, `dns` es una capa adicional de defensa contra bots de registro que usan emails de dominios inexistentes.

##### `unique:users,email`

Verifica que el email no exista ya en la columna `email` de la tabla `users`. Laravel ejecuta:

```sql
SELECT COUNT(*) FROM users WHERE email = ? AND deleted_at IS NULL
```

Si el resultado > 0, la validación falla con el mensaje "Este correo electrónico ya está registrado".

**Dos matices importantes:**

1. **El `deleted_at IS NULL` es automático**: Gracias al trait `SoftDeletes` en el modelo `User`, Eloquent añade el scope global. Esto significa que un email de un usuario soft-deleted **no bloquea** el registro de uno nuevo — la consulta `unique` encuentra 0 resultados.

2. **Race condition**: Dos requests simultáneos con el mismo email pueden pasar la validación ambos. La validación de Laravel ocurre ANTES de llegar al Service. Si dos requests llegan al mismo tiempo:

   ```
   Request A: unique:users,email → 0 resultados → OK
   Request B: unique:users,email → 0 resultados → OK
   Request A: INSERT INTO users → éxito
   Request B: INSERT INTO users → ❌ Integrity constraint violation (UNIQUE en DB)
   ```

   La defensa en profundidad es el índice `UNIQUE` sobre `users.email` (creado en la Parte 2). Aunque dos requests pasen la validación de Laravel, MySQL rechaza el segundo INSERT con un error de constraint. El `DB::transaction()` en el `AuthService` (sección 6) capturará esto como una excepción y hará rollback.

> **`unique` vs `exists`**: `unique:users,email` verifica que el valor NO existe (es único). `exists:users,email` verifica que SÍ existe (útil para login: "¿existe un usuario con este email?"). Son opuestos. No los confundas.

##### `max:255`

El RFC 5321 permite emails de hasta 254 caracteres. `VARCHAR(255)` en la base de datos + `max:255` en validación cubren el caso máximo. Si alguien envía un email de 256 caracteres, la validación lo rechaza antes de que llegue a la base de datos.

#### `password`: `['required', 'string', 'min:8', 'confirmed']`

##### `min:8`

NIST SP 800-63B (Digital Identity Guidelines) recomienda un mínimo de 8 caracteres para contraseñas generadas por humanos. Es el balance entre seguridad y usabilidad.

| Longitud mínima | Seguridad | Usabilidad | Caso de uso |
|-----------------|-----------|------------|-------------|
| 6 caracteres | Baja — fuerza bruta viable en minutos | Alta | Aplicaciones de bajo riesgo |
| **8 caracteres** | **Media — fuerza bruta toma horas/días con rate limiting** | **Buena** | **Aplicaciones web estándar (este manual)** |
| 12 caracteres | Alta — fuerza bruta no viable | Media | Aplicaciones financieras, healthcare |
| 16+ caracteres | Muy alta | Baja (gestores de contraseñas) | Sistemas críticos |

##### `confirmed`

La regla `confirmed` de Laravel espera un campo hermano con el sufijo `_confirmation`. Es decir, si el campo es `password`, Laravel busca `password_confirmation` en la request y verifica que ambos valores sean iguales. Si no son iguales o si `password_confirmation` no está presente, la validación falla.

```json
// ✅ Válido — password y password_confirmation coinciden
{
    "password": "Secure123!",
    "password_confirmation": "Secure123!"
}

// ❌ Inválido — no coinciden
{
    "password": "Secure123!",
    "password_confirmation": "Secure123"
}

// ❌ Inválido — falta password_confirmation
{
    "password": "Secure123!"
}
```

##### ¿Por qué NO validar complejidad (mayúsculas, números, símbolos)?

NIST SP 800-63B **ya NO recomienda** reglas de complejidad como "al menos una mayúscula, un número y un símbolo". El razonamiento:

1. **Los usuarios encuentran formas de burlarlas**: `Password1!` cumple todas las reglas de complejidad pero es trivial de adivinar.
2. **Reducen la entropía real**: Al obligar a ciertos patrones, reduces el espacio de búsqueda. Saber que "debe tener al menos un número" elimina todas las contraseñas sin números del espacio de ataque.
3. **Frustran al usuario**: Llevan a comportamientos inseguros como anotar la contraseña o reutilizarla en otros sitios.

Lo que NIST recomienda HOY:
- **Longitud mínima** (8 caracteres para claves humanas, 6 para claves generadas aleatoriamente).
- **Verificación contra diccionarios de contraseñas comunes** (ej: haveibeenpwned.com).
- **No exigir cambios periódicos** de contraseña sin evidencia de compromiso.
- **No exigir composición arbitraria** (mayúsculas, números, símbolos).

En la sección 9.2 mencionamos cómo añadir verificación contra haveibeenpwned.com como mejora futura.

#### `password_confirmation`: `['required', 'string']`

El campo `password_confirmation` debe estar presente y ser un string. No necesita `min:8` porque su único propósito es compararse con `password` — si `password` pasa la validación, la confirmación es redundante validarla por separado. Sin embargo, `required` es necesario: si falta, la regla `confirmed` sobre `password` generará un error confuso ("las contraseñas no coinciden" cuando en realidad falta el campo). Con `required` explícito, Laravel da un error más claro: "el campo password_confirmation es obligatorio".

### 5.3 `messages()` — Personalización de errores

```php
public function messages(): array
{
    return [
        'email.unique'      => 'Este correo electrónico ya está registrado.',
        'password.min'      => 'La contraseña debe tener al menos :min caracteres.',
        'password.confirmed' => 'Las contraseñas no coinciden.',
    ];
}
```

Laravel tiene mensajes de error por defecto en inglés. Personalizarlos al español mejora la experiencia de usuario. Los mensajes por defecto que NO personalizamos son suficientemente claros:

| Regla | Mensaje por defecto (inglés) | Traducción automática de Laravel (si configuras `config/app.php` → `locale = 'es'`) |
|-------|------------------------------|----------------------------------------------------------------------------------------|
| `required` | "The name field is required." | "El campo nombre es obligatorio." |
| `email` | "The email must be a valid email address." | "El campo email debe ser una dirección de correo electrónico válida." |
| `min:2` | "The name must be at least 2 characters." | "El campo nombre debe tener al menos 2 caracteres." |

El placeholder `:min` en `'password.min'` se reemplaza dinámicamente por el valor de la regla (`8`). El mensaje resultante es: "La contraseña debe tener al menos 8 caracteres."

### 5.4 ¿Qué pasa cuando la validación falla?

Laravel maneja automáticamente la respuesta de error cuando un `FormRequest` falla la validación. El cliente recibe:

```http
HTTP/1.1 422 Unprocessable Content
Content-Type: application/json

{
    "message": "The email field is required. (and 2 more errors)",
    "errors": {
        "email": [
            "The email field is required."
        ],
        "password": [
            "The password field confirmation does not match."
        ],
        "name": [
            "The name field must be at least 2 characters."
        ]
    }
}
```

El código `422 Unprocessable Content` (antes `422 Unprocessable Entity`) es el estándar HTTP para errores de validación. Laravel lo establece automáticamente — no necesitas hacer nada en el controller.

---

## 6. `AuthService::register()` — Lógica de Negocio

Crea el archivo `app/Services/AuthService.php` con **solo** el método `register()`. Los métodos `login()`, `refreshTokens()` y `logout()` se implementarán en la Parte 5.

```php
<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Support\Facades\DB;

final class AuthService
{
    public function register(array $data): array
    {
        return DB::transaction(function () use ($data): array {
            $user = User::create([
                'name'     => $data['name'],
                'email'    => $data['email'],
                'password' => $data['password'],
                'role'     => UserRole::User,
                'status'   => UserStatus::Active,
            ]);

            $accessToken  = auth('api')->login($user);
            $refreshToken = auth('api')->setTTL(config('jwt.refresh_ttl'))->login($user);

            $user->refreshTokens()->create([
                'token'      => $refreshToken,
                'expires_at' => now()->addMinutes(config('jwt.refresh_ttl')),
            ]);

            return [
                'user'          => $user,
                'access_token'  => $accessToken,
                'refresh_token' => $refreshToken,
                'token_type'    => 'bearer',
                'expires_in'    => config('jwt.ttl') * 60,
            ];
        });
    }
}
```

### 6.1 Explicación detallada

#### `final class AuthService`

```php
final class AuthService
```

`final` previene que otra clase extienda `AuthService`. Los services son unidades concretas de lógica de negocio, no diseñadas para herencia. Si necesitas extender comportamiento, usa composición (inyectar otro service como dependencia) o el patrón Strategy.

#### `DB::transaction()`

```php
return DB::transaction(function () use ($data): array {
    // ...
});
```

Todo el registro ocurre dentro de una transacción de base de datos. Esto garantiza **atomicidad**: o todas las operaciones se completan exitosamente, o ninguna se aplica.

¿Qué operaciones están dentro de la transacción?

1. `User::create()` — INSERT en `users`
2. `$user->refreshTokens()->create()` — INSERT en `refresh_tokens`

Si la segunda operación falla (por ejemplo, por una violación de FK o un error de constraint), MySQL revierte automáticamente la primera. El usuario no se crea a medias.

Si ocurre una excepción de PHP (no de MySQL) dentro del closure, Laravel hace rollback de la transacción. Esto incluye excepciones lanzadas por el paquete JWT, errores de tipo, o cualquier `Throwable`.

**¿Qué NO está dentro de la transacción?**

Las llamadas a `auth('api')->login($user)` no tocan la base de datos — generan el token JWT en memoria (codificación + firma). No hay nada que "deshacer" si fallan, pero si fallaran, la excepción haría rollback del `User::create()` anterior.

#### `User::create()`

```php
$user = User::create([
    'name'     => $data['name'],
    'email'    => $data['email'],
    'password' => $data['password'],
    'role'     => UserRole::User,
    'status'   => UserStatus::Active,
]);
```

| Campo | Valor | Quién lo decide |
|-------|-------|-----------------|
| `name` | Lo que envió el cliente | Cliente |
| `email` | Lo que envió el cliente (ya validado) | Cliente |
| `password` | Texto plano enviado por el cliente | Cliente |

¿Texto plano? **Sí.** Y es correcto. El cast `'password' => 'hashed'` en el modelo `User` (Parte 2) convierte automáticamente el valor a un hash bcrypt antes de guardarlo en la base de datos:

```php
// El cast 'hashed' internamente hace esto:
$this->attributes['password'] = Hash::make($value);
```

Esto significa que `$data['password']` llega como `"Secure123!"` pero se guarda como `"$2y$12$LJ3m4ys3GZfnYMz8kVsKaOmxAZjFPqFq7dQ8eY0..."`. El password en texto plano **nunca** se persiste.

| Campo | Valor | Quién lo decide |
|-------|-------|-----------------|
| `role` | `UserRole::User` | **El servidor**, no el cliente |
| `status` | `UserStatus::Active` | **El servidor**, no el cliente |

**El rol y el estado NO vienen del cliente.** Son decisiones del servidor. Todo usuario nuevo es `user` (no `admin`) y `active` (no `banned`). Si el cliente enviara `"role": "admin"` en el JSON, el `RegisterRequest` ni siquiera lo validaría (no está en `rules()`), y aunque llegara al Service, `$fillable` lo aceptaría. **Pero no lo enviamos a `User::create()`**. Hardcodeamos los valores en el Service.

Esta es la defensa en profundidad contra escalación de privilegios en el registro:
1. `RegisterRequest` no valida `role` → no está en `$request->validated()`.
2. `AuthService` no usa `$data['role']` → lo asigna explícitamente.
3. El modelo `User` tiene `'role'` en `$fillable`, pero como el Service no lo pasa, no se asigna.

**¿Por qué no quitar `role` de `$fillable`?** Porque otros flujos (actualización de perfil, panel admin) SÍ necesitan asignar `role` masivamente. `$fillable` no es una restricción de seguridad por endpoint, es una restricción de seguridad por modelo. La lógica de negocio (qué roles se permiten en cada flujo) vive en el Service, no en el modelo.

#### `auth('api')->login($user)` — Access Token

```php
$accessToken = auth('api')->login($user);
```

Desglose de lo que ocurre:

1. `auth('api')` obtiene el guard `api` configurado en `config/auth.php`.
2. El guard `api` tiene driver `jwt`, proporcionado por `tymon/jwt-auth`.
3. `login($user)` del driver JWT:
   - Llama a `$user->getJWTIdentifier()` → obtiene `1` (el ID del usuario recién creado).
   - Llama a `$user->getJWTCustomClaims()` → obtiene `['role' => 'user', 'name' => 'John Doe']`.
   - Construye el payload con los claims estándar (`iss`, `iat`, `exp`, `nbf`, `jti`, `sub`, `prv`) y los claims personalizados.
   - Firma el token con `JWT_SECRET` usando HS256.
   - Codifica todo a Base64URL.
   - Retorna el string JWT completo.

El TTL de este token es el configurado en `config/jwt.ttl`: 15 minutos (`JWT_TTL=15`). El claim `exp` se calcula como `now() + 900 segundos`.

**`login()` de JWT NO es `auth()->login()` de sesiones de Laravel.** El método `login()` del paquete tymon/jwt-auth CREA y FIRMA un token JWT. No inicia una sesión en el servidor. No escribe nada en `sessions` o `cache`. Es una operación puramente criptográfica en memoria.

#### `auth('api')->setTTL(...)->login($user)` — Refresh Token

```php
$refreshToken = auth('api')->setTTL(config('jwt.refresh_ttl'))->login($user);
```

`setTTL()` sobreescribe temporalmente el TTL **solo para esta llamada**. No modifica la configuración global. La secuencia es:

1. `auth('api')->setTTL(10080)` — "para el próximo token que generes, usa 10080 minutos como TTL".
2. `->login($user)` — genera el token con TTL de 7 días en lugar de 15 minutos.

El resultado es un JWT con `exp = now() + 604800 segundos` (7 días). El resto del payload es idéntico al access token. La diferencia está únicamente en el claim `exp`.

**¿Por qué no usar `claims()` para marcar el tipo de token?**

Podríamos añadir un claim `token_type: "refresh"` así:

```php
$refreshToken = auth('api')
    ->claims(['token_type' => 'refresh'])
    ->setTTL(config('jwt.refresh_ttl'))
    ->login($user);
```

Esto permitiría que el middleware JWT distinga access tokens de refresh tokens y rechace refresh tokens en endpoints normales. Sin embargo, este manual mantiene ambos tokens con la misma estructura (la distinción está en la tabla `refresh_tokens` para los refresh tokens). En la Parte 5, si se requiere esta distinción a nivel de middleware, se puede añadir.

#### Guardar el refresh token en la base de datos

```php
$user->refreshTokens()->create([
    'token'      => $refreshToken,
    'expires_at' => now()->addMinutes(config('jwt.refresh_ttl')),
]);
```

- `$user->refreshTokens()` usa la relación `HasMany` definida en el modelo `User`.
- `create()` inserta una nueva fila en `refresh_tokens` con el `user_id` del usuario, el token JWT completo, y la fecha de expiración.
- `now()->addMinutes(config('jwt.refresh_ttl'))` calcula `2025-01-22 10:30:00` (7 días después de `now()`).

El `expires_at` en la base de datos es redundante con el claim `exp` dentro del JWT. Esta redundancia es deliberada: permite validar la expiración con SQL sin decodificar el JWT (más rápido, y útil para el comando de limpieza programada).

#### Respuesta del método

```php
return [
    'user'          => $user,
    'access_token'  => $accessToken,
    'refresh_token' => $refreshToken,
    'token_type'    => 'bearer',
    'expires_in'    => config('jwt.ttl') * 60,
];
```

| Campo | Valor de ejemplo | Explicación |
|-------|------------------|-------------|
| `user` | Instancia de `User` | Al serializarse a JSON, Eloquent aplica `$hidden` (excluye `password`, `remember_token`) y `casts` (enum a string, fechas a ISO 8601). |
| `access_token` | `"eyJ0eXAiOiJKV1Q..."` | JWT de 15 minutos de vida. |
| `refresh_token` | `"eyJ0eXAiOiJKV1Q..."` | JWT de 7 días de vida. |
| `token_type` | `"bearer"` | El tipo de token para el header `Authorization: Bearer <token>`. Es una convención, no un mecanismo de seguridad. |
| `expires_in` | `900` | TTL en **segundos** (15 × 60 = 900). Esto sigue la convención de OAuth2 y permite al frontend calcular cuándo refrescar sin decodificar el JWT. |

El campo `expires_in` en segundos (no en minutos) es una convención de APIs OAuth2. Si el frontend usa una librería como `axios` con interceptors para refrescar tokens automáticamente, espera este formato.

---

## 7. `RegisterController` — Punto de Entrada HTTP

Crea el archivo `app/Http/Controllers/Auth/RegisterController.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Http\Requests\Auth\RegisterRequest;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

final class RegisterController
{
    public function __invoke(RegisterRequest $request, AuthService $authService): JsonResponse
    {
        $result = $authService->register($request->validated());

        return response()->json([
            'data' => $result,
        ], Response::HTTP_CREATED);
    }
}
```

### 7.1 Explicación

#### Single-action controller (`__invoke`)

```php
final class RegisterController
{
    public function __invoke(RegisterRequest $request, AuthService $authService): JsonResponse
```

Una clase con un solo método `__invoke` es un **single-action controller**. Enrutar `Route::post('/register', RegisterController::class)` llama automáticamente a `__invoke`. Responsabilidad única: esta clase existe solo para manejar el registro de usuarios. Si necesitas cambiar el login, no tocas este archivo.

#### Inyección de dependencias

```php
public function __invoke(RegisterRequest $request, AuthService $authService): JsonResponse
```

Laravel resuelve automáticamente `RegisterRequest` (inyecta la request HTTP validada) y `AuthService` (lo resuelve del contenedor de servicios). No necesitas `new AuthService()` ni `app()->make(AuthService::class)`. El contenedor de Laravel lo hace por ti.

`AuthService` no tiene dependencias en su constructor, así que el contenedor lo instancia directamente. Si en el futuro `AuthService` requiriera dependencias (ej: `UserRepository`, `TokenService`), el contenedor las resolvería recursivamente. El controller no cambia.

#### `$request->validated()`

```php
$result = $authService->register($request->validated());
```

`validated()` retorna **solo los campos que pasaron la validación** (los definidos en `rules()`). No retorna `_token`, `_method`, query params, ni campos adicionales que el cliente haya enviado.

Comparación:

```php
// ❌ Peligroso — incluye TODOS los campos de la request
$data = $request->all();

// ⚠️ Aceptable si confías en $fillable, pero no es explícito
$data = $request->only(['name', 'email', 'password', 'password_confirmation']);

// ✅ Seguro y explícito — solo lo validado
$data = $request->validated();
```

`validated()` devuelve `password_confirmation` además de `name`, `email`, `password`. El `AuthService::register()` no usa `password_confirmation` (su propósito era solo para la validación `confirmed`), pero no hay problema con que esté en el array — `User::create()` usa `$fillable` para filtrar.

#### HTTP 201 Created

```php
return response()->json([
    'data' => $result,
], Response::HTTP_CREATED);
```

`Response::HTTP_CREATED` es la constante `201` de Laravel. Usar la constante en vez del número mágico:

```php
// ❌ Número mágico — ¿qué significa 201?
return response()->json(['data' => $result], 201);

// ✅ Constante con nombre — autoexplicativo
return response()->json(['data' => $result], Response::HTTP_CREATED);
```

HTTP 201 Created es el código semánticamente correcto para la creación exitosa de un recurso:

| Código | Significado | Cuándo usarlo |
|--------|-------------|---------------|
| `200 OK` | La petición fue exitosa | GET, PUT, PATCH, DELETE |
| `201 Created` | Se creó un recurso nuevo | POST que resulta en una nueva entidad |
| `202 Accepted` | La petición fue aceptada pero no procesada aún | Operaciones asíncronas |
| `204 No Content` | Éxito sin cuerpo de respuesta | DELETE exitoso sin datos que devolver |

El controller tiene ~5 líneas de lógica. No hay `if`, no hay bucles, no hay acceso a base de datos. Toda la complejidad vive en el `RegisterRequest` (validación) y el `AuthService` (lógica de negocio).

---

## 8. Ruta de Registro

Añade en `routes/api.php`:

```php
use App\Http\Controllers\Auth\RegisterController;

Route::post('/register', RegisterController::class)
    ->name('auth.register')
    ->middleware('throttle:10,1');
```

### 8.1 Explicación

#### Ruta POST a `/register`

Laravel carga `routes/api.php` con el prefijo `/api` (definido en `bootstrap/app.php` en Laravel 11). La ruta completa es `POST /api/register`.

#### `->name('auth.register')`

Nombrar las rutas permite referenciarlas simbólicamente en otros lugares del código:

```php
// En tests:
$response = $this->postJson(route('auth.register'), $data);

// En generar URLs:
$url = route('auth.register'); // "http://localhost:8000/api/register"
```

Si algún día cambias la URL de `/register` a `/signup`, solo modificas la ruta. Todas las referencias por nombre siguen funcionando.

#### `->middleware('throttle:10,1')`

Rate limiting: máximo 10 intentos de registro por minuto desde una misma IP.

| Parámetro | Significado |
|-----------|-------------|
| `10` | Número máximo de intentos permitidos |
| `1` | Ventana de tiempo en minutos |

Si un cliente (o bot) intenta más de 10 registros en 1 minuto, Laravel responde:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60
Content-Type: application/json

{
    "message": "Too Many Requests"
}
```

**¿Por qué rate limiting en el registro?**

El endpoint de registro tiene tres vectores de abuso:
1. **Creación masiva de cuentas** (spam, bots) — rate limiting lo frena.
2. **Enumeración de emails** (probar si `x@y.com` ya existe) — rate limiting + mensajes genéricos de error lo mitigan (ver sección 9.3).
3. **Denegación de servicio por agotamiento de recursos** — crear usuarios consume INSERTs, hasheo bcrypt (CPU), y generación de JWT (CPU). 10 por minuto mantiene esto bajo control.

---

## 9. Testing del Registro

### 9.1 Prueba manual con curl

```bash
curl -X POST http://localhost:8000/api/register \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "SecurePass123!",
    "password_confirmation": "SecurePass123!"
  }'
```

**Headers explicados:**

| Header | Propósito |
|--------|-----------|
| `Content-Type: application/json` | Indica al servidor que el cuerpo es JSON. Sin esto, Laravel podría interpretar el body como form-data y la validación fallaría. |
| `Accept: application/json` | Indica al servidor que el cliente espera respuesta JSON. Si la validación falla, Laravel devolverá JSON con errores en vez de redirigir (comportamiento web por defecto). **Crítico para APIs**. |

**Respuesta esperada (éxito):**

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
    "data": {
        "user": {
            "id": 1,
            "name": "John Doe",
            "email": "john@example.com",
            "role": "user",
            "status": "active",
            "email_verified_at": null,
            "created_at": "2025-01-15T10:30:00.000000Z",
            "updated_at": "2025-01-15T10:30:00.000000Z"
        },
        "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
        "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
        "token_type": "bearer",
        "expires_in": 900
    }
}
```

Observa que el `user` NO incluye `password` ni `remember_token` — el `$hidden` del modelo los excluyó. Tampoco incluye `deleted_at` porque es `null` y Eloquent omite atributos `null` en la serialización por defecto.

### 9.2 Prueba con Postman / Insomnia

Crea una colección con la siguiente configuración:

```
Method: POST
URL: http://localhost:8000/api/register

Headers:
  Content-Type: application/json
  Accept: application/json

Body (raw JSON):
{
    "name": "Jane Doe",
    "email": "jane@example.com",
    "password": "SecurePass123!",
    "password_confirmation": "SecurePass123!"
}
```

Guarda la colección. La reutilizarás en las Partes 5 y 6 para probar login, refresh y logout.

### 9.3 Pruebas con PHPUnit

Crea el archivo `tests/Feature/Auth/RegisterTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class RegisterTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_register(): void
    {
        $response = $this->postJson('/api/register', [
            'name'                  => 'Test User',
            'email'                 => 'test@example.com',
            'password'              => 'Secure123!',
            'password_confirmation' => 'Secure123!',
        ]);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'data' => [
                    'user' => [
                        'id',
                        'name',
                        'email',
                        'role',
                        'status',
                        'created_at',
                        'updated_at',
                    ],
                    'access_token',
                    'refresh_token',
                    'token_type',
                    'expires_in',
                ],
            ]);

        $this->assertDatabaseHas('users', [
            'email' => 'test@example.com',
        ]);

        $this->assertDatabaseHas('refresh_tokens', [
            'user_id' => 1,
        ]);

        $user = User::where('email', 'test@example.com')->first();
        $this->assertNotNull($user);
        $this->assertNotEquals('Secure123!', $user->password);
        $this->assertTrue(Hash::check('Secure123!', $user->password));
    }
}
```

#### ¿Qué prueba cada aserción?

```php
$response->assertStatus(201);
```

Verifica que el endpoint responde con HTTP 201 Created. Si responde 422, algo falló en la validación. Si 500, algo explotó en el Service.

```php
->assertJsonStructure([...]);
```

Verifica que la respuesta JSON tiene exactamente la estructura esperada. Si falta `access_token` o `user.id`, el test falla. Esto detecta cambios accidentales en el formato de respuesta.

```php
$this->assertDatabaseHas('users', ['email' => 'test@example.com']);
```

Confirma que el usuario realmente se persistió en la base de datos. No solo que el endpoint respondió 201 — el registro se materializó.

```php
$this->assertDatabaseHas('refresh_tokens', ['user_id' => 1]);
```

Confirma que se creó un refresh token para el usuario recién registrado. Verifica que la transacción funcionó completa.

```php
$this->assertNotEquals('Secure123!', $user->password);
$this->assertTrue(Hash::check('Secure123!', $user->password));
```

La prueba más importante de todas: el password NO está en texto plano en la base de datos. `assertNotEquals` verifica que el valor guardado es diferente al input. `Hash::check` verifica que el hash corresponde al password original.

**¿Por qué ambas aserciones?** `assertNotEquals` detecta el caso obvio (error humano). `Hash::check` detecta el caso sutil: el cast `hashed` podría estar roto y guardar un hash de otro string. Si `Hash::check` falla, el password guardado no puede usarse para login.

### 9.4 Casos de prueba negativos

Añade estos tests al mismo archivo:

```php
public function test_registration_fails_with_duplicate_email(): void
{
    User::factory()->create(['email' => 'existing@example.com']);

    $response = $this->postJson('/api/register', [
        'name'                  => 'Duplicate User',
        'email'                 => 'existing@example.com',
        'password'              => 'Secure123!',
        'password_confirmation' => 'Secure123!',
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['email']);
}

public function test_registration_fails_with_short_password(): void
{
    $response = $this->postJson('/api/register', [
        'name'                  => 'Short Pass',
        'email'                 => 'short@example.com',
        'password'              => '1234567',
        'password_confirmation' => '1234567',
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['password']);
}

public function test_registration_fails_without_password_confirmation(): void
{
    $response = $this->postJson('/api/register', [
        'name'     => 'No Confirm',
        'email'    => 'noconfirm@example.com',
        'password' => 'Secure123!',
    ]);

    $response->assertStatus(422);
}

public function test_registration_fails_with_invalid_email(): void
{
    $response = $this->postJson('/api/register', [
        'name'                  => 'Bad Email',
        'email'                 => 'not-an-email',
        'password'              => 'Secure123!',
        'password_confirmation' => 'Secure123!',
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['email']);
}

public function test_registration_fails_with_empty_name(): void
{
    $response = $this->postJson('/api/register', [
        'name'                  => '',
        'email'                 => 'empty@example.com',
        'password'              => 'Secure123!',
        'password_confirmation' => 'Secure123!',
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['name']);
}

public function test_registration_enforces_rate_limiting(): void
{
    for ($i = 0; $i < 10; $i++) {
        $this->postJson('/api/register', [
            'name'                  => "User {$i}",
            'email'                 => "user{$i}@example.com",
            'password'              => 'Secure123!',
            'password_confirmation' => 'Secure123!',
        ]);
    }

    $response = $this->postJson('/api/register', [
        'name'                  => 'Rate Limited',
        'email'                 => 'ratelimited@example.com',
        'password'              => 'Secure123!',
        'password_confirmation' => 'Secure123!',
    ]);

    $response->assertStatus(429);
}
```

| Test | Qué verifica |
|------|-------------|
| `fails_with_duplicate_email` | El índice UNIQUE + regla `unique:users,email` funcionan |
| `fails_with_short_password` | `min:8` rechaza contraseñas de 7 caracteres |
| `fails_without_password_confirmation` | `confirmed` falla cuando falta `password_confirmation` |
| `fails_with_invalid_email` | `email:rfc,dns` rechaza strings que no son emails |
| `fails_with_empty_name` | `required` + `min:2` rechazan strings vacíos |
| `enforces_rate_limiting` | `throttle:10,1` bloquea después de 10 intentos |

### 9.5 Ejecutar los tests

```bash
php artisan test --filter RegisterTest
```

Salida esperada:

```
PASS  Tests\Feature\Auth\RegisterTest
  ✓ user can register
  ✓ registration fails with duplicate email
  ✓ registration fails with short password
  ✓ registration fails without password confirmation
  ✓ registration fails with invalid email
  ✓ registration fails with empty name
  ✓ registration enforces rate limiting

Tests:  7 passed
```

---

## 10. Seguridad Específica del Registro

### 10.1 Rate Limiting

Ya implementado en la ruta con `throttle:10,1`. Diez registros por minuto es suficiente para un usuario legítimo (nadie abre 10 cuentas en un minuto) pero insuficiente para un bot de registro masivo.

La respuesta 429 incluye el header `Retry-After` para que el frontend sepa cuánto esperar. Si usas Axios, puedes interceptar 429 y mostrar un mensaje al usuario.

### 10.2 Password Strength

Tres niveles de defensa, de menor a mayor inversión:

| Nivel | Qué incluye | Implementado en este manual |
|-------|-------------|----------------------------|
| **Básico** | Longitud mínima (8 chars) + confirmación | ✅ `min:8` + `confirmed` |
| **Intermedio** | Verificación contra haveibeenpwned.com | ❌ Mejora futura |
| **Avanzado** | Diccionario de contraseñas comunes + zxcvbn (estimación de entropía) | ❌ No planeado |

**Mejora futura recomendada**: instalar el paquete `arubacao/laravel-password-validation`. Añade una regla de validación que verifica contraseñas contra la API de haveibeenpwned.com (sin enviar la contraseña completa, solo los primeros 5 caracteres del hash SHA-1, usando k-anonymity). Ejemplo:

```php
// Implementación futura con el paquete
'password' => ['required', 'string', 'min:8', 'confirmed', new PwnedPassword()],
```

### 10.3 Email Uniqueness y Timing Attacks

El mensaje de error personalizado en `RegisterRequest` revela si un email ya está registrado:

```json
{
    "errors": {
        "email": ["Este correo electrónico ya está registrado."]
    }
}
```

Esto permite a un atacante **enumerar** emails registrados en el sistema: prueba `admin@empresa.com` → "ya está registrado" → sabe que existe un admin con ese email. Prueba `noexiste@empresa.com` → 201 Created → sabe que no existe.

**¿Es esto aceptable?**

Depende del modelo de amenaza de tu aplicación:

| Escenario | ¿Aceptable? | Mitigación |
|-----------|-------------|------------|
| Aplicación B2C (red social, ecommerce) | Sí, en general | UX de "ese email ya tiene cuenta" es esperado |
| Aplicación B2B/enterprise | Precaución | Podría revelar qué empresas usan tu servicio |
| Aplicación de alta seguridad (banca, gobierno) | No | Mensaje genérico + verificación por email |

**Mitigación parcial que ya tenemos**: rate limiting (`throttle:10,1`) limita la velocidad a la que un atacante puede probar emails. Probar 1000 emails tomaría 100 minutos como mínimo.

**Mitigación completa (no implementada en este manual)**: No revelar si el email existe. En vez de "ya está registrado", siempre responder con éxito y enviar un email de verificación. Si el email ya existe, el email dice "alguien intentó registrar esta cuenta — si no fuiste tú, ignora este mensaje". El atacante nunca sabe si el email existía o no.

### 10.4 SQL Injection

El uso exclusivo de Eloquent + bindings en este flujo previene inyección SQL automáticamente. Cada interacción con la base de datos usa prepared statements:

```php
// ✅ Seguro — Eloquent con bindings
User::create($data);
$user->refreshTokens()->create([...]);
User::where('email', $email)->first();
```

No se usa `DB::raw()`, `whereRaw()`, ni concatenación de strings con input de usuario. **Si añadieras esto en el futuro, asegúrate de usar bindings explícitos.**

### 10.5 XSS en el nombre

El campo `name` se almacena tal cual lo envía el cliente. Si un atacante se registra con:

```json
{
    "name": "<script>alert('XSS')</script>",
    "email": "xss@evil.com"
}
```

La base de datos guardará el script. Cuando ese nombre se devuelva en respuestas JSON, **el backend no escapa nada** porque JSON no tiene contexto de HTML. La responsabilidad de escapar para HTML es del **frontend**.

En Vue/React, esto se maneja automáticamente (escapan por defecto). Si el frontend usa `innerHTML` o `dangerouslySetInnerHTML`, debe sanear el nombre.

**Opción de saneamiento en backend**: aplicar `strip_tags()` en el `AuthService`:

```php
'name' => strip_tags($data['name']),
```

Esto eliminaría tags HTML del nombre antes de guardarlo. Sin embargo, es una decisión controversial: estás modificando el input del usuario. Un nombre legítimo como `"O'Reilly"` no debería ser afectado, pero `strip_tags()` no lo afecta (solo elimina `<tag>`). Para este manual, no aplicamos `strip_tags()` — confiamos en que el frontend maneje la renderización segura de datos provenientes de la API.

### 10.6 Mass Assignment — `$fillable` y `role`

El campo `role` está en `$fillable`, pero el `AuthService::register()` lo asigna explícitamente a `UserRole::User`. Si un atacante intenta:

```json
{
    "name": "Hacker",
    "email": "hacker@evil.com",
    "password": "password123",
    "password_confirmation": "password123",
    "role": "admin"
}
```

El `RegisterRequest` acepta el campo `role` (no lo valida, pero tampoco lo rechaza — los FormRequests no eliminan campos, solo validan los que están en `rules()`). Sin embargo, el controller usa `$request->validated()`, que **retorna solo los campos validados**: `name`, `email`, `password`, `password_confirmation`. El campo `role` no está en `rules()`, así que `validated()` no lo incluye.

El array que llega al Service es:

```php
[
    'name'                  => 'Hacker',
    'email'                 => 'hacker@evil.com',
    'password'              => 'password123',
    'password_confirmation' => 'password123',
]
```

No contiene `role`. El Service hardcodea `'role' => UserRole::User`. El usuario se crea con rol `user` incluso si el atacante envió `"role": "admin"`.

---

## 11. Resumen y Puente a la Parte 5

### 11.1 Lo construido en esta parte

| Componente | Archivo | Estado |
|------------|---------|--------|
| Migración `refresh_tokens` | `database/migrations/xxxx_create_refresh_tokens_table.php` | ✅ Creada y ejecutada |
| Modelo `RefreshToken` | `app/Models/RefreshToken.php` | ✅ Con casts, helpers y relación a User |
| Relación en `User` | `app/Models/User.php` (actualizado) | ✅ `refreshTokens(): HasMany` |
| `RegisterRequest` | `app/Http/Requests/Auth/RegisterRequest.php` | ✅ Validación completa con mensajes en español |
| `AuthService::register()` | `app/Services/AuthService.php` | ✅ Lógica de negocio con transacción |
| `RegisterController` | `app/Http/Controllers/Auth/RegisterController.php` | ✅ Single-action, 5 líneas de lógica |
| Ruta | `routes/api.php` | ✅ `POST /api/register` con rate limiting |
| Tests | `tests/Feature/Auth/RegisterTest.php` | ✅ 7 tests: 1 positivo, 6 negativos |

### 11.2 Flujo completo de registro

```
1. Cliente → POST /api/register (JSON con name, email, password, password_confirmation)

2. Rate Limiter: ¿más de 10 intentos en 1 minuto?
   → Sí: 429 Too Many Requests
   → No: continuar

3. RegisterRequest::authorize(): ¿el registro es público?
   → Sí (true): continuar
   → No (false): 403 Forbidden

4. RegisterRequest::rules(): validar name, email, password, password_confirmation
   → Falla: 422 Unprocessable Content con errores
   → Pasa: $request->validated()

5. RegisterController → AuthService::register(validatedData)

6. AuthService::register():
   a. DB::transaction() inicia
   b. User::create(name, email, password, role=user, status=active)
      → Cast 'hashed' hashea password automáticamente
   c. auth('api')->login($user) → access token (15 min TTL)
   d. auth('api')->setTTL(10080)->login($user) → refresh token (7 días TTL)
   e. $user->refreshTokens()->create(token, expires_at)
   f. DB::transaction() confirma

7. RegisterController → response()->json(['data' => $result], 201)

8. Cliente recibe 201 Created con user, access_token, refresh_token, token_type, expires_in
```

### 11.3 Lo que viene en la Parte 5

La [Parte 5](05-login-autenticacion.md) implementará:

- **`LoginRequest`** — validación de credenciales (email + password).
- **`AuthService::login()`** — verificación de credenciales, validación de estado del usuario (active/inactive/banned), emisión de tokens.
- **`AuthService::refreshTokens()`** — rotación de refresh tokens con detección de reuse.
- **`AuthService::logout()`** — invalidación de access token y refresh token.
- **`LoginController`**, **`RefreshTokenController`**, **`LogoutController`** — single-action controllers.
- **Middleware `JwtAuthenticate`** — protección de rutas con validación JWT automática.
- **Rutas protegidas** — el usuario autenticado puede acceder a su perfil y cerrar sesión.

---

## Decisiones Vinculantes para Partes 5-6

1. **El método `register()` del `AuthService` YA EXISTE.** La Parte 5 debe añadir los métodos `login()`, `refreshTokens()`, y `logout()` a la misma clase `AuthService`. No crear servicios separados.

2. **El modelo `RefreshToken` YA EXISTE** con sus métodos de dominio (`isExpired()`, `isRevoked()`, `isValid()`, `revoke()`). La Parte 5 debe USAR estos métodos, no reimplementarlos ni acceder directamente a las columnas.

3. **La relación `User::refreshTokens()` YA EXISTE.** La Parte 5 la usa para crear, consultar y revocar refresh tokens.

4. **La tabla `refresh_tokens` YA ESTÁ CREADA Y POBLADA** (cada registro crea una fila). La Parte 5 debe usarla para validar refresh tokens entrantes durante el refresh.

5. **El formato de respuesta de registro YA ESTÁ DEFINIDO**:
   ```json
   {
     "data": {
       "user": { "id": 1, "name": "...", "email": "...", "role": "user", "status": "active", ... },
       "access_token": "eyJ...",
       "refresh_token": "eyJ...",
       "token_type": "bearer",
       "expires_in": 900
     }
   }
   ```
   La Parte 5 debe mantener este formato para login y refresh (misma estructura de `data`).

6. **El rate limiting YA ESTÁ CONFIGURADO** en la ruta de registro (`throttle:10,1`). La Parte 5 debe añadir rate limiting en la ruta de login (recomendado: `throttle:5,1` — 5 intentos por minuto, más restrictivo por ser endpoint de autenticación).

7. **El `AuthService` es `final`.** No puede extenderse. Si la Parte 5 necesita variaciones de comportamiento, debe usar composición o inyección de dependencias.

8. **El rol por defecto para nuevos usuarios es `UserRole::User`.** Hardcodeado en el Service. La Parte 5 debe validar que un usuario `Banned` o `Inactive` NO pueda loguearse, lanzando una excepción específica con mensaje apropiado.

9. **Los tokens JWT generados en registro usan los métodos `getJWTIdentifier()` y `getJWTCustomClaims()` del modelo `User`** (Parte 3). La Parte 5 debe usar los mismos métodos para generar tokens en login — coherencia en claims entre registro y login.
