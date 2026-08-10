# Parte 6: Seguridad Avanzada, CORS, Rate Limiting, Limpieza Programada y Testing Integral

## 1. Introducción

### 1.1 Dónde estamos

En las cinco partes anteriores construimos un sistema de autenticación completo y funcional:

| Parte | Lo construido | Estado |
|-------|---------------|--------|
| [Parte 1](01-fundamentos-setup-arquitectura.md) | Proyecto Laravel 11, arquitectura en capas, convenciones de código, estructura de directorios | ✅ |
| [Parte 2](02-env-y-base-de-datos.md) | Variables de entorno, base de datos MySQL, migración `users`, modelo `User`, enums `UserRole` y `UserStatus` | ✅ |
| [Parte 3](03-jwt-configuracion-y-tokens.md) | Paquete `tymon/jwt-auth` instalado y configurado, guard `api` con driver `jwt`, claims del JWT, diseño de tabla `refresh_tokens` | ✅ |
| [Parte 4](04-registro-de-usuarios.md) | Migración `refresh_tokens`, modelo `RefreshToken`, `RegisterRequest`, `AuthService::register()`, `RegisterController`, ruta de registro, tests | ✅ |
| [Parte 5](05-login-autenticacion-middleware.md) | `LoginRequest`, `AuthenticationException`, `AccountInactiveException`, `AuthService::login()`, `AuthService::refreshTokens()`, `AuthService::logout()`, middleware `JwtAuthenticate`, controllers de login/refresh/logout, endpoint `/me`, 15 tests | ✅ |

En este momento, la aplicación tiene un ciclo completo de autenticación JWT funcionando: registro, login, protección de rutas, refresh con detección de reuse attack, y logout. Los usuarios pueden registrarse, autenticarse, acceder a rutas protegidas, refrescar sus tokens y cerrar sesión.

### 1.2 Objetivo de esta parte

Llevar el sistema del estado "funcional en desarrollo" a "seguro y listo para producción". Nos enfocamos en hardening de seguridad, operaciones automatizadas, y cobertura de tests exhaustiva.

Al terminar esta parte, el sistema contará con:

1. **CORS** correctamente configurado para la comunicación con el frontend SPA.
2. **Rate limiting avanzado** con limiters personalizados por IP y por usuario.
3. **Security headers HTTP** protegiendo contra clickjacking, MIME sniffing, XSS y otros vectores.
4. **Comando de limpieza programada** de refresh tokens expirados y revocados.
5. **Manejo de errores global** con formato JSON consistente para toda la API.
6. **Logging de eventos de seguridad** estructurado.
7. **Checklist de producción** verificable antes del despliegue.
8. **Batería completa de tests PHPUnit** cubriendo todos los flujos de autenticación.
9. **Preparación para producción** con comandos de optimización.

### 1.3 Qué NO construiremos en esta parte

- Email verification ni password reset (quedan como próximos pasos recomendados).
- 2FA ni OAuth social login (extensiones futuras).
- Panel de administración de usuarios.
- Documentación de API con Swagger/OpenAPI.

---

## 2. Configuración de CORS (Cross-Origin Resource Sharing)

### 2.1 Qué es CORS y por qué importa

La **Same-Origin Policy** (SOP) es una restricción de seguridad implementada por todos los navegadores modernos. Su regla es simple: un script que se ejecuta en `dominioA.com` NO puede hacer peticiones HTTP a `dominioB.com` a menos que `dominioB.com` lo permita explícitamente.

**CORS** (Cross-Origin Resource Sharing) es el mecanismo que permite a `dominioB.com` (tu API en `api.tudominio.com`) declarar: "sí, acepto peticiones desde `dominioA.com` (tu frontend SPA en `app.tudominio.com`)".

Sin CORS correctamente configurado:

- Tu API es **inaccesible** desde cualquier frontend que no esté en el mismo dominio.
- El navegador bloquea las peticiones de login, registro y cualquier endpoint de la API. El error típico en la consola del navegador es:
  ```
  Access to fetch at 'https://api.tudominio.com/api/auth/login' from origin
  'https://app.tudominio.com' has been blocked by CORS policy:
  No 'Access-Control-Allow-Origin' header is present on the requested resource.
  ```
- Si configuras CORS de forma demasiado permisiva (origen `*` con credenciales), expones tu API a ataques CSRF-like desde cualquier otro origen malicioso.

**JWT NO protege contra CORS.** Son capas completamente diferentes:

| Capa | Qué protege | Dónde opera |
|------|------------|-------------|
| **CORS** | Qué orígenes pueden hacer peticiones a tu API | Navegador (Browser-enforced) |
| **JWT** | Que el usuario que hace la petición es quien dice ser | Servidor (firma criptográfica) |
| **HTTPS** | Que los datos en tránsito no son interceptados ni modificados | Red (cifrado TLS) |

Un atacante puede tener un JWT perfectamente válido, pero si CORS está mal configurado, podría usar ese JWT desde cualquier dominio malicioso. A la inversa, CORS bien configurado no protege contra un JWT robado — para eso están la expiración corta y la rotación de refresh tokens.

### 2.2 Flujo de una petición CORS

Cuando un frontend en `https://app.tudominio.com` hace una petición a `https://api.tudominio.com`, ocurre lo siguiente:

```
1. PREFLIGHT (automático, solo para peticiones "complejas")
   Navegador → OPTIONS /api/auth/login
   Headers:
     Origin: https://app.tudominio.com
     Access-Control-Request-Method: POST
     Access-Control-Request-Headers: Content-Type, Authorization

   Servidor responde:
     Access-Control-Allow-Origin: https://app.tudominio.com
     Access-Control-Allow-Methods: GET, POST, PUT, DELETE
     Access-Control-Allow-Headers: Content-Type, Authorization
     Access-Control-Max-Age: 86400

2. PETICIÓN REAL
   Navegador → POST /api/auth/login
   Headers:
     Origin: https://app.tudominio.com
     Content-Type: application/json

   Servidor responde normalmente + header CORS:
     Access-Control-Allow-Origin: https://app.tudominio.com
```

El preflight (petición `OPTIONS`) es automático: el navegador lo envía antes de la petición real cuando esta es "compleja" (usa métodos distintos de GET/HEAD/POST con content-types simples, o incluye headers como `Authorization`). Nuestra API de autenticación SIEMPRE dispara preflight porque usa `Content-Type: application/json` y `Authorization: Bearer <token>`.

Una petición `GET /api/me` con `Authorization: Bearer <token>` también dispara preflight por el header `Authorization`.

**Peticiones simples** (GET sin headers personalizados, POST con `Content-Type: application/x-www-form-urlencoded`) NO disparan preflight — el navegador envía la petición directamente y verifica los headers CORS en la respuesta.

### 2.3 Configuración en Laravel 11

Laravel 11 incluye el middleware `HandleCors` en el stack HTTP por defecto, y usa el archivo `config/cors.php` como configuración. Si el archivo no existe en tu proyecto, publícalo:

```bash
php artisan config:publish cors
```

Sobrescribe el contenido de `config/cors.php`:

```php
<?php

declare(strict_types=1);

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Configuración para el middleware HandleCors. Controla qué orígenes,
    | métodos, y headers son aceptados en peticiones cross-origin.
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => explode(',', env('CORS_ALLOWED_ORIGINS', 'http://localhost:3000')),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 86400,

    'supports_credentials' => false,

];
```

### 2.4 Explicación de cada clave

#### `paths`

```php
'paths' => ['api/*', 'sanctum/csrf-cookie'],
```

**Qué hace:** Especifica qué rutas de la aplicación deben incluir los headers CORS en sus respuestas. Solo las rutas que coinciden con estos patrones activan el middleware CORS.

**Por qué `api/*`:** Todas nuestras rutas de autenticación viven bajo el prefijo `/api` (definido en `bootstrap/app.php`). Incluir `api/*` cubre `api/auth/login`, `api/auth/register`, `api/me`, `api/auth/refresh`, `api/auth/logout`, y cualquier futura ruta de API.

**Por qué NO `*`:** Si pusiéramos `*`, las rutas web tradicionales (Blade, vistas) también tendrían headers CORS. Esto es innecesario (las vistas Blade se sirven del mismo dominio) y añade superficie de ataque innecesaria.

#### `allowed_methods`

```php
'allowed_methods' => ['*'],
```

**Qué hace:** Lista de métodos HTTP que el servidor acepta en peticiones cross-origin.

**`*` vs lista explícita:** `*` permite todos los métodos (GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD). Es aceptable y conveniente para una API RESTful que expone múltiples métodos. Si prefieres ser más restrictivo:

```php
'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
```

La restricción real de métodos en Laravel viene de las rutas definidas en `routes/api.php` — si no hay una ruta `DELETE /api/users`, el método DELETE simplemente retorna 404, independientemente de lo que CORS permita.

#### `allowed_origins`

```php
'allowed_origins' => explode(',', env('CORS_ALLOWED_ORIGINS', 'http://localhost:3000')),
```

**Qué hace:** Lista blanca explícita de orígenes (dominios) desde los cuales se aceptan peticiones. Cada origen debe incluir el protocolo (`http://` o `https://`), el dominio, y el puerto si no es el estándar (80/443).

**⚠️ NUNCA uses `'*'` en producción.** Aunque para APIs JWT sin cookies `*` es técnicamente aceptable (no hay cookies que proteger), es una mala práctica de seguridad. Siempre debes saber exactamente qué dominios están autorizados a hablar con tu API.

Separamos los orígenes con coma en la variable de entorno:

```env
# Desarrollo local (React en 3000, Vite en 5173, Angular en 4200, Next.js en 3000)
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:4200

# Producción (dominios explícitos de tu organización)
CORS_ALLOWED_ORIGINS=https://app.tudominio.com,https://admin.tudominio.com
```

`explode(',', ...)` convierte el string separado por comas en un array PHP que Laravel espera.

#### `allowed_origins_patterns`

```php
'allowed_origins_patterns' => [],
```

**Qué hace:** Permite definir patrones regex para orígenes dinámicos. Útil cuando tienes múltiples subdominios.

**Ejemplo de uso (para futura referencia):**

```php
'allowed_origins_patterns' => [
    '#^https://.*\.tudominio\.com$#',
],
```

Esto permitiría `https://app.tudominio.com`, `https://admin.tudominio.com`, `https://staging.tudominio.com`, etc. Sin embargo, `allowed_origins_patterns` es incompatible con `supports_credentials: true` (el navegador no permite wildcards con credenciales). Como este manual usa `supports_credentials: false`, es seguro usar patrones si los necesitas.

Para una API simple con 2-3 orígenes conocidos, `allowed_origins` con lista explícita es más seguro y mantenible que un patrón regex.

#### `allowed_headers`

```php
'allowed_headers' => ['*'],
```

**Qué hace:** Lista de headers HTTP que el cliente puede enviar en peticiones cross-origin.

**`*` aquí sí es seguro.** A diferencia de `allowed_origins`, donde `*` es peligroso, en `allowed_headers` `*` simplemente significa "acepto cualquier header que el cliente envíe". Los headers que tu API realmente procesa están limitados por la lógica de la aplicación (el middleware JWT espera `Authorization`, los controllers esperan `Content-Type: application/json`). Un header adicional como `X-Custom-Thing` será ignorado por Laravel.

Si quisieras ser restrictivo:

```php
'allowed_headers' => ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
```

Pero `*` es más práctico y no reduce la seguridad real.

#### `exposed_headers`

```php
'exposed_headers' => [],
```

**Qué hace:** Por defecto, el navegador solo expone al JavaScript los siguientes headers de la respuesta: `Cache-Control`, `Content-Language`, `Content-Type`, `Expires`, `Last-Modified`, `Pragma`. Si tu API devuelve headers personalizados que el frontend necesita leer (ej: `X-RateLimit-Remaining`, `X-Request-Id`), debes listarlos aquí.

