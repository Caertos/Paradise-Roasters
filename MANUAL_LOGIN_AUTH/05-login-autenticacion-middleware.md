# Parte 5: Login, Autenticación y Middleware JWT

## 1. Introducción

### 1.1 Dónde estamos

En las cuatro partes anteriores construimos la base completa del sistema de autenticación:

| Parte | Lo construido | Estado |
|-------|---------------|--------|
| [Parte 1](01-fundamentos-setup-arquitectura.md) | Proyecto Laravel 11, arquitectura en capas, convenciones de código, estructura de directorios | ✅ |
| [Parte 2](02-env-y-base-de-datos.md) | Variables de entorno, base de datos MySQL, migración `users`, modelo `User`, enums `UserRole` y `UserStatus` | ✅ |
| [Parte 3](03-jwt-configuracion-y-tokens.md) | Paquete `tymon/jwt-auth` instalado y configurado, guard `api` con driver `jwt`, claims del JWT, diseño de tabla `refresh_tokens` | ✅ |
| [Parte 4](04-registro-de-usuarios.md) | Migración `refresh_tokens`, modelo `RefreshToken`, `RegisterRequest`, `AuthService::register()`, `RegisterController`, ruta de registro, tests | ✅ |

En este momento, la aplicación **puede** registrar usuarios y emitir tokens JWT, pero **no puede**:

- Autenticar usuarios existentes con email y contraseña (login)
- Proteger rutas con middleware JWT
- Refrescar tokens expirados
- Cerrar sesión de usuarios

Eso es exactamente lo que construiremos aquí.

### 1.2 Objetivo de esta parte

Implementar el ciclo completo de autenticación:

```
Login → Access Token → Proteger Rutas → Refresh → Logout
```

Al terminar esta parte, la aplicación podrá:
1. Autenticar usuarios con email/password y devolver tokens.
2. Proteger rutas con un middleware JWT que rechace peticiones no autenticadas.
3. Refrescar access tokens expirados usando refresh tokens, con detección de reuse attack.
4. Cerrar sesión invalidando tanto el access token como el refresh token.

### 1.3 Qué construiremos

1. **`LoginRequest`** — valida los datos de entrada del login.
2. **`AuthService::login()`** — lógica de negocio: verificar credenciales, validar estado del usuario, emitir tokens.
3. **Excepciones de dominio** — `AuthenticationException` y `AccountInactiveException`.
4. **`LoginController`** — punto de entrada HTTP, single-action.
5. **Rutas públicas** — agrupación `auth` con ruta de login y rate limiting.
6. **Middleware `JwtAuthenticate`** — protege rutas verificando el token JWT en cada petición.
7. **Rutas protegidas** — agrupación bajo `jwt.auth`.
8. **`AuthService::refreshTokens()`** — rotación de refresh tokens con detección de reuse attack.
9. **`AuthService::logout()`** — cierre de sesión completo.
10. **`RefreshTokenRequest`** — valida el refresh token entrante.
11. **`RefreshTokenController`** y **`LogoutController`** — single-action controllers.
12. **Endpoint `/me`** — datos del usuario autenticado vía `UserController`.
13. **Tests de integración** — verificar cada flujo y cada caso de error.

---

## 2. `LoginRequest` — Validación de Credenciales

### 2.1 Crear el FormRequest

```bash
php artisan make:request Auth/LoginRequest
```

Sobrescribe el contenido generado en `app/Http/Requests/Auth/LoginRequest.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'email'    => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ];
    }

    public function messages(): array
    {
        return [
            'email.required'    => 'El correo electrónico es obligatorio.',
            'password.required' => 'La contraseña es obligatoria.',
        ];
    }
}
```

### 2.2 Explicación de cada regla y las reglas AUSENTES

#### `authorize(): bool`

```php
public function authorize(): bool
{
    return true;
}
```

Cualquier persona, autenticada o no, puede intentar hacer login. `true` indica que no hay restricciones de autorización a nivel de FormRequest.

#### Reglas presentes

| Regla | Qué valida | Por qué |
|-------|-----------|---------|
| `email: required` | El campo debe estar presente y no vacío | Sin email no hay autenticación posible |
| `email: string` | Debe ser un string, no un array u objeto | Previene ataques de type juggling |
| `email: email` | Formato de email válido según `filter_var()` | Rechaza `notanemail`, `@missing`, `spaces in@email` |
| `password: required` | El campo debe estar presente y no vacío | Sin contraseña no hay autenticación posible |
| `password: string` | Debe ser un string, no un array u objeto | Previene type juggling |

#### `email:rfc,dns` — ¿Por qué NO aquí?

En el `RegisterRequest` (Parte 4), usamos `email:rfc,dns` con validación estricta de formato RFC 5322 y verificación DNS de registros MX. En el `LoginRequest`, usamos solo `email` sin parámetros adicionales (equivalente a `filter`).

**Razón**: el usuario ya se registró. Durante el registro validamos que su email tenía un formato RFC válido y un dominio con registros MX. Re-validarlo en cada login es:

1. **Redundante**: si el email pasó la validación estricta en el registro, no va a dejar de ser válido después.
2. **Más lento**: la verificación DNS (`dns`) hace una consulta de red real (`checkdnsrr()`). En cada login, esto añade entre 50-500ms de latencia innecesaria.
3. **Punto de fallo**: si el servidor DNS del dominio del usuario está caído temporalmente, el login fallaría por un problema externo a nuestra aplicación.

La validación `email` (básica, `filter_var`) es suficiente para asegurar que el string tiene formato de email.

#### `min:8` para password — ¿Por qué NO aquí?

En el `RegisterRequest`, validamos `password: min:8`. En el `LoginRequest`, NO validamos longitud.

**Razón**: la contraseña ya fue validada durante el registro. El usuario podría haber creado su cuenta con una contraseña de 8+ caracteres, y esa es la que debe ingresar ahora. Si validáramos `min:8` en el login y el usuario ingresa correctamente una contraseña de 8 caracteres... pasa. Pero si la política de contraseñas cambiara en el futuro y este usuario tuviera una contraseña creada antes de que `min:8` fuera la regla, `min:8` en el login lo bloquearía injustamente.

Además, `min:8` en el login **no tiene valor de seguridad**: no previene brute force porque el atacante igual probará contraseñas de cualquier longitud. La defensa contra brute force es el rate limiting, no la validación de longitud.

#### `exists:users,email` — ¿Por qué NO aquí?

Esta es una de las reglas más tentadoras de añadir pero una de las más peligrosas:

```php
// ❌ NUNCA hagas esto en login
'email' => ['required', 'string', 'email', 'exists:users,email'],
```

**Problema: User Enumeration Attack**

Si validas `exists:users,email`, el atacante recibe respuestas diferentes según si el email existe o no:

```
POST /api/login { email: "admin@empresa.com", password: "wrong" }
→ 422 "The selected email is invalid."
   ↑ El email NO existe → el atacante sabe que "admin@empresa.com" no es un usuario

POST /api/login { email: "john@empresa.com", password: "wrong" }
→ 401 "Credenciales inválidas."
   ↑ El email SÍ existe → el atacante sabe que "john@empresa.com" ES un usuario
```

Esta diferencia de respuestas permite a un atacante enumerar todos los emails registrados en el sistema: prueba emails de una base de datos de leaks, y los que pasan `exists` son cuentas válidas. Luego concentra el brute force solo en esos emails.

**En su lugar, validamos la existencia en el Service** con un mensaje de error genérico:

```php
// ✅ Mensaje genérico — no revela si el email existe
throw new AuthenticationException(
    'Credenciales inválidas.',
    'invalid_credentials'
);
```

El atacante recibe exactamente el mismo error (401 + "Credenciales inválidas") tanto si el email no existe como si la contraseña es incorrecta. No puede distinguir entre ambos casos.

### 2.3 `messages()` — Personalización de errores

```php
public function messages(): array
{
    return [
        'email.required'    => 'El correo electrónico es obligatorio.',
        'password.required' => 'La contraseña es obligatoria.',
    ];
}
```

Solo personalizamos los mensajes `required` porque son los errores más comunes en login. Los errores `string` y `email` tienen mensajes razonables por defecto. La ausencia de un mensaje para `email` no válido es intencional: Laravel ya provee "The email field must be a valid email address" que es suficientemente claro.

---

## 3. `AuthService::login()` — Lógica de Negocio

### 3.1 El método completo

Añade este método a la clase `app/Services/AuthService.php` **existente** (junto al método `register()` de la Parte 4):

```php
public function login(array $credentials): array
{
    // Intentar autenticar con el guard JWT
    if (!$token = auth('api')->attempt($credentials)) {
        throw new \App\Exceptions\AuthenticationException(
            'Credenciales inválidas.',
            'invalid_credentials'
        );
    }

    // Obtener el usuario autenticado
    $user = auth('api')->user();

    // Verificar estado del usuario
    if ($user->status !== UserStatus::Active) {
        auth('api')->logout(); // Invalidar el token generado
        throw new \App\Exceptions\AccountInactiveException(
            match($user->status) {
                UserStatus::Inactive => 'Tu cuenta está inactiva. Contacta al administrador.',
                UserStatus::Banned   => 'Tu cuenta ha sido suspendida.',
                default              => 'Tu cuenta no está activa.',
            },
            'account_' . $user->status->value
        );
    }

    // Verificar si el usuario está soft-deleted
    if ($user->trashed()) {
        auth('api')->logout();
        throw new \App\Exceptions\AuthenticationException(
            'Credenciales inválidas.',
            'invalid_credentials'
        );
    }

    // Generar refresh token
    $refreshToken = auth('api')->setTTL(config('jwt.refresh_ttl'))->login($user);

    // Revocar TODOS los refresh tokens anteriores del usuario (one session per user)
    $user->refreshTokens()->whereNull('revoked_at')->update(['revoked_at' => now()]);

    // Guardar nuevo refresh token
    $user->refreshTokens()->create([
        'token'      => $refreshToken,
        'expires_at' => now()->addMinutes(config('jwt.refresh_ttl')),
    ]);

    return [
        'user'          => $user->only(['id', 'name', 'email', 'role', 'status']),
        'access_token'  => $token,
        'refresh_token' => $refreshToken,
        'token_type'    => 'bearer',
        'expires_in'    => config('jwt.ttl') * 60,
    ];
}
```

### 3.2 Explicación detallada, paso a paso

#### Paso 1: `auth('api')->attempt($credentials)`

```php
if (!$token = auth('api')->attempt($credentials)) {
    throw new \App\Exceptions\AuthenticationException(
        'Credenciales inválidas.',
        'invalid_credentials'
    );
}
```

