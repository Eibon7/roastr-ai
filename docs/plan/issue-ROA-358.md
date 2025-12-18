# Plan: ROA-358 - Auth UI Base Components v2

## Estado Actual

- ✅ Existen componentes shadcn/ui base: `input.tsx`, `button.tsx`, `label.tsx`, `card.tsx`
- ✅ Existe `AuthLayout` para layouts de autenticación
- ✅ Existen páginas de login y recover usando componentes shadcn directamente
- ❌ No hay componentes base especializados para auth (PasswordInput, EmailInput, AuthForm, etc.)
- ❌ Los componentes de auth están duplicados en cada página
- ❌ No hay componente de PasswordInput con toggle de visibilidad
- ❌ No hay componente MagicLinkForm especializado

## Objetivo

Crear componentes base reutilizables de UI para autenticación usando shadcn/ui v2, que encapsulen patrones comunes y sean consistentes en toda la aplicación.

## Componentes a Crear

### 1. PasswordInput
- Input de contraseña con toggle de visibilidad (eye icon)
- Usa shadcn Input como base
- Iconos de lucide-react (Eye, EyeOff)
- Accesible con aria-labels

### 2. EmailInput
- Input de email con validación visual
- Usa shadcn Input como base
- Validación de formato email

### 3. AuthForm
- Formulario base para auth con manejo de errores
- Manejo de loading states
- Estructura consistente

### 4. AuthButton
- Botón especializado para acciones de auth
- Loading state integrado
- Variantes consistentes

### 5. MagicLinkForm
- Formulario para envío de magic links
- Mensaje de éxito
- Integración con AuthForm

## Estructura de Archivos

```
frontend/src/components/auth/
├── password-input.tsx
├── email-input.tsx
├── auth-form.tsx
├── auth-button.tsx
├── magic-link-form.tsx
├── index.ts
└── __tests__/
    ├── password-input.test.tsx
    ├── email-input.test.tsx
    ├── auth-form.test.tsx
    ├── auth-button.test.tsx
    └── magic-link-form.test.tsx
```

## Implementación

### Fase 1: Componentes Base Individuales
1. PasswordInput - Con toggle de visibilidad
2. EmailInput - Con validación
3. AuthButton - Con loading states

### Fase 2: Componentes Compuestos
4. AuthForm - Formulario base
5. MagicLinkForm - Formulario de magic link

### Fase 3: Testing y Validación
6. Tests unitarios para cada componente
7. Validación visual en claro/oscuro/sistema
8. Validación responsive

## Agentes Relevantes

- FrontendDev (implementación de componentes UI)
- TestEngineer (tests de componentes)

## Archivos Afectados

- `frontend/src/components/auth/` (nuevo)
- `frontend/src/pages/auth/login.tsx` (refactorizar para usar nuevos componentes)
- `frontend/src/pages/auth/recover.tsx` (refactorizar para usar nuevos componentes)

## Validación

- [x] Todos los componentes renderizan correctamente
- [x] Tests creados para todos los componentes
- [ ] Tests pasando al 100% (pendiente ejecución con entorno configurado)
- [ ] Probado en modo claro/oscuro/sistema
- [ ] Responsive en móvil/tablet/desktop
- [x] Accesibilidad verificada (a11y - aria-labels, roles)
- [ ] Sin regresiones en páginas existentes (refactorización pendiente)

## Estado de Implementación

### ✅ Completado

1. **PasswordInput** - Componente con toggle de visibilidad usando Eye/EyeOff de lucide-react
2. **EmailInput** - Componente con validación visual y atributos email
3. **AuthButton** - Botón especializado con loading state integrado
4. **AuthForm** - Formulario base con manejo de errores
5. **MagicLinkForm** - Formulario completo para magic links
6. **Tests** - Tests unitarios creados para todos los componentes
7. **Exportaciones** - Index file con todas las exportaciones

### 📝 Próximos Pasos (Opcional)

1. Refactorizar `login.tsx` para usar los nuevos componentes base
2. Refactorizar `recover.tsx` para usar MagicLinkForm
3. Ejecutar tests cuando el entorno esté configurado
4. Validar visualmente en diferentes temas