**Para esta API de autenticación, lo dejamos vacío.** Los headers estándar son suficientes. Si en el futuro implementas rate limiting avanzado con headers informativos, añadirías:

```php
'exposed_headers' => ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-Retry-After'],
```

#### `max_age`

```php
'max_age' => 86400,
```

**Qué hace:** Tiempo en **segundos** que el navegador puede cachear los resultados del preflight (`OPTIONS`). Durante este tiempo, el navegador NO vuelve a enviar peticiones preflight para el mismo origen.

**Nuestro valor: `86400` (24 horas).** El valor por defecto de Laravel es `0` (no cachear), lo cual es ineficiente: cada petición `POST /api/auth/login` dispararía un `OPTIONS` previo. Con `86400`, el navegador cachea el resultado del preflight por 24 horas. Solo la PRIMERA petición del día (o después de limpiar caché del navegador) dispara preflight.

| Valor | Comportamiento | Recomendación |
|-------|---------------|---------------|
| `0` | Preflight en cada petición | Solo desarrollo con cambios frecuentes de CORS |
| `86400` (24h) | Preflight una vez al día | **Producción — balance entre eficiencia y flexibilidad** |
| `604800` (7d) | Preflight una vez a la semana | Orígenes muy estables, rara vez cambian |

#### `supports_credentials`

```php
'supports_credentials' => false,
```

**Qué hace:** Indica si la API acepta credenciales (cookies, headers de autenticación HTTP, certificados TLS de cliente) en peticiones cross-origin.

**⚠️ CRÍTICO:** Cuando `supports_credentials` es `true`:
- `allowed_origins` **NO puede ser `*`** — el navegador rechaza la combinación.
- El header `Access-Control-Allow-Credentials: true` se envía en la respuesta.
- Las cookies httpOnly, los headers `Authorization`, y los certificados de cliente se incluyen en peticiones cross-origin.

**Nuestra configuración: `false`.** ¿Por qué?

Nuestra API usa JWT en el header `Authorization: Bearer <token>`. El token lo envía el frontend manualmente (desde memoria, no desde una cookie). No dependemos de cookies para la autenticación. Con `supports_credentials: false`:

```http
# El frontend envía el token manualmente:
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
```

El header `Authorization` se envía en TODAS las peticiones cross-origin, incluso con `supports_credentials: false`. La restricción de credenciales aplica SOLO a mecanismos automáticos del navegador (cookies, HTTP Basic auth, TLS client certificates), no a headers que el JavaScript establece manualmente.

**¿Cuándo usar `supports_credentials: true`?**

Si decidieras almacenar el refresh token en una httpOnly cookie (como se discutió en la Parte 1, sección 4), necesitarías `supports_credentials: true` para que el navegador envíe automáticamente la cookie en peticiones cross-origin. En ese caso, la configuración sería:

```php
'supports_credentials' => true,
'allowed_origins' => ['https://app.tudominio.com'], // Lista explícita, NUNCA '*'
```

Para este manual, con tokens en memoria + header Authorization manual, `false` es correcto.

### 2.5 Verificación de CORS

Después de configurar `config/cors.php`, verifica que los headers se envían correctamente usando curl:

```bash
# Simular preflight
curl -X OPTIONS http://localhost:8000/api/auth/login \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization" \
  -v

# Deberías ver en la respuesta:
# Access-Control-Allow-Origin: http://localhost:3000
# Access-Control-Allow-Methods: GET, POST, PUT, DELETE, ...
# Access-Control-Allow-Headers: Content-Type, Authorization, ...
# Access-Control-Max-Age: 86400
```

Si estás usando un frontend React/Vue/Next.js en desarrollo, las peticiones al endpoint de login deberían funcionar sin errores de CORS en la consola del navegador.

---

## 3. Rate Limiting Avanzado

### 3.1 ¿Qué es rate limiting y por qué es crítico?

Rate limiting es el mecanismo que limita cuántas peticiones puede hacer un cliente (IP, usuario, o combinación de ambos) en un período de tiempo. Es una defensa de primera línea contra:

| Ataque | Cómo lo mitiga el rate limiting |
|--------|--------------------------------|
| **Brute force en login** | Limitar intentos de login por IP + email. 5 intentos/minuto = 7200 intentos/día como máximo, comparado con millones sin límite. |
| **Registro masivo de cuentas falsas** | Limitar registros por IP/hora. Un bot que intenta crear 10,000 cuentas falsas es detenido. |
| **Denegación de servicio básica** | Limitar peticiones totales por IP. Un atacante no puede saturar tu API con miles de requests/segundo desde una sola IP. |
| **Enumeración de usuarios** | Limitar intentos de login por IP. El atacante no puede probar cientos de emails para ver cuáles existen. |
| **Credential stuffing** | Limitar intentos de login. Si un atacante tiene una base de datos de emails/contraseñas filtradas, el rate limiting frena la verificación masiva. |

Los límites ya configurados en las Partes 4 y 5 (`throttle:10,1` para registro, `throttle:5,1` para login) son un buen punto de partida, pero insuficientes en producción por dos razones:

1. **Son límites por ruta, no por endpoint semántico**: `throttle:5,1` aplica 5 intentos/minuto por IP a la ruta de login. Pero no distingue entre emails (un atacante puede probar 5 contraseñas contra `user1@test.com`, luego 5 contra `user2@test.com`, etc.). Un rate limiter personalizado permite granularidad por IP + email.
2. **No hay rate limiting en rutas protegidas**: endpoints como `/me` o futuros endpoints de datos no tienen protección de rate limiting. Un atacante con un token válido podría hacer miles de requests.

### 3.2 Rate Limiting por IP vs por Usuario

| Estrategia | Cómo funciona | Ventaja | Desventaja |
|------------|--------------|---------|------------|
| **IP-based** | Cuenta requests por IP del cliente | Simple, no requiere autenticación. Funciona incluso en login/register. | Un atacante puede rotar IPs (VPN, proxy, botnet). Usuarios detrás de NAT comparten IP (oficina, universidad). |
| **User-based** | Cuenta requests por usuario autenticado (ID) | Preciso — identifica al usuario específico. No afecta a otros usuarios en la misma red. | No funciona para rutas públicas (login/register) porque el usuario no está autenticado todavía. |
| **Híbrida** | IP + email para login, user ID para rutas protegidas | Lo mejor de ambos mundos | Más compleja de configurar |

### 3.3 Rate limiters personalizados

Crea o modifica `app/Providers/AppServiceProvider.php`:

```php
<?php

declare(strict_types=1);

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Limiter para login: 5 intentos por minuto por IP + email
        RateLimiter::for('login', function (Request $request) {
            $key = 'login:' . $request->ip() . ':' . ($request->input('email') ?? 'no-email');
            return Limit::perMinute(5)->by($key);
        });

        // Limiter para API general: 60 requests por minuto por usuario autenticado
        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(60)->by(
                $request->user()?->id ?: $request->ip()
            );
        });

        // Limiter para registro: 3 por hora por IP
        RateLimiter::for('register', function (Request $request) {
            return Limit::perHour(3)->by($request->ip());
        });
    }
}
```

#### Explicación de cada limiter

##### `login` limiter

```php
RateLimiter::for('login', function (Request $request) {
    $key = 'login:' . $request->ip() . ':' . ($request->input('email') ?? 'no-email');
    return Limit::perMinute(5)->by($key);
});
```

**Clave compuesta IP + email:** Esto es más granular que un límite solo por IP. Si un atacante detrás de una VPN intenta brute force, cada email diferente que prueba consume el límite POR SEPARADO. Pero el mismo email no puede intentarse más de 5 veces por minuto desde ninguna IP. Esto equilibra la protección contra brute force dirigido (mismo email, muchas contraseñas) y credential stuffing (muchos emails, una contraseña).

**`?? 'no-email'`**: Si por alguna razón el campo `email` no está presente en la request, usamos un fallback para que la clave no quede como `login:127.0.0.1:` (que sería la misma para cualquier email faltante).

##### `api` limiter

```php
RateLimiter::for('api', function (Request $request) {
    return Limit::perMinute(60)->by(
        $request->user()?->id ?: $request->ip()
    );
});
```

**User-based con fallback a IP:** Si el usuario está autenticado, el límite se aplica por `user_id`. Esto significa que cada usuario autenticado tiene su propio bucket de 60 requests/minuto, independientemente de su IP. Si no está autenticado (raro en rutas protegidas, pero defensivo), el límite se aplica por IP.

**60 requests por minuto** es generoso: un usuario navegando una SPA que hace polling o carga datos en varias pestañas no debería alcanzarlo en uso normal. Un atacante scrapeando datos o haciendo fuzzing sí lo alcanzará.

##### `register` limiter

```php
RateLimiter::for('register', function (Request $request) {
    return Limit::perHour(3)->by($request->ip());
});
```

**3 registros por hora por IP:** Más restrictivo que el límite por defecto (`throttle:10,1` que son 10 por minuto). La razón: un usuario legítimo se registra UNA vez. Si una misma IP intenta registrar más de 3 cuentas en una hora, es casi seguro un bot. Usamos `perHour()` en vez de `perMinute()` para capturar ataques de baja intensidad (un bot que registra una cuenta cada 20 minutos para evadir límites por minuto).

### 3.4 Aplicar los rate limiters personalizados en las rutas

Modifica `routes/api.php` para usar los limiters personalizados en lugar de los límites inline:

```php
<?php

use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\LogoutController;
use App\Http\Controllers\Auth\RefreshTokenController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

// Rutas públicas de autenticación
Route::prefix('auth')->group(function () {
    Route::post('/register', RegisterController::class)
        ->name('auth.register')
        ->middleware('throttle:register');

    Route::post('/login', LoginController::class)
        ->name('auth.login')
        ->middleware('throttle:login');
});

// Rutas protegidas
Route::middleware('jwt.auth')->group(function () {
    Route::get('/me', [UserController::class, 'me'])
        ->name('user.me')
        ->middleware('throttle:api');

    Route::post('/auth/refresh', RefreshTokenController::class)
        ->name('auth.refresh')
        ->middleware('throttle:api');

    Route::post('/auth/logout', LogoutController::class)
        ->name('auth.logout')
        ->middleware('throttle:api');
});
```

El middleware `throttle:login` busca el rate limiter registrado con nombre `'login'` en `AppServiceProvider`. Es más semántico y mantenible que `throttle:5,1`.

### 3.5 Strategy de rate limiting en producción

Para un entorno de producción real, considera estas mejoras adicionales al rate limiting básico:

**1. Usar Redis como cache driver para rate limiting**

Por defecto, Laravel usa el driver de caché configurado en `CACHE_DRIVER` (normalmente `file` en desarrollo). El driver `file` almacena los contadores de rate limiting en archivos del sistema. Esto es problemático en producción con múltiples instancias:

```
Instancia A: login:192.168.1.5:john@test.com → 3 intentos
Instancia B: login:192.168.1.5:john@test.com → 0 intentos (no comparte estado con A)
```

El atacante solo necesita distribuir sus requests entre instancias para evadir el límite. Con Redis:

```env
CACHE_DRIVER=redis
```

Todas las instancias comparten el mismo almacén de rate limiting. 5 intentos son 5 intentos en total, sin importar qué instancia los reciba.

**2. Combinar con fail2ban a nivel de servidor**

Rate limiting en Laravel devuelve HTTP 429. Fail2ban puede monitorear los logs de acceso (nginx/apache) y banear IPs temporalmente a nivel de firewall:

```ini
# /etc/fail2ban/jail.local
[laravel-auth]
enabled  = true
port     = http,https
filter   = laravel-auth
logpath  = /var/log/nginx/access.log
maxretry = 10
findtime = 60
bantime  = 600
```

Esto añade una capa de defensa a nivel de red, antes de que las peticiones lleguen siquiera a PHP.

**3. Alertas cuando se alcancen thresholds de rate limiting**