Este es el corazón del login. `attempt()` es un método del driver JWT proporcionado por `tymon/jwt-auth`. Lo que hace internamente:

1. **Extrae las credenciales**: Toma el array `$credentials` que contiene `['email' => 'john@example.com', 'password' => 'Secure123!']`.

2. **Busca al usuario por el campo identificador**: El driver usa el provider configurado en `config/auth.php` → `providers.users` → `model => App\Models\User::class`. Eloquent ejecuta:

   ```sql
   SELECT * FROM users WHERE email = 'john@example.com' LIMIT 1;
   ```

   El campo usado para buscar es el **primer elemento del array `$credentials`**, en este caso `email`. Si pasaras `['username' => 'john', 'password' => '...']`, buscaría por `username`. Esta es la razón por la que el orden de las claves en `$credentials` importa: `email` debe ir primero.

3. **Verifica la contraseña**: Si encuentra un usuario, compara la contraseña usando `Hash::check($credentials['password'], $user->password)`. Internamente, esto usa `password_verify()` de PHP. Si el modelo tiene `SoftDeletes`, **automáticamente excluye usuarios soft-deleted** (`WHERE deleted_at IS NULL`).

4. **Si la verificación falla** (usuario no encontrado o contraseña incorrecta):
   - Retorna `false` — **NO lanza excepción**.
   - No distingue entre "email no existe" y "contraseña incorrecta" → esto es deliberado para prevenir user enumeration.

5. **Si la verificación es exitosa**:
   - Llama a `$user->getJWTIdentifier()` → obtiene `1` (el `id` del usuario).
   - Llama a `$user->getJWTCustomClaims()` → obtiene `['role' => 'user', 'name' => 'John Doe']`.
   - Construye el payload con los claims estándar (`iss`, `iat`, `exp`, `nbf`, `jti`, `sub`, `prv`) y los personalizados.
   - Firma el payload con `JWT_SECRET` usando HS256.
   - Codifica todo a Base64URL.
   - Retorna el string JWT completo.

**¿Por qué `attempt()` en vez de buscar manualmente y luego `login()`?**

```php
// ❌ Enfoque manual — NO usar
$user = User::where('email', $credentials['email'])->first();
if (!$user || !Hash::check($credentials['password'], $user->password)) {
    throw new AuthenticationException('Credenciales inválidas.');
}
$token = auth('api')->login($user);
```

Problemas del enfoque manual:

1. **Timing attack**: `Hash::check()` usa `password_verify()` que es timing-attack safe, pero `User::where('email', ...)->first()` no lo es. Un atacante podría medir tiempos de respuesta para inferir si el email existe (la consulta SQL tarda más si encuentra el usuario que si no). `attempt()` maneja esto internamente con comparaciones de tiempo constante.

2. **Código duplicado**: `attempt()` delega la búsqueda del usuario al provider de Laravel. Si en el futuro cambias el modelo `User` por otro mecanismo de autenticación (LDAP, OAuth), solo cambias el provider, no el código del Service.

3. **Edge cases**: `attempt()` maneja automáticamente `SoftDeletes`, `email_verified_at`, y cualquier scope global que el provider tenga configurado. El código manual tendría que replicar toda esa lógica.

4. **Consistencia**: `attempt()` usa exactamente el mismo mecanismo que `auth('api')->user()` y `auth('api')->login()`. La coherencia entre "cómo se autentica" y "cómo se resuelve el usuario después" está garantizada.

#### Paso 2: Obtener el usuario autenticado

```php
$user = auth('api')->user();
```

Después de `attempt()` exitoso, el usuario queda "logueado" en el contexto del guard `api`. `auth('api')->user()` resuelve al modelo `User` completo desde la base de datos usando el claim `sub` del token recién generado. No genera una segunda consulta innecesaria: el paquete JWT cachea el usuario resuelto en memoria.

#### Paso 3: Verificar estado del usuario

```php
if ($user->status !== UserStatus::Active) {
    auth('api')->logout();
    throw new \App\Exceptions\AccountInactiveException(
        match($user->status) {
            UserStatus::Inactive => 'Tu cuenta está inactiva. Contacta al administrador.',
            UserStatus::Banned   => 'Tu cuenta ha sido suspendida.',
            default              => 'Tu cuenta no está activa.',
        },
        'account_' . $user->status->value
    );
}
```

Las credenciales son correctas, pero el usuario NO está autorizado para usar el sistema. Diferenciamos dos casos:

| Estado | Significado | Mensaje al usuario | Código HTTP | `error_code` |
|--------|-------------|-------------------|-------------|-------------|
| `active` | Cuenta normal, puede loguearse | (No aplica — el login prosigue) | — | — |
| `inactive` | Cuenta desactivada (por admin o por el usuario) | "Tu cuenta está inactiva. Contacta al administrador." | 403 | `account_inactive` |
| `banned` | Cuenta suspendida por violación de términos | "Tu cuenta ha sido suspendida." | 403 | `account_banned` |

**¿Por qué estos mensajes SÍ revelan el estado del usuario?**

Porque esta es información que el usuario LEGÍTIMO necesita. Si tu cuenta fue suspendida, tienes derecho a saberlo. El user enumeration attack NO se aplica aquí porque:

1. El atacante YA proporcionó credenciales correctas (pasó `attempt()`). Ya sabe que el usuario existe.
2. Si las credenciales son incorrectas, nunca llega a esta verificación — recibe "Credenciales inválidas" antes.

**Análisis del `match()`:**

```php
match($user->status) {
    UserStatus::Inactive => 'Tu cuenta está inactiva. Contacta al administrador.',
    UserStatus::Banned   => 'Tu cuenta ha sido suspendida.',
    default              => 'Tu cuenta no está activa.',
}
```

- `match()` es exhaustivo: si en el futuro añades un nuevo estado (`UserStatus::Pending`) y olvidas añadir un caso aquí, PHP lanza `UnhandledMatchError` en tiempo de ejecución. El `default` captura cualquier estado futuro no previsto.
- `$user->status->value` devuelve el string del enum (`"inactive"`, `"banned"`). Se concatena con `account_` para formar el `errorCode` que el frontend puede usar programáticamente.

**`auth('api')->logout()` en caso de error:**

El `attempt()` ya generó un access token válido. Si el usuario no está activo, ese token no debe ser usable. `auth('api')->logout()` añade el `jti` de este token a la blacklist (gracias a `blacklist_enabled: true` en `config/jwt.php`). Si alguien intentara usar este token en una petición posterior, el middleware lo rechazaría porque su `jti` está blacklisteado.

#### Paso 4: Verificar soft-delete

```php
if ($user->trashed()) {
    auth('api')->logout();
    throw new \App\Exceptions\AuthenticationException(
        'Credenciales inválidas.',
        'invalid_credentials'
    );
}
```

En teoría, `attempt()` NO debería encontrar usuarios soft-deleted porque Eloquent aplica el scope global `SoftDeletes` que añade `WHERE deleted_at IS NULL` a todas las queries. Pero en la práctica, un bug en el provider, una migración mal aplicada, o una condición de carrera podrían hacer que un usuario soft-deleted pase `attempt()`.

Este `if` es defensa en profundidad: si ocurre, el token se invalida y el atacante recibe "Credenciales inválidas" (sin revelar que el usuario existió alguna vez). El mensaje es GENÉRICO — same as wrong password — porque un usuario eliminado no debería ser identificable.

#### Paso 5: Generar refresh token

```php
$refreshToken = auth('api')->setTTL(config('jwt.refresh_ttl'))->login($user);
```

Exactamente la misma lógica que en `register()` (Parte 4, sección 6.1):

1. `setTTL(10080)` sobreescribe temporalmente el TTL a 7 días (10080 minutos).
2. `login($user)` genera un JWT con `exp = now() + 604800 segundos`.
3. El token incluye los mismos claims que el access token (`sub`, `role`, `name`, `prv`), solo cambia `exp`.

**Nota sobre `login()` después de `attempt()`:** `login()` crea un NUEVO token. No reutiliza el token generado por `attempt()`. Esto significa que el refresh token y el access token son tokens JWT completamente independientes — diferentes `jti`, diferentes `exp`, mismo payload de claims. Es correcto: ambos son emitidos por el mismo usuario, para la misma sesión, pero con diferentes propósitos y TTLs.

#### Paso 6: Revocar refresh tokens anteriores

```php
$user->refreshTokens()->whereNull('revoked_at')->update(['revoked_at' => now()]);
```

Esta línea implementa la estrategia de **una sesión por usuario** (one session per user):

| Estrategia | Comportamiento | Ventaja | Desventaja |
|------------|---------------|---------|------------|
| **Una sesión por usuario** (este manual) | Cada login invalida la sesión anterior | Simple de implementar, fácil de razonar sobre seguridad | Solo puedes usar la app en un dispositivo a la vez |
| **Múltiples sesiones** | Cada login crea una nueva sesión independiente | Multi-dispositivo sin fricción | Más complejo: necesitas `device_name`, gestión de sesiones, UI de "cerrar otras sesiones" |

Para este manual usamos una sesión por usuario. Si el usuario inicia sesión en su laptop y luego en su teléfono, el login en el teléfono revoca el refresh token de la laptop. Cuando la laptop intente refrescar su access token, recibirá 401 y será redirigida al login.

**¿Por qué `update()` masivo y no `revoke()` individual?**

`revoke()` es un método del modelo `RefreshToken` que revoca UN token:

```php
$token->revoke(); // UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ?
```

`update()` masivo revoca TODOS los tokens activos de una vez:

```php
$user->refreshTokens()->whereNull('revoked_at')->update(['revoked_at' => now()]);
// UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL
```

Usamos `update()` masivo por eficiencia: una sola query SQL en vez de N queries si el usuario tuviera múltiples refresh tokens activos (lo cual no debería ocurrir con una sesión por usuario, pero es una protección adicional).

#### Paso 7: Guardar nuevo refresh token

```php
$user->refreshTokens()->create([
    'token'      => $refreshToken,
    'expires_at' => now()->addMinutes(config('jwt.refresh_ttl')),
]);
```

Inserta una nueva fila en `refresh_tokens` con el token JWT y su fecha de expiración. `$user->refreshTokens()` usa la relación `HasMany` definida en el modelo `User` (Parte 4), y `create()` automáticamente asigna `user_id` al valor de `$user->id`.

#### Paso 8: Respuesta del método

```php
return [
    'user'          => $user->only(['id', 'name', 'email', 'role', 'status']),
    'access_token'  => $token,
    'refresh_token' => $refreshToken,
    'token_type'    => 'bearer',
    'expires_in'    => config('jwt.ttl') * 60,
];
```

Comparativa con la respuesta de `register()`:

