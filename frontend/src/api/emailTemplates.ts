import { api } from './client'

export type EmailTemplate =
  | GeneralEmailTemplate
  | ProjectEmailTemplate

export type GeneralEmailTemplate = {
  type: 'general'
  id: string
  name: string
  description?: string
  content: string
  variables?: string[]
  created_at?: string
  updated_at?: string
}

export type EmailTemplateVariable = {
  name: string
  expression: string
  syntax: string
  raw: string
}

export type ProjectEmailTemplate = {
  type: 'project_backend'
  id: string
  projectId: string
  projectName: string
  name: string
  fileName: string
  relativePath: string
  framework: 'laravel'
  moduleName?: string | null
  content?: string
  variables: EmailTemplateVariable[]
  variablesCount?: number
  updatedAt?: string
  exists?: boolean
}

type ApiGeneral = {
  id: string; name: string; description: string; content: string; type: string;
  variables: string[]; created_at: string; updated_at: string
}

type ApiProjectMeta = {
  id: string; project_id: string; project_name: string; name: string;
  file_name: string; relative_path: string; framework: string; module: string | null;
  variables: EmailTemplateVariable[]; variables_count: number; updated_at: string; exists: boolean
}

type ApiProjectDetail = ApiProjectMeta & { content: string }

function toGeneral(d: ApiGeneral): GeneralEmailTemplate {
  return {
    type: 'general', id: d.id, name: d.name, description: d.description,
    content: d.content, variables: d.variables, created_at: d.created_at, updated_at: d.updated_at,
  }
}

function toProject(d: ApiProjectMeta | ApiProjectDetail, fallbackProjectId = '', fallbackProjectName = ''): ProjectEmailTemplate {
  return {
    type: 'project_backend', id: d.id,
    projectId: (d as ApiProjectMeta).project_id || fallbackProjectId,
    projectName: (d as ApiProjectMeta).project_name || fallbackProjectName,
    name: d.name, fileName: d.file_name, relativePath: d.relative_path,
    framework: 'laravel', moduleName: d.module,
    content: (d as ApiProjectDetail).content,
    variables: d.variables || [], variablesCount: d.variables_count,
    updatedAt: d.updated_at, exists: d.exists,
  }
}

export const emailApi = {
  async listGeneral(): Promise<GeneralEmailTemplate[]> {
    const list: ApiGeneral[] = await api.get('/email-templates')
    return list.map(toGeneral)
  },
  async createGeneral(data: { name: string; description?: string; content?: string }): Promise<GeneralEmailTemplate> {
    return toGeneral(await api.post('/email-templates', data))
  },
  async updateGeneral(id: string, data: { name?: string; description?: string; content?: string }): Promise<GeneralEmailTemplate> {
    return toGeneral(await api.patch(`/email-templates/${id}`, data))
  },
  async deleteGeneral(id: string): Promise<void> {
    await api.delete(`/email-templates/${id}`)
  },
  async listProjects(): Promise<{ id: string; name: string; framework: string }[]> {
    const data = await api.get('/projects?limit=100')
    return (data.items || []).map((p: any) => ({ id: p.id, name: p.name, framework: p.framework || 'Unknown' }))
  },
  async listProjectTemplates(projectId: string): Promise<ProjectEmailTemplate[]> {
    const list: ApiProjectMeta[] = await api.get(`/projects/${projectId}/email-templates`)
    return list.map((d) => toProject(d, projectId))
  },
  async scanProjectTemplates(projectId: string): Promise<ProjectEmailTemplate[]> {
    const list: ApiProjectMeta[] = await api.post(`/projects/${projectId}/email-templates/scan`, {})
    return list.map((d) => toProject(d, projectId))
  },
  async getProjectTemplate(projectId: string, templateId: string): Promise<ProjectEmailTemplate> {
    const d: ApiProjectDetail = await api.get(`/projects/${projectId}/email-templates/${templateId}`)
    return toProject(d, projectId)
  },
  async saveProjectTemplate(projectId: string, templateId: string, content: string): Promise<ProjectEmailTemplate> {
    const d: ApiProjectDetail = await api.patch(`/projects/${projectId}/email-templates/${templateId}`, { content })
    return toProject(d, projectId)
  },
  async preview(content: string, kind: 'general' | 'blade'): Promise<string> {
    const r = await api.post('/email-templates/preview', { content, kind })
    return r.html as string
  },
}