Configura monitoreo (Laravel Telescope, Sentry, Datadog, ELK) para alertar cuando el rate limiting se active con frecuencia. Un pico de respuestas 429 en el endpoint de login es un indicador temprano de un ataque de brute force en curso.

---

## 4. HTTP Security Headers

Los security headers son directivas que el servidor envía en cada respuesta HTTP para instruir al navegador sobre comportamientos de seguridad. Cada header mitiga una clase específica de ataque.

### 4.1 Crear el middleware de security headers

```bash
php artisan make:middleware SecurityHeaders
```

Sobrescribe el contenido generado en `app/Http/Middleware/SecurityHeaders.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        // Prevenir MIME type sniffing
        $response->headers->set('X-Content-Type-Options', 'nosniff');

        // Prevenir clickjacking
        $response->headers->set('X-Frame-Options', 'DENY');

        // Controlar información en el header Referer
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');

        // Deshabilitar APIs del navegador innecesarias
        $response->headers->set(
            'Permissions-Policy',
            'geolocation=(), microphone=(), camera=(), usb=()'
        );

        // HSTS — solo en producción con HTTPS
        if (app()->environment('production')) {
            $response->headers->set(
                'Strict-Transport-Security',
                'max-age=31536000; includeSubDomains; preload'
            );
        }

        // Content Security Policy
        $response->headers->set(
            'Content-Security-Policy',
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'"
        );

        return $response;
    }
}
```

### 4.2 Registrar el middleware globalmente

En Laravel 11, los middlewares globales se registran en `bootstrap/app.php`:

```php
->withMiddleware(function (Middleware $middleware) {
    $middleware->alias([
        'jwt.auth' => \App\Http\Middleware\JwtAuthenticate::class,
    ]);

    $middleware->append(\App\Http\Middleware\SecurityHeaders::class);
})
```

`append()` añade el middleware al final de la cadena global. Esto significa que se ejecuta en CADA request, no solo en las de API. Los security headers son deseables también en rutas web, así que es correcto.

Si quisieras que los headers de seguridad se apliquen SOLO a rutas de API, usarías `$middleware->api()` o `$middleware->prependToGroup('api', ...)`. Pero para headers de seguridad, global es la opción más segura.

### 4.3 Explicación de cada header

#### X-Content-Type-Options: nosniff

```
X-Content-Type-Options: nosniff
```

**Qué previene:** MIME type sniffing. Algunos navegadores (especialmente Internet Explorer y versiones antiguas de Chrome) intentan "adivinar" el tipo de contenido de un recurso ignorando el header `Content-Type`. Esto es peligroso: un atacante podría subir un archivo con extensión `.jpg` que contiene JavaScript. Si el servidor lo sirve como `image/jpeg` pero el navegador "huele" que es JavaScript y lo ejecuta, tienes un XSS.

**`nosniff`** obliga al navegador a respetar EXACTAMENTE el `Content-Type` declarado por el servidor. Si el servidor dice `image/jpeg`, el navegador lo trata como imagen aunque el contenido sea JavaScript — y las imágenes no se ejecutan.

#### X-Frame-Options: DENY

```
X-Frame-Options: DENY
```

**Qué previene:** Clickjacking. Un atacante podría embeber tu aplicación en un `<iframe>` invisible en su sitio malicioso, superponer elementos visuales, y engañar al usuario para que haga clic en "Eliminar cuenta" o "Transferir fondos" creyendo que está interactuando con otra cosa.

**`DENY`** impide que tu aplicación sea embebida en CUALQUIER `<iframe>`, incluso de tu propio dominio. Alternativas:

| Valor | Efecto |
|-------|--------|
| `DENY` | No puede ser embebida en ningún iframe (recomendado para APIs) |
| `SAMEORIGIN` | Puede ser embebida en iframes del mismo dominio (útil si tu app usa iframes propios) |
| `ALLOW-FROM https://example.com` | Solo permite un origen específico (obsoleto, usar CSP `frame-ancestors`) |

Para una API RESTful que devuelve JSON, el clickjacking no es un vector de ataque relevante (no hay UI que clickear). Pero el header es barato de incluir y protege cualquier ruta web que pudiera existir (páginas de error de Laravel, horizon dashboard, telescope en desarrollo).

#### Referrer-Policy: strict-origin-when-cross-origin

```
Referrer-Policy: strict-origin-when-cross-origin
```

**Qué controla:** Cuánta información de la URL se envía en el header `Referer` cuando el usuario navega de tu sitio a otro.

**`strict-origin-when-cross-origin`:**
- Mismo origen (tudominio.com → tudominio.com): envía la URL COMPLETA (incluyendo path y query string).
- Cross-origin (tudominio.com → otrodominio.com): envía SOLO el origen (`https://tudominio.com`), sin path ni query string.
- Downgrade HTTPS → HTTP: NO envía nada.

**¿Por qué importa en una API?** Si tu API redirige (301/302) a alguna URL, o si sirves documentación HTML, el header `Referer` podría filtrar información. Por ejemplo, si un endpoint redirige a una URL externa con un token en el query string (`/redirect?token=abc123`), el `Referer` expondría ese token. `strict-origin-when-cross-origin` evita filtrar el path y query string en navegaciones cross-origin.

#### Permissions-Policy

```
Permissions-Policy: geolocation=(), microphone=(), camera=(), usb=()
```

**Qué hace:** Deshabilita APIs del navegador potentes que tu aplicación no necesita. Es una declaración de "mi aplicación NO usa geolocalización, micrófono, cámara, ni acceso USB".

**Sintaxis `=()`:** significa "no permitido para ningún origen, ni siquiera el propio". Es un deny-all explícito.

Esto es relevante si tu API alguna vez sirve HTML (páginas de error, dashboard, documentación). Si un atacante encontrara una forma de inyectar JavaScript en esas páginas, `Permissions-Policy` limita qué APIs del navegador puede explotar.

#### Strict-Transport-Security (HSTS)

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

**Qué hace:** Instruye al navegador a que SOLO acceda a este dominio mediante HTTPS, incluso si el usuario escribe `http://` en la barra de direcciones o hace clic en un enlace `http://`.

**`max-age=31536000`**: El navegador recuerda esta instrucción por 1 año (31,536,000 segundos). Durante ese año, CUALQUIER intento de acceder vía HTTP es automáticamente convertido a HTTPS por el navegador (interno, sin pasar por el servidor).

**`includeSubDomains`**: La regla aplica a TODOS los subdominios (`api.tudominio.com`, `app.tudominio.com`, `admin.tudominio.com`). Sin esto, un atacante podría crear un subdominio malicioso que use HTTP.

**`preload`**: Permite incluir tu dominio en la lista de preload de HSTS mantenida por Google y usada por Chrome, Firefox, Safari. Una vez en la lista, el navegador SABE que tu dominio es HTTPS-only incluso ANTES de la primera visita. Esto elimina por completo el ataque de SSL stripping en la primera conexión. Para incluirte, debes someter tu dominio en [hstspreload.org](https://hstspreload.org).

**⚠️ ADVERTENCIA:** HSTS con `max-age` alto es un compromiso. Si lo activas y luego tienes problemas con tu certificado HTTPS (expiró, configuración incorrecta), los usuarios no podrán acceder a tu sitio durante el tiempo que dure el `max-age` — el navegador rechazará cualquier conexión HTTP. Por eso solo lo activamos en `production`. Y si usas preload, la salida es aún más difícil (requiere pasar por el proceso de remoción).

```php
if (app()->environment('production')) {
    $response->headers->set(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload'
    );
}
```

En desarrollo (`APP_ENV=local`), HSTS está desactivado. `localhost` rara vez tiene HTTPS configurado, y un HSTS accidental en `localhost` podría bloquearte el acceso a otros proyectos locales.

#### Content-Security-Policy (CSP)

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'
```

**Qué hace:** Define una whitelist de fuentes de contenido que el navegador puede cargar. Es la defensa MÁS POTENTE contra XSS: incluso si un atacante logra inyectar un `<script>` en tu página, CSP puede bloquear su ejecución.

**Desglose de directivas:**

| Directiva | Valor | Significado |
|-----------|-------|-------------|
| `default-src` | `'self'` | Política por defecto: solo cargar recursos del mismo origen. Todas las demás directivas heredan de esta a menos que se sobrescriban. |
| `script-src` | `'self'` | Solo ejecutar scripts del mismo origen. Bloquea `<script src="https://evil.com/malware.js">` e inline scripts (`<script>alert(1)</script>`). |
| `style-src` | `'self' 'unsafe-inline'` | Permitir estilos del mismo origen + estilos inline (`<style>` y `style=""`). `'unsafe-inline'` se incluye porque Laravel y muchas librerías frontend usan estilos inline. Idealmente se eliminaría usando nonces o hashes. |
| `img-src` | `'self' data:` | Imágenes del mismo origen + data URIs (imágenes embebidas en base64). |
| `font-src` | `'self'` | Fuentes tipográficas solo del mismo origen. |
| `connect-src` | `'self'` | Conexiones XHR/WebSocket/fetch solo al mismo origen. Bloquea exfiltración de datos vía `fetch('https://evil.com/steal?data=' + token)`. |

**Para una API pura que devuelve JSON, CSP es menos crítico.** CSP protege contra XSS en contenido HTML. Si tu API solo devuelve `application/json`, el navegador no ejecuta JSON como HTML. Sin embargo, si tu aplicación incluye:
- Páginas de error HTML de Laravel (modo debug)
- Horizon dashboard
- Telescope
- Documentación HTML servida por la API

CSP las protege. Dado que es barato de incluir y no causa problemas, lo añadimos.

**Nota sobre CSP y SPAs:** Si tu SPA React/Vue/Next.js se sirve desde `app.tudominio.com` y tu API desde `api.tudominio.com`, el CSP se aplica a las respuestas de la API, no a la SPA. La SPA debe configurar su propio CSP desde el servidor que la sirve (nginx, Vercel, Netlify). Esta configuración protege las respuestas HTML que la API pueda generar.

---

## 5. Manejo de Errores Global

En las Partes 4 y 5 creamos excepciones de dominio (`AuthenticationException`, `AccountInactiveException`) con su propio método `render()`. Pero el resto de excepciones de Laravel (modelos no encontrados, errores 500, errores de validación en endpoints no-autenticados) todavía usan el formato por defecto de Laravel, que es diferente a nuestro formato `{ "error": { "code": "...", "message": "..." } }`.

El objetivo de esta sección es **uniformizar TODAS las respuestas de error** de la API.

### 5.1 Configuración en `bootstrap/app.php`

Laravel 11 introdujo un nuevo enfoque para el manejo de excepciones a través del método `withExceptions()` en `bootstrap/app.php`. Amplía la sección de excepciones del archivo:

```php
<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use App\Exceptions\AuthenticationException;
use App\Exceptions\AccountInactiveException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Illuminate\Auth\Access\AuthorizationException;
use Throwable;

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

        $middleware->append(\App\Http\Middleware\SecurityHeaders::class);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // Forzar respuestas JSON en rutas API
        $exceptions->shouldRenderJsonWhen(function (Request $request) {
            return $request->is('api/*') || $request->expectsJson();
        });

        // No reportar excepciones esperadas del dominio de autenticación
        $exceptions->dontReport([
            AuthenticationException::class,
            AccountInactiveException::class,
        ]);

        // Modelo no encontrado (404)
        $exceptions->render(function (NotFoundHttpException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json([
                    'error' => [
                        'code'    => 'not_found',
                        'message' => 'El recurso solicitado no existe.',
                    ],
                ], 404);
            }
        });

        // Errores de autorización (403) — Policies, Gates
        $exceptions->render(function (AuthorizationException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json([
                    'error' => [
                        'code'    => 'forbidden',
                        'message' => 'No tienes permiso para realizar esta acción.',
                    ],
                ], 403);
            }
        });

        // Errores de validación (422) — mantener estructura de Laravel con code adicional
        $exceptions->render(function (ValidationException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json([
                    'error' => [
                        'code'    => 'validation_failed',
                        'message' => 'Los datos proporcionados no son válidos.',
                    ],
                    'errors' => $e->errors(),
                ], 422);
            }
        });

        // Reportar en producción con contexto mínimo
        $exceptions->reportable(function (Throwable $e) {
            if (app()->environment('production')) {
                Log::error($e->getMessage(), [
                    'exception' => get_class($e),
                    'file'      => $e->getFile(),
                    'line'      => $e->getLine(),
                    'user_id'   => auth('api')->id(),
                    'url'       => request()->fullUrl(),
                    'method'    => request()->method(),
                    'ip'        => request()->ip(),
                ]);
            }
        });
    })->create();
