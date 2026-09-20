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
  async listProjects(): Promise<{ id: string; name: string }[]> {
    const data = await api.get('/projects?limit=100')
    return (data.items || []).map((p: any) => ({ id: p.id, name: p.name }))
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

/** Instant client-side general preview — always replaces {var} with dummy data. */
export function previewGeneralClient(content: string): string {
  return (content || '').replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (_, v: string) => dummyFor(v))
}

/** Instant client-side Blade preview — always replaces {{ }}/{!! !!} (with or without $) with dummy data. */
export function previewBladeClient(content: string): string {
  let out = content || ''
  out = out.replace(/\{\!\!\s*(.+?)\s*\!\!\}|\{\{\s*(.+?)\s*\}\}/gs, (_full, g1: string, g2: string) => {
    const expr = (g1 ?? g2 ?? '').trim()
    const vm = /\$([a-zA-Z_][a-zA-Z0-9_]*)(?:\s*->\s*([a-zA-Z_][a-zA-Z0-9_]*))?/.exec(expr)
    if (vm) return dummyFor(vm[2] ? `${vm[1]}.${vm[2]}` : vm[1])
    const bare = /[a-zA-Z_][a-zA-Z0-9_]*/.exec(expr)
    if (bare) return dummyFor(bare[0])
    return 'Sample Value'
  })
  out = out.replace(/@\w+(\s*\(.*?\))?/gs, '')
  return out
}
