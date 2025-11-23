# Prettier + ESLint Setup

## Resumen

Configuración unificada de Prettier y ESLint para Roastr.ai, optimizada para evitar formateo doble según las mejores prácticas recomendadas por VS Code ESLint extension, Prettier VS Code extension, y eslint-plugin-prettier.

## Archivos Creados/Modificados

### Configuración de Formateo

- **`.prettierrc.json`**: Configuración de Prettier con reglas estándar
- **`.prettierignore`**: Archivos a excluir del formateo
- **`eslint.config.js`**: Actualizado con integración de Prettier (flat config ESLint 9)

### Configuración de Editor (Cursor/VS Code)

- **`.vscode/settings.json`**: Configuración optimizada para evitar formateo doble
  - ✅ Deshabilita `editor.formatOnSave` genérico
  - ✅ Usa ESLint para JS/TS (que ejecuta Prettier internamente)
  - ✅ Usa Prettier directamente para JSON, Markdown, CSS, YAML
  - ✅ Habilita soporte para ESLint 9 flat config
  
- **`.vscode/extensions.json`**: Extensiones recomendadas
  - `dbaeumer.vscode-eslint`
  - `esbenp.prettier-vscode`

### Package.json

Nuevos scripts:
```bash
npm run format          # Formatear todos los archivos
npm run format:check    # Verificar formato sin cambiar archivos
npm run lint:fix        # Arreglar problemas de linting automáticamente
```

Nuevas dependencias de desarrollo:
- `prettier@^3.4.2`
- `eslint-config-prettier@^9.1.0`
- `eslint-plugin-prettier@^5.2.1`

### .gitignore

Actualizado para permitir archivos de configuración de Cursor/VS Code:
```gitignore
# VS Code / Cursor - ignorar archivos personales pero permitir configuración compartida
.vscode/*
!.vscode/settings.json
!.vscode/extensions.json
```

## Configuración por Editor

### VS Code / Cursor (Recomendado)

Ambos editores usan la misma configuración (Cursor está basado en VS Code):

**Instalación:**
1. Instalar extensiones recomendadas:
   - ESLint (`dbaeumer.vscode-eslint`)
   - Prettier (`esbenp.prettier-vscode`)
2. La configuración se aplica automáticamente via `.vscode/settings.json`

**Uso:**
- Automático al guardar:
  - JS/TS: ESLint aplica fixes (incluye Prettier)
  - JSON/Markdown/CSS/YAML: Prettier formatea directamente
- Manual: `Cmd+Shift+P` → "Format Document"

### WebStorm / IntelliJ IDEA

**Configuración:**
1. Ve a `Settings → Languages & Frameworks → JavaScript → Prettier`
2. Marca las opciones:
   - ✅ "On save"
   - ✅ "Run for files"
3. Establece Prettier package: `<project>/node_modules/prettier`
4. Para ESLint: `Settings → Languages & Frameworks → JavaScript → Code Quality Tools → ESLint`
   - Marca "Run eslint --fix on save"

**Uso:**
- Automático al guardar (si configurado)
- Manual: `Cmd+Opt+L` (Mac) / `Ctrl+Alt+L` (Windows)

### Vim / Neovim

**Con ALE (Asynchronous Lint Engine):**
```vim
" En tu .vimrc o init.vim
let g:ale_fixers = {
\   'javascript': ['prettier', 'eslint'],
\   'typescript': ['prettier', 'eslint'],
\}
let g:ale_fix_on_save = 1
```

**Con coc-prettier:**
```vim
" Instalar coc-prettier
:CocInstall coc-prettier

" En coc-settings.json
{
  "prettier.onlyUseLocalVersion": true,
  "coc.preferences.formatOnSave": true
}
```

**Uso:**
- Automático al guardar (si configurado)
- Manual: `:ALEFix` o `:CocCommand prettier.formatFile`

### Emacs

**Con prettier-js:**
```elisp
;; Instalar prettier-js desde MELPA
(require 'prettier-js)

;; Habilitar en modos JS/TS
(add-hook 'js-mode-hook 'prettier-js-mode)
(add-hook 'typescript-mode-hook 'prettier-js-mode)
```