/** Normalize a raw Blade echo for comparison (collapse whitespace). */
export function normalizeBladeRaw(raw: string): string {
  return (raw || '').replace(/\s+/g, ' ').trim().slice(0, 300)
}

const BLADE_RAW_RE = /\{\!\!\s*(.+?)\s*\!\!\}|\{\{\s*(.+?)\s*\}\}/gs

/** Extract raw Blade echo expressions ({{ ... }} / {!! ... !!}), order-preserving, deduped. */
export function extractBladeRawsClient(content: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  BLADE_RAW_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = BLADE_RAW_RE.exec(content || ''))) {
    const norm = normalizeBladeRaw(m[0])
    if (norm && !seen.has(norm)) {
      seen.add(norm)
      out.push(norm)
    }
  }
  return out
}

export function extractGeneralVarsClient(content: string): string[] {
  const re = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g
  const seen: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(content || ''))) {
    if (!seen.includes(m[1])) seen.push(m[1])
  }
  return seen
}

const DUMMY: Record<string, string> = {
  company_name: 'Acme Corporation',
  company: 'Acme Corporation',
  employee_name: 'John Doe',
  employee: 'John Doe',
  user: 'John Doe',
  name: 'John Doe',
  first_name: 'John',
  last_name: 'Doe',
  email: 'john@example.com',
  phone: '+1 555 0100',
  job_title: 'Software Engineer',
  login_url: 'https://example.com/login',
  loginUrl: 'https://example.com/login',
  url: 'https://example.com',
  date: '2026-01-15',
  message: "Welcome aboard! We're glad to have you.",
}

function dummyFor(name: string): string {
  if (DUMMY[name]) return DUMMY[name]
  const base = name.split('.')[0]
  if (DUMMY[base]) return DUMMY[base]
  return 'Sample Value'
}

/** Email scanning supports Laravel backends only. */
export function isLaravelProject(framework: string | undefined | null): boolean {
  return (framework || '').toLowerCase() === 'laravel'
}

/* ---- Smart Blade analysis (mirrors backend blade_parser.analyze_blade) ----
   Knows Laravel scoping: @php blocks, loop vars, @inject, @props/@aware,
   $errors/$attributes/$slot, $loop in loops, @isset/@empty guards,
   $message in @error blocks; ignores comments and @verbatim. */

const BLADE_ALWAYS_KNOWN = new Set(['errors', 'attributes', 'slot'])

function stripBladeNoise(content: string): string {
  return (content || '')
    .replace(/\{\{--.*?--\}\}/gs, '')
    .replace(/@verbatim.*?@endverbatim/gsi, '')
}

function bladeDefinedInPhp(code: string, store: Set<string>) {
  let m: RegExpExecArray | null
  const fe = /foreach\s*\(.+?\bas\s+(\$[a-zA-Z_][a-zA-Z0-9_]*)(?:\s*=>\s*(\$[a-zA-Z_][a-zA-Z0-9_]*))?/gsi
  while ((m = fe.exec(code))) {
    store.add(m[1].slice(1))
    if (m[2]) store.add(m[2].slice(1))
  }
  const fr = /for\s*\(\s*(\$[a-zA-Z_][a-zA-Z0-9_]*)/gi
  while ((m = fr.exec(code))) store.add(m[1].slice(1))
  const ct = /catch\s*\([^)]*?(\$[a-zA-Z_][a-zA-Z0-9_]*)/gi
  while ((m = ct.exec(code))) store.add(m[1].slice(1))
  const as = /(?<![\$>:=\-a-zA-Z_])\$([a-zA-Z_][a-zA-Z0-9_]*)\s*=(?![=>])/g
  while ((m = as.exec(code))) store.add(m[1])
}

function bladeBlockRanges(body: string): { loop: [number, number][]; error: [number, number][] } {
  const opens: Record<string, 'loop' | 'error'> = { foreach: 'loop', forelse: 'loop', error: 'error' }
  const closes: Record<string, 'loop' | 'error'> = { endforeach: 'loop', endforelse: 'loop', enderror: 'error' }
  const stack: { kind: 'loop' | 'error'; start: number }[] = []
  const ranges: { loop: [number, number][]; error: [number, number][] } = { loop: [], error: [] }
  const tok = /@(\w+)/gi
  let m: RegExpExecArray | null
  while ((m = tok.exec(body))) {
    const name = m[1].toLowerCase()
    if (opens[name]) stack.push({ kind: opens[name], start: m.index })
    else if (closes[name]) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].kind === closes[name]) {
          const [op] = stack.splice(i, 1)
          ranges[closes[name]].push([op.start, m.index + m[0].length])
          break
        }
      }
    }
  }
  return ranges
}