| Campo | `register()` | `login()` | Diferencia |
|-------|-------------|-----------|------------|
| `user` | Instancia completa de `User` (Eloquent serializa) | `$user->only([...])` — array con campos seleccionados | `login()` es más explícito sobre qué campos se exponen |
| `access_token` | JWT 15 min | JWT 15 min | Idéntico |
| `refresh_token` | JWT 7 días | JWT 7 días | Idéntico |
| `token_type` | `"bearer"` | `"bearer"` | Idéntico |
| `expires_in` | `900` (segundos) | `900` (segundos) | Idéntico |

Ambas respuestas tienen exactamente la misma estructura. El frontend puede tratar el resultado de `register()` y `login()` de forma intercambiable: guarda los tokens y redirige al dashboard.

---

## 4. Excepciones de Dominio

Las excepciones personalizadas son una de las herramientas más poderosas para mantener la consistencia en las respuestas de error de una API. En vez de que cada Service o Controller decida cómo formatear un error, centralizamos el formato en la excepción.

### 4.1 `AuthenticationException`

Crea el archivo `app/Exceptions/AuthenticationException.php`:

```php
<?php

declare(strict_types=1);

namespace App\Exceptions;

use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuthenticationException extends Exception
{
    public function __construct(
        string $message = 'No autenticado.',
        private readonly string $errorCode = 'unauthenticated',
        int $httpCode = 401
    ) {
        parent::__construct($message, $httpCode);
    }

    public function render(Request $request): JsonResponse
    {
        return response()->json([
            'error' => [
                'code'    => $this->errorCode,
                'message' => $this->getMessage(),
            ],
        ], $this->getCode() ?: 401);
    }

    public function getErrorCode(): string
    {
        return $this->errorCode;
    }
}
```

### 4.2 `AccountInactiveException`

Crea el archivo `app/Exceptions/AccountInactiveException.php`:

```php
<?php

declare(strict_types=1);

namespace App\Exceptions;

use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AccountInactiveException extends Exception
{
    public function __construct(
        string $message = 'Tu cuenta no está activa.',
        private readonly string $errorCode = 'account_inactive',
        int $httpCode = 403
    ) {
        parent::__construct($message, $httpCode);
    }

    public function render(Request $request): JsonResponse
    {
        return response()->json([
            'error' => [
                'code'    => $this->errorCode,
                'message' => $this->getMessage(),
            ],
        ], $this->getCode() ?: 403);
    }

    public function getErrorCode(): string
    {
        return $this->errorCode;
    }
}
```

### 4.3 Explicación del diseño

#### ¿Por qué excepciones de dominio y no genéricas?

Comparación de enfoques:

```php
// ❌ Enfoque con excepción genérica — inconsistente
throw new \Exception('Credenciales inválidas');
// → El controller tiene que catchear y decidir el código HTTP y el formato JSON
// → Cada controller podría formatear el error de forma diferente
// → El mensaje de error no está asociado a un código de error programático

// ✅ Enfoque con excepción de dominio — consistente y semántico
throw new AuthenticationException('Credenciales inválidas.', 'invalid_credentials');
// → La excepción SABE cómo renderizarse a JSON
// → El código HTTP (401) es parte de la excepción
// → El errorCode permite al frontend manejar casos específicos
```

#### El método `render()`

```php
public function render(Request $request): JsonResponse
{
    return response()->json([
        'error' => [
            'code'    => $this->errorCode,
            'message' => $this->getMessage(),
        ],
    ], $this->getCode() ?: 401);
}
```

Laravel llama automáticamente a `render()` cuando una excepción NO es atrapada con `try/catch`. El flujo es:

1. El Service lanza `throw new AuthenticationException(...)`.
2. La excepción sube por la pila de llamadas: Service → Controller → Middleware → Exception Handler de Laravel.
3. Laravel verifica si la excepción tiene método `render()`.
4. Si lo tiene, lo llama y devuelve su resultado como respuesta HTTP.
5. Si no lo tiene, usa el handler por defecto (HTML en web, JSON en API).

No necesitas `try/catch` en el controller. La excepción "sabe" cómo presentarse al cliente.

#### Códigos HTTP semánticos

| Excepción | Código HTTP | Significado |
|-----------|-------------|-------------|
| `AuthenticationException` | `401 Unauthorized` | "No sé quién eres" o "tus credenciales son incorrectas". Es un problema de AUTENTICACIÓN. |
| `AccountInactiveException` | `403 Forbidden` | "Sé quién eres (las credenciales son correctas) pero NO tienes permiso para acceder (cuenta inactiva/baneada)". Es un problema de AUTORIZACIÓN. |

Esta distinción entre 401 y 403 es sutil pero importante:

- **401**: No estás autenticado. La solución es proporcionar credenciales válidas.
- **403**: Estás autenticado pero no autorizado. La solución NO es cambiar credenciales, es resolver el estado de tu cuenta.

#### El campo `errorCode`

```php
private readonly string $errorCode = 'unauthenticated';
```

Cada excepción lleva un código de error programático (`error_code` en el JSON de respuesta) que permite al frontend manejar casos específicos con lógica condicional:

```javascript
// Frontend (React/Vue) — pseudocódigo
try {
    const response = await api.post('/login', credentials);
    // éxito
} catch (error) {
    switch (error.response.data.error.code) {
        case 'invalid_credentials':
            // Mostrar mensaje genérico: "Email o contraseña incorrectos"
            break;
        case 'account_inactive':
            // Redirigir a página de "cuenta inactiva — contacta al admin"
            break;
        case 'account_banned':
            // Redirigir a página de "cuenta suspendida"
            break;
        case 'token_expired':
            // Intentar refresh automáticamente
            break;
        case 'token_missing':
            // Redirigir al login
            break;
    }
}
```

Sin `errorCode`, el frontend tendría que hacer string matching sobre el `message`, lo cual es frágil (cambios de texto rompen la lógica) y problemático con i18n (el mensaje cambia según el idioma).

---

## 5. `LoginController` — Punto de Entrada HTTP

Crea el archivo `app/Http/Controllers/Auth/LoginController.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Http\Requests\Auth\LoginRequest;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;

final class LoginController
{
    public function __invoke(LoginRequest $request, AuthService $authService): JsonResponse
    {
        $result = $authService->login($request->validated());

        return response()->json([
            'data' => $result,
        ]);
    }
}
```

### 5.1 Explicación

#### Single-action controller (`__invoke`)

```php
final class LoginController
{
    public function __invoke(LoginRequest $request, AuthService $authService): JsonResponse
```

Mismo patrón que `RegisterController` (Parte 4). Una clase con una sola responsabilidad: manejar la petición HTTP de login. No hay métodos `store()`, `create()`, `edit()` como en un resource controller tradicional. `Route::post('/login', LoginController::class)` llama automáticamente a `__invoke`.

#### ¿Por qué `200 OK` y no `201 Created`?

| Endpoint | Código HTTP | Razón |
|----------|-------------|-------|
| `POST /register` | `201 Created` | Se crea un recurso nuevo (un usuario). |
| `POST /login` | `200 OK` | No se crea un recurso nuevo. Se crea una **sesión/token**, y las sesiones no son recursos RESTful en el sentido tradicional. |

`201 Created` implica "aquí tienes la URL del nuevo recurso" (header `Location`). Un token no tiene URL canónica. `200 OK` es semánticamente correcto: la petición fue exitosa, aquí está el resultado.

#### `$request->validated()`

```php
$result = $authService->login($request->validated());
```

`validated()` retorna `['email' => 'john@example.com', 'password' => 'Secure123!']`. Solo los campos definidos en `rules()` del `LoginRequest`. Si el cliente enviara campos adicionales (`remember_me`, `device_name`), serían ignorados — no llegan al Service.

#### Respuesta del controller

```php
return response()->json([
    'data' => $result,
]);
```

El controller tiene 3 líneas de lógica. No hay `if`, no hay `try/catch`, no hay formateo manual. La excepción de autenticación se lanza desde el Service y Laravel la captura automáticamente llamando a `render()`.

**Diferencias clave con `RegisterController`:**

| Aspecto | `RegisterController` | `LoginController` |
|---------|---------------------|-------------------|
| Código HTTP | `201 Created` | `200 OK` |
| Service llamado | `$authService->register()` | `$authService->login()` |
| Request inyectado | `RegisterRequest` | `LoginRequest` |
| Respuesta | Misma estructura `{ data: { user, access_token, refresh_token, ... } }` | Misma estructura |
| Excepciones posibles | Errores de validación (422) manejados por FormRequest, errores de BD (500) manejados por Laravel | `AuthenticationException` (401), `AccountInactiveException` (403), errores de validación (422) |

---

## 6. Ruta de Login y Grupo de Rutas Públicas

### 6.1 Agrupación de rutas públicas

Edita `routes/api.php` para agrupar las rutas de autenticación pública:

```php
<?php

use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\RegisterController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function () {
    Route::post('/register', RegisterController::class)
        ->name('auth.register')
        ->middleware('throttle:10,1');

    Route::post('/login', LoginController::class)
        ->name('auth.login')
        ->middleware('throttle:5,1');
});
```

### 6.2 Explicación

#### Prefijo `auth`

```php
Route::prefix('auth')->group(function () {
    // ...
});
```

Laravel carga `routes/api.php` con el prefijo `/api` (definido en `bootstrap/app.php` en Laravel 11). Con el prefijo `auth`, las rutas completas quedan:

| Ruta | Nombre | Middleware |
|------|--------|------------|
| `POST /api/auth/register` | `auth.register` | `throttle:10,1` |
| `POST /api/auth/login` | `auth.login` | `throttle:5,1` |

El prefijo `auth` comunica claramente que estas rutas pertenecen al dominio de autenticación. Si en el futuro añadieras `POST /api/auth/forgot-password` o `POST /api/auth/reset-password`, encajarían naturalmente en este grupo.

#### Rate limiting en login: `throttle:5,1`

```php
->middleware('throttle:5,1');
```

| Endpoint | Rate Limit | Razón |
|----------|-----------|-------|
| Registro | `throttle:10,1` (10/min) | El registro es más permisivo porque: a) un usuario legítimo normalmente se registra UNA vez, b) los bots de registro necesitan muchas cuentas rápidamente. |
| **Login** | **`throttle:5,1` (5/min)** | **Más restrictivo** porque: a) el login es el vector principal de brute force, b) un usuario legítimo puede equivocarse 2-3 veces, pero 5 intentos en un minuto es sospechoso, c) un atacante probando contraseñas de un diccionario hará cientos de intentos. |

5 intentos por minuto son suficientes para un usuario real que:

1. Escribe mal su contraseña 2-3 veces (teclado en otro idioma, mayúsculas).
2. La recuerda y la escribe correctamente al 4° intento.