```

### 5.2 Explicación de cada sección

#### `shouldRenderJsonWhen`

```php
$exceptions->shouldRenderJsonWhen(function (Request $request) {
    return $request->is('api/*') || $request->expectsJson();
});
```

**Qué hace:** Instruye a Laravel a que TODAS las excepciones en rutas `/api/*` se rendericen como JSON, incluso excepciones inesperadas como `ErrorException` o `PDOException`. Sin esto, una excepción no capturada en una ruta API podría devolver HTML (la página de error de Laravel), lo cual es inútil para un cliente que espera JSON.

**`$request->expectsJson()`**: Detecta el header `Accept: application/json`. Es una buena práctica que todo cliente de API envíe este header. Si el cliente lo envía pero la ruta no empieza con `api/`, igual le damos JSON.

#### `dontReport`

```php
$exceptions->dontReport([
    AuthenticationException::class,
    AccountInactiveException::class,
]);
```

**Qué hace:** Excluye estas excepciones de los logs de Laravel.

**¿Por qué?** `AuthenticationException` se lanza en CADA intento de login fallido. Si un atacante está haciendo brute force, los logs se llenarían de cientos de entradas "Credenciales inválidas". Estas excepciones son eventos esperados del dominio de negocio, no errores del sistema. No necesitan llenar los logs.

Si quisieras registrar intentos de login fallidos para auditoría de seguridad, lo harías en el `AuthService::login()` con `Log::warning()`, no mediante el reporte automático de excepciones.

#### Render personalizado para `NotFoundHttpException` (404)

```php
$exceptions->render(function (NotFoundHttpException $e, Request $request) {
    if ($request->is('api/*')) {
        return response()->json([
            'error' => [
                'code'    => 'not_found',
                'message' => 'El recurso solicitado no existe.',
            ],
        ], 404);
    }
});
```

Unifica el formato de errores 404. Cuando un cliente pide `GET /api/users/99999` y el usuario no existe, la respuesta es:

```json
{
    "error": {
        "code": "not_found",
        "message": "El recurso solicitado no existe."
    }
}
```

En vez del formato por defecto de Laravel para `ModelNotFoundException` (que varía entre versiones).

#### Render personalizado para `AuthorizationException` (403)

```php
$exceptions->render(function (AuthorizationException $e, Request $request) {
    if ($request->is('api/*')) {
        return response()->json([
            'error' => [
                'code'    => 'forbidden',
                'message' => 'No tienes permiso para realizar esta acción.',
            ],
        ], 403);
    }
});
```

Prepara el terreno para cuando implementes Policies y Gates de autorización. Actualmente no hay lógica de autorización más allá de "está autenticado", pero cuando añadas `$this->authorize('update', $post)` en futuros controllers, las excepciones de autorización seguirán este formato.

#### Render personalizado para `ValidationException` (422)

```php
$exceptions->render(function (ValidationException $e, Request $request) {
    if ($request->is('api/*')) {
        return response()->json([
            'error' => [
                'code'    => 'validation_failed',
                'message' => 'Los datos proporcionados no son válidos.',
            ],
            'errors' => $e->errors(),
        ], 422);
    }
});
```

Mantiene la estructura de errores de validación de Laravel (`errors` con array de mensajes por campo) pero añade nuestro envoltorio `error` con `code` y `message`. El frontend puede:

1. Verificar `error.code === 'validation_failed'` para saber que es un error de validación.
2. Iterar `errors` para mostrar mensajes específicos por campo.
3. Usar `error.message` como resumen general.

#### Reporte en producción

```php
$exceptions->reportable(function (Throwable $e) {
    if (app()->environment('production')) {
        Log::error($e->getMessage(), [
            'exception' => get_class($e),
            'file'      => $e->getFile(),
            'line'      => $e->getLine(),
            'user_id'   => auth('api')->id(),
            'url'       => request()->fullUrl(),
            'method'    => request()->method(),
            'ip'        => request()->ip(),
        ]);
    }
});
```

**En producción, logueamos excepciones con contexto, SIN stack traces completos.** Las stack traces pueden contener rutas absolutas del servidor, fragmentos de código, y parámetros de funciones que potencialmente incluyen datos sensibles. El contexto que guardamos es suficiente para debugging:

| Campo | Propósito |
|-------|-----------|
| `exception` | Clase de la excepción (`PDOException`, `ErrorException`, etc.) |
| `file` + `line` | Archivo y línea donde ocurrió. Suficiente para localizar el código. |
| `user_id` | Usuario autenticado (si hay). Saber "el usuario 42 causó este error" acelera el debugging. |
| `url` + `method` | Qué endpoint y método HTTP fallaron. |
| `ip` | IP del cliente, útil para identificar ataques. |

En desarrollo (`APP_ENV=local`), Laravel muestra la página de error completa con stack trace, variables, y entorno. Esto es invaluable para debugging y es seguro en `localhost`.

---

## 6. Logging de Eventos de Seguridad

Los logs son los ojos del sistema en producción. Sin logs, un ataque puede estar ocurriendo durante horas sin que lo sepas. Pero los logs también deben ser selectivos: demasiada información genera ruido, muy poca deja puntos ciegos.

### 6.1 Eventos a registrar

Añade (o confirma que ya están) los siguientes logs en `App\Services\AuthService.php`:

```php
use Illuminate\Support\Facades\Log;

// En AuthService::login() — después de autenticación exitosa
Log::info('User logged in', [
    'user_id'    => $user->id,
    'ip'         => request()->ip(),
    'user_agent' => request()->userAgent(),
]);

// En AuthService::login() — después de fallo de credenciales
Log::warning('Failed login attempt', [
    'email'      => $credentials['email'],
    'ip'         => request()->ip(),
    'user_agent' => request()->userAgent(),
]);

// En AuthService::refreshTokens() — detección de reuse attack
Log::alert('Refresh token reuse detected — possible token theft', [
    'user_id'  => $storedToken->user->id,
    'token_id' => $storedToken->id,
    'ip'       => request()->ip(),
    'user_agent' => request()->userAgent(),
]);

// En AuthService::logout() — cierre de sesión
Log::info('User logged out', [
    'user_id' => $user->id,
    'ip'      => request()->ip(),
]);

// En AuthService::register() — nuevo registro
Log::info('New user registered', [
    'user_id' => $user->id,
    'email'   => $user->email,
    'ip'      => request()->ip(),
]);
```

### 6.2 Niveles de log (PSR-3)

Laravel usa la especificación PSR-3 de niveles de log. La elección del nivel es semántica y determina qué herramientas de monitoreo alertarán:

| Nivel | Cuándo usarlo | Ejemplo en esta app |
|-------|--------------|---------------------|
| **debug** | Información detallada para desarrollo | Valores de variables durante el proceso de login |
| **info** | Eventos normales, operaciones esperadas | Login exitoso, registro exitoso, logout |
| **notice** | Eventos normales pero significativos | Usuario cambió su contraseña |
| **warning** | Eventos anómalos, no necesariamente errores | Login fallido, rate limit alcanzado |
| **error** | Errores que requieren atención | Excepción no capturada, error de base de datos |
| **critical** | Errores críticos que afectan la operación | Servicio de cache caído, no se pueden validar tokens |
| **alert** | Acción inmediata requerida | Detección de reuse attack (posible token robado) |
| **emergency** | Sistema inutilizable | Base de datos caída, aplicación no arranca |

### 6.3 Estructura de los logs

Cada entrada de log sigue la misma estructura: un mensaje descriptivo en inglés (convención estándar para logs) y un array de contexto con datos estructurados.

```php
Log::warning('Failed login attempt', [
    'email'      => $credentials['email'],
    'ip'         => request()->ip(),
    'user_agent' => request()->userAgent(),
]);
```

Ventajas del contexto estructurado:

1. **Parseable**: Herramientas como ELK, Datadog, y Grafana Loki pueden indexar los campos del contexto para búsquedas como `level:warning AND email:"john@test.com"`.
2. **Consistente**: Todos los logs de seguridad tienen los mismos campos (`email`, `ip`, `user_agent`, `user_id` donde aplica).
3. **Privacidad**: El mensaje es genérico. El contexto contiene los detalles. Si necesitas redactar logs para GDPR, es más fácil filtrar campos del contexto que parsear mensajes de texto libre.

### 6.4 Estrategia de monitoreo recomendada

Para un sistema en producción, los logs deben ser:

1. **Centralizados**: Todos los logs de todas las instancias van a un mismo lugar (ELK stack, Datadog, Grafana Loki, CloudWatch). Buscar en archivos `.log` de cada servidor no escala.

2. **Alertados**: Configura alertas en tu sistema de monitoreo para:
   - `level:alert` → notificación inmediata (posible ataque en curso).
   - `level:warning` + alta frecuencia en login → posible brute force attack.
   - `level:error` → revisión diaria, posible bug.

3. **Retenidos**: Define una política de retención. Logs de seguridad (login, logout, refresh) deberían retenerse al menos 90 días. Logs de debug pueden rotarse cada 7 días.

---

## 7. Comando de Limpieza de Refresh Tokens (Scheduled Task)

### 7.1 El problema

La tabla `refresh_tokens` crece con cada login y cada refresh. Cada fila ocupa aproximadamente:

- `id`: 8 bytes (BIGINT)
- `user_id`: 8 bytes (BIGINT)
- `token`: ~400 bytes (JWT típico en VARCHAR(500))
- `expires_at`: ~4 bytes (TIMESTAMP)
- `revoked_at`: ~4 bytes (TIMESTAMP)
- `created_at`: ~4 bytes (TIMESTAMP)
- `updated_at`: ~4 bytes (TIMESTAMP)

**Total: ~432 bytes por fila.**

En una aplicación con 10,000 usuarios activos que se loguean una vez al día y refrescan tokens 4 veces al día (uso típico de una sesión de 8 horas con TTL de 15 minutos), se generan ~50,000 filas por día — aproximadamente 21.6 MB diarios. En un año, ~7.8 GB solo en refresh tokens. La mayoría son tokens ya expirados o revocados que no sirven para nada.

### 7.2 Crear el comando

```bash
php artisan make:command CleanupExpiredTokens
```

Sobrescribe el contenido generado en `app/Console/Commands/CleanupExpiredTokens.php`:

```php
<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\RefreshToken;
use Illuminate\Console\Command;

class CleanupExpiredTokens extends Command
{
    protected $signature = 'tokens:cleanup
                            {--days=30 : Días de retención para tokens revocados (default: 30)}';

    protected $description = 'Elimina refresh tokens expirados y revocados antiguos de la base de datos.';

    public function handle(): int
    {
        $retentionDays = (int) $this->option('days');

        // Tokens expirados: eliminación inmediata
        $expiredCount = RefreshToken::where('expires_at', '<', now())->delete();
        $this->info("Tokens expirados eliminados: {$expiredCount}");

        // Tokens revocados: eliminar solo los que tienen más de N días desde su revocación
        $revokedCount = RefreshToken::whereNotNull('revoked_at')
            ->where('revoked_at', '<', now()->subDays($retentionDays))
            ->delete();
        $this->info("Tokens revocados eliminados (>{$retentionDays} días): {$revokedCount}");

        $totalDeleted = $expiredCount + $revokedCount;
        $this->info("Total eliminados: {$totalDeleted}");

        return self::SUCCESS;
    }
}
```

### 7.3 Explicación del comando

#### Signature y opciones

```php
protected $signature = 'tokens:cleanup
                        {--days=30 : Días de retención para tokens revocados (default: 30)}';
```

- `tokens:cleanup`: nombre del comando. Se ejecuta con `php artisan tokens:cleanup`.
- `--days=30`: opción con valor por defecto. Define cuántos días conservar los tokens revocados antes de eliminarlos. Personalizable en cada ejecución: `php artisan tokens:cleanup --days=60`.

#### Tokens expirados: eliminación inmediata

```php
$expiredCount = RefreshToken::where('expires_at', '<', now())->delete();
```

**¿Por qué eliminación inmediata?** Un token que ya expiró naturalmente (`expires_at` pasó) no tiene valor de auditoría. No fue revocado — simplemente caducó. No hay "quién lo revocó" ni "por qué". Ocupa espacio sin propósito. Se elimina sin período de gracia.

**El índice `idx_refresh_tokens_expires_at`** (creado en la Parte 4) hace que esta consulta sea eficiente: MySQL usa el índice para encontrar las filas con `expires_at < NOW()` sin escanear toda la tabla.

#### Tokens revocados: retención de N días

```php
$revokedCount = RefreshToken::whereNotNull('revoked_at')
    ->where('revoked_at', '<', now()->subDays($retentionDays))
    ->delete();
```

**¿Por qué retener tokens revocados?** Un token revocado fue invalidado antes de su expiración natural, por una de estas razones:

| Razón de revocación | Quién lo revocó | Valor de auditoría |
|---------------------|-----------------|-------------------|
| Rotación normal (refresh) | El sistema, durante `refreshTokens()` | Bajo — es operación normal |
| Logout | El usuario, durante `logout()` | Medio — "el usuario cerró sesión a las X:YZ" |
| Reuse attack detectado | El sistema, durante `refreshTokens()` (segundo uso) | **Alto** — posible ataque de seguridad |

La retención de 30 días (configurable) permite auditoría forense: si un usuario reporta actividad sospechosa, puedes consultar `SELECT * FROM refresh_tokens WHERE user_id = ? ORDER BY revoked_at DESC` y ver exactamente cuándo y por qué se revocaron sus tokens.

Después de 30 días, los tokens revocados se eliminan. El valor de auditoría decae con el tiempo — un token revocado hace 6 meses rara vez es relevante.

#### Output del comando

```php
$this->info("Tokens expirados eliminados: {$expiredCount}");
$this->info("Tokens revocados eliminados (>{$retentionDays} días): {$revokedCount}");
$this->info("Total eliminados: {$totalDeleted}");

return self::SUCCESS;
```

El comando informa cuántos tokens eliminó en cada categoría. Esto es útil para monitoreo: si un día elimina 1 millón de tokens expirados, sabes que el sistema tiene alto volumen de refresh. Si elimina 0 consistentemente, tal vez el comando no se está ejecutando.

`self::SUCCESS` es la constante `0` (código de salida exitoso). Si quisiéramos indicar fallo, retornaríamos `self::FAILURE` (1).

### 7.4 Programar el comando

En Laravel 11, la programación de tareas se configura en `routes/console.php` o en `bootstrap/app.php` con el método `withSchedule()`. Usa este último para tener toda la configuración de la aplicación en un solo archivo.

Amplía `bootstrap/app.php` para incluir la programación:

```php
use Illuminate\Console\Scheduling\Schedule;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // ... middleware configuration ...
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // ... exception handling ...
    })
    ->withSchedule(function (Schedule $schedule) {
        $schedule->command('tokens:cleanup')
            ->dailyAt('03:00')
            ->timezone('America/Mexico_City')
            ->runInBackground()
            ->withoutOverlapping();
    })
    ->create();
```

#### Explicación de la programación

- **`dailyAt('03:00')`**: Ejecuta diariamente a las 3:00 AM. Esta es típicamente la hora de menor tráfico en la mayoría de aplicaciones. Ajusta la zona horaria según tu ubicación.
- **`timezone('America/Mexico_City')`**: Define la zona horaria para la programación. Sin esto, `03:00` se interpreta en UTC. Ajusta a tu zona horaria.
- **`runInBackground()`**: Ejecuta el comando en un proceso separado. Si la limpieza tarda más de un minuto, no bloquea otras tareas programadas.
- **`withoutOverlapping()`**: Si la ejecución anterior aún no ha terminado a las 3:00 AM del día siguiente, no inicia una nueva. Previene múltiples instancias del comando corriendo simultáneamente (lo cual no causaría problemas en esta operación, pero es una buena práctica).

### 7.5 Configurar el cron en el servidor

Laravel necesita un único cron job en el servidor que ejecute el scheduler cada minuto. El scheduler interno de Laravel decide qué tareas corren según su programación.

Añade esta línea al crontab del usuario que ejecuta la aplicación:

```bash
* * * * * cd /ruta/a/tu/proyecto && php artisan schedule:run >> /dev/null 2>&1
```

O si usas Laravel Forge, Ploi, o similar, esta entrada se configura automáticamente.

#### Verificar el cron y el scheduler

Puedes probar que el comando de limpieza funciona sin esperar a las 3 AM:

```bash
php artisan tokens:cleanup
```

Para probar el scheduler completo sin cron:

```bash
php artisan schedule:run
```

Esto ejecuta todas las tareas que deberían correr en este minuto. Durante el día, solo verás "No scheduled commands are ready to run." porque `tokens:cleanup` está programado para las 3 AM.

---

## 8. Factories para Testing

Las factories permiten generar datos de prueba de forma consistente en los tests. `UserFactory` ya fue creada en la Parte 2 y completada en la Parte 4. Aquí la refinamos con estados adicionales útiles para los tests de seguridad.

### 8.1 UserFactory completa

Sobrescribe (o confirma el contenido de) `database/factories/UserFactory.php`:

```php
<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\User>
 */
class UserFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name'              => fake()->name(),
            'email'             => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password'          => Hash::make('password'),
            'role'              => UserRole::User,
            'status'            => UserStatus::Active,
            'remember_token'    => null,
        ];
    }

    /**
     * Usuario con rol de administrador.
     */
    public function admin(): static
    {
        return $this->state(fn (array $attributes) => [
            'role' => UserRole::Admin,
        ]);
    }

    /**
     * Usuario con cuenta inactiva.
     */
    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => UserStatus::Inactive,
        ]);
    }

    /**
     * Usuario baneado.
     */
    public function banned(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => UserStatus::Banned,
        ]);
    }

    /**
     * Usuario con email sin verificar.
     */
    public function unverified(): static
    {
        return $this->state(fn (array $attributes) => [
            'email_verified_at' => null,
        ]);
    }

    /**
     * Usuario soft-deleted.
     */
    public function trashed(): static
    {
        return $this->state(fn (array $attributes) => [
            'deleted_at' => now(),
        ]);
    }
}
```

### 8.2 Explicación de cada estado

Cada método de estado retorna una factory con atributos modificados mediante `state()`. Esto permite composición fluida:

```php
// Usuario admin inactivo (estados combinados)
User::factory()->admin()->inactive()->create();

// Usuario baneado con email sin verificar
User::factory()->banned()->unverified()->create();

// Usuario estándar activo (default)
User::factory()->create();

// Crear 10 usuarios activos
User::factory()->count(10)->create();
```

**`Hash::make('password')` en la factory:** La factory crea usuarios directamente en la base de datos con `create()`. El password debe estar hasheado ANTES de insertarse. Aunque el cast `'hashed'` del modelo `User` hashea automáticamente en `save()`/`create()` de Eloquent, usar `Hash::make()` explícitamente en la factory es más seguro: si alguna vez cambia el cast, la factory sigue funcionando.

**`'remember_token' => null`**: Explícitamente inicializa el `remember_token` como `null`. Aunque Laravel lo hace por defecto, ser explícito evita sorpresas.

---

## 9. Testing Integral de Autenticación

Esta sección consolida y expande los tests de las Partes 4 y 5, añadiendo casos que no fueron cubiertos anteriormente. Los tests se escriben en sus propios archivos, organizados por funcionalidad.

### 9.1 Archivos de test

Crea los siguientes archivos (algunos ya existen de las partes anteriores; aquí los expandimos):

```
tests/Feature/Auth/
├── LoginTest.php        ← Tests de login, middleware, refresh, logout (Parte 5 + nuevos)
├── RegisterTest.php     ← Tests de registro (Parte 4 + nuevos)
└── SecurityTest.php     ← NUEVO: Tests de rate limiting, CORS, headers de seguridad
```

### 9.2 LoginTest (expandido desde Parte 5)

El archivo `tests/Feature/Auth/LoginTest.php` ya contiene 15 tests de la Parte 5. Añade los siguientes tests adicionales:

```php
<?php

declare(strict_types=1);

// ============================================================
// Añadir estos tests a tests/Feature/Auth/LoginTest.php
// (manteniendo los 15 tests existentes de la Parte 5)
// ============================================================

// ──── Tests adicionales de Login ────

public function test_login_sets_expires_in_seconds_correctly(): void
{
    $this->createUser();

    $response = $this->postJson(route('auth.login'), $this->loginPayload());

    $response->assertStatus(200);

    $expectedExpiresIn = config('jwt.ttl') * 60; // 15 min * 60 = 900 segundos
    $this->assertEquals(
        $expectedExpiresIn,
        $response->json('data.expires_in'),
        "expires_in debe ser {$expectedExpiresIn} segundos"
    );
}

public function test_login_token_can_access_protected_routes(): void
{
    $this->createUser();

    $loginResponse = $this->postJson(route('auth.login'), $this->loginPayload());
    $accessToken = $loginResponse->json('data.access_token');

    $response = $this->getJson(route('user.me'), [
        'Authorization' => 'Bearer ' . $accessToken,
    ]);

    $response->assertStatus(200)
        ->assertJsonStructure([
            'data' => [
                'user' => ['id', 'name', 'email', 'role', 'status'],
            ],
        ]);
}

public function test_login_revokes_previous_refresh_tokens(): void
{
    $this->createUser();

    // Primer login
    $firstLogin = $this->postJson(route('auth.login'), $this->loginPayload());
    $firstLogin->assertStatus(200);

    // Verificar que hay UN refresh token activo
    $this->assertDatabaseCount('refresh_tokens', 1);
    $this->assertEquals(
        1,
        \App\Models\RefreshToken::where('user_id', 1)->whereNull('revoked_at')->count()
    );

    // Segundo login
    $this->postJson(route('auth.login'), $this->loginPayload())->assertStatus(200);

    // Verificar que el primer refresh token fue revocado
    $this->assertDatabaseCount('refresh_tokens', 2);
    $this->assertEquals(
        1,
        \App\Models\RefreshToken::where('user_id', 1)->whereNull('revoked_at')->count(),
        'Solo debe haber un refresh token activo después del segundo login'
    );
}

// ──── Tests adicionales de Refresh ────

public function test_refresh_with_expired_token_fails(): void
{
    $user = $this->createUser();
    $accessToken = auth('api')->login($user);

    // Crear refresh token ya expirado
    $expiredRefreshToken = auth('api')->setTTL(-1)->login($user); // TTL negativo = ya expiró
    $user->refreshTokens()->create([
        'token'      => $expiredRefreshToken,
        'expires_at' => now()->subMinute(), // expiró hace 1 minuto
    ]);

    $response = $this->postJson(route('auth.refresh'), [
        'refresh_token' => $expiredRefreshToken,
    ], [
        'Authorization' => 'Bearer ' . $accessToken,
    ]);

    $response->assertStatus(401)
        ->assertJson([
            'error' => [
                'code' => 'invalid_refresh_token',
            ],
        ]);
}