**Con LSP Mode:**
```elisp
(use-package lsp-mode
  :hook ((js-mode . lsp)
         (typescript-mode . lsp))
  :config
  (setq lsp-eslint-auto-fix-on-save t))
```

**Uso:**
- Automático al guardar (si configurado)
- Manual: `M-x prettier-js`

### Sublime Text

**Instalación:**
1. Instalar Package Control
2. Instalar paquetes:
   - `JsPrettier`
   - `SublimeLinter-eslint`

**Configuración (Preferences → Package Settings → JsPrettier):**
```json
{
  "auto_format_on_save": true,
  "prettier_cli_path": "./node_modules/.bin/prettier"
}
```

**Uso:**
- Automático al guardar (si configurado)
- Manual: `Cmd+Shift+P` → "JsPrettier: Format Code"

### Línea de Comandos (Cualquier Editor)

Si tu editor no soporta Prettier/ESLint, puedes usar los scripts npm:

```bash
npm run format              # Formatear todos los archivos
npm run format:check        # Solo verificar sin cambiar
npm run lint:fix            # Arreglar linting automáticamente
```

## Uso

### Workflow Recomendado

1. Escribir código
2. Guardar (auto-format según tu editor)
3. Antes de commit: `npm run format:check && npm run lint`

## Características Clave

### ✅ Sin Formateo Doble

La configuración está optimizada para evitar que Prettier y ESLint formateen dos veces:
- ESLint ejecuta Prettier via `eslint-plugin-prettier`
- VS Code no ejecuta Prettier adicional para JS/TS
- Prettier solo se ejecuta directamente para archivos no-JS/TS

### ✅ Compatible con Cursor

Cursor está basado en VS Code y usa la misma estructura de configuración:
- `.vscode/settings.json` funciona idéntico
- `.vscode/extensions.json` funciona idéntico
- Mismas extensiones disponibles

### ✅ ESLint 9 Flat Config

La configuración usa el nuevo formato flat config de ESLint 9:
```javascript
const prettierConfig = require('eslint-plugin-prettier');
const prettierRecommended = require('eslint-config-prettier');

module.exports = [
  {
    plugins: { prettier: prettierConfig },
    rules: {
      'prettier/prettier': 'error',
      ...prettierRecommended.rules
    }
  }
];
```

## Reglas de Prettier

```json
{
  "semi": true,
  "trailingComma": "none",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

## Próximos Pasos (Opcionales)

1. **Formateo gradual del codebase:**
   - Por directorio/feature en PRs futuros
   - Evitar cambio masivo en una PR

2. **CI/CD Integration:**
   - Añadir check de formato en pipeline
   - Ejemplo: `npm run format:check` en GitHub Actions

3. **Pre-commit Hook:**
   - Formatear automáticamente antes de commit
   - Usar `husky` + `lint-staged`

## Troubleshooting

### "Prettier not formatting on save"

1. Verificar que tienes la extensión instalada
2. Recargar Cursor: `Cmd+Shift+P` → "Reload Window"
3. Verificar que el archivo no está en `.prettierignore`

### "ESLint not working"

1. Verificar: `npm list eslint-plugin-prettier`
2. Reinstalar: `npm install`
3. Recargar Cursor

### "Formato doble"

Si detectas que el formato se ejecuta dos veces:
1. Verificar `.vscode/settings.json`
2. Asegurar que `editor.formatOnSave: false` globalmente
3. Solo debe estar `true` para lenguajes específicos (JSON, Markdown, etc.)

## Referencias

- [PR #953](https://github.com/Eibon7/roastr-ai/pull/953)
- [CodeRabbit Review](https://github.com/Eibon7/roastr-ai/pull/953#pullrequestreview-3497912148)
- [ESLint Flat Config](https://eslint.org/docs/latest/use/configure/configuration-files-new)
- [eslint-plugin-prettier](https://github.com/prettier/eslint-plugin-prettier)

---

**Última actualización:** 2025-11-23  
**Implementado por:** @Eibon7  
**Issues relacionadas:** #949, #950, #951