No son suficientes para un atacante que está iterando sobre un diccionario de 10,000 contraseñas comunes (tomaría 2,000 minutos = 33 horas para probar todas contra un solo email).

Si el límite se excede, Laravel responde:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60
Content-Type: application/json

{
    "message": "Too Many Requests"
}
```

#### Naming

```php
->name('auth.login');
```

Nombrar las rutas permite referenciarlas simbólicamente:

```php
// En tests:
$response = $this->postJson(route('auth.login'), $credentials);

// En generar URLs desde cualquier parte del código:
$loginUrl = route('auth.login'); // "http://localhost:8000/api/auth/login"
```

Si algún día cambias `/login` a `/signin`, solo modificas la ruta. Todas las referencias por nombre siguen funcionando.

---

## 7. Middleware `JwtAuthenticate` — Protección de Rutas

El middleware es la pieza que protege las rutas: cada petición a un endpoint protegido pasa por aquí, y si el token no es válido, la petición se rechaza antes de llegar al controller.

### 7.1 Crear el middleware

```bash
php artisan make:middleware JwtAuthenticate
```

Sobrescribe el contenido generado en `app/Http/Middleware/JwtAuthenticate.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Exceptions\AuthenticationException;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class JwtAuthenticate
{
    public function handle(Request $request, Closure $next): Response
    {
        try {
            // Intenta autenticar con el guard JWT
            if (!$user = auth('api')->user()) {
                throw new AuthenticationException(
                    'Token no proporcionado o inválido.',
                    'token_missing_or_invalid'
                );
            }

            // Verificar que el usuario sigue estando activo
            // (podría haber sido baneado después de emitir el token)
            if ($user->status !== \App\Enums\UserStatus::Active) {
                auth('api')->logout(); // Invalidar el token
                throw new AuthenticationException(
                    'Tu cuenta ya no está activa.',
                    'account_inactive',
                    403
                );
            }

            // Verificar soft-delete
            if ($user->trashed()) {
                auth('api')->logout();
                throw new AuthenticationException(
                    'Token inválido.',
                    'token_invalid'
                );
            }

        } catch (\Tymon\JWTAuth\Exceptions\TokenExpiredException $e) {
            throw new AuthenticationException(
                'El token ha expirado.',
                'token_expired'
            );
        } catch (\Tymon\JWTAuth\Exceptions\TokenInvalidException $e) {
            throw new AuthenticationException(
                'El token no es válido.',
                'token_invalid'
            );
        } catch (\Tymon\JWTAuth\Exceptions\JWTException $e) {
            throw new AuthenticationException(
                'Token no proporcionado.',
                'token_missing'
            );
        }

        return $next($request);
    }
}
```

### 7.2 Explicación detallada del flujo

Cada petición a una ruta protegida con `jwt.auth` atraviesa este middleware. El flujo es:

```
Request → auth('api')->user() → ¿token válido?
  ├── Sí → ¿usuario activo? → ¿no soft-deleted?
  │         ├── Sí → next($request) → Controller
  │         └── No  → 403/401
  └── No  → ¿por qué falló?
            ├── TokenExpiredException    → 401 token_expired
            ├── TokenInvalidException    → 401 token_invalid
            └── JWTException             → 401 token_missing
