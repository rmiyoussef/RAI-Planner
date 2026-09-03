import { describe, it, expect } from 'vitest'
import { parseQuery, taskMatchesQuery } from '../components/tasks/queryParser'
import { getStatusMeta } from '../components/tasks/statusMeta'

describe('queryParser', () => {
  it('parses simple field:value', () => {
    const p = parseQuery('status:"In Progress"')
    expect(p.tokens).toHaveLength(1)
    expect(p.tokens[0].field).toBe('status')
    expect(p.tokens[0].value).toBe('In Progress')
    expect(p.tokens[0].negated).toBe(false)
    expect(p.freeText).toBe('')
  })
  it('parses negation & multiple tokens + free text', () => {
    const p = parseQuery('-status:"Completed" assignee:rami hello world label:urgent')
    expect(p.tokens).toHaveLength(3)
    expect(p.tokens[0].negated).toBe(true)
    expect(p.tokens[0].field).toBe('status')
    expect(p.tokens[0].value).toBe('Completed')
    expect(p.tokens[1].field).toBe('assignee')
    expect(p.tokens[1].value).toBe('rami')
    expect(p.byField['label'][0].value).toBe('urgent')
    expect(p.freeText).toBe('hello world')
  })
  it('handles field aliases', () => {
    const p = parseQuery('tag:bug sprint:S1 project:MyProj')
    expect(p.byField['label']).toBeDefined()
    expect(p.byField['iteration']).toBeDefined()
    expect(p.byField['module']).toBeDefined()
  })
  it('taskMatchesQuery negation', () => {
    const parsed = parseQuery('-status:"done"')
    const task = { title: 'Fix bug', status: 'done', description: '' }
    expect(taskMatchesQuery(task as any, parsed)).toBe(false)
    const task2 = { title: 'Fix bug', status: 'todo', description: '' }
    expect(taskMatchesQuery(task2 as any, parsed)).toBe(true)
  })
  it('free text matches title', () => {
    const parsed = parseQuery('hello')
    expect(taskMatchesQuery({ title: 'Hello world', status: 'todo', description: '' } as any, parsed)).toBe(true)
    expect(taskMatchesQuery({ title: 'Other', status: 'todo', description: '' } as any, parsed)).toBe(false)
  })
})

describe('statusMeta', () => {
  it('returns meta for known status', () => {
    expect(getStatusMeta('todo').label).toBe('Planning')
    expect(getStatusMeta('in_review').label).toBe('Testing')
    expect(getStatusMeta('done').label).toBe('Completed')
    expect(getStatusMeta('archived').label).toBe('On Hold')
  })
  it('fallback for unknown', () => {
    const m = getStatusMeta('custom_status')
    expect(m.label).toBe('Custom Status')
  })
})
