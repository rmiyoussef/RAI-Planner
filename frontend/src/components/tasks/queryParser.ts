/**
 * Plane/Linear-style query token parser
 * Supports:
 *  - field:value  (status, assignee, label, module, iteration, priority, project)
 *  - negation: -status:"Completed"  or -label:urgent
 *  - quoted values: status:"In Progress"
 *  - free-text combined in same bar
 */

export type FilterToken = {
  field: string
  value: string
  negated: boolean
  raw: string
}

export type ParsedQuery = {
  tokens: FilterToken[]
  freeText: string
  /** grouped by field for easier lookup */
  byField: Record<string, FilterToken[]>
}

const FIELD_ALIASES: Record<string, string> = {
  status: 'status',
  assignee: 'assignee',
  assigned_to: 'assignee',
  assignees: 'assignee',
  label: 'label',
  labels: 'label',
  tag: 'label',
  tags: 'label',
  module: 'module',
  project: 'module',
  iteration: 'iteration',
  sprint: 'iteration',
  priority: 'priority',
}

function normalizeField(f: string): string {
  return FIELD_ALIASES[f.toLowerCase()] ?? f.toLowerCase()
}

export function parseQuery(raw: string): ParsedQuery {
  const input = raw ?? ''
  const tokenRegex = /(-?)(\w+):(?:"([^"]+)"|(\S+))/g
  const tokens: FilterToken[] = []
  let match: RegExpExecArray | null
  // Collect tokens and track consumed ranges to extract freeText
  const consumedRanges: [number, number][] = []
  while ((match = tokenRegex.exec(input)) !== null) {
    const [full, dash, fieldRaw, quoted, unquoted] = match
    const negated = dash === '-'
    const field = normalizeField(fieldRaw)
    const value = (quoted ?? unquoted ?? '').trim()
    if (!value) continue
    tokens.push({ field, value, negated, raw: full })
    consumedRanges.push([match.index, match.index + full.length])
  }
  // Build freeText by removing consumed ranges
  let freeText = ''
  let cursor = 0
  for (const [start, end] of consumedRanges) {
    freeText += input.slice(cursor, start) + ' '
    cursor = end
  }
  freeText += input.slice(cursor)
  // normalize whitespace
  freeText = freeText.replace(/\s+/g, ' ').trim()

  const byField: Record<string, FilterToken[]> = {}
  for (const t of tokens) {
    if (!byField[t.field]) byField[t.field] = []
    byField[t.field].push(t)
  }

  return { tokens, freeText, byField }
}

export function tokensToString(tokens: FilterToken[], freeText: string): string {
  const parts = tokens.map((t) => {
    const prefix = t.negated ? '-' : ''
    const needsQuote = /\s/.test(t.value)
    const val = needsQuote ? `"${t.value}"` : t.value
    return `${prefix}${t.field}:${val}`
  })
  if (freeText) parts.push(freeText)
  return parts.join(' ').trim()
}

/** Test helper — apply parsed query to tasks (client-side) */
export function taskMatchesQuery(
  task: { title: string; status: string; priority?: string; tags?: string[]; labels?: string[]; project_name?: string; module?: string; iteration?: string; assigned_user_name?: string | null; assigned_to?: string | null; description?: string },
  parsed: ParsedQuery
): boolean {
  // check tokens
  for (const t of parsed.tokens) {
    const val = t.value.toLowerCase()
    let fieldMatch = false
    switch (t.field) {
      case 'status': {
        const s = (task.status ?? '').toLowerCase()
        // allow matching humanized form
        fieldMatch = s === val || s.replace(/_/g, ' ') === val || s.replace(/_/g, '-') === val
        break
      }
      case 'priority': {
        fieldMatch = (task.priority ?? '').toLowerCase() === val
        break
      }
      case 'assignee': {
        const a = (task.assigned_user_name ?? task.assigned_to ?? '').toLowerCase()
        fieldMatch = a.includes(val)
        break
      }
      case 'label': {
        const all = [...(task.tags ?? []), ...(task.labels ?? [])].map((x) => x.toLowerCase())
        fieldMatch = all.some((l) => l === val || l.includes(val))
        break
      }
      case 'module': {
        const m = (task.module ?? task.project_name ?? '').toLowerCase()
        fieldMatch = m.includes(val)
        break
      }
      case 'iteration': {
        fieldMatch = (task.iteration ?? '').toLowerCase().includes(val)
        break
      }
      default:
        fieldMatch = false
    }
    if (t.negated) {
      if (fieldMatch) return false
    } else {
      if (!fieldMatch) return false
    }
  }
  // free text: must appear in title or description
  if (parsed.freeText) {
    const hay = `${task.title ?? ''} ${task.description ?? ''}`.toLowerCase()
    const need = parsed.freeText.toLowerCase().trim()
    // split into words, all must appear? spec: free-text search combined
    // implement as substring match of the whole phrase OR all words
    if (!hay.includes(need)) {
      const words = need.split(/\s+/).filter(Boolean)
      if (!words.every((w) => hay.includes(w))) return false
    }
  }
  return true
}