public function test_refresh_for_inactive_user_fails(): void
{
    $user = $this->createUser(['status' => \App\Enums\UserStatus::Inactive]);
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

    $response->assertStatus(403)
        ->assertJson([
            'error' => [
                'code' => 'account_inactive',
            ],
        ]);
}

public function test_refresh_without_existing_token_in_db_fails(): void
{
    $user = $this->createUser();
    $accessToken = auth('api')->login($user);

    // Refresh token generado pero NO guardado en la DB
    $orphanRefreshToken = auth('api')->setTTL(config('jwt.refresh_ttl'))->login($user);

    $response = $this->postJson(route('auth.refresh'), [
        'refresh_token' => $orphanRefreshToken,
    ], [
        'Authorization' => 'Bearer ' . $accessToken,
    ]);

    $response->assertStatus(401)
        ->assertJson([
            'error' => [
                'code' => 'invalid_refresh_token',
            ],
        ]);
}

// ──── Tests adicionales de Logout ────

public function test_logout_revokes_only_current_user_tokens(): void
{
    $user1 = $this->createUser(['email' => 'user1@test.com']);
    $user2 = User::factory()->create([
        'email'    => 'user2@test.com',
        'password' => $this->password,
        'status'   => \App\Enums\UserStatus::Active,
    ]);

    // Login de user1 → refresh token para user1
    $login1 = $this->postJson(route('auth.login'), [
        'email'    => 'user1@test.com',
        'password' => $this->password,
    ]);

    // Login de user2 → refresh token para user2
    $login2 = $this->postJson(route('auth.login'), [
        'email'    => 'user2@test.com',
        'password' => $this->password,
    ]);

    // Logout de user1
    $this->postJson(route('auth.logout'), [], [
        'Authorization' => 'Bearer ' . $login1->json('data.access_token'),
    ])->assertStatus(200);

    // Verificar: tokens de user1 están revocados, tokens de user2 siguen activos
    $this->assertEquals(
        0,
        \App\Models\RefreshToken::where('user_id', $user1->id)->whereNull('revoked_at')->count(),
        'Tokens de user1 deben estar revocados'
    );

    $this->assertEquals(
        1,
        \App\Models\RefreshToken::where('user_id', $user2->id)->whereNull('revoked_at')->count(),
        'Tokens de user2 deben seguir activos'
    );
}

// ──── Tests del endpoint /me ────

public function test_me_endpoint_returns_only_selected_fields(): void
{
    $user = $this->createUser();
    $token = auth('api')->login($user);

    $response = $this->getJson(route('user.me'), [
        'Authorization' => 'Bearer ' . $token,
    ]);

    $response->assertStatus(200);

    $userData = $response->json('data.user');

    // Campos que DEBEN estar presentes
    $this->assertArrayHasKey('id', $userData);
    $this->assertArrayHasKey('name', $userData);
    $this->assertArrayHasKey('email', $userData);
    $this->assertArrayHasKey('role', $userData);
    $this->assertArrayHasKey('status', $userData);

    // Campos que NO deben estar expuestos
    $this->assertArrayNotHasKey('password', $userData);
    $this->assertArrayNotHasKey('remember_token', $userData);
    $this->assertArrayNotHasKey('deleted_at', $userData);
    $this->assertArrayNotHasKey('email_verified_at', $userData);
    $this->assertArrayNotHasKey('created_at', $userData);
    $this->assertArrayNotHasKey('updated_at', $userData);
}
```

### 9.3 RegisterTest (expandido desde Parte 4)

El archivo `tests/Feature/Auth/RegisterTest.php` ya contiene tests de la Parte 4. Añade estos tests adicionales:

```php
<?php

declare(strict_types=1);

// ============================================================
// Añadir estos tests a tests/Feature/Auth/RegisterTest.php
// (manteniendo los tests existentes de la Parte 4)
// ============================================================

use App\Enums\UserRole;
use App\Enums\UserStatus;
use Illuminate\Support\Facades\Hash;

public function test_password_is_hashed_after_registration(): void
{
    $response = $this->postJson('/api/auth/register', [
        'name'                  => 'Hash Test',
        'email'                 => 'hash@example.com',
        'password'              => 'Secure123!',
        'password_confirmation' => 'Secure123!',
    ]);

    $response->assertStatus(201);

    $user = \App\Models\User::where('email', 'hash@example.com')->first();
    $this->assertNotNull($user);
    $this->assertNotEquals('Secure123!', $user->password);
    $this->assertTrue(Hash::check('Secure123!', $user->password));
}

public function test_registration_defaults_role_to_user(): void
{
    $response = $this->postJson('/api/auth/register', [
        'name'                  => 'Role Test',
        'email'                 => 'role@example.com',
        'password'              => 'Secure123!',
        'password_confirmation' => 'Secure123!',
    ]);

    $response->assertStatus(201);

    $this->assertDatabaseHas('users', [
        'email' => 'role@example.com',
        'role'  => UserRole::User->value,
    ]);

    $user = \App\Models\User::where('email', 'role@example.com')->first();
    $this->assertEquals(UserRole::User, $user->role);
}

public function test_registration_defaults_status_to_active(): void
{
    $response = $this->postJson('/api/auth/register', [
        'name'                  => 'Status Test',
        'email'                 => 'status@example.com',
        'password'              => 'Secure123!',
        'password_confirmation' => 'Secure123!',
    ]);

    $response->assertStatus(201);

    $this->assertDatabaseHas('users', [
        'email'  => 'status@example.com',
        'status' => UserStatus::Active->value,
    ]);
}

public function test_registration_ignores_role_in_request(): void
{
    // Aunque el cliente envíe "role": "admin", debe ser ignorado
    $response = $this->postJson('/api/auth/register', [
        'name'                  => 'Attacker',
        'email'                 => 'attacker@example.com',
        'password'              => 'Secure123!',
        'password_confirmation' => 'Secure123!',
        'role'                  => 'admin', // <-- Intentando escalar privilegios
    ]);

    $response->assertStatus(201);

    $user = \App\Models\User::where('email', 'attacker@example.com')->first();
    $this->assertEquals(UserRole::User, $user->role, 'El rol debe ser User, no Admin');
}
```

### 9.4 SecurityTest (NUEVO)

Crea el archivo `tests/Feature/Auth/SecurityTest.php`:

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Auth;

use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SecurityTest extends TestCase
{
    use RefreshDatabase;

    private string $password = 'Secure123!';

    // ──── Tests de Rate Limiting ────

    public function test_login_rate_limit_blocks_after_5_attempts(): void
    {
        $user = User::factory()->create([
            'email'    => 'test@example.com',
            'password' => $this->password,
            'status'   => UserStatus::Active,
        ]);

        // 5 intentos con contraseña incorrecta
        for ($i = 0; $i < 5; $i++) {
            $this->postJson(route('auth.login'), [
                'email'    => 'test@example.com',
                'password' => 'wrong',
            ])->assertStatus(401);
        }

        // 6° intento debe ser bloqueado
        $this->postJson(route('auth.login'), [
            'email'    => 'test@example.com',
            'password' => $this->password, // contraseña CORRECTA, pero debe ser bloqueado igual
        ])->assertStatus(429);
    }

    public function test_registration_rate_limit_blocks_after_3_per_hour(): void
    {
        // 3 registros exitosos
        for ($i = 0; $i < 3; $i++) {
            $this->postJson('/api/auth/register', [
                'name'                  => "User {$i}",
                'email'                 => "user{$i}@example.com",
                'password'              => $this->password,
                'password_confirmation' => $this->password,
            ])->assertStatus(201);
        }

        // 4° intento debe ser bloqueado
        $this->postJson('/api/auth/register', [
            'name'                  => 'Blocked',
            'email'                 => 'blocked@example.com',
            'password'              => $this->password,
            'password_confirmation' => $this->password,
        ])->assertStatus(429);
    }

    public function test_user_enumeration_prevention(): void
    {
        $user = User::factory()->create([
            'email'    => 'exists@example.com',
            'password' => $this->password,
            'status'   => UserStatus::Active,
        ]);

        // Email que NO existe
        $noExists = $this->postJson(route('auth.login'), [
            'email'    => 'noexists@example.com',
            'password' => 'irrelevant',
        ]);

        // Email que SÍ existe, contraseña incorrecta
        $existsWrongPassword = $this->postJson(route('auth.login'), [
            'email'    => 'exists@example.com',
            'password' => 'wrongpassword',
        ]);

        // Ambos deben devolver EXACTAMENTE la misma respuesta
        $noExists->assertStatus(401)
            ->assertJson(['error' => ['code' => 'invalid_credentials']]);

        $existsWrongPassword->assertStatus(401)
            ->assertJson(['error' => ['code' => 'invalid_credentials']]);

        $this->assertEquals(
            $noExists->json(),
            $existsWrongPassword->json(),
            'Las respuestas para email inexistente y contraseña incorrecta deben ser idénticas'
        );
    }

    // ──── Tests de Security Headers ────

    public function test_security_headers_are_present(): void
    {
        $user = User::factory()->create([
            'password' => $this->password,
            'status'   => UserStatus::Active,
        ]);

        $token = auth('api')->login($user);

        $response = $this->getJson(route('user.me'), [
            'Authorization' => 'Bearer ' . $token,
        ]);

        $response->assertHeader('X-Content-Type-Options', 'nosniff');
        $response->assertHeader('X-Frame-Options', 'DENY');
        $response->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->assertHeader('Content-Security-Policy');
        $response->assertHeader('Permissions-Policy');
    }

    public function test_hsts_header_not_present_in_local(): void
    {
        $user = User::factory()->create([
            'password' => $this->password,
            'status'   => UserStatus::Active,
        ]);

        $token = auth('api')->login($user);

        $response = $this->getJson(route('user.me'), [
            'Authorization' => 'Bearer ' . $token,
        ]);

        // En entorno local, HSTS NO debe estar presente
        $this->assertFalse(
            $response->headers->has('Strict-Transport-Security'),
            'HSTS no debe enviarse en entorno de desarrollo'
        );
    }

    // ──── Tests de CORS ────

    public function test_cors_headers_are_present(): void
    {
        $response = $this->withHeaders([
            'Origin'                         => 'http://localhost:3000',
            'Access-Control-Request-Method'  => 'POST',
            'Access-Control-Request-Headers' => 'Content-Type, Authorization',
        ])->options('/api/auth/login');

        $response->assertStatus(200);

        $corsOrigin = $response->headers->get('Access-Control-Allow-Origin');

        // En entorno de test, config('cors.allowed_origins') puede ser ['*'] o la lista de .env
        // Verificamos que el header existe y tiene un valor no vacío
        $this->assertNotNull($corsOrigin, 'Access-Control-Allow-Origin debe estar presente');
        $this->assertNotEmpty($corsOrigin);

        $response->assertHeader('Access-Control-Allow-Methods');
        $response->assertHeader('Access-Control-Max-Age');
    }

    // ──── Tests de Soft-Delete en autenticación ────

    public function test_soft_deleted_user_cannot_access_protected_routes(): void
    {
        $user = User::factory()->create([
            'password' => $this->password,
            'status'   => UserStatus::Active,
        ]);

        $token = auth('api')->login($user);

        // Verificar acceso normal
        $this->getJson(route('user.me'), [
            'Authorization' => 'Bearer ' . $token,
        ])->assertStatus(200);

        // Soft-delete al usuario
        $user->delete();

        // Ahora el token debe ser rechazado
        $this->getJson(route('user.me'), [
            'Authorization' => 'Bearer ' . $token,
        ])->assertStatus(401)
        ->assertJson(['error' => ['code' => 'token_invalid']]);
    }

    public function test_banned_user_token_is_rejected_by_middleware(): void
    {
        $user = User::factory()->create([
            'password' => $this->password,
            'status'   => UserStatus::Active,
        ]);

        $token = auth('api')->login($user);

        // Verificar acceso normal
        $this->getJson(route('user.me'), [
            'Authorization' => 'Bearer ' . $token,
        ])->assertStatus(200);

        // Banear al usuario
        $user->update(['status' => UserStatus::Banned]);

        // Ahora el token debe ser rechazado
        $this->getJson(route('user.me'), [
            'Authorization' => 'Bearer ' . $token,
        ])->assertStatus(403) // o 401 según implementación del middleware
        ->assertJson(['error' => ['code' => 'account_inactive']]);
    }

    // ──── Tests de Validación de Errores JSON ────

    public function test_404_errors_follow_json_format(): void
    {
        $response = $this->getJson('/api/nonexistent-endpoint');

        $response->assertStatus(404)
            ->assertJsonStructure([
                'error' => ['code', 'message'],
            ])
            ->assertJson([
                'error' => [
                    'code' => 'not_found',
                ],
            ]);
    }

    public function test_422_errors_include_error_code(): void
    {
        $response = $this->postJson(route('auth.login'), [
            // Falta el campo email intencionalmente
            'password' => 'anything',
        ]);

        $response->assertStatus(422)
            ->assertJsonStructure([
                'error' => ['code', 'message'],
                'errors',
            ])
            ->assertJson([
                'error' => [
                    'code' => 'validation_failed',
                ],
            ]);
    }

    // ──── Tests de Comando de Limpieza ────

    public function test_cleanup_command_removes_expired_tokens(): void
    {
        $user = User::factory()->create(['status' => UserStatus::Active]);

        // Crear token expirado
        \App\Models\RefreshToken::create([
            'user_id'    => $user->id,
            'token'      => 'expired-token-jwt-string',
            'expires_at' => now()->subDay(), // expiró ayer
        ]);

        // Crear token activo
        \App\Models\RefreshToken::create([
            'user_id'    => $user->id,
            'token'      => 'active-token-jwt-string',
            'expires_at' => now()->addDays(7),
        ]);

        $this->assertDatabaseCount('refresh_tokens', 2);

        $this->artisan('tokens:cleanup')
            ->expectsOutputToContain('Tokens expirados eliminados: 1')
            ->assertExitCode(0);

        $this->assertDatabaseCount('refresh_tokens', 1);
        $this->assertDatabaseHas('refresh_tokens', ['token' => 'active-token-jwt-string']);
        $this->assertDatabaseMissing('refresh_tokens', ['token' => 'expired-token-jwt-string']);
    }

    public function test_cleanup_command_removes_old_revoked_tokens(): void
    {
        $user = User::factory()->create(['status' => UserStatus::Active]);

        // Token revocado hace 31 días
        \App\Models\RefreshToken::create([
            'user_id'    => $user->id,
            'token'      => 'old-revoked-token',
            'expires_at' => now()->addDays(5), // todavía no expira por fecha natural
            'revoked_at' => now()->subDays(31),
        ]);

        // Token revocado recientemente (hace 5 días)
        \App\Models\RefreshToken::create([
            'user_id'    => $user->id,
            'token'      => 'recent-revoked-token',
            'expires_at' => now()->addDays(5),
            'revoked_at' => now()->subDays(5),
        ]);

        $this->assertDatabaseCount('refresh_tokens', 2);

        $this->artisan('tokens:cleanup')
            ->expectsOutputToContain('Tokens revocados eliminados (>30 días): 1')
            ->assertExitCode(0);

        $this->assertDatabaseCount('refresh_tokens', 1);
        $this->assertDatabaseMissing('refresh_tokens', ['token' => 'old-revoked-token']);
        $this->assertDatabaseHas('refresh_tokens', ['token' => 'recent-revoked-token']);
    }

    public function test_cleanup_command_respects_custom_retention_days(): void
    {
        $user = User::factory()->create(['status' => UserStatus::Active]);

        // Token revocado hace 10 días
        \App\Models\RefreshToken::create([
            'user_id'    => $user->id,
            'token'      => 'ten-days-revoked',
            'expires_at' => now()->addDays(5),
            'revoked_at' => now()->subDays(10),
        ]);

        // Con 15 días de retención, el token de 10 días NO debe eliminarse
        $this->artisan('tokens:cleanup --days=15')
            ->expectsOutputToContain('Tokens revocados eliminados (>15 días): 0')
            ->assertExitCode(0);

        $this->assertDatabaseHas('refresh_tokens', ['token' => 'ten-days-revoked']);

        // Con 5 días de retención, el token de 10 días SÍ debe eliminarse
        $this->artisan('tokens:cleanup --days=5')
            ->expectsOutputToContain('Tokens revocados eliminados (>5 días): 1')
            ->assertExitCode(0);

        $this->assertDatabaseMissing('refresh_tokens', ['token' => 'ten-days-revoked']);
    }
}
```

