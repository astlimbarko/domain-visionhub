# Entorno de Claude Code — VisionHub

> Documentación del entorno de plugins/skills de Claude Code usado en este
> proyecto, para mantener todas las máquinas del equipo iguales. Fuente de
> referencia: `plugins-y-skills.txt` (raíz). Última actualización: 2026-07-26.

## Marketplaces configurados

| Marketplace | Repo | Notas |
|---|---|---|
| `claude-plugins-official` | `anthropics/claude-plugins-official` | Marketplace oficial de Anthropic. Es el único configurado hoy. |

Para agregar un marketplace nuevo: `claude plugin marketplace add <owner/repo>`.

## Skills nativas (ya vienen con Claude Code — no requieren plugin)

Están disponibles de fábrica; **no** hay que instalarlas. En este proyecto se usan
sobre todo `frontend-design` (UI), `dataviz`, `artifact-design`, `review`,
`security-review`, `simplify`, `run`, `init`:

`dataviz` · `artifact-design` · `artifact-capabilities` · `update-config` ·
`keybindings-help` · `simplify` · `fewer-permission-prompts` · `loop` · `schedule` ·
`claude-api` · `claude-in-chrome` · `run` · `init` · `review` · `security-review`

## Plugins instalados

| Plugin | Skill(s) | Autor | Marketplace | Scope | Comando de instalación |
|---|---|---|---|---|---|
| `frontend-design` | `frontend-design` | Anthropic | `claude-plugins-official` | user | `claude plugin install frontend-design@claude-plugins-official` |

- Propósito: *"Create distinctive, production-grade frontend interfaces with high
  design quality"* — se usa para el frontend Vite+React+Tailwind del proyecto.
- Instalado el 2026-07-26. Los plugins se cargan **al iniciar sesión**; tras
  instalar hay que abrir una sesión nueva para que la skill aparezca.

## Pendiente (requiere fuente / confirmación)

| Elemento | Estado | Qué falta |
|---|---|---|
| `apple-hig-designer` | **No encontrado** en `claude-plugins-official` (ni skill nativa, ni skill local, ni parte de `frontend-design`). | Confirmar su procedencia con el compañero: (a) skill personal en su `~/.claude/skills/`, o (b) plugin de otro marketplace. No se instaló ningún sustituto parecido. |

## Cómo replicar este entorno en otra máquina

```bash
# 1. El marketplace oficial suele auto-agregarse; si no:
claude plugin marketplace add anthropics/claude-plugins-official

# 2. Instalar los plugins del proyecto (scope usuario):
claude plugin install frontend-design@claude-plugins-official

# 3. (Pendiente) apple-hig-designer -> falta fuente verificable.

# 4. Verificar:
claude plugin list
```

Las 15 skills nativas listadas arriba no requieren ninguna acción.
