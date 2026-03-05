# 2. Autenticación y Gestión de Usuarios (v3)

*(Versión actualizada para Supabase Auth + NestJS)*

Roastr v3 utiliza **Supabase Auth** como sistema único de autenticación, identidad y seguridad.

La autenticación determina:

- Qué panel ve el usuario (Admin Panel o User App)
- Qué límites aplica su plan
- Qué redes puede conectar
- Qué features puede usar
- El flujo de onboarding
- Su nivel de acceso a datos y configuraciones

---

## 2.1 Signup / Login

### Signup (registro)

1. El usuario proporciona:
   - Email
   - Contraseña (≥ 8 caracteres, al menos 1 número y 1 mayúscula)
   - Plan seleccionado (Starter, Pro o Plus)
2. Se crea el usuario via `supabase.auth.signUp()`.
3. Supabase envía email de confirmación.
4. Tras confirmar email:
   - Se crea el perfil en `profiles` (via trigger de DB o backend).
   - Se redirige al onboarding wizard.
5. En el onboarding:
   - Se valida método de pago (Polar checkout).
   - Si la tarjeta falla → onboarding queda bloqueado en "Configura tu método de pago".
   - Si es válida → se activa el trial correspondiente.

### Schema

```sql
-- Supabase ya gestiona auth.users internamente.
-- Nosotros extendemos con profiles (public schema).

CREATE TABLE profiles (
  id                      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                   TEXT NOT NULL,
  role                    TEXT NOT NULL DEFAULT 'user'
                          CHECK (role IN ('user', 'admin', 'superadmin')),
  username                TEXT,
  roastr_persona_config   BYTEA,        -- JSON cifrado AES-256-GCM
  onboarding_state        TEXT NOT NULL DEFAULT 'welcome'
                          CHECK (onboarding_state IN (
                            'welcome', 'select_plan', 'payment',
                            'persona_setup', 'connect_accounts', 'done'
                          )),
  language_preference     TEXT DEFAULT 'es',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can only read/update their own profile
CREATE POLICY profiles_select ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY profiles_update ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

### Login

Métodos permitidos:

- **Email + password** (siempre disponible)
- **Magic link** (solo si feature flag `enable_magic_links_user` está ON, solo para role `user`)

Tras login exitoso:

- `role = user` → User App (dashboard)
- `role = admin` → Admin Panel
- `role = superadmin` → Admin Panel (con permisos extendidos)

### Validaciones

- Email case-insensitive (normalizado a lowercase)
- Contraseña ≥ 8 caracteres
- Anti-enumeration: mensaje genérico en errores ("Credenciales inválidas")
- Rate limit: 5 intentos / 15 min por IP
- Cuenta pausada → login permitido, redirige a Billing

### Auth Error Taxonomy

| Código | Mensaje (usuario) | Causa |
|---|---|---|
| `AUTH_INVALID_CREDENTIALS` | Credenciales inválidas | Email/password incorrectos |
| `AUTH_EMAIL_NOT_CONFIRMED` | Confirma tu email primero | Email no verificado |
| `AUTH_RATE_LIMITED` | Demasiados intentos, espera unos minutos | Rate limit excedido |
| `AUTH_USER_DISABLED` | Cuenta deshabilitada | Admin desactivó la cuenta |
| `AUTH_WEAK_PASSWORD` | La contraseña no cumple los requisitos | < 8 chars, sin número, etc. |
| `AUTH_EMAIL_EXISTS` | (mensaje genérico) | Email ya registrado |
| `AUTH_UNKNOWN` | Error inesperado | Catch-all |

---

## 2.2 Magic Links

Controlados por feature flag:

```
enable_magic_links_user = false   // default: OFF
```

### Reglas

- Solo `role = user` puede usar magic link (si flag ON)
- `admin` y `superadmin` → **nunca** magic link
- Expiran a los **5 minutos**
- Requieren email verificado previamente
- Implementados via `supabase.auth.signInWithOtp({ email })`

---

## 2.3 Roles

### user

Acceso a la **User App**:

- Conectar redes sociales (YouTube, X)
- Shield (moderación automática)
- Roasts (si módulo activo y plan lo permite)
- Gestionar su plan y billing
- Editar Roastr Persona
- Ver métricas y dashboard

### admin — Phase 2

> **MVP: No se implementa Admin Panel.** Gestión via Supabase Dashboard + queries directas.

Cuando se implemente:

- Gestión de usuarios
- Edición de planes y tonos
- Feature flags
- Métricas globales
- Impersonación segura

**Restricciones:**

- No magic link
- Sesión: 24h
- Inactividad > 4h → logout automático

### superadmin — Phase 2

Permisos extra sobre admin:

- Degradar/suspender admins
- Modificar flags críticos (kill-switch, feature gates)
- Modificar comportamiento de billing
- Activar integraciones nuevas

**Seguridad:**

- Mismas reglas de sesión que admin
- Acciones de alto riesgo → password + confirmación doble

---

## 2.4 NestJS JWT Guard

El backend NestJS valida tokens de Supabase en todas las rutas protegidas:

```typescript
// Esquema del guard
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) throw new UnauthorizedException();

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) throw new UnauthorizedException();

    request.user = user;
    return true;
  }
}