### 9.5 Ejecutar todos los tests

```bash
php artisan test
```

Salida esperada combinando todas las partes:

```
PASS  Tests\Feature\Auth\RegisterTest
  ✓ user can register
  ✓ registration fails with duplicate email
  ✓ registration fails with short password
  ✓ registration fails without password confirmation
  ✓ registration fails with invalid email
  ✓ registration fails with empty name
  ✓ registration enforces rate limiting
  ✓ password is hashed after registration
  ✓ registration defaults role to user
  ✓ registration defaults status to active
  ✓ registration ignores role in request

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
  ✓ login sets expires_in seconds correctly
  ✓ login token can access protected routes
  ✓ login revokes previous refresh tokens
  ✓ refresh with expired token fails
  ✓ refresh for inactive user fails
  ✓ refresh without existing token in db fails
  ✓ logout revokes only current user tokens
  ✓ me endpoint returns only selected fields

PASS  Tests\Feature\Auth\SecurityTest
  ✓ login rate limit blocks after 5 attempts
  ✓ registration rate limit blocks after 3 per hour
  ✓ user enumeration prevention
  ✓ security headers are present
  ✓ hsts header not present in local
  ✓ cors headers are present
  ✓ soft deleted user cannot access protected routes
  ✓ banned user token is rejected by middleware
  ✓ 404 errors follow json format
  ✓ 422 errors include error code
  ✓ cleanup command removes expired tokens
  ✓ cleanup command removes old revoked tokens
  ✓ cleanup command respects custom retention days

Tests: 47 passed
```

---

## 10. Checklist de Seguridad para Producción

Antes de desplegar a producción, verifica cada punto de esta lista. Un solo elemento sin marcar puede ser la diferencia entre un sistema seguro y una brecha de seguridad.

### ☑️ Ambiente y Configuración

- [ ] `APP_ENV=production` en `.env`
- [ ] `APP_DEBUG=false` en `.env`
- [ ] `APP_KEY` es una clave aleatoria fuerte (generada con `php artisan key:generate`)
- [ ] `JWT_SECRET` es una clave aleatoria fuerte de al menos 64 caracteres (generada con `php artisan jwt:secret`)
- [ ] `DB_PASSWORD` usa una contraseña fuerte — NO `root`, NO vacía, NO `password`
- [ ] Todas las contraseñas y secretos en `.env` son únicos (no se repiten entre entornos)
- [ ] `.env` NO está en el repositorio (está en `.gitignore`)
- [ ] `.env.example` está actualizado con todas las variables necesarias pero SIN valores reales
- [ ] El usuario de base de datos en producción tiene permisos acotados (no es `root`)
- [ ] HTTPS está configurado y funcionando (certificado TLS válido)
- [ ] Todas las peticiones HTTP son redirigidas a HTTPS (nginx/apache)

### ☑️ Optimización de Laravel

- [ ] `php artisan config:cache` ejecutado
- [ ] `php artisan route:cache` ejecutado
- [ ] `php artisan view:cache` ejecutado
- [ ] `php artisan event:cache` ejecutado
- [ ] `composer install --optimize-autoloader --no-dev` ejecutado
- [ ] Dependencias de desarrollo NO están instaladas en producción
- [ ] `composer audit` ejecutado — sin vulnerabilidades conocidas en dependencias

### ☑️ CORS

- [ ] `CORS_ALLOWED_ORIGINS` contiene SOLO los orígenes del frontend en producción (NO `*`)
- [ ] `supports_credentials` es `false` (usamos `Authorization` header, no cookies)
- [ ] `max_age` configurado (86400 recomendado)
- [ ] Verificado que las peticiones desde el frontend no generan errores CORS en consola

### ☑️ Rate Limiting

- [ ] El rate limiter de login está activo (`throttle:login`)
- [ ] El rate limiter de registro está activo (`throttle:register`)
- [ ] Las rutas protegidas tienen rate limiting por usuario (`throttle:api`)
- [ ] El cache driver para rate limiting es `redis` (o `database`) en producción, no `file`

### ☑️ Security Headers