```

#### Paso 1: `auth('api')->user()`

```php
if (!$user = auth('api')->user()) {
    throw new AuthenticationException(
        'Token no proporcionado o inválido.',
        'token_missing_or_invalid'
    );
}
```

`auth('api')->user()` le pide al guard JWT que resuelva al usuario autenticado. El driver JWT hace lo siguiente:

1. Busca el token en el header `Authorization: Bearer <token>`.
2. Si no hay header `Authorization`, lanza `JWTException` → capturado en el `catch` inferior.
3. Si hay header, decodifica el token y verifica la firma con `JWT_SECRET`.
4. Si la firma es inválida o el token está malformado, lanza `TokenInvalidException`.
5. Si el token es válido pero el claim `exp` ya pasó, lanza `TokenExpiredException`.
6. Si el `jti` del token está en la blacklist, lanza `TokenInvalidException` (porque `TokenBlacklistedException` es subclase de `TokenInvalidException`).
7. Si todo es correcto, extrae el claim `sub`, busca `User::find($sub)`, y retorna el modelo.

Este `if (!$user = ...)` es un fallback para cualquier caso donde `user()` retorne `null` sin lanzar excepción — extremadamente raro, pero defensivo.

#### Paso 2: Verificar estado del usuario

```php
if ($user->status !== \App\Enums\UserStatus::Active) {
    auth('api')->logout();
    throw new AuthenticationException(
        'Tu cuenta ya no está activa.',
        'account_inactive',
        403
    );
}
```

**Esta verificación es crítica.** ¿Por qué verificar el estado AQUÍ si ya lo verificamos en `login()`?

| Momento | Usuario activo | Token emitido | Token TTL |
|---------|---------------|---------------|-----------|
| t=0 (login) | ✅ Active | Access token emitido | Expira en t=15min |
| t=5 (admin banea al usuario) | ❌ Banned | Token SIGUE siendo válido criptográficamente | Expira en t=15min |
| t=10 (request del usuario baneado) | ❌ Banned | Token aún no expirado → si no verificamos estado aquí, PASARÍA | — |

Sin esta verificación en el middleware, un usuario baneado tendría acceso durante el tiempo restante de su access token (hasta 15 minutos). Con esta verificación, el acceso se corta inmediatamente (en el siguiente request).

**Trade-off: una query extra a la base de datos por request autenticado.** `auth('api')->user()` YA hizo una query para resolver al usuario (`User::find($sub)`). El modelo ya está cargado en memoria, así que `$user->status` NO genera una query adicional — es una lectura de un atributo del modelo ya hidratado.

#### Paso 3: Verificar soft-delete

```php
if ($user->trashed()) {
    auth('api')->logout();
    throw new AuthenticationException(
        'Token inválido.',
        'token_invalid'
    );
}
```

Similar al caso de estado: un usuario podría ser soft-deleted después de que su token fue emitido. `trashed()` verifica `deleted_at !== null`.

Mensaje genérico ("Token inválido") — no revelamos que el usuario fue eliminado.

#### Paso 4: Captura de excepciones del paquete JWT

```php
} catch (\Tymon\JWTAuth\Exceptions\TokenExpiredException $e) {
    throw new AuthenticationException(
        'El token ha expirado.',
        'token_expired'
    );
} catch (\Tymon\JWTAuth\Exceptions\TokenInvalidException $e) {
    throw new AuthenticationException(
        'El token no es válido.',
        'token_invalid'
    );
} catch (\Tymon\JWTAuth\Exceptions\JWTException $e) {
    throw new AuthenticationException(
        'Token no proporcionado.',
        'token_missing'
    );
}
```

Estas excepciones las lanza `auth('api')->user()` internamente cuando el token no es válido. Las capturamos y las convertimos a nuestras `AuthenticationException` de dominio con `errorCode` semántico:

| Excepción del paquete | Causa | Nuestra excepción | `errorCode` |
|-----------------------|-------|-------------------|-------------|
| `TokenExpiredException` | `exp` del token ya pasó | `AuthenticationException` | `token_expired` |
| `TokenInvalidException` | Firma inválida, token malformado, o `jti` en blacklist | `AuthenticationException` | `token_invalid` |
| `JWTException` | No hay header `Authorization`, o está vacío | `AuthenticationException` | `token_missing` |

**¿Por qué capturar aquí y no dejar que suban?**

Por consistencia en el formato de error. Si no capturáramos estas excepciones, el paquete JWT devolvería su propio formato de error, que es diferente al nuestro (`{ "error": { "code": "...", "message": "..." } }`). Las capturamos y las convertimos para mantener la consistencia.

**Jerarquía de excepciones del paquete:**

```
JWTException (base)
├── TokenExpiredException
├── TokenInvalidException
│   └── TokenBlacklistedException
└── PayloadException
```

El orden de los `catch` importa: `TokenExpiredException` y `TokenInvalidException` extienden `JWTException`, por lo que deben ir ANTES del `catch (JWTException)`. Si el orden fuera inverso, `JWTException` capturaría todas las subclases y nunca llegaríamos a los catches específicos.

#### Paso 5: Pasar al siguiente middleware/controller

```php
return $next($request);
```

Si todo es válido, la petición continúa al siguiente middleware en la cadena (o al controller si este es el último middleware). `$next($request)` es una closure que representa el resto de la cadena de middleware.

### 7.3 Registrar el middleware en el Kernel

En Laravel 11, los middleware se registran en `bootstrap/app.php`:

```php
<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->alias([
            'jwt.auth' => \App\Http\Middleware\JwtAuthenticate::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();
```

El método `alias()` registra un nombre corto (`jwt.auth`) para la clase del middleware. Esto permite usar `->middleware('jwt.auth')` en las rutas en vez de `->middleware(\App\Http\Middleware\JwtAuthenticate::class)`.

### 7.4 ¿Por qué NO usar el middleware incluido en `tymon/jwt-auth`?

El paquete incluye su propio middleware (`Tymon\JWTAuth\Http\Middleware\Authenticate`), pero NO lo usamos. Razones:

| Aspecto | Middleware del paquete | Nuestro middleware |
|---------|----------------------|-------------------|
| **Formato de error** | Formato propio del paquete | Nuestro formato consistente `{ error: { code, message } }` |
| **Verificación de estado** | ❌ No verifica `UserStatus` | ✅ Verifica que el usuario siga activo |
| **Verificación de soft-delete** | ❌ No verifica | ✅ Verifica `trashed()` |
| **Control de mensajes** | Mensajes en inglés hardcodeados | Mensajes en español personalizables |
| **`errorCode`** | ❌ No proporciona | ✅ Cada error tiene un código programático |
| **Extensibilidad** | Difícil de extender sin heredar | Código propio — control total |

Crear nuestro propio middleware son ~70 líneas y nos da control total sobre el comportamiento, mensajes, y formato de error.

---

## 8. Rutas Protegidas

### 8.1 Agrupación bajo `jwt.auth`

Añade en `routes/api.php`, debajo del grupo `auth`:

```php
use App\Http\Controllers\Auth\LogoutController;
use App\Http\Controllers\Auth\RefreshTokenController;
use App\Http\Controllers\UserController;

Route::middleware('jwt.auth')->group(function () {
    // Perfil del usuario autenticado
    Route::get('/me', [UserController::class, 'me'])->name('user.me');

    // Refresh de tokens
    Route::post('/auth/refresh', RefreshTokenController::class)->name('auth.refresh');

    // Logout
    Route::post('/auth/logout', LogoutController::class)->name('auth.logout');
});
```

### 8.2 Explicación

#### Agrupación por middleware

```php
Route::middleware('jwt.auth')->group(function () {
    // Todas las rutas aquí requieren token JWT válido
});
```

DRY: en vez de repetir `->middleware('jwt.auth')` en cada ruta, lo declaramos una vez para el grupo. Cualquier ruta añadida dentro del grupo hereda automáticamente la protección JWT.

#### Orden de las rutas en `api.php`

```php
// 1. Rutas públicas (sin middleware)
Route::prefix('auth')->group(function () {
    Route::post('/register', ...);
    Route::post('/login', ...);
});

// 2. Rutas protegidas (con middleware jwt.auth)
Route::middleware('jwt.auth')->group(function () {
    Route::get('/me', ...);
    Route::post('/auth/refresh', ...);
    Route::post('/auth/logout', ...);
});
```

El orden importa porque Laravel evalúa las rutas en el orden en que están definidas. Si una ruta pública y una protegida coincidieran (no es el caso aquí), la primera que haga match gana.

#### `/me` — Usuario autenticado

```php
Route::get('/me', [UserController::class, 'me'])->name('user.me');
```

Endpoint fundamental para SPAs: después de login/registro, el frontend necesita los datos del usuario autenticado para mostrar "Bienvenido, John" y decidir qué rutas/componentes mostrar según el rol.

`/me` es un estándar de facto en APIs RESTful para "dame los datos del usuario cuyo token estoy enviando". Alternativas: `/user`, `/profile`, `/auth/user`. `/me` es semánticamente claro: "yo" = el usuario autenticado.

#### `/auth/refresh` y `/auth/logout` bajo `jwt.auth`

```php
Route::post('/auth/refresh', RefreshTokenController::class)->name('auth.refresh');
Route::post('/auth/logout', LogoutController::class)->name('auth.logout');
```

Estas rutas están bajo el prefijo `auth` pero DENTRO del grupo protegido. La ruta completa es:

| Método | Ruta completa | Nombre | ¿Requiere token? |
|--------|-------------|--------|-----------------|
| `GET` | `/api/me` | `user.me` | ✅ Sí |
| `POST` | `/api/auth/refresh` | `auth.refresh` | ✅ Sí |
| `POST` | `/api/auth/logout` | `auth.logout` | ✅ Sí |

Wait — ¿refresh requiere token? La respuesta es **sí, requiere access token**. Esto puede parecer contradictorio (si el access token expiró, ¿cómo pasas el middleware JWT?), y es una excelente pregunta.

**Excepción para refresh en el middleware:**

Para manejar este caso correctamente, el middleware `JwtAuthenticate` DEBE permitir tokens expirados en la ruta de refresh. Añade esta condición al inicio del método `handle()`:

```php
public function handle(Request $request, Closure $next): Response
{
    $isRefreshRoute = $request->is('api/auth/refresh');

    try {
        if (!$user = auth('api')->user()) {
            throw new AuthenticationException(
                'Token no proporcionado o inválido.',
                'token_missing_or_invalid'
            );
        }

        // ... resto de verificaciones ...

    } catch (\Tymon\JWTAuth\Exceptions\TokenExpiredException $e) {
        // Permitir tokens expirados SOLO en la ruta de refresh
        if ($isRefreshRoute) {
            return $next($request);
        }

        throw new AuthenticationException(
            'El token ha expirado.',
            'token_expired'
        );
    } catch (\Tymon\JWTAuth\Exceptions\TokenInvalidException $e) {
        throw new AuthenticationException(
            'El token no es válido.',
            'token_invalid'
        );
    } catch (\Tymon\JWTAuth\Exceptions\JWTException $e) {
        throw new AuthenticationException(
            'Token no proporcionado.',
            'token_missing'
        );
    }

    return $next($request);
}
```

La lógica es: si el token expiró PERO estamos en la ruta `/api/auth/refresh`, permitimos que la petición continúe. El `RefreshTokenController` usará el refresh token (que viene en el body, no en el header) para validar la sesión.

**¿Por qué no hacer la ruta de refresh pública?**

Si la ruta de refresh fuera pública (sin middleware JWT), cualquiera podría enviar refresh tokens sin siquiera tener un access token. Aunque el refresh token está protegido (es un JWT firmado y se valida contra la DB), añadir el access token como capa adicional:

1. Permite identificar al usuario ANTES de validar el refresh token (el claim `sub` del access token expirado sigue siendo legible).
2. El `sub` del access token debe coincidir con el `sub` del refresh token — el middleware fuerza esta consistencia.
3. Añade una capa adicional de defensa: el atacante necesita DOS tokens (access + refresh) en vez de uno solo.

Si prefieres mantener la ruta de refresh pública, omite `$isRefreshRoute` y coloca `POST /auth/refresh` en el grupo de rutas públicas. Ambas opciones son válidas. Este manual usa la ruta protegida con excepción para tokens expirados.

---

## 9. `AuthService::refreshTokens()` — Rotación de Tokens con Detección de Reuse Attack

### 9.1 El método completo

Añade este método a `app/Services/AuthService.php`:

```php
use App\Models\RefreshToken;

public function refreshTokens(string $refreshToken): array
{
    // Buscar refresh token en DB
    $storedToken = RefreshToken::where('token', $refreshToken)->first();

    // Validar existencia, expiración y revocación
    if (!$storedToken || $storedToken->isExpired() || $storedToken->isRevoked()) {
        // Si el refresh token está revocado pero no expirado → posible reuse attack
        if ($storedToken && $storedToken->isRevoked() && !$storedToken->isExpired()) {
            // Revocar TODOS los refresh tokens del usuario (compromiso de seguridad)
            $storedToken->user->refreshTokens()
                ->whereNull('revoked_at')
                ->update(['revoked_at' => now()]);

            // Invalidar access token actual
            auth('api')->invalidate(true); // true = forever (no grace period)
        }

        throw new AuthenticationException(
            'Refresh token inválido o expirado.',
            'invalid_refresh_token'
        );
    }

    $user = $storedToken->user;

    // Verificar estado del usuario
    if ($user->status !== UserStatus::Active || $user->trashed()) {
        $storedToken->revoke();
        throw new AccountInactiveException(
            'Tu cuenta no está activa.',
            'account_inactive'
        );
    }

    // Revocar refresh token actual (rotación)
    $storedToken->revoke();

    // Emitir nuevos tokens
    $newAccessToken  = auth('api')->login($user);
    $newRefreshToken = auth('api')->setTTL(config('jwt.refresh_ttl'))->login($user);

    // Guardar nuevo refresh token
    $user->refreshTokens()->create([
        'token'      => $newRefreshToken,
        'expires_at' => now()->addMinutes(config('jwt.refresh_ttl')),
    ]);

    return [
        'access_token'  => $newAccessToken,
        'refresh_token' => $newRefreshToken,
        'token_type'    => 'bearer',
        'expires_in'    => config('jwt.ttl') * 60,
    ];
}
```

### 9.2 Explicación detallada de cada paso

#### Paso 1: Buscar el refresh token en la base de datos

```php
$storedToken = RefreshToken::where('token', $refreshToken)->first();
```

Buscamos el refresh token en la tabla `refresh_tokens` por su valor JWT completo. El índice `idx_refresh_tokens_token` (creado en la Parte 4) hace que esta consulta sea O(log n) incluso con millones de tokens.

**¿Por qué buscar en la DB y no solo validar la firma JWT?**

El paquete `tymon/jwt-auth` puede validar la firma del refresh token (es un JWT como cualquier otro), pero necesitamos la DB para saber si fue REVOCADO. La revocación es una operación de base de datos — no hay forma de saber desde el token mismo si fue revocado. El JWT dice "soy válido hasta el día X", pero no dice "fui revocado ayer".

#### Paso 2: Validar existencia, expiración y revocación

```php
if (!$storedToken || $storedToken->isExpired() || $storedToken->isRevoked()) {
    // ...
}
```

Usamos los métodos de dominio del modelo `RefreshToken` (Parte 4):

| Método | Qué verifica | SQL equivalente |
|--------|-------------|-----------------|
| `!$storedToken` | ¿Existe el token en la DB? | `SELECT ... WHERE token = ?` no encontró nada |
| `$storedToken->isExpired()` | ¿`expires_at` ya pasó? | `WHERE expires_at < NOW()` → devuelve `true` si pasó |
| `$storedToken->isRevoked()` | ¿`revoked_at` no es null? | `WHERE revoked_at IS NOT NULL` → `true` si fue revocado |

Si cualquiera de estas condiciones es verdadera, el refresh token NO es válido. Pero antes de lanzar la excepción, verificamos si es un ataque de reuse.

#### Paso 3: Detección de Reuse Attack

```php
if ($storedToken && $storedToken->isRevoked() && !$storedToken->isExpired()) {
    // REUSE ATTACK DETECTADO
    $storedToken->user->refreshTokens()
        ->whereNull('revoked_at')
        ->update(['revoked_at' => now()]);

    auth('api')->invalidate(true);
}
```

Esta es una de las protecciones más importantes de la rotación de refresh tokens. El razonamiento:

**Escenario normal:**
1. El usuario legítimo usa su refresh token → el servidor lo revoca y emite uno nuevo.
2. El usuario legítimo usa el NUEVO refresh token → todo bien.

**Escenario de ataque:**
1. Un atacante roba el refresh token del usuario legítimo (MITM, XSS, leak).
2. El usuario legítimo usa su refresh token → el servidor lo revoca y emite uno nuevo.
3. El atacante intenta usar el refresh token ROBADO (el mismo que el usuario ya usó en el paso 2).

En el paso 3, `$storedToken` EXISTE en la DB pero `isRevoked()` es `true` (el usuario legítimo ya lo usó en el paso 2) y `isExpired()` es `false` (todavía está dentro de los 7 días). Esta combinación — **revocado pero no expirado** — es la firma de un ataque de reuse:

| Estado del token | ¿Existe? | ¿Revocado? | ¿Expirado? | Interpretación |
|-----------------|----------|------------|------------|----------------|
| Nunca emitido | ❌ No | — | — | Token inválido — no hay ataque |
| Usado normalmente, ya rotado | ✅ Sí | ✅ Sí | ✅ Sí | Token viejo que expiró naturalmente — no hay ataque |
| **Usado, revocado, NO expirado** | **✅ Sí** | **✅ Sí** | **❌ No** | **POSIBLE ATAQUE DE REUSE** |
| Activo | ✅ Sí | ❌ No | ❌ No | Token válido — refresh normal |

**¿Qué hacemos cuando detectamos reuse?**

1. **Revocamos TODOS los refresh tokens del usuario:**

   ```php
   $storedToken->user->refreshTokens()
       ->whereNull('revoked_at')
       ->update(['revoked_at' => now()]);
   ```

   Esto incluye el refresh token que el usuario legítimo recibió en el paso 2. El usuario legítimo es forzado a volver a loguearse. Es una fricción, pero preferible a que el atacante mantenga acceso.

2. **Invalidamos el access token actual:**

   ```php
   auth('api')->invalidate(true); // true = forever (no grace period)
   ```

   `invalidate(true)` añade el `jti` del access token actual a la blacklist con TTL igual al `exp` del token (es decir, permanece blacklisteado hasta que habría expirado naturalmente). El parámetro `true` significa "forever" — ignora el `blacklist_grace_period` y rechaza inmediatamente.

**¿Qué gana el atacante? NADA.**

- El refresh token robado es rechazado (revocado).
- Incluso si el atacante tuviera un access token válido, también es invalidado.
- El usuario legítimo es desconectado, pero puede volver a loguearse con email/password.

**¿Qué gana el usuario legítimo? SABER que algo pasó.**

La próxima vez que intente usar la app, su refresh token será rechazado → es redirigido al login. Idealmente, en el login se le mostraría un mensaje: "Tu sesión fue cerrada por seguridad. Si no fuiste tú, cambia tu contraseña." (Esto requiere lógica adicional en el frontend, no cubierta aquí.)

#### Paso 4: Verificar estado del usuario

```php
if ($user->status !== UserStatus::Active || $user->trashed()) {
    $storedToken->revoke();
    throw new AccountInactiveException(
        'Tu cuenta no está activa.',
        'account_inactive'
    );
}
```

Misma verificación que en `login()`, pero en el contexto de refresh. Si el usuario fue baneado después del último refresh, no debe poder seguir refrescando tokens.

#### Paso 5: Revocar el refresh token actual

```php
$storedToken->revoke();
```

**Rotación**: el refresh token usado para esta petición es revocado inmediatamente. No puede usarse una segunda vez. Esta es la esencia de la rotación:

```
Refresh Token A → usado → revocado → Refresh Token B emitido
Refresh Token B → usado → revocado → Refresh Token C emitido
Refresh Token A → usado de nuevo → REUSE ATTACK DETECTADO
```

#### Paso 6: Emitir nuevos tokens

```php
$newAccessToken  = auth('api')->login($user);
$newRefreshToken = auth('api')->setTTL(config('jwt.refresh_ttl'))->login($user);
```

Misma lógica que en `login()` y `register()`: access token de 15 minutos, refresh token de 7 días.

#### Paso 7: Guardar nuevo refresh token

```php
$user->refreshTokens()->create([
    'token'      => $newRefreshToken,
    'expires_at' => now()->addMinutes(config('jwt.refresh_ttl')),
]);
```

El nuevo refresh token se persiste en la base de datos. Ahora es el ÚNICO refresh token activo para este usuario (una sesión por usuario).

#### Paso 8: Respuesta del método

```php
return [
    'access_token'  => $newAccessToken,
    'refresh_token' => $newRefreshToken,
    'token_type'    => 'bearer',
    'expires_in'    => config('jwt.ttl') * 60,
];
```

Comparativa con la respuesta de `login()`:

| Campo | `login()` | `refreshTokens()` | Diferencia |
|-------|----------|-------------------|------------|
| `user` | ✅ Incluido | ❌ No incluido | El refresh no necesita devolver el usuario — el frontend ya lo tiene |
| `access_token` | ✅ | ✅ | Mismo formato |
| `refresh_token` | ✅ | ✅ | Mismo formato |
| `token_type` | ✅ | ✅ | Mismo formato |
| `expires_in` | ✅ | ✅ | Mismo formato |

La respuesta de `refreshTokens()` NO incluye `user` porque el frontend ya tiene los datos del usuario (los obtuvo en el login/registro). Si los necesita actualizados, puede llamar a `GET /me`.

---

## 10. `AuthService::logout()` — Cierre de Sesión

### 10.1 El método completo

Añade este método a `app/Services/AuthService.php`:

```php
public function logout(): void
{
    $user = auth('api')->user();

    if ($user) {
        // Revocar todos los refresh tokens del usuario
        $user->refreshTokens()
            ->whereNull('revoked_at')
            ->update(['revoked_at' => now()]);

        // Invalidar el access token actual (blacklist)
        auth('api')->logout();
    }
}
```

### 10.2 Explicación

#### ¿Por qué dos operaciones de invalidación?

El logout debe cerrar la sesión COMPLETAMENTE. Esto requiere dos acciones:

1. **Revocar refresh tokens**: Sin esto, el usuario podría usar su refresh token para obtener un nuevo access token incluso después de hacer logout. El refresh token seguiría siendo válido criptográficamente y no está blacklisteado (la blacklist es solo para access tokens).

   ```php
   $user->refreshTokens()
       ->whereNull('revoked_at')
       ->update(['revoked_at' => now()]);
   ```

2. **Invalidar el access token actual**: Sin esto, el access token seguiría siendo válido por el tiempo que le quede de TTL (hasta 15 minutos). Aunque el usuario ya no puede refrescar, podría seguir usando la API durante el resto de la ventana del access token.

   ```php
   auth('api')->logout();
   ```

   `auth('api')->logout()` añade el `jti` del access token actual a la blacklist. Si alguien intenta usar este token en una petición posterior, el middleware `JwtAuthenticate` lo rechazará (porque el `jti` está en la blacklist).

#### Idempotencia

```php
if ($user) {
    // ...
}
```

Llamar `logout()` dos veces no causa errores:
- La segunda vez, `$user->refreshTokens()->whereNull('revoked_at')` no encuentra tokens → `update()` afecta 0 filas.
- La segunda vez, `auth('api')->logout()` intenta blacklistear un token que ya está blacklisteado → el paquete ignora duplicados.

#### ¿Por qué no borrar el refresh token de la DB?

Usamos `revoked_at` (soft-revoke) en vez de `DELETE` (hard-delete) por las mismas razones que en el diseño original de la tabla (Parte 4):

1. **Auditoría forense**: ¿El usuario cerró sesión voluntariamente o fue un cierre forzoso por ataque de reuse? `revoked_at` lo registra.
2. **Debugging**: Si un usuario reporta problemas de sesión, puedes consultar el historial de sus refresh tokens.
3. **Consistencia**: El modelo `RefreshToken` usa soft-revoke en todo el sistema. Mezclar hard-delete en logout y soft-revoke en refresh sería inconsistente.

---

## 11. `RefreshTokenRequest` — Validación del Refresh Token

Crea el archivo `app/Http/Requests/Auth/RefreshTokenRequest.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class RefreshTokenRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'refresh_token' => ['required', 'string'],
        ];
    }

    public function messages(): array
    {
        return [
            'refresh_token.required' => 'El refresh token es obligatorio.',
        ];
    }
}
```

### 11.1 Explicación

La validación es mínima: el campo `refresh_token` debe estar presente y ser un string. No validamos el formato JWT aquí porque:

1. El formato JWT se valida en el Service cuando `auth('api')` intenta decodificarlo.
2. Si el token está malformado, el Service lanzará `AuthenticationException` con `invalid_refresh_token`.
3. Validar formato JWT en el FormRequest requeriría lógica de decodificación duplicada aquí, rompiendo el principio de single responsibility.

---

## 12. `RefreshTokenController` y `LogoutController`

### 12.1 `RefreshTokenController`

Crea el archivo `app/Http/Controllers/Auth/RefreshTokenController.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Http\Requests\Auth\RefreshTokenRequest;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;