function bladeVarBase(expr: string): { base: string; friendly: string } | null {
  const vm = /\$([a-zA-Z_][a-zA-Z0-9_]*)(?:\s*->\s*([a-zA-Z_][a-zA-Z0-9_]*))?/.exec(expr)
  if (vm) return { base: vm[1], friendly: vm[2] ? `${vm[1]}.${vm[2]}` : vm[1] }
  const bare = /[a-zA-Z_][a-zA-Z0-9_]*/.exec(expr)
  if (!bare) return null
  if (['if', 'else', 'foreach', 'echo', 'empty', 'isset', 'true', 'false', 'null'].includes(bare[0].toLowerCase())) return null
  return { base: bare[0], friendly: bare[0] }
}

export type BladeUnknown = { name: string; raw: string }
export type BladeAnalysis = { used: string[]; defined: string[]; unknown: BladeUnknown[] }

export function analyzeBladeClient(content: string, known: string[] = []): BladeAnalysis {
  const body = stripBladeNoise(content)
  const knownBases = new Set((known || []).map((k) => String(k).split('.')[0].replace(/^\$/, '')).filter(Boolean))
  const defined = new Set<string>()
  let m: RegExpExecArray | null

  const php = /@php(.*?)@endphp/gsi
  while ((m = php.exec(body))) bladeDefinedInPhp(m[1], defined)
  const phpInline = /@php\(([^)]*)\)/gi
  while ((m = phpInline.exec(body))) bladeDefinedInPhp(m[1], defined)
  const loop = /@(?:foreach|forelse)\s*\(.+?\bas\s+(\$[a-zA-Z_][a-zA-Z0-9_]*)(?:\s*=>\s*(\$[a-zA-Z_][a-zA-Z0-9_]*))?/gsi
  while ((m = loop.exec(body))) {
    defined.add(m[1].slice(1))
    if (m[2]) defined.add(m[2].slice(1))
  }
  const fr = /@for\s*\(\s*(\$[a-zA-Z_][a-zA-Z0-9_]*)/gi
  while ((m = fr.exec(body))) defined.add(m[1].slice(1))
  const inj = /@inject\s*\(\s*['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]/gi
  while ((m = inj.exec(body))) defined.add(m[1])
  const pp = /@(?:props|aware)\s*\(\s*\[(.*?)\]\)/gsi
  while ((m = pp.exec(body))) {
    const inner = m[1]
    const keys = /['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]\s*=>/g
    let k: RegExpExecArray | null
    while ((k = keys.exec(inner))) defined.add(k[1])
    const bare = /['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]/g
    let b: RegExpExecArray | null
    const noDefaults = inner.replace(/=>[^,]+/g, '')
    while ((b = bare.exec(noDefaults))) defined.add(b[1])
  }

  const ranges = bladeBlockRanges(body)
  const guarded = new Set<string>()
  const gr = /@(isset|empty)\s*\((.*?)\)/gsi
  while ((m = gr.exec(body))) {
    const vm = /\$([a-zA-Z_][a-zA-Z0-9_]*)(?:\s*->\s*[a-zA-Z_][a-zA-Z0-9_]*)?/g
    let v: RegExpExecArray | null
    while ((v = vm.exec(m[2]))) guarded.add(v[1])
  }

  const allowed = new Set([...knownBases, ...defined, ...BLADE_ALWAYS_KNOWN, ...guarded])
  const inRanges = (pos: number, rs: [number, number][]) => rs.some(([s, e]) => s <= pos && pos <= e)
  const used = new Map<string, string>()
  const unknown = new Map<string, BladeUnknown>()
  const consider = (base: string, friendly: string, raw: string, pos: number) => {
    if (!base) return
    if (!used.has(friendly)) used.set(friendly, raw.trim().slice(0, 300))
    if (allowed.has(base)) return
    if (base === 'loop' && inRanges(pos, ranges.loop)) return
    if (base === 'message' && inRanges(pos, ranges.error)) return
    const key = raw.replace(/\s+/g, ' ').trim().slice(0, 300)
    if (key && !unknown.has(key)) unknown.set(key, { name: friendly, raw: key })
  }

  const echo = /\{\!\!\s*(.+?)\s*\!\!\}|\{\{\s*(.+?)\s*\}\}/gs
  while ((m = echo.exec(body))) {
    const expr = (m[1] ?? m[2] ?? '').trim()
    const hit = bladeVarBase(expr)
    // register every $var inside (ternary/coalesce), else the bare name
    const vm = /\$([a-zA-Z_][a-zA-Z0-9_]*)(?:\s*->\s*([a-zA-Z_][a-zA-Z0-9_]*))?/g
    let v: RegExpExecArray | null
    let found = false
    while ((v = vm.exec(expr))) {
      found = true
      consider(v[1], v[2] ? `${v[1]}.${v[2]}` : v[1], m[0], m.index)
    }
    if (!found && hit) consider(hit.base, hit.friendly, m[0], m.index)
  }
  const dir = /@(if|elseif|unless|isset|empty|foreach|forelse|for|while|switch|case|include|each|checked|selected|disabled|readonly|required|json|js|class|style)\s*\((.*?)\)/gsi
  while ((m = dir.exec(body))) {
    const vm = /\$([a-zA-Z_][a-zA-Z0-9_]*)(?:\s*->\s*([a-zA-Z_][a-zA-Z0-9_]*))?/g
    let v: RegExpExecArray | null
    while ((v = vm.exec(m[2]))) consider(v[1], v[2] ? `${v[1]}.${v[2]}` : v[1], m[0], m.index)
  }
  const bind = /:[a-zA-Z_][\w\-.]*\s*=\s*"([^"]*)"/g
  while ((m = bind.exec(body))) {
    const vm = /\$([a-zA-Z_][a-zA-Z0-9_]*)(?:\s*->\s*([a-zA-Z_][a-zA-Z0-9_]*))?/g
    let v: RegExpExecArray | null
    while ((v = vm.exec(m[1]))) consider(v[1], v[2] ? `${v[1]}.${v[2]}` : v[1], v[0], m.index)
  }

  return { used: [...used.keys()].sort(), defined: [...defined].sort(), unknown: [...unknown.values()] }
}

/** Instant client-side general preview — always replaces {var} with dummy data. */
export function previewGeneralClient(content: string): string {
  return (content || '').replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (_, v: string) => dummyFor(v))
}

/** Instant client-side Blade preview — always replaces {{ }}/{!! !!} (with or without $) with dummy data. */
export function previewBladeClient(content: string): string {
  let out = stripBladeNoise(content || '')
  out = out.replace(/\{\!\!\s*(.+?)\s*\!\!\}|\{\{\s*(.+?)\s*\}\}/gs, (_full, g1: string, g2: string) => {
    const expr = (g1 ?? g2 ?? '').trim()
    const vm = /\$([a-zA-Z_][a-zA-Z0-9_]*)(?:\s*->\s*([a-zA-Z_][a-zA-Z0-9_]*))?/.exec(expr)
    if (vm) return dummyFor(vm[2] ? `${vm[1]}.${vm[2]}` : vm[1])
    const bare = /[a-zA-Z_][a-zA-Z0-9_]*/.exec(expr)
    if (bare) return dummyFor(bare[0])
    return 'Sample Value'
  })
  // @php blocks are logic, never output — drop them like the server does
  out = out.replace(/@php.*?@endphp/gsi, '')
  out = out.replace(/@\w+(\s*\(.*?\))?/gs, '')
  return out
}