// Decorator para roles
@Injectable()
export class RolesGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!requiredRoles) return true;

    const { user } = context.switchToHttp().getRequest();
    const profile = await this.profilesService.findById(user.id);

    return requiredRoles.includes(profile.role);
  }
}

// Uso en controllers
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin', 'superadmin')
@Get('admin/users')
async listUsers() { ... }
```

**Reglas:**

- Todas las rutas de API requieren JWT válido (excepto `/auth/*` y `/health`)
- Workers usan **Service Role Key** de Supabase (no tokens de usuario)
- El Admin Panel usa token de admin normal, **nunca** Service Role

---

## 2.5 Roastr Persona (referencia)

El Roastr Persona se configura en el perfil del usuario:

- **Lo que me define** → identidades personales
- **Lo que no tolero** → líneas rojas (escalan a Shield)
- **Lo que me da igual** → tolerancias (reducen sensibilidad)

Almacenado cifrado (AES-256-GCM) en `profiles.roastr_persona_config`.

> Mecánica completa de cifrado, matching e impacto en análisis definida en §6 (Roastr Persona) y §5 (Motor de Análisis).

---

## 2.6 Session Management

### Usuarios (role = user)

- Sesión persistente: **7 días**
- Inactividad > 14 días → login requerido
- Cambio de contraseña → invalida todas las sesiones
- Refresh tokens gestionados automáticamente por Supabase

### Admin / Superadmin — Phase 2

- Sesión: **24h**
- Inactividad > **4h** → logout automático
- No sesión persistente
- Acciones críticas → pedir contraseña nuevamente

### Reglas de invalidación

Logout en cascada cuando:

- El email cambia
- La contraseña cambia
- Se degrada el rol
- Se reactiva cuenta pausada (para forzar re-auth)

### Tokens especiales

- **Workers:** Service Role JWT de Supabase (server-side only)
- **Frontend:** anon key + user JWT (client-side)
- **Admin Panel:** user JWT con role verificado (nunca Service Role)

---

## 2.7 Onboarding Wizard

El onboarding es un wizard multi-paso que se presenta en la primera sesión.

### Estados

```
welcome → select_plan → payment → persona_setup → connect_accounts → done
```

### Flujo

1. **welcome** — Introducción breve a Roastr
2. **select_plan** — Elección Starter / Pro / Plus con comparativa
3. **payment** — Checkout Polar. Si falla → bloqueado aquí hasta método válido
4. **persona_setup** — Configurar Roastr Persona (obligatorio, define la protección)
5. **connect_accounts** — Conectar al menos 1 cuenta (YouTube o X)
6. **done** — Onboarding completo, entra al dashboard

El wizard se **reanuda exactamente donde se quedó** si el usuario abandona y vuelve.

`onboarding_state` se persiste en `profiles` y se lee en cada login.

---

## 2.8 Trial y Cancelación

### Trial

- Todos los planes incluyen trial (duración definida en SSOT/Polar).
- Durante el trial: acceso completo al plan seleccionado.
- Se requiere método de pago válido para activar el trial.

### Cancelación durante trial

> **Si un usuario cancela durante el trial → el trial termina INMEDIATAMENTE.**

- No se sigue dando servicio durante los días restantes.
- La cuenta pasa a estado `paused`.
- Workers se detienen.
- El usuario puede reactivarse aportando método de pago válido.

Esto evita gasto computacional en usuarios que rechazan el producto.

---

## 2.9 Acceso según estado de suscripción

| Estado | Acceso permitido | Acceso restringido |
|---|---|---|
| `trialing` | Full acceso del plan | — |
| `active` | Full acceso del plan | — |
| `paused` | Solo login + billing + historial | Shield, Roasts, ingestión |
| `canceled` | Solo login + billing | Toda funcionalidad |
| `past_due` | Igual que paused | Igual que paused |

---

## 2.10 Seguridad adicional

- No se permite ninguna llamada al backend sin JWT válido.
- Tokens caducados son rechazados automáticamente por Supabase.
- Workers operan con Service Role (permisos elevados pero controlados por RLS policies con `auth.uid()`).
- Passwords hasheadas con bcrypt (gestionado por Supabase).
- Supabase detecta anomalías (login desde nueva ubicación, etc.).

---

## 2.11 Dependencias

- **Supabase Auth:** Sistema principal de autenticación (signup, login, JWT, refresh tokens).
- **Supabase DB:** Tabla `profiles` con RLS y trigger de auto-creación.
- **Polar (§3):** Checkout para método de pago durante onboarding, gestión de trials y suscripciones.
- **Roastr Persona (§6):** Almacenado cifrado en el perfil del usuario.
- **NestJS Guards:** Validación de JWT y roles en cada request al backend.