final class RefreshTokenController
{
    public function __invoke(RefreshTokenRequest $request, AuthService $authService): JsonResponse
    {
        $result = $authService->refreshTokens($request->validated('refresh_token'));

        return response()->json([
            'data' => $result,
        ]);
    }
}
```

Nota: `$request->validated('refresh_token')` extrae solo el valor del campo `refresh_token` del array validado. Es equivalente a `$request->validated()['refresh_token']` pero más limpio.

### 12.2 `LogoutController`

Crea el archivo `app/Http/Controllers/Auth/LogoutController.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Services\AuthService;
use Illuminate\Http\JsonResponse;

final class LogoutController
{
    public function __invoke(AuthService $authService): JsonResponse
    {
        $authService->logout();

        return response()->json([
            'data' => [
                'message' => 'Sesión cerrada exitosamente.',
            ],
        ]);
    }
}
```

### 12.3 Explicación

Ambos controllers siguen el mismo patrón: single-action, inyección de dependencias, delegación total al Service.

| Controller | Líneas de lógica | Service llamado | Respuesta |
|-----------|-----------------|-----------------|-----------|
| `RefreshTokenController` | 1 | `$authService->refreshTokens()` | `{ data: { access_token, refresh_token, token_type, expires_in } }` |
| `LogoutController` | 1 | `$authService->logout()` | `{ data: { message: "Sesión cerrada exitosamente." } }` |

El `LogoutController` NO devuelve `204 No Content` (que sería semánticamente correcto para un DELETE exitoso) porque:

1. Usamos `POST /auth/logout`, no `DELETE`. Las operaciones de autenticación suelen ser POST.
2. La respuesta con mensaje es más amigable para el frontend: puede mostrar "Sesión cerrada" al usuario.
3. `POST` con body de respuesta es más fácil de manejar en interceptors HTTP que `204 No Content`.

---

## 13. Endpoint `/me` — Usuario Autenticado

### 13.1 `UserController`

Crea el archivo `app/Http/Controllers/UserController.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;

final class UserController
{
    public function me(): JsonResponse
    {
        $user = auth('api')->user();

        return response()->json([
            'data' => [
                'user' => $user->only(['id', 'name', 'email', 'role', 'status']),
            ],
        ]);
    }
}
```

### 13.2 Explicación

#### `auth('api')->user()`

En este punto, el middleware `JwtAuthenticate` YA verificó que el token es válido y el usuario está activo. `auth('api')->user()` devuelve el modelo `User` ya resuelto (cacheado en memoria por el middleware). No genera una segunda consulta a la base de datos.

#### `$user->only([...])`

Limitamos los campos expuestos a los necesarios para el frontend:

| Campo | Propósito en el frontend |
|-------|------------------------|
| `id` | Identificador único para operaciones (actualizar perfil, eliminar cuenta) |
| `name` | Mostrar "Bienvenido, John" en la UI |
| `email` | Mostrar en la página de perfil |
| `role` | Control de acceso en el frontend (mostrar/ocultar panel admin) |
| `status` | Información para el usuario sobre el estado de su cuenta |

No exponemos `password`, `remember_token`, `email_verified_at`, `created_at`, `updated_at`, `deleted_at`. Los campos sensibles ya están en `$hidden` del modelo, pero `only()` es una capa adicional de defensa explícita.

#### ¿Por qué no usar `auth('api')->user()` directamente en la respuesta?

```php
// ❌ Expone TODOS los campos visibles del modelo
return response()->json([
    'data' => [
        'user' => auth('api')->user(),
    ],
]);
```

Aunque `$hidden` protegería `password` y `remember_token`, `created_at` y `updated_at` quedarían expuestos. Usar `only()` hace explícito qué campos se exponen, facilitando auditorías de seguridad y documentación de API.

---

## 14. Testing del Login, Middleware, Refresh y Logout

### 14.1 Archivo de tests

Crea el archivo `tests/Feature/Auth/LoginTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Auth;

