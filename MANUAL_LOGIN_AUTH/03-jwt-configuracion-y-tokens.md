# Parte 3: Configuración de JWT y Modelo de Tokens

## 1. Introducción a JWT

### 1.1 ¿Qué es JSON Web Token?

JWT (JSON Web Token) es un estándar abierto definido en la [RFC 7519](https://datatracker.ietf.org/doc/html/rfc7519) que define un formato compacto y autónomo para transmitir información entre partes como un objeto JSON. La información transmitida está **firmada digitalmente**, lo que permite verificar que no ha sido alterada.

Un JWT se compone de tres partes separadas por puntos (`.`):

```
HEADER.PAYLOAD.SIGNATURE
```

Cada parte es una cadena codificada en Base64URL:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsIm5hbWUiOiJKb2huIERvZSIsImlhdCI6MTY5MjAwMDAwMCwiZXhwIjoxNjkyMDAwOTAwfQ.4fRNqLw2GvJk1XmzygF_RBdJYKtyH0NKz3BqNkH6X7g
```

#### Header

Contiene metadatos sobre el token: el algoritmo de firma y el tipo de token.

```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

| Campo | Significado |
|-------|-------------|
| `alg` | Algoritmo criptográfico usado para firmar el token. `HS256` = HMAC-SHA256, una firma simétrica (misma clave para firmar y verificar). |
| `typ` | Tipo de token. Siempre `"JWT"` (en mayúsculas). |

#### Payload

Contiene los **claims** (declaraciones o afirmaciones) sobre una entidad (normalmente el usuario) y datos adicionales. Existen tres tipos de claims:

| Tipo | Descripción | Ejemplos |
|------|-------------|----------|
| **Registered claims** | Claims predefinidos por la RFC 7519. No son obligatorios pero sí recomendados. | `iss` (issuer), `sub` (subject), `exp` (expiration), `iat` (issued at), `nbf` (not before), `jti` (JWT ID) |
| **Public claims** | Claims definidos por la aplicación que usen namespaces para evitar colisiones. | `role`, `name`, `https://miapp.com/permissions` |
| **Private claims** | Claims acordados entre dos partes específicas. | `user_id`, `account_type` |

Ejemplo de payload decodificado:

```json
{
  "iss": "http://localhost:8000",
  "iat": 1692000000,
  "exp": 1692000900,
  "nbf": 1692000000,
  "jti": "a1b2c3d4e5f6",
  "sub": 1,
  "role": "admin",
  "name": "John Doe"
}
```

#### Signature

La firma se calcula aplicando el algoritmo especificado en el header sobre la concatenación del header y el payload codificados:

```
HMACSHA256(
  base64UrlEncode(header) + "." + base64UrlEncode(payload),
  secret
)
```

**La firma garantiza dos cosas:**
1. **Integridad**: si alguien modifica el payload o el header, la firma no coincidirá y el token será rechazado.
2. **Autenticidad**: solo quien posee el `secret` puede generar firmas válidas.

> **ADVERTENCIA CRÍTICA**: La firma **NO encripta** el contenido. El payload es Base64URL-encoded, lo que significa que **cualquiera puede decodificarlo y leerlo**. JWT garantiza que el contenido no ha sido alterado, NO que sea confidencial. Si necesitas confidencialidad, debes usar JWE (JSON Web Encryption) o transmitir el JWT siempre por HTTPS.

---

### 1.2 ¿Por qué JWT para APIs?

| Ventaja | Explicación |
|---------|-------------|
| **Stateless (sin estado)** | El servidor no necesita almacenar sesiones. Toda la información necesaria para autenticar y autorizar está dentro del token. Esto elimina la necesidad de consultar una base de datos de sesiones en cada petición. |
| **Escalabilidad horizontal** | Al no depender de estado en el servidor, cualquier instancia puede validar el token sin necesidad de compartir sesiones entre nodos. No necesitas Redis/memcached para sticky sessions. |
| **Auto-contenido** | El token transporta claims que evitan consultas adicionales a la base de datos para datos comunes (rol, nombre, ID del usuario). |
| **Desacoplamiento** | El servicio que emite el token no tiene por qué ser el mismo que lo valida (útil en arquitecturas de microservicios con RS256). |

---

### 1.3 JWT vs OAuth2 vs SAML — ¿Cuándo usar cada uno?

| Tecnología | Qué es | Cuándo usarlo |
|------------|--------|---------------|
| **JWT** | Formato de token (no un protocolo). Define la estructura del token. | Autenticación de APIs REST/GraphQL propia. Control total sobre la emisión y validación. Ideal para aplicaciones SPA + API backend propios. |
| **OAuth2** | Protocolo de autorización delegada. Define CÓMO obtener tokens, pero no el formato del token en sí (aunque suele usarse JWT como formato). | Cuando necesitas delegar autorización a terceros ("Iniciar sesión con Google"), o cuando tienes múltiples clientes (web, mobile, third-party) accediendo a tus APIs. |
| **SAML** | Protocolo de autenticación federada basado en XML. | Entornos enterprise con Single Sign-On (SSO) corporativo, Active Directory, Okta. Raramente se usa en aplicaciones nuevas orientadas a APIs. |

**Para este manual usamos JWT puro con el paquete `tymon/jwt-auth`** porque nuestra arquitectura es una API RESTful propia, sin delegación a terceros ni federación corporativa. Si en el futuro necesitáramos "Login with Google", migraríamos a Laravel Sanctum + Socialite o a una solución OAuth2 como Laravel Passport.

---

### 1.4 JWT NO es un mecanismo de sesiones

Este es uno de los malentendidos más comunes entre desarrolladores. JWT es un **token de claims firmado**, no un mecanismo de sesiones. Diferencias fundamentales:

| Sesiones tradicionales | JWT |
|------------------------|-----|
| El servidor almacena el estado de la sesión (server-side state) | El token contiene el estado (client-side state) |
| La sesión se identifica con un ID opaco (cookie de sesión) | El token ES la autorización, no un puntero a ella |
| Invalidar una sesión es inmediato (borrar del store) | Invalidar un JWT requiere blacklist o esperar a que expire |
| El servidor controla el ciclo de vida | El token tiene un ciclo de vida autónomo definido por sus claims temporales (`exp`, `nbf`) |

La confusión nace de que muchas implementaciones usan JWT + refresh tokens para simular sesiones, pero conceptualmente son mecanismos distintos.

---

## 2. Instalación del Paquete JWT-Auth

### 2.1 Composer require

```bash
composer require tymon/jwt-auth
```

`tymon/jwt-auth` es el paquete canónico para integrar JWT con Laravel. Es mantenido activamente, compatible con Laravel 11, y construye sobre `lcobucci/jwt` para la manipulación de tokens a bajo nivel.

Razones para elegir `tymon/jwt-auth` sobre alternativas:
- Integración nativa con el sistema de guards de Laravel (`auth()->guard('api')`)
- Middleware incluido para proteger rutas
- Blacklist de tokens incorporada
- Soporte para refresh tokens con rotación
- Manejo de claims personalizados vía la interfaz `JWTSubject`

---

### 2.2 Service Providers en Laravel 11

Laravel 11 eliminó `config/app.php` como archivo de configuración de providers. En su lugar, los service providers se registran en `bootstrap/providers.php`.

**Para Laravel 11**, añade al archivo `bootstrap/providers.php`:

```php
<?php

return [
    App\Providers\AppServiceProvider::class,
    Tymon\JWTAuth\Providers\LaravelServiceProvider::class,
];
```

**Para Laravel 10 o inferior**, añade al array `providers` en `config/app.php`:

```php
'providers' => [
    // ... otros providers ...
    Tymon\JWTAuth\Providers\LaravelServiceProvider::class,
],
```

El paquete soporta **auto-discovery** en Laravel, por lo que en la mayoría de los casos Composer lo registrará automáticamente. Sin embargo, ser explícito en el registro evita problemas si el auto-discovery falla o si despliegas en entornos con configuraciones atípicas.

---

### 2.3 Publicar configuración

```bash
php artisan vendor:publish --provider="Tymon\JWTAuth\Providers\LaravelServiceProvider"
```

Este comando copia el archivo de configuración del paquete a `config/jwt.php`. Sin este paso, el paquete usará sus valores por defecto internos, lo cual incluye una clave secreta predecible (punto 3.1).

Salida esperada:

```
Copied File [/vendor/tymon/jwt-auth/config/config.php] To [/config/jwt.php]
Publishing complete.
```

---

## 3. Configuración de `config/jwt.php` — Explicación Exhaustiva

El archivo `config/jwt.php` contiene TODAS las claves de configuración del paquete. A continuación se explican las más importantes para este proyecto, agrupadas por sección lógica.

### 3.1 `secret`

```php
'secret' => env('JWT_SECRET'),
```

**Qué es**: La clave simétrica usada para firmar y verificar los tokens con el algoritmo HMAC (en nuestro caso HS256).

**Cómo se genera**: Con el comando Artisan `php artisan jwt:secret`, que escribe una cadena aleatoria de 64 caracteres en la variable `JWT_SECRET` del archivo `.env`.

**Qué pasa si no se genera**: El paquete usará una clave por defecto hardcodeada en su configuración interna. Esto es **extremadamente inseguro** en producción porque cualquiera que conozca la clave por defecto (es pública) podría generar tokens válidos para tu aplicación.

**Seguridad**: La entropía de esta clave es la defensa principal contra ataques de fuerza bruta sobre la firma. 64 caracteres alfanuméricos ofrecen ~380 bits de entropía, más que suficiente con HS256.

> **ADVERTENCIA DE PRODUCCIÓN**: Cambiar `JWT_SECRET` en un entorno productivo **invalida instantáneamente TODOS los tokens existentes**. Todos los usuarios serán forzados a re-autenticarse. Planifica cualquier rotación de esta clave con cuidado.

---

### 3.2 `keys` (solo para algoritmos asimétricos)

```php
'keys' => [
    'public' => env('JWT_PUBLIC_KEY'),
    'private' => env('JWT_PRIVATE_KEY'),
    'passphrase' => env('JWT_PASSPHRASE'),
],
```

Esta sección es relevante **solo cuando se usan algoritmos asimétricos** como RS256, RS384, RS512, EdDSA, o ES256. Dado que este manual usa **HS256 (simétrico)**, estas claves **no se utilizan**. Se dejan documentadas para referencia:

| Clave | Algoritmo | Propósito |
|-------|-----------|-----------|
| `public` | RS256, ES256, EdDSA | Verificar la firma de tokens (la posee cualquier servicio que necesite validar). |
| `private` | RS256, ES256, EdDSA | Firmar tokens (SOLO la posee el servicio de autenticación). |
| `passphrase` | RS256, ES256 | Frase de contraseña para desbloquear la clave privada si está protegida. |

**¿Cuándo usar RS256 en lugar de HS256?**: Cuando tienes múltiples servicios que necesitan validar tokens pero solo uno debe poder emitirlos. El servicio de auth firma con la clave privada; los demás servicios validan con la pública (que no puede generar tokens). En arquitecturas de microservicios esto es una ventaja de seguridad. Para monolitos o APIs simples, HS256 es suficiente y más simple.

---

### 3.3 `ttl` — Time To Live del Access Token

```php
'ttl' => env('JWT_TTL', 60),
```

**Qué es**: Tiempo de vida del access token, en **minutos**.

**Nuestro valor**: `JWT_TTL=15` (definido en el `.env` desde la Parte 2). 15 minutos = 900 segundos.

**¿Por qué 15 minutos?**

| TTL | Riesgo si es robado | Experiencia de usuario |
|-----|---------------------|------------------------|
| 5 min | Muy bajo | Pésima — refrescos constantes |
| **15 min** | **Bajo** | **Buena — el refresh es transparente para el usuario** |
| 60 min | Medio | Excelente — pero 1 hora de ventana para un atacante |
| 24 horas | Alto | No necesita refresh, pero es casi como no tener expiración |

15 minutos es el sweet spot: la ventana de ataque es lo suficientemente pequeña para que el daño sea limitado, pero lo suficientemente grande para que el usuario no perciba interrupciones (el refresh token renueva silenciosamente).

El valor por defecto del paquete es 60 minutos. Nosotros lo sobrescribimos explícitamente con nuestra variable de entorno.

---

### 3.4 `refresh_ttl` — Ventana de Refresh

```php
'refresh_ttl' => env('JWT_REFRESH_TTL', 20160),
```

**Qué es**: El período de tiempo (en **minutos**) durante el cual un access token expirado puede ser renovado usando un refresh token.

**Nuestro valor**: `JWT_REFRESH_TTL=10080` (definido en el `.env` desde la Parte 2). 10080 minutos = 7 días = 168 horas.

**Cómo funciona la ventana de refresh**: El `refresh_ttl` no es el TTL del refresh token en sí, sino la ventana máxima de inactividad que toleramos:

- Si un access token expira en el minuto 0, puede ser refrescado hasta el minuto +10080.
- Después del minuto +10080, el token es irrecuperable y el usuario debe volver a iniciar sesión.
- Mientras el usuario siga activo (refrescando antes de que pasen 7 días), su sesión se mantiene viva indefinidamente.

**Analogía**: El access token es una "llave de hotel" que caduca cada 15 minutos. El refresh token es la "reserva del hotel" que dura 7 días. Mientras tengas la reserva activa, puedes pedir llaves nuevas.

El valor por defecto del paquete es 20160 minutos (14 días). Nosotros elegimos 7 días como balance entre comodidad y seguridad: suficiente para un usuario que usa la app a diario, pero obliga a re-login tras una semana de inactividad.

---

### 3.5 `algo` — Algoritmo de Firma

```php
'algo' => env('JWT_ALGO', 'HS256'),
```

**Qué es**: El algoritmo criptográfico usado para calcular la firma del token.

**Valor para este manual**: `HS256` (HMAC con SHA-256). Es el valor por defecto y el que usamos.

| Algoritmo | Tipo | Clave | Velocidad | Caso de uso |
|-----------|------|-------|-----------|-------------|
| HS256 | Simétrico | 1 clave secreta | Alta | Monolito, API simple |
| HS384 | Simétrico | 1 clave secreta | Media | Mayor seguridad, mismo caso |
| HS512 | Simétrico | 1 clave secreta | Baja | Máxima seguridad simétrica |
| RS256 | Asimétrico | Par público/privado | Media | Microservicios |
| ES256 | Asimétrico | Par público/privado | Alta | Microservicios modernos |

HS256 es la elección correcta para este proyecto porque:
1. Una sola aplicación (no microservicios).
2. No necesitamos distribuir capacidad de firma vs verificación.
3. Es más simple de configurar y operar.
4. La clave de 64 caracteres ofrece entropía más que suficiente.

---

### 3.6 `required_claims` — Claims Obligatorios

```php
'required_claims' => [
    'iss',
    'iat',
    'exp',
    'nbf',
    'sub',
    'jti',
],
```

Estos son los claims que `tymon/jwt-auth` exige que estén presentes en CADA token. Si un token no contiene alguno de ellos, es rechazado automáticamente. Explicación de cada uno:

| Claim | Nombre completo | Significado | Formato |
|-------|----------------|-------------|---------|
| `iss` | **Issuer** | Quién emitió el token. Normalmente la URL del servidor. | String (URL) |
| `iat` | **Issued At** | Timestamp de cuándo se emitió el token. Se usa para calcular la antigüedad. | NumericDate (timestamp Unix) |
| `exp` | **Expiration** | Timestamp de cuándo expira el token. Después de este momento, el token es inválido. | NumericDate (timestamp Unix) |
| `nbf` | **Not Before** | Timestamp antes del cual el token NO debe ser aceptado. Permite emitir tokens para uso futuro. | NumericDate (timestamp Unix) |
| `sub` | **Subject** | Identificador del sujeto del token (el usuario autenticado). Normalmente el ID del usuario. | String o número |
| `jti` | **JWT ID** | Identificador único del token. Fundamental para la blacklist (logout). | String |

**¿Por qué son obligatorios?**
- `exp` es la defensa básica contra tokens robados: sin expiración, un token robado es válido para siempre.
- `jti` es necesario para invalidar tokens individuales (logout, revocación).
- `sub` identifica a quién pertenece el token — sin él, no sabríamos qué usuario está autenticado.
- `iat` + `exp` juntos definen la ventana de validez — si falta `iat`, no podemos calcular cuándo se emitió.
- `iss` previene que tokens emitidos por otro servidor se usen en este (ataque de confusión de issuer).
- `nbf` permite emitir tokens que no son válidos inmediatamente (raro, pero útil en ciertos flujos).

---

### 3.7 `persistent_claims`

```php
'persistent_claims' => [],
```

Claims que **sobreviven al proceso de refresh**. Cuando se refresca un token, todos los claims son regenerados excepto los listados aquí, que se copian del token original al nuevo.

Lo dejamos vacío porque nuestro refresh token regenera todos los claims desde cero. Si en el futuro quisieras que un claim como `device_id` o `session_id` persistiera entre refrescos, lo añadirías aquí.

---

### 3.8 `lock_subject`

```php
'lock_subject' => true,
```

**Qué hace**: Cuando es `true`, el claim `sub` (subject = ID del usuario) no puede cambiar durante un refresh. Esto previene un vector de ataque donde un token de un usuario se transforma en token de otro usuario durante el refresco.

**Riesgo de desactivarlo**: Un atacante con un token válido podría, durante un refresh, modificar el `sub` para suplantar a otro usuario. Con `lock_subject: true`, el `sub` se bloquea y cualquier intento de modificarlo invalida el refresh.

Recomendación: **dejarlo en `true` siempre**, a menos que tengas un caso de uso muy concreto que requiera migrar tokens entre usuarios (prácticamente inexistente).

---

### 3.9 `leeway`

```php
'leeway' => env('JWT_LEEWAY', 0),
```

**Qué es**: Margen de tolerancia en **segundos** para compensar el desfase de reloj entre servidores (clock skew).

**Por qué existe**: Si el servidor A emite un token con `exp: 1692000900` y el reloj del servidor B va 30 segundos adelantado, B rechazaría el token 30 segundos antes de que realmente expire. `leeway` añade un margen para absorber esta diferencia.

**Recomendación**: En una arquitectura de un solo servidor, déjalo en 0. Si despliegas en múltiples nodos, configúralo entre 30 y 60 segundos.

---

### 3.10 `blacklist_enabled`

```php
'blacklist_enabled' => env('JWT_BLACKLIST_ENABLED', true),
```

**Qué hace**: Habilita el mecanismo de invalidación de tokens. Cuando un token se "bloquea" (logout), su `jti` (JWT ID) se almacena en una blacklist. Cada vez que se valida un token, el paquete consulta si su `jti` está en la blacklist.

**Cómo funciona técnicamente**: El storage provider (configurado en `providers.storage`) almacena cada `jti` bloqueado hasta que el token habría expirado naturalmente (según `exp`). Esto significa que la blacklist se limpia automáticamente: no necesitas un proceso de limpieza manual.

**Caso práctico**: El usuario hace logout → el `jti` de su access token va a la blacklist → durante los próximos minutos, si alguien intenta usar ese access token, será rechazado → cuando `exp` se alcanza, el `jti` sale de la blacklist automáticamente.

**¿Qué pasa si blacklist_enabled = false?**: El logout no invalida el access token. El token seguirá siendo válido hasta que expire naturalmente. **No es aceptable para una aplicación con logout real**.

---

### 3.11 `blacklist_grace_period`

```php
'blacklist_grace_period' => env('JWT_BLACKLIST_GRACE_PERIOD', 0),
```

**Qué es**: Período de gracia en **segundos** antes de que un token en blacklist sea efectivamente rechazado.

**Por qué existe**: En sistemas distribuidos, la blacklist puede tener consistencia eventual (un nodo ya la registró, otro todavía no la ve). El grace period da tiempo para que todos los nodos sincronicen antes de empezar a rechazar.

**Nuestra configuración**: 0 segundos. En una aplicación de un solo servidor, la consistencia es inmediata. Si el usuario hace logout, el token se invalida instantáneamente.

---

### 3.12 `decrypt_cookies`

```php
'decrypt_cookies' => false,
```

**Qué hace**: Permite que el paquete intente extraer el token de cookies cifradas de Laravel.

**Nuestra configuración**: `false`. Este manual usa el header `Authorization: Bearer <token>` para transportar el JWT, no cookies. El uso de cookies con JWT introduce vulnerabilidades CSRF y va contra la filosofía stateless de JWT.

---

### 3.13 `providers`

```php
'providers' => [
    'jwt' => Tymon\JWTAuth\Providers\JWT\Lcobucci::class,
    'auth' => Tymon\JWTAuth\Providers\Auth\Illuminate::class,
    'storage' => Tymon\JWTAuth\Providers\Storage\Illuminate::class,
],
```

Cada provider es una pieza intercambiable del ecosistema JWT. Explicación detallada:

| Provider | Clase | Responsabilidad |
|----------|-------|-----------------|
| `jwt` | `Lcobucci` | **Codificar y decodificar tokens JWT**. Maneja la creación del payload, la firma con el algoritmo configurado, la validación de claims (`exp`, `nbf`, `iat`) y la decodificación del token entrante. Es el corazón criptográfico del paquete. |
| `auth` | `Illuminate` | **Integrar con el sistema de autenticación de Laravel**. Realiza `Auth::login()`, `Auth::user()`, `Auth::logout()` usando el guard JWT. Traduce entre el mundo JWT (claims, tokens) y el mundo Laravel (User models, guards, providers). |
| `storage` | `Illuminate` | **Almacenar tokens en la caché de Laravel para la blacklist**. Usa el driver de caché configurado en `config/cache.php` (file, redis, memcached, database). Cada `jti` bloqueado se almacena con TTL igual al tiempo restante hasta `exp`. |

**¿Por qué son intercambiables?**: El paquete está diseñado con una arquitectura de proveedores (strategy pattern). En teoría, podrías reemplazar `Lcobucci` por otra librería JWT, o `Illuminate` por un driver de auth personalizado, sin cambiar el resto del código. En la práctica, las implementaciones por defecto cubren el 99% de los casos de uso.

---

## 4. Generar `JWT_SECRET`

### 4.1 El comando `jwt:secret`

```bash
php artisan jwt:secret
```

Salida esperada:

```
jwt-auth secret [4fH7kL9mN2pQ5rS8tV1wX3yZ6aB9cD0eF2gH5iJ8kL1mN4oP7qR0sT3uV6wX9yZ] set successfully.
```

### 4.2 Qué hace exactamente

1. Genera una cadena aleatoria de 64 caracteres alfanuméricos con `Str::random(64)`.
2. Busca la clave `JWT_SECRET` en tu archivo `.env`.
3. Si existe, reemplaza su valor con la nueva clave.
4. Si no existe, añade `JWT_SECRET=<clave>` al final del archivo.
5. Limpia la caché de configuración para que el cambio surta efecto inmediato.

### 4.3 Verificación

```bash
cat .env | grep JWT_SECRET
```

Deberías ver algo como:

```env
JWT_SECRET=4fH7kL9mN2pQ5rS8tV1wX3yZ6aB9cD0eF2gH5iJ8kL1mN4oP7qR0sT3uV6wX9yZ
```

### 4.4 ADVERTENCIA DE PRODUCCIÓN

Si rotas `JWT_SECRET` en producción:
- **TODOS los tokens emitidos con la clave anterior son invalidados instantáneamente** porque la firma ya no coincide.
- **Todos los usuarios conectados serán desconectados** (sus tokens serán rechazados como inválidos).
- Esto incluye tanto access tokens como refresh tokens.
- Planifica la rotación durante ventanas de bajo tráfico.
- Considera un período de transición donde el servidor acepte ambas claves (vieja y nueva) durante unos minutos — esto requiere lógica personalizada que escapa al alcance de este manual pero es práctica estándar en sistemas de alta disponibilidad.

---

## 5. Implementar `JWTSubject` en el Modelo `User`

El modelo `App\Models\User` quedó pendiente de completar en la Parte 2. Ahora añadimos los dos métodos requeridos por la interfaz `JWTSubject` del paquete `tymon/jwt-auth`.

### 5.1 El código

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Notifications\Notifiable;
use Tymon\JWTAuth\Contracts\JWTSubject;
use App\Enums\UserRole;
use App\Enums\UserStatus;

class User extends Authenticatable implements JWTSubject
{
    use HasFactory, Notifiable, SoftDeletes;

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
            'password' => 'hashed',
            'role' => UserRole::class,
            'status' => UserStatus::class,
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | JWTSubject Implementation
    |--------------------------------------------------------------------------
    */

    /**
     * Get the identifier that will be stored in the subject claim of the JWT.
     */
    public function getJWTIdentifier(): mixed
    {
        return $this->getKey();
    }

    /**
     * Return a key value array, containing any custom claims to be added to the JWT.
     */
    public function getJWTCustomClaims(): array
    {
        return [
            'role' => $this->role->value,
            'name' => $this->name,
        ];
    }
}
```

### 5.2 `getJWTIdentifier()` — El claim `sub`

**Qué devuelve**: El valor que irá en el claim `sub` (subject) del payload del JWT.

**Qué devolvemos**: `$this->getKey()` — la primary key del usuario. En Laravel, `getKey()` devuelve el valor de `$this->primaryKey`, que por defecto es `$this->id`.

**Ejemplo**: Si el usuario tiene `id = 1`, el payload del JWT tendrá `"sub": 1`.

**¿Por qué el ID?**: El claim `sub` es la forma canónica de identificar al sujeto de un JWT. Durante la validación, el paquete usa este valor para buscar al usuario en la base de datos con `User::find($sub)`. Es lo que conecta el mundo JWT (claims) con el mundo Laravel (Eloquent models).

**Alternativas (AVANZADO, no para este manual)**: Podrías devolver UUID en lugar de ID autoincremental si tu aplicación usa UUIDs como primary key, o un hash del ID si no quieres exponer IDs secuenciales en los tokens. Para este manual, el ID secuencial es suficiente.

### 5.3 `getJWTCustomClaims()` — Claims personalizados

**Qué devuelve**: Un array asociativo de claims que se añaden al payload del token.

**Qué devolvemos**:

| Claim | Valor | Propósito |
|-------|-------|-----------|
| `role` | `$this->role->value` (`"admin"` o `"user"`) | Autorización rápida sin consultar la base de datos. Un middleware puede leer `auth()->payload()->get('role')` y decidir si permite el acceso a rutas administrativas. |
| `name` | `$this->name` (`"John Doe"`) | Mostrar el nombre del usuario en la UI sin hacer una query adicional. Útil para "Bienvenido, John" en el frontend. |

### 5.4 ADVERTENCIA DE SEGURIDAD SOBRE CLAIMS PERSONALIZADOS

> **EL PAYLOAD DEL JWT ES BASE64-ENCODED, NO ENCRIPTADO. CUALQUIERA PUEDE DECODIFICARLO Y LEERLO.**

Esto significa:
- **Cualquiera** puede decodificar el token y ver `role`, `name`, y cualquier otro claim que incluyas.
- Lo que **no pueden hacer** es modificar esos valores porque la firma dejaría de ser válida.
- Pero **pueden leerlos**. Siempre.

**Qué NUNCA debes incluir en claims personalizados:**

| Dato | Razón |
|------|-------|
| `password` o `password_hash` | Obvio, pero vale la pena repetirlo. Es información de autenticación, no de autorización. |
| `email` (si es considerado PII en tu jurisdicción) | Bajo GDPR y similares, el email es dato personal. Si puedes evitarlo en el payload, mejor. Si lo necesitas para la UI, pondera el trade-off. En este manual NO lo incluimos. |
| Token de verificación de email | Si alguien lo lee, puede verificar emails ajenos. |
| `remember_token` | Nunca sale de la base de datos. |
| Cualquier secret o API key | El payload no es el lugar para secretos. |

**Qué SÍ es seguro incluir:**
- `role`, `permissions`: strings simples para autorización.
- `name`, `username`: identificadores visibles.
- Timestamps de sesión.
- Cualquier dato que ya sea público o semi-público en tu aplicación.

**Regla de oro**: Si no pondrías ese dato en un `<div>` público de tu HTML, no lo pongas en un claim del JWT.

---

## 6. Configurar el Guard en `config/auth.php`

El guard es el mecanismo que Laravel usa para autenticar usuarios. Configurar el guard JWT correctamente es lo que permite usar `auth('api')->attempt($credentials)` y `auth('api')->user()` en los controllers.

### 6.1 El archivo `config/auth.php` modificado

```php
<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Authentication Defaults
    |--------------------------------------------------------------------------
    */

    'defaults' => [
        'guard' => 'api',
        'passwords' => 'users',
    ],

    /*
    |--------------------------------------------------------------------------
    | Authentication Guards
    |--------------------------------------------------------------------------
    */

    'guards' => [
        'web' => [
            'driver' => 'session',
            'provider' => 'users',
        ],

        'api' => [
            'driver' => 'jwt',
            'provider' => 'users',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | User Providers
    |--------------------------------------------------------------------------
    */

    'providers' => [
        'users' => [
            'driver' => 'eloquent',
            'model' => App\Models\User::class,
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Resetting Passwords
    |--------------------------------------------------------------------------
    */

    'passwords' => [
        'users' => [
            'provider' => 'users',
            'table' => 'password_reset_tokens',
            'expire' => 60,
            'throttle' => 60,
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Password Confirmation Timeout
    |--------------------------------------------------------------------------
    */

    'password_timeout' => 10800,

];
```

### 6.2 Explicación por sección

#### `defaults.guard` → `'api'`

Define qué guard se usa cuando llamas a `auth()` sin especificar guard:

```php
// Con defaults.guard = 'api', estas dos líneas son equivalentes:
$user = auth()->user();
$user = auth('api')->user();
```

**¿Por qué `api` como default?**: Nuestra aplicación es una API RESTful. La gran mayoría de las peticiones se autenticarán vía JWT en el header `Authorization`. Si la aplicación tuviera también una parte web con sesiones, el default sería `web` y en las rutas API se especificaría `auth('api')`.

#### `guards.api` → `driver: 'jwt'`

El driver `jwt` es proporcionado por `tymon/jwt-auth`. Cuando Laravel encuentra `driver: 'jwt'`, delega en el paquete para resolver al usuario autenticado a partir del token JWT en la petición.

**Diferencia con otros drivers de API:**

| Driver | Mecanismo | Estado | Cuándo usarlo |
|--------|-----------|--------|---------------|
| `token` (Laravel nativo) | Token simple almacenado en la tabla `api_tokens` de la DB. Cada petición requiere un query a la DB. | Stateful | APIs internas simples, no necesita claims. |
| `sanctum` (Laravel Sanctum) | Token almacenado en DB (hash) o cookie de sesión para SPAs. Soporta SPA + mobile. | Stateful | SPAs mismo dominio + API tokens para third-party. |
| `jwt` (tymon/jwt-auth) | Token firmado con claims. Validación sin DB. Blacklist opcional vía caché. | Stateless | APIs RESTful puras, mobile apps, microservicios. |

#### `guards.web` → `driver: 'session'`

Se mantiene por compatibilidad. Si la aplicación tuviera rutas web tradicionales (formularios, vistas Blade), usarían este guard. En nuestra API pura, no se usa pero no conviene eliminarlo por si en el futuro se añade un panel admin con Filament o Nova.

#### `providers.users`

Define de DÓNDE obtiene Laravel los usuarios.

| Campo | Valor | Significado |
|-------|-------|-------------|
| `driver` | `eloquent` | Usa Eloquent ORM para buscar usuarios. La alternativa es `database` (query builder directo). |
| `model` | `App\Models\User::class` | El modelo Eloquent que representa a los usuarios. Debe implementar `JWTSubject`. |

El provider es compartido entre el guard `web` y el guard `api`. Ambos autentican usuarios del mismo modelo `User`, pero usando mecanismos distintos (session vs JWT). Esto es correcto y deseable: el origen de datos es el mismo.

---

## 7. Anatomía de un Token JWT en esta Aplicación

### 7.1 Token completo (ejemplo)

```
eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwOi8vbG9jYWxob3N0OjgwMDAiLCJpYXQiOjE2OTIwMDAwMDAsImV4cCI6MTY5MjAwMDkwMCwibmJmIjoxNjkyMDAwMDAwLCJqdGkiOiJhMWIyYzNkNGU1ZjYiLCJzdWIiOjEsInBydiI6IjIzYmQwNzFhNjg4MmNiMTJjM2QwYmE4YmU4YmQyYmI3Iiwicm9sZSI6ImFkbWluIiwibmFtZSI6IkpvaG4gRG9lIn0.SIGNATURE_AQUI
```

### 7.2 Header decodificado

```json
{
  "typ": "JWT",
  "alg": "HS256"
}
```

### 7.3 Payload decodificado

```json
{
  "iss": "http://localhost:8000",
  "iat": 1692000000,
  "exp": 1692000900,
  "nbf": 1692000000,
  "jti": "a1b2c3d4e5f6",
  "sub": 1,
  "prv": "23bd071a6882cb12c3d0ba8be8bd2bb7",
  "role": "admin",
  "name": "John Doe"
}
```

### 7.4 Explicación de cada claim en este payload

| Claim | Valor ejemplo | Origen | Explicación |
|-------|---------------|--------|-------------|
| `iss` | `http://localhost:8000` | Automático (URL de la app) | El issuer. `tymon/jwt-auth` lo configura desde `config/app.url`. En producción será tu dominio real. |
| `iat` | `1692000000` | Automático (timestamp actual) | Issued At. Momento exacto de emisión. Formato NumericDate (segundos desde epoch Unix). |
| `exp` | `1692000900` | `iat + (JWT_TTL * 60)` | Expiration. `1692000900 - 1692000000 = 900 segundos = 15 minutos`. Coincide con `JWT_TTL=15`. |
| `nbf` | `1692000000` | Automático (= `iat`) | Not Before. El token no es válido antes de este momento. Igual a `iat` porque el token es válido inmediatamente. |
| `jti` | `a1b2c3d4e5f6` | Automático (string aleatorio) | JWT ID. Identificador único de este token específico. Se genera con `Str::random()`. Esencial para la blacklist. |
| `sub` | `1` | `User::getJWTIdentifier()` | Subject. El ID del usuario autenticado. El paquete usa `User::find(1)` para resolverlo. |
| `prv` | `23bd071a...` | Automático (hash del provider) | Provider hash. Claim interno de `tymon/jwt-auth` que identifica este token como parte del flujo de refresh. Es un hash del modelo User para verificar que el token pertenece al provider correcto. |
| `role` | `admin` | `User::getJWTCustomClaims()` | Claim personalizado. Rol del usuario desde `UserRole` enum. Permite autorización rápida sin DB. |
| `name` | `John Doe` | `User::getJWTCustomClaims()` | Claim personalizado. Nombre del usuario para mostrarlo en la UI. |

### 7.5 Relación con `required_claims`

El paquete valida que los 6 claims configurados en `required_claims` estén presentes. Los claims `role` y `name` son opcionales desde el punto de vista del paquete (no están en `required_claims`), pero SIEMPRE estarán presentes porque `getJWTCustomClaims()` los devuelve.

---

## 8. Estrategia de Tokens: Access + Refresh

Esta no es una decisión de implementación menor — es la **arquitectura de seguridad de sesiones** de la aplicación.

### 8.1 Access Token

| Propiedad | Valor |
|-----------|-------|
| **Vida útil** | 15 minutos (`JWT_TTL`) |
| **Transporte** | Header HTTP: `Authorization: Bearer <token>` |
| **Contenido** | Claims de autorización (`sub`, `role`, `name`) + claims estándar |
| **Validación** | Firma + claims temporales + blacklist |
| **Uso** | Cada petición a endpoints protegidos |
| **Si es robado** | El atacante tiene acceso durante máximo 15 minutos |

**¿Por qué 15 minutos?**
- Si un atacante intercepta un access token (MITM, XSS, log泄露), el daño está acotado a 15 minutos.
- 15 minutos es suficiente para que un usuario real complete cualquier operación sin notar el refresh.
- Es lo suficientemente corto para que la rotación de refresh tokens detecte anomalías (ver sección 8.3).

### 8.2 Refresh Token

| Propiedad | Valor |
|-----------|-------|
| **Vida útil** | 7 días (`JWT_REFRESH_TTL`) |
| **Transporte** | Cuerpo de la petición POST al endpoint `/auth/refresh` |
| **Contenido** | Mismos claims que el access token + claim `prv` que lo marca como refresh token |
| **Uso** | Solo en el endpoint de refresh, una vez, para obtener nuevos tokens |
| **Si es robado** | Detectable mediante rotación (ver 8.3) |

**¿Por qué separar access y refresh?**

Separar el token que se usa en CADA petición (alto riesgo de exposición en logs, proxies, headers) del token que se usa UNA SOLA VEZ en un endpoint específico (bajo riesgo) es una práctica estándar de seguridad. Es el mismo principio que separar una llave de uso diario de una llave maestra de emergencia.

### 8.3 Rotación de Refresh Tokens (Refresh Token Rotation)

Cada vez que el cliente usa un refresh token para obtener nuevos tokens, el servidor:
1. Valida el refresh token entrante.
2. **Emite un NUEVO access token y un NUEVO refresh token**.
3. **Revoca (invalida) el refresh token anterior**.

**¿Por qué implementar rotación?**

Sin rotación, un refresh token robado es indetectable: el atacante y el usuario legítimo pueden usarlo simultáneamente sin que nadie se dé cuenta.

Con rotación, si un atacante roba un refresh token y lo usa:
1. El servidor emite nuevos tokens y revoca el refresh token usado.
2. Cuando el usuario legítimo intente usar SU refresh token (que es el mismo), el servidor lo rechazará porque ya fue revocado.
3. El servidor **detecta el reuse** y puede forzar logout de todas las sesiones del usuario (invalidando TODOS los refresh tokens activos de ese usuario).

**Implementación en este manual**: La tabla `refresh_tokens` (sección 9) almacena cada refresh token emitido. Durante el refresh, el token entrante se busca en la tabla:
- Si existe y no está revocado → se revoca, se emite uno nuevo.
- Si no existe o ya está revocado → **posible ataque de reuse** → respuesta 401 + invalidación de todos los tokens del usuario.

### 8.4 Flujo Completo de Refresh

```
CLIENTE                              SERVIDOR
   |                                     |
   |  POST /api/auth/refresh              |
   |  { refresh_token: "..." }           |
   | ----------------------------------> |
   |                                     | 1. Validar firma del refresh token
   |                                     | 2. Verificar que no ha expirado
   |                                     | 3. Buscar en tabla refresh_tokens
   |                                     | 4. ¿Existe y no está revocado?
   |                                     |    SÍ → revocarlo, emitir nuevos
   |                                     |    NO → 401, revocar todos los
   |                                     |         tokens del usuario (ataque)
   |                                     | 5. Generar nuevo access token (15 min)
   |                                     | 6. Generar nuevo refresh token (7 días)
   |                                     | 7. Insertar nuevo en refresh_tokens
   |                                     |
   |  200 OK                              |
   |  { access_token, refresh_token }    |
   | <---------------------------------- |
   |                                     |
   |  Guarda refresh_token nuevo         |
   |  Descarta refresh_token anterior    |
```

---

## 9. Almacenamiento de Refresh Tokens — Diseño de la Tabla `refresh_tokens`

La migración formal se creará en la Parte 4, pero DISEÑAMOS aquí la tabla para entender la arquitectura completa antes de implementar.

### 9.1 Esquema SQL

```sql
CREATE TABLE refresh_tokens (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    token VARCHAR(500) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT NULL,
    updated_at TIMESTAMP NULL DEFAULT NULL,

    CONSTRAINT fk_refresh_tokens_user_id
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,

    INDEX idx_refresh_tokens_user_id (user_id),
    INDEX idx_refresh_tokens_token (token),
    INDEX idx_refresh_tokens_expires_at (expires_at)
);
```

### 9.2 Explicación columna por columna

| Columna | Tipo | Justificación |
|---------|------|---------------|
| `id` | `BIGINT UNSIGNED AUTO_INCREMENT` | Clave primaria estándar. `BIGINT` porque una API con mucho tráfico puede generar millones de tokens. |
| `user_id` | `BIGINT UNSIGNED` | Referencia al usuario dueño del token. Necesario para "cerrar sesión en todos los dispositivos" (revocar todos los tokens de un usuario). |
| `token` | `VARCHAR(500)` | El refresh token completo (string JWT). 500 caracteres dan margen suficiente para un JWT con múltiples claims. Un JWT típico ronda los 200-400 caracteres. |
| `expires_at` | `TIMESTAMP` | Cuándo expira este refresh token (7 días desde emisión). Permite: a) rechazar tokens expirados sin decodificarlos, b) limpiar tokens expirados con un scheduled command. |
| `revoked_at` | `TIMESTAMP NULL` | Soft-revoke. `NULL` = activo. Una timestamp ≠ NULL = revocado en ese momento. Permite auditoría forense ("¿cuándo se revocó este token? ¿fue el usuario o fue por detección de reuse?"). |
| `created_at` | `TIMESTAMP` | Laravel lo maneja automáticamente con `$table->timestamps()`. |
| `updated_at` | `TIMESTAMP` | Ídem. Se actualiza cuando se revoca el token. |

### 9.3 Índices

| Índice | Columnas | Consulta que acelera |
|--------|----------|---------------------|
| `PRIMARY` | `id` | Identificación única. |
| `idx_refresh_tokens_user_id` | `user_id` | `SELECT * FROM refresh_tokens WHERE user_id = ?` — listar sesiones activas de un usuario. |
| `idx_refresh_tokens_token` | `token` | `SELECT * FROM refresh_tokens WHERE token = ?` — validar un refresh token entrante. Esta es la consulta MÁS frecuente (cada refresh). |
| `idx_refresh_tokens_expires_at` | `expires_at` | `DELETE FROM refresh_tokens WHERE expires_at < NOW()` — limpieza programada de tokens expirados. |
| (implícito) | `user_id` en FK | El constraint de FK crea automáticamente un índice en `user_id` en la mayoría de motores. |

### 9.4 FK con `ON DELETE CASCADE`

```sql
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
```

Si un usuario es eliminado de la tabla `users`, todos sus refresh tokens se eliminan automáticamente. Esto es fundamental: sin `ON DELETE CASCADE`, los refresh tokens de usuarios eliminados quedarían huérfanos y ocuparían espacio para siempre.

### 9.5 Alternativa evaluada: Redis vs Base de Datos

| Criterio | Base de Datos (MySQL) | Redis |
|----------|----------------------|-------|
| **Persistencia** | ✅ Duradera (disco). Los tokens sobreviven a reinicios del servidor. | ⚠️ Volátil (por defecto). Si Redis se reinicia sin snapshot, todos los refresh tokens se pierden → todos los usuarios son desconectados. |
| **Velocidad** | ⚠️ Consulta SQL (~1ms con índice). Aceptable para la frecuencia de refresh (1 vez cada 15 min por usuario). | ✅ Sub-milisegundo. Excelente para alta frecuencia. |
| **Simplicidad operativa** | ✅ Sin dependencias adicionales. MySQL ya está en el stack. | ❌ Necesitas Redis instalado, configurado, monitoreado. |
| **TTL nativo** | ❌ Necesitas un scheduled command para limpieza. | ✅ `SETEX` con TTL — expira automáticamente. |
| **Auditoría** | ✅ Puedes consultar SQL histórico: "¿cuántos tokens activos tiene el usuario 42?" | ❌ Difícil auditar datos que ya expiraron. |
| **Rotación** | ✅ Transacción SQL: revocar viejo + insertar nuevo = atómico. | ⚠️ Sin transacciones. Necesitarías Lua scripting para atomicidad. |

**Decisión para este manual: Base de Datos (MySQL).**

Razones:
1. Este proyecto no justifica Redis. La frecuencia de refresh (cada 15 minutos por usuario) no es un cuello de botella para MySQL.
2. No añadimos dependencia operativa. Un desarrollador puede clonar el repo, `php artisan migrate` y tener todo funcionando.
3. La auditoría de sesiones activas es trivial con SQL.
4. Si en el futuro el tráfico escala, migrar refresh tokens a Redis es un refactor acotado (cambiar el storage en el AuthService, la tabla sigue existiendo para auditoría).

### 9.6 Estrategia de limpieza

Los refresh tokens expirados o revocados se acumularán en la tabla. Para evitar que crezca indefinidamente, se implementará (en la Parte 5 o 6) un comando de limpieza:

```php
// Pseudocódigo del futuro comando
DELETE FROM refresh_tokens
WHERE expires_at < NOW()
   OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL 30 DAY);
```

Este comando se programará en `app/Console/Kernel.php` para ejecutarse diariamente:

```php
$schedule->command('tokens:cleanup')->daily();
```

La ventana de 30 días para tokens revocados permite auditoría forense (¿se revocó este token por el usuario o por detección de ataque de reuse?), pero evita acumulación perpetua.

---

## 10. Verificación de la Configuración

### 10.1 Limpiar caché de configuración

Después de modificar `config/auth.php` y `config/jwt.php`, la caché de configuración de Laravel puede contener valores antiguos:

```bash
php artisan config:clear
```

Esto elimina `bootstrap/cache/config.php` y fuerza a Laravel a releer todos los archivos de configuración. En producción, después de verificar que todo funciona, vuelve a cachear:

```bash
php artisan config:cache
```

**Nota**: `config:cache` no se ejecuta en desarrollo local porque cada cambio requeriría re-cachear. En producción, cachear la configuración mejora el rendimiento (evita leer docenas de archivos PHP en cada petición).

### 10.2 Probar generación de token con Tinker

```bash
php artisan tinker
```

Dentro de Tinker:

```php
$user = User::first();
$token = auth('api')->login($user);
echo $token;
// Debería mostrar un string JWT como:
// eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRw...
```

Si esto falla, diagnóstico por orden de probabilidad:

| Error | Causa probable | Solución |
|-------|---------------|----------|
| `Class 'Tymon\JWTAuth\Providers\LaravelServiceProvider' not found` | El paquete no está instalado o el provider no está registrado. | Verifica `composer.json`, ejecuta `composer dump-autoload`, confirma `bootstrap/providers.php`. |
| `JWT_SECRET is not set` | No se ejecutó `php artisan jwt:secret`. | `php artisan jwt:secret`. |
| `Method login does not exist` | El guard `api` no está configurado con driver `jwt`. | Revisa `config/auth.php` → `guards.api.driver = 'jwt'`. |
| `Undefined method getJWTIdentifier()` | El modelo User no implementa `JWTSubject`. | Verifica `implements JWTSubject` y los dos métodos. |
| `Target class [config] does not exist` en Tinker | La configuración está cacheada con valores viejos. | `php artisan config:clear`. |

### 10.3 Decodificar el token en jwt.io

1. Copia el token generado en Tinker.
2. Ve a [jwt.io](https://jwt.io).
3. Pégalo en el campo "Encoded".
4. Verifica que el payload muestre tus claims personalizados (`role`, `name`).
5. En el campo "Verify Signature", pega tu `JWT_SECRET` para confirmar que la firma es válida.

> **ADVERTENCIA DE SEGURIDAD**: jwt.io es una herramienta de debugging. NUNCA pegues tokens de producción con datos reales de usuarios en herramientas de terceros. Para debugging en producción, usa `php artisan tinker` con `JWTAuth::parseToken()->getPayload()`.

---

## 11. Resumen y Puente a Parte 4

### 11.1 Lo instalado y configurado en esta parte

| Elemento | Estado |
|----------|--------|
| Paquete `tymon/jwt-auth` | Instalado vía Composer |
| Service Provider | Registrado en `bootstrap/providers.php` |
| `config/jwt.php` | Publicado y configurado con HS256, TTL 15min, refresh TTL 7d |
| `JWT_SECRET` | Generado con `php artisan jwt:secret`, almacenado en `.env` |
| Guard `api` en `config/auth.php` | Configurado con driver `jwt` y provider `users` |
| Modelo `User` | Implementa `JWTSubject` con `getJWTIdentifier()` y `getJWTCustomClaims()` |
| Tabla `refresh_tokens` | Diseñada (migración en Parte 4) |

### 11.2 Estado actual del sistema

En este punto, la aplicación PUEDE generar tokens JWT para cualquier usuario (probado con Tinker), pero NO puede:
- Registrar usuarios nuevos (→ Parte 4)
- Autenticar usuarios con email/password (→ Parte 5)
- Proteger rutas con middleware JWT (→ Parte 5)
- Refrescar tokens (→ Parte 5)

### 11.3 Lo que viene en la Parte 4

La Parte 4 implementará el **registro de usuarios**:
- `RegisterRequest` — validación de datos de registro
- `RegisterController` — single-action controller con `__invoke`
- `AuthService::register()` — lógica de negocio (crear usuario, emitir tokens)
- Migración de la tabla `refresh_tokens`
- Primeros tests de integración

---

## Decisiones Vinculantes para Partes 4-6

1. **Estructura del access token**: Payload con claims `iss`, `iat`, `exp`, `nbf`, `jti`, `sub`, `prv` (automáticos) + `role` y `name` (custom). Algoritmo HS256. TTL de 15 minutos.

2. **Estructura del refresh token**: Mismo payload que el access token, mismo algoritmo, TTL de 7 días (10080 minutos). El claim `prv` lo identifica como refresh token.

3. **Formato del refresh token en la DB**: Se almacena en la tabla `refresh_tokens` como string JWT completo (`VARCHAR(500)`). Columna `revoked_at` para soft-revoke. Columna `expires_at` para limpieza programada.

4. **Tabla `refresh_tokens`**: La migración se crea en la Parte 4. Debe incluir FK a `users(id)` con `ON DELETE CASCADE` + índices en `user_id`, `token`, `expires_at`. La columna `token` usa `VARCHAR(500)`.

5. **Rotación de refresh tokens**: Cada refresh emite un NUEVO refresh token y revoca el anterior. Reuse de refresh token revocado → detección de ataque → revocar TODOS los tokens del usuario → 401.

6. **Claims personalizados**: `role` (desde `UserRole` enum, valor string) y `name` (desde `$user->name`). NO se incluye `email` en los claims por ser PII bajo GDPR. Si un endpoint necesita el email, consulta la DB.

7. **Limpieza de tokens**: Comando `tokens:cleanup` programado diariamente. Elimina tokens con `expires_at < NOW()` o `revoked_at < NOW() - 30 days`.

8. **Guard por defecto**: `api` (driver `jwt`). Todas las rutas protegidas usarán `auth('api')` implícitamente vía `auth()->user()` sin especificar el guard.