- [ ] El middleware `SecurityHeaders` está registrado globalmente
- [ ] `X-Content-Type-Options: nosniff` presente
- [ ] `X-Frame-Options: DENY` presente
- [ ] `Strict-Transport-Security` activo en producción
- [ ] `Content-Security-Policy` configurado
- [ ] Verificado con [securityheaders.com](https://securityheaders.com) (objetivo: grade A+)

### ☑️ Base de Datos

- [ ] Las migraciones están actualizadas en producción (`php artisan migrate:status`)
- [ ] La base de datos tiene backups automáticos configurados
- [ ] `utf8mb4` es el charset de la base de datos y las tablas
- [ ] Los índices están creados (especialmente `refresh_tokens.token` y `refresh_tokens.expires_at`)

### ☑️ Contraseñas y Autenticación

- [ ] bcrypt cost factor es adecuado (10+ rounds — verificar en `config/hashing.php`)
- [ ] Longitud mínima de contraseña es 8+ caracteres
- [ ] Login tiene protección anti-brute force (rate limiting por IP + email)
- [ ] No se revelan mensajes específicos en errores de login (user enumeration prevention)
- [ ] Cuentas inactivas/baneadas no pueden autenticarse
- [ ] Usuarios soft-deleted son tratados como inexistentes en autenticación
- [ ] Refresh tokens rotan correctamente (cada refresh emite un nuevo token)
- [ ] Reuse de refresh token es detectado y TODOS los tokens del usuario son revocados
- [ ] Logout invalida tanto access token (blacklist) como refresh tokens (revoke en DB)

### ☑️ JWT Específico

- [ ] TTL de access token es corto (≤ 15 minutos)
- [ ] TTL de refresh token es razonable (≤ 14 días)
- [ ] Claims del JWT NO contienen datos sensibles (sin password hash, sin email si es PII crítico)
- [ ] Blacklist de tokens está habilitada (`blacklist_enabled: true`)
- [ ] Blacklist usa un storage confiable (Redis recomendado en producción)
- [ ] Limpieza de refresh tokens programada con `tokens:cleanup` ejecutándose diariamente

### ☑️ Monitoreo y Logs

- [ ] Logs de errores configurados con rotación (no crecen indefinidamente)
- [ ] Logs contienen contexto estructurado pero NO stack traces completos
- [ ] Eventos de seguridad (login exitoso/fallido, reuse attack) son registrados
- [ ] Monitoreo configurado para alertar sobre picos de 401/429 en login
- [ ] Alertas configuradas para detección de reuse attack
- [ ] Canal de comunicación para incidentes de seguridad definido

### ☑️ Tests

- [ ] Todos los tests pasan en el entorno de producción/staging
- [ ] Tests de rate limiting verifican bloqueos
- [ ] Tests de user enumeration prevention verifican respuestas idénticas
- [ ] Tests de middleware verifican que tokens inactivos/baneados son rechazados
- [ ] Tests del comando de limpieza verifican eliminación correcta
- [ ] Cobertura de código ≥ 80% en el dominio de autenticación

---

## 11. Preparación para Producción — Resumen de Comandos

Ejecuta estos comandos en orden como parte de tu pipeline de deploy:

```bash
# 1. Instalar dependencias de producción (sin dev)
composer install --optimize-autoloader --no-dev

# 2. Verificar que .env tiene las variables de producción
php artisan about

# 3. Cachear configuración (IMPORTANTE: hacerlo DESPUÉS de verificar .env)
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache

# 4. Ejecutar migraciones pendientes (--force para producción)
php artisan migrate --force

# 5. Verificar que las migraciones están aplicadas
php artisan migrate:status

# 6. Verificar seguridad de dependencias
composer audit

# 7. Ejecutar tests (idealmente en pipeline CI/CD antes del deploy)
php artisan test

# 8. Limpiar cachés antiguas
php artisan optimize:clear  # Solo si necesitas regenerar cachés

# 9. Reiniciar colas (si usas queue workers)
php artisan queue:restart
```

Verifica el estado del sistema después del deploy:

```bash
# Ver variables críticas de .env
cat .env | grep -E "APP_ENV|APP_DEBUG|APP_KEY|DB_PASSWORD|JWT_SECRET"

# Verificar que config:cache se aplicó
php artisan config:clear  # Si muestra "Configuration cache cleared", estaba cacheado
php artisan config:cache  # Volver a cachear

# Verificar rutas registradas
php artisan route:list | grep auth

# Verificar que el cron está activo
crontab -l | grep schedule
```

---

## 12. Conclusión del Manual Completo

### 12.1 Lo Construido en las 6 Partes

A lo largo de este manual, construiste desde cero un sistema de autenticación y autorización completo, seguro, testeado y listo para producción. Recapitulemos el camino recorrido:

| Parte | Contenido | Archivos Clave |
|-------|-----------|----------------|
| **Parte 1** | Fundamentos: arquitectura en capas, stack tecnológico, decisiones de seguridad (bcrypt, HS256, claims JWT, CORS conceptual), estructura de directorios, convenciones de código, tipado estricto, enums, formato JSON de respuesta | Estructura del proyecto |
| **Parte 2** | Variables de entorno (`.env`), conexión a MySQL 8, migración `users`, modelo `User` con `JWTSubject`, `SoftDeletes`, casts (`hashed`, `UserRole`, `UserStatus`), enums `UserRole` y `UserStatus` | `config/database.php`, `.env`, `User.php`, `UserRole.php`, `UserStatus.php`, migración `create_users_table` |
| **Parte 3** | Instalación de `tymon/jwt-auth`, configuración de `config/jwt.php` (HS256, TTL 15min, refresh TTL 7d), generación de `JWT_SECRET`, implementación de `getJWTIdentifier()` y `getJWTCustomClaims()`, guard `api` con driver `jwt`, diseño de tabla `refresh_tokens` | `config/jwt.php`, `config/auth.php`, `bootstrap/providers.php` |
| **Parte 4** | Migración `refresh_tokens`, modelo `RefreshToken` con helpers (`isExpired()`, `isRevoked()`, `isValid()`, `revoke()`), `RegisterRequest`, `AuthService::register()`, `RegisterController`, ruta `POST /api/auth/register`, tests de registro | `refresh_tokens` migration, `RefreshToken.php`, `RegisterRequest.php`, `AuthService.php`, `RegisterController.php`, `RegisterTest.php` |
| **Parte 5** | `LoginRequest` (con prevención de user enumeration), `AuthenticationException`, `AccountInactiveException`, `AuthService::login()`, `AuthService::refreshTokens()` (rotación con reuse attack detection), `AuthService::logout()`, middleware `JwtAuthenticate`, controllers de login/refresh/logout, endpoint `/me`, `UserController`, rutas públicas y protegidas, 15 tests | `LoginRequest.php`, `AuthenticationException.php`, `AccountInactiveException.php`, `AuthService.php` (completado), `JwtAuthenticate.php`, `LoginController.php`, `RefreshTokenController.php`, `LogoutController.php`, `UserController.php`, `LoginTest.php` |
| **Parte 6** (esta) | CORS (`config/cors.php`), rate limiting avanzado con limiters personalizados por IP/email/usuario, security headers HTTP (CSP, HSTS, X-Frame-Options, etc.), manejo de errores global con formato unificado, logging de eventos de seguridad, comando `tokens:cleanup` programado, UserFactory con estados, batería completa de tests (47 tests), checklist de producción, comandos de deploy | `config/cors.php`, `AppServiceProvider.php`, `SecurityHeaders.php`, `bootstrap/app.php` (excepciones + scheduler), `CleanupExpiredTokens.php`, `UserFactory.php`, `LoginTest.php` (expandido), `RegisterTest.php` (expandido), `SecurityTest.php` |

### 12.2 Stack Final

```
┌─────────────────────────────────────────────────────┐
│  FRONTEND (SPA / Mobile App)                        │
│  React / Vue / Angular / Flutter / React Native      │
│  Almacena access token en memoria                   │
│  Envía Authorization: Bearer <token>                │
└─────────────────────┬───────────────────────────────┘
                      │ HTTPS
                      ▼
┌─────────────────────────────────────────────────────┐
│  NGINX / APACHE                                     │
│  - Terminación TLS                                  │
│  - Redirección HTTP → HTTPS                         │
│  - Rate limiting a nivel de red (fail2ban)          │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│  LARAVEL 11 API                                     │
│                                                     │
│  Middleware pipeline:                                │
│    SecurityHeaders → CORS → JwtAuthenticate          │
│                          → RateLimiter → Controller  │
│                                                     │
│  Controller → AuthService (lógica de negocio)        │
│  AuthService → User/RefreshToken (Eloquent)          │
│                                                     │
│  Autenticación: JWT (tymon/jwt-auth)                 │
│    - Access token: 15 min (HS256)                   │
│    - Refresh token: 7 días (HS256)                   │
│    - Blacklist: habilitada                          │
│    - Rotación con detección de reuse attack         │
│                                                     │
│  Seguridad:                                         │
│    - CORS con lista blanca explícita                │
│    - Rate limiting por IP + email + usuario         │
│    - Security headers (CSP, HSTS, anti-clickjack)   │
│    - Prevención de user enumeration                 │
│    - Soft-deletes con verificación en middleware     │
│    - Manejo de errores unificado JSON               │
│    - Logging estructurado de eventos de seguridad   │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│  MySQL 8                                            │
│    - Tabla users (softDeletes, enum casts)          │
│    - Tabla refresh_tokens (índices, FK cascade)     │
│    - Limpieza programada diaria (tokens:cleanup)    │
└─────────────────────────────────────────────────────┘
```

### 12.3 El lector ahora tiene

- Un sistema de autenticación funcional con registro, login, logout, refresh de tokens y endpoint de perfil.
- Middleware JWT que protege rutas verificando estado del usuario en cada request.
- Rotación de refresh tokens que detecta y mitiga ataques de token theft.
- Rate limiting por IP, email, y usuario autenticado.
- Seguridad perimetral: CORS, security headers, HTTPS forced via HSTS.
- Manejo de errores consistente con formato `{ error: { code, message } }` en TODA la API.
- Comando programado de limpieza de tokens expirados/revocados.
- 47 tests PHPUnit cubriendo flujos positivos, negativos, edge cases y escenarios de seguridad.
- Checklist verificable para despliegue a producción.
- Logging estructurado para monitoreo y respuesta a incidentes.

### 12.4 Próximos pasos recomendados

Este manual cubre el núcleo de autenticación. Funcionalidades que típicamente se añaden después:

| Funcionalidad | Complejidad | Descripción |
|--------------|-------------|-------------|
| **Email verification** | Media | Verificar que el email del usuario es real antes de activar la cuenta. Laravel incluye `MustVerifyEmail`. Requiere configuración de mail (SMTP, Mailgun, SES). |
| **Password reset** | Media | Flujo de "olvidé mi contraseña": email con link firmado, formulario de nueva contraseña. Laravel incluye `PasswordBroker`. |
| **Two-Factor Authentication (2FA)** | Alta | Añadir TOTP (Google Authenticator) o SMS como segundo factor. Paquetes: `laravel/fortify`, `pragmarx/google2fa`. |
| **OAuth Social Login** | Media-Alta | "Iniciar sesión con Google/Facebook/GitHub". Paquete: `laravel/socialite`. Requiere registrar la app en cada provider. |
| **Sesiones múltiples** | Media | Permitir múltiples dispositivos simultáneos. Necesitas `device_id` en refresh tokens y UI de "cerrar otras sesiones". |
| **Rate limiting con Redis** | Baja | Cambiar `CACHE_DRIVER=redis` para rate limiting compartido entre instancias. |
| **Notificaciones de seguridad** | Media | Email/SMS al usuario cuando se detecta login desde nueva IP, reuse attack, o cambio de contraseña. |
| **Panel de administración** | Alta | Interfaz para gestionar usuarios (banear, reactivar, eliminar, ver sesiones activas). Usar Filament, Nova, o construir custom. |
| **Documentación de API** | Baja-Media | Documentar endpoints con OpenAPI/Swagger. Paquete: `scribe` o `scramble`. |
| **CI/CD Pipeline** | Media | GitHub Actions / GitLab CI para correr tests automáticamente en cada push/PR y desplegar a producción. |

### 12.5 Referencias y lecturas adicionales

- [JWT.io](https://jwt.io) — Debugger de tokens, introducción a JWT.
- [RFC 7519 — JSON Web Token](https://datatracker.ietf.org/doc/html/rfc7519) — La especificación oficial de JWT.
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) — Guía completa de seguridad en autenticación.
- [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html) — Para cuando implementes password reset.
- [NIST SP 800-63B — Digital Identity Guidelines](https://pages.nist.gov/800-63-3/sp800-63b.html) — Estándar del gobierno de EE.UU. sobre autenticación digital.
- [Laravel Authentication Docs](https://laravel.com/docs/11.x/authentication) — Documentación oficial de autenticación en Laravel.
- [tymon/jwt-auth Wiki](https://github.com/tymondesigns/jwt-auth/wiki) — Documentación del paquete JWT.
- [Laravel Rate Limiting](https://laravel.com/docs/11.x/rate-limiting) — Documentación oficial de rate limiting.
- [MDN Web Docs — CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) — Explicación exhaustiva de CORS.
- [MDN Web Docs — Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP) — Referencia de CSP.
- [SecurityHeaders.com](https://securityheaders.com) — Escáner de security headers.
- [HSTS Preload](https://hstspreload.org) — Para incluir tu dominio en la lista de preload de HSTS.

---

## Decisiones Vinculantes para Futuras Extensiones

Este documento es la Parte 6 de 6 del manual. Las siguientes decisiones tomadas aquí deben ser respetadas por cualquier extensión futura del sistema:

1. **El formato de respuesta de error en TODA la API** es `{ "error": { "code": "...", "message": "..." } }`. Cualquier nuevo endpoint o excepción debe seguir este formato.

2. **Los rate limiters personalizados** (`login`, `register`, `api`) están registrados en `AppServiceProvider`. Nuevos endpoints que necesiten rate limiting deben usar estos limiters existentes o registrar nuevos en el mismo provider.

3. **El middleware `SecurityHeaders` es global.** Cualquier nuevo endpoint, web o API, recibe estos headers automáticamente.

4. **El comando `tokens:cleanup` está programado diariamente a las 03:00.** Si se añaden nuevas tablas con datos temporales que necesitan limpieza (password reset tokens, email verification tokens), deben integrarse en este comando o crear comandos separados.

5. **Los logs de seguridad** (login exitoso/fallido, reuse attack, logout) están implementados en `AuthService`. Cualquier nuevo método de autenticación (OAuth, 2FA) debe seguir el mismo patrón de logging estructurado.

6. **La UserFactory** contiene estados `admin`, `inactive`, `banned`, `unverified`, `trashed`. Cualquier nuevo estado de usuario debe añadirse como un método de estado en la factory.

7. **Los tests están organizados por funcionalidad** (`RegisterTest`, `LoginTest`, `SecurityTest`). Nuevos tests deben seguir esta organización y usar `RefreshDatabase`.

8. **El password por defecto en la factory es `'password'`** (hasheado con `Hash::make()`). Cualquier helper de test que cree usuarios debe poder especificar un password custom o usar este default.