use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LoginTest extends TestCase
{
    use RefreshDatabase;

    private string $password = 'Secure123!';

    private function createUser(array $overrides = []): User
    {
        return User::factory()->create(array_merge([
            'email'    => 'test@example.com',
            'password' => $this->password,
            'status'   => UserStatus::Active,
        ], $overrides));
    }

    private function loginPayload(string $email = 'test@example.com', string $password = null): array
    {
        return [
            'email'    => $email,
            'password' => $password ?? $this->password,
        ];
    }

    // ──── Tests de Login Exitoso ────

    public function test_user_can_login_with_valid_credentials(): void
    {
        $this->createUser();

        $response = $this->postJson(route('auth.login'), $this->loginPayload());

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    'user' => [
                        'id',
                        'name',
                        'email',
                        'role',
                        'status',
                    ],
                    'access_token',
                    'refresh_token',
                    'token_type',
                    'expires_in',
                ],
            ]);

        $this->assertDatabaseHas('refresh_tokens', [
            'user_id'     => 1,
            'revoked_at'  => null,
        ]);
    }

    // ──── Tests de Credenciales Inválidas ────

    public function test_login_fails_with_wrong_password(): void
    {
        $this->createUser();

        $response = $this->postJson(route('auth.login'), $this->loginPayload(password: 'WrongPassword!'));

        $response->assertStatus(401)
            ->assertJson([
                'error' => [
                    'code'    => 'invalid_credentials',
                    'message' => 'Credenciales inválidas.',
                ],
            ]);
    }

    public function test_login_fails_with_nonexistent_email(): void
    {
        $response = $this->postJson(route('auth.login'), $this->loginPayload(email: 'noexiste@example.com'));

        $response->assertStatus(401)
            ->assertJson([
                'error' => [
                    'code'    => 'invalid_credentials',
                    'message' => 'Credenciales inválidas.',
                ],
            ]);
    }

    // ──── Tests de Estado de Cuenta ────

    public function test_login_fails_with_inactive_account(): void
    {
        $this->createUser(['status' => UserStatus::Inactive]);

        $response = $this->postJson(route('auth.login'), $this->loginPayload());

        $response->assertStatus(403)
            ->assertJson([
                'error' => [
                    'code'    => 'account_inactive',
                    'message' => 'Tu cuenta está inactiva. Contacta al administrador.',
                ],
            ]);
    }

    public function test_login_fails_with_banned_account(): void
    {
        $this->createUser(['status' => UserStatus::Banned]);

        $response = $this->postJson(route('auth.login'), $this->loginPayload());

        $response->assertStatus(403)
            ->assertJson([
                'error' => [
                    'code'    => 'account_banned',
                    'message' => 'Tu cuenta ha sido suspendida.',
                ],
            ]);
    }

    // ──── Tests de Soft-Delete ────

    public function test_login_fails_with_soft_deleted_user(): void
    {
        $user = $this->createUser();
        $user->delete(); // Soft delete

        $response = $this->postJson(route('auth.login'), $this->loginPayload());

        $response->assertStatus(401)
            ->assertJson([
                'error' => [
                    'code'    => 'invalid_credentials',
                    'message' => 'Credenciales inválidas.',
                ],
            ]);
    }

    // ──── Tests de Rate Limiting ────

    public function test_login_enforces_rate_limiting(): void
    {
        $this->createUser();

        for ($i = 0; $i < 5; $i++) {
            $this->postJson(route('auth.login'), $this->loginPayload(password: 'wrong'));
        }

        $response = $this->postJson(route('auth.login'), $this->loginPayload(password: 'wrong'));

        $response->assertStatus(429);
    }

    // ──── Tests de Middleware JWT ────

    public function test_protected_route_returns_401_without_token(): void
    {
        $response = $this->getJson(route('user.me'));

        $response->assertStatus(401)
            ->assertJson([
                'error' => [
                    'code' => 'token_missing',
                ],
            ]);
    }

    public function test_protected_route_returns_401_with_invalid_token(): void
    {
        $response = $this->getJson(route('user.me'), [
            'Authorization' => 'Bearer invalid.token.here',
        ]);

        $response->assertStatus(401)
            ->assertJson([
                'error' => [
                    'code' => 'token_invalid',
                ],
            ]);
    }

    public function test_protected_route_returns_200_with_valid_token(): void
    {
        $user = $this->createUser();
        $token = auth('api')->login($user);

        $response = $this->getJson(route('user.me'), [
            'Authorization' => 'Bearer ' . $token,
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'data' => [
                    'user' => [
                        'id'    => $user->id,
                        'email' => $user->email,
                    ],
                ],
            ]);
    }

    // ──── Tests de Refresh Token ────

    public function test_can_refresh_tokens(): void
    {
        $user = $this->createUser();
        $accessToken  = auth('api')->login($user);
        $refreshToken = auth('api')->setTTL(config('jwt.refresh_ttl'))->login($user);

        $user->refreshTokens()->create([
            'token'      => $refreshToken,
            'expires_at' => now()->addMinutes(config('jwt.refresh_ttl')),
        ]);

        $response = $this->postJson(route('auth.refresh'), [
            'refresh_token' => $refreshToken,
        ], [
            'Authorization' => 'Bearer ' . $accessToken,
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    'access_token',
                    'refresh_token',
                    'token_type',
                    'expires_in',
                ],
            ]);

        // Verificar que el refresh token original fue revocado
        $this->assertDatabaseHas('refresh_tokens', [
            'token'      => $refreshToken,
            'user_id'    => $user->id,
        ]);
        $this->assertNotNull(
            \App\Models\RefreshToken::where('token', $refreshToken)->first()->revoked_at
        );

        // Verificar que se creó un nuevo refresh token
        $this->assertEquals(
            2,
            \App\Models\RefreshToken::where('user_id', $user->id)->count()
        );
    }

    // ──── Tests de Reuse Attack ────

    public function test_refresh_with_revoked_token_detects_reuse_attack(): void
    {
        $user = $this->createUser();
        $refreshToken = auth('api')->setTTL(config('jwt.refresh_ttl'))->login($user);

        $storedToken = $user->refreshTokens()->create([
            'token'      => $refreshToken,
            'expires_at' => now()->addMinutes(config('jwt.refresh_ttl')),
        ]);

        // Revocar el token (simulando que ya fue usado)
        $storedToken->revoke();

        $accessToken = auth('api')->login($user);

        // Intentar usar el refresh token revocado
        $response = $this->postJson(route('auth.refresh'), [
            'refresh_token' => $refreshToken,
        ], [
            'Authorization' => 'Bearer ' . $accessToken,
        ]);

        $response->assertStatus(401)
            ->assertJson([
                'error' => [
                    'code' => 'invalid_refresh_token',
                ],
            ]);

        // Verificar que TODOS los refresh tokens fueron revocados
        $activeTokens = \App\Models\RefreshToken::where('user_id', $user->id)
            ->whereNull('revoked_at')
            ->count();

        $this->assertEquals(0, $activeTokens, 'Todos los refresh tokens deben estar revocados tras un reuse attack');
    }

    // ──── Tests de Logout ────

    public function test_logout_invalidates_access_token_and_refresh_tokens(): void
    {
        $user = $this->createUser();
        $accessToken  = auth('api')->login($user);
        $refreshToken = auth('api')->setTTL(config('jwt.refresh_ttl'))->login($user);

        $user->refreshTokens()->create([
            'token'      => $refreshToken,
            'expires_at' => now()->addMinutes(config('jwt.refresh_ttl')),
        ]);

        // Hacer logout
        $response = $this->postJson(route('auth.logout'), [], [
            'Authorization' => 'Bearer ' . $accessToken,
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'data' => [
                    'message' => 'Sesión cerrada exitosamente.',
                ],
            ]);

        // Verificar que el access token fue invalidado (no puede usarse)
        $meResponse = $this->getJson(route('user.me'), [
            'Authorization' => 'Bearer ' . $accessToken,
        ]);

        $meResponse->assertStatus(401);

        // Verificar que los refresh tokens fueron revocados
        $activeTokens = \App\Models\RefreshToken::where('user_id', $user->id)
            ->whereNull('revoked_at')
            ->count();

        $this->assertEquals(0, $activeTokens, 'Todos los refresh tokens deben estar revocados tras logout');
    }

    // ──── Tests de Validación ────

    public function test_login_fails_without_email(): void
    {
        $response = $this->postJson(route('auth.login'), [
            'password' => 'Secure123!',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_login_fails_without_password(): void
    {
        $response = $this->postJson(route('auth.login'), [
            'email' => 'test@example.com',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['password']);
    }
}
```

### 14.2 Explicación de los tests

#### Tests de login exitoso — `test_user_can_login_with_valid_credentials`

```php
$response->assertStatus(200)
    ->assertJsonStructure([...]);

$this->assertDatabaseHas('refresh_tokens', [
    'user_id'    => 1,
    'revoked_at' => null,
]);
```

Tres verificaciones:
1. **HTTP 200 OK** — login exitoso.
2. **Estructura de respuesta** — incluye `user`, `access_token`, `refresh_token`, `token_type`, `expires_in`.
3. **Refresh token persistido** — existe en la DB, no está revocado, pertenece al usuario correcto.

#### Tests de credenciales inválidas — `test_login_fails_with_wrong_password` y `test_login_fails_with_nonexistent_email`

AMBOS tests verifican exactamente la misma respuesta: 401 + `invalid_credentials`. Esto confirma que NO estamos filtrando user enumeration — el atacante recibe la misma respuesta tanto si el email no existe como si la contraseña es incorrecta.

```php
// Email incorrecto
$response = $this->postJson(route('auth.login'), ['email' => 'noexiste@...', 'password' => '...']);
$response->assertStatus(401)->assertJson(['error' => ['code' => 'invalid_credentials']]);

// Contraseña incorrecta
$response = $this->postJson(route('auth.login'), ['email' => 'test@...', 'password' => 'wrong']);
$response->assertStatus(401)->assertJson(['error' => ['code' => 'invalid_credentials']]);

// ¡EXACTAMENTE LA MISMA RESPUESTA!
```

#### Tests de estado de cuenta — `test_login_fails_with_inactive_account` y `test_login_fails_with_banned_account`

```php
$response->assertStatus(403)
    ->assertJson([
        'error' => [
            'code'    => 'account_inactive', // o 'account_banned'
            'message' => 'Tu cuenta está inactiva. Contacta al administrador.',
        ],
    ]);
```

Verificamos:
- **403 Forbidden** (no 401) — el usuario está autenticado pero no autorizado.
- **`errorCode` específico** — el frontend puede manejar `account_inactive` y `account_banned` de forma diferente.
- **Mensaje específico** — el usuario legítimo recibe información útil.

#### Test de soft-delete — `test_login_fails_with_soft_deleted_user`

El usuario soft-deleted NO debería poder loguearse, y la respuesta debe ser **GENÉRICA** (`invalid_credentials`, igual que email inexistente o contraseña incorrecta). Un usuario eliminado no debería ser identificable.

#### Tests de middleware JWT

```php
// Sin token → token_missing
public function test_protected_route_returns_401_without_token()

// Token inválido → token_invalid
public function test_protected_route_returns_401_with_invalid_token()

// Token válido → 200 + datos del usuario
public function test_protected_route_returns_200_with_valid_token()
```

Estos tests verifican el middleware desde la perspectiva del cliente HTTP: ¿qué recibe el frontend en cada caso?

#### Tests de refresh token

```php
public function test_can_refresh_tokens()
```

Verificaciones:
1. Refresh exitoso → 200 OK.
2. El refresh token original fue revocado (`revoked_at` NO es null).
3. Se creó un nuevo refresh token (2 filas en total: la original revocada + la nueva activa).

#### Test de reuse attack

```php
public function test_refresh_with_revoked_token_detects_reuse_attack()
```

El test más sofisticado de esta suite:

1. Creamos un refresh token y lo revocamos (simulando que ya fue usado).
2. Intentamos refrescar con ese token revocado.
3. Verificamos 401 + `invalid_refresh_token`.
4. **Verificamos que TODOS los refresh tokens del usuario fueron revocados** (defensa ante reuse attack).

```php
$activeTokens = \App\Models\RefreshToken::where('user_id', $user->id)
    ->whereNull('revoked_at')
    ->count();

$this->assertEquals(0, $activeTokens);
```

#### Test de logout

```php
public function test_logout_invalidates_access_token_and_refresh_tokens()
```

Verifica el cierre completo de sesión:
1. Logout exitoso → 200 OK + mensaje.
2. El access token YA NO funciona para acceder a rutas protegidas (401).
3. Todos los refresh tokens del usuario están revocados.

### 14.3 Ejecutar los tests

```bash
php artisan test --filter LoginTest
```

Salida esperada:

```
PASS  Tests\Feature\Auth\LoginTest
  ✓ user can login with valid credentials
  ✓ login fails with wrong password
  ✓ login fails with nonexistent email
  ✓ login fails with inactive account
  ✓ login fails with banned account
  ✓ login fails with soft deleted user
  ✓ login enforces rate limiting
  ✓ protected route returns 401 without token
  ✓ protected route returns 401 with invalid token
  ✓ protected route returns 200 with valid token
  ✓ can refresh tokens
  ✓ refresh with revoked token detects reuse attack
  ✓ logout invalidates access token and refresh tokens
  ✓ login fails without email
  ✓ login fails without password

Tests:  15 passed
```

---

## 15. Resumen y Puente a Parte 6

### 15.1 Lo construido en esta parte

| Componente | Archivo | Estado |
|------------|---------|--------|
| `LoginRequest` | `app/Http/Requests/Auth/LoginRequest.php` | ✅ Validación con prevención de user enumeration |
| `AuthenticationException` | `app/Exceptions/AuthenticationException.php` | ✅ Con `render()`, `errorCode`, HTTP 401 |
| `AccountInactiveException` | `app/Exceptions/AccountInactiveException.php` | ✅ Con `render()`, `errorCode`, HTTP 403 |
| `AuthService::login()` | `app/Services/AuthService.php` (añadido) | ✅ Verificación de credenciales, estado, soft-delete, emisión de tokens |
| `AuthService::refreshTokens()` | `app/Services/AuthService.php` (añadido) | ✅ Rotación con detección de reuse attack |
| `AuthService::logout()` | `app/Services/AuthService.php` (añadido) | ✅ Invalidación de access token + revocación de refresh tokens |
| `LoginController` | `app/Http/Controllers/Auth/LoginController.php` | ✅ Single-action |
| `RefreshTokenController` | `app/Http/Controllers/Auth/RefreshTokenController.php` | ✅ Single-action |
| `LogoutController` | `app/Http/Controllers/Auth/LogoutController.php` | ✅ Single-action |
| `RefreshTokenRequest` | `app/Http/Requests/Auth/RefreshTokenRequest.php` | ✅ Validación mínima |
| `UserController` | `app/Http/Controllers/UserController.php` | ✅ Endpoint `/me` |
| `JwtAuthenticate` middleware | `app/Http/Middleware/JwtAuthenticate.php` | ✅ Protección de rutas con verificación de estado |
| Rutas públicas | `routes/api.php` | ✅ Agrupación `auth` con rate limiting |
| Rutas protegidas | `routes/api.php` | ✅ Agrupación `jwt.auth` |
| Tests | `tests/Feature/Auth/LoginTest.php` | ✅ 15 tests |

### 15.2 El `AuthService` completo

Al finalizar esta parte, `app/Services/AuthService.php` contiene CUATRO métodos:

```php
final class AuthService
{
    public function register(array $data): array { ... }       // Parte 4
    public function login(array $credentials): array { ... }   // Parte 5
    public function refreshTokens(string $refreshToken): array { ... } // Parte 5
    public function logout(): void { ... }                    // Parte 5
}
```

### 15.3 Flujo completo de autenticación

```
REGISTRO:
  POST /api/auth/register → RegisterRequest → RegisterController → AuthService::register() → 201 + tokens

LOGIN:
  POST /api/auth/login → LoginRequest → LoginController → AuthService::login()
    ├── Credenciales correctas + usuario activo → 200 + tokens
    ├── Credenciales incorrectas → 401 invalid_credentials
    ├── Usuario inactivo/baneado → 403 account_inactive/account_banned
    └── Rate limit excedido → 429

RUTAS PROTEGIDAS (cada request):
  Request → JwtAuthenticate middleware → auth('api')->user()
    ├── Token válido + usuario activo → Controller
    ├── Token expirado + ruta refresh → Continuar (permitir refresh)
    ├── Token expirado + otra ruta → 401 token_expired
    ├── Token inválido/blacklisted → 401 token_invalid
    └── Sin token → 401 token_missing

REFRESH:
  POST /api/auth/refresh → JwtAuthenticate (permite expirado) → RefreshTokenRequest
    → RefreshTokenController → AuthService::refreshTokens()
      ├── Refresh token válido → revocar viejo + emitir nuevos → 200 + tokens
      └── Refresh token revocado (reuse attack) → revocar todos → 401

LOGOUT:
  POST /api/auth/logout → JwtAuthenticate → LogoutController → AuthService::logout()
    → Invalidar access token + revocar refresh tokens → 200

PERFIL:
  GET /api/me → JwtAuthenticate → UserController::me() → 200 + datos del usuario
```

### 15.4 Lo que viene en la Parte 6

La [Parte 6](06-seguridad-avanzada-y-produccion.md) implementará las capas finales de seguridad y operaciones:

- **CORS** — configuración de `config/cors.php` para permitir peticiones desde el frontend SPA.
- **Headers de seguridad** — `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, etc.
- **Rate limiting avanzado** — configuración global en `AppServiceProvider`.
- **Comando `tokens:cleanup`** — limpieza programada de refresh tokens expirados/revocados.
- **Programación en `Console/Kernel.php`** — ejecución diaria del comando de limpieza.
- **Manejo de excepciones global** — personalización del `ExceptionHandler` para mantener consistencia en todas las respuestas de error (no solo las de autenticación).
- **Variables de entorno adicionales** — configuración para producción.
- **Verificación y hardening** — checklist de seguridad antes de desplegar a producción.

---

## Decisiones Vinculantes para Parte 6

1. **El `AuthService` YA TIENE los cuatro métodos**: `register()`, `login()`, `refreshTokens()`, `logout()`. La Parte 6 no añade más métodos a esta clase.

2. **Las excepciones `AuthenticationException` y `AccountInactiveException` YA ESTÁN CREADAS**. La Parte 6 puede extender el `ExceptionHandler` global para atrapar otras excepciones (como `ModelNotFoundException`, `ValidationException`, `ThrottleRequestsException`) y formatearlas con la misma estructura `{ error: { code, message } }`.

3. **El middleware `JwtAuthenticate` YA ESTÁ CREADO** y registrado con alias `jwt.auth`. La Parte 6 no modifica este middleware pero puede añadir headers de seguridad a nivel de aplicación.

4. **El formato de respuesta de error YA ESTÁ DEFINIDO**:
   ```json
   { "error": { "code": "...", "message": "..." } }
   ```
   La Parte 6 debe extender este formato a TODAS las respuestas de error (no solo las de autenticación), personalizando el `ExceptionHandler`.

5. **Los rate limiters YA ESTÁN CONFIGURADOS** por ruta (`throttle:10,1` en registro, `throttle:5,1` en login). La Parte 6 puede añadir rate limiting global o para rutas protegidas.

6. **La estrategia one-session-per-user ESTÁ IMPLEMENTADA** en `login()` (revocar refresh tokens anteriores). La Parte 6 no cambia esta estrategia.

7. **La detección de reuse attack ESTÁ IMPLEMENTADA** en `refreshTokens()`. La Parte 6 puede añadir notificaciones al usuario cuando se detecta un reuse (email/SMS: "Actividad sospechosa en tu cuenta").

8. **La tabla `refresh_tokens` acumula registros revocados y expirados**. La Parte 6 DEBE implementar el comando `tokens:cleanup` para limpiarlos periódicamente, según lo diseñado en la Parte 3 (sección 9.6) y Parte 4 (sección 2.3).

9. **Los tests de login YA ESTÁN ESCRITOS** (15 tests). La Parte 6 puede añadir tests de integración adicionales para CORS, headers de seguridad, y el comando de limpieza.

10. **El endpoint `/me` usa `UserController::me()`** (método, no `__invoke`). Si la Parte 6 añade más endpoints de usuario (`PUT /me`, `DELETE /me`), deben ir en el mismo controller o en controllers separados single-action — consistencia con el patrón establecido.
