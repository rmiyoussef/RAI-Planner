import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { extractGeneralVarsClient, extractBladeRawsClient, normalizeBladeRaw, isLaravelProject, analyzeBladeClient, previewBladeClient, previewGeneralClient } from '../api/emailTemplates'
import { GeneralEmailTemplateBadge, ProjectEmailTemplateBadge } from '../components/email/TemplateBadges'
import { EmailTemplatePreview } from '../components/email/EmailTemplatePreview'

describe('email template variables (general)', () => {
  it('detects {vars} and deduplicates', () => {
    expect(extractGeneralVarsClient('<h1>Hi {company_name} {email} {company_name}</h1>')).toEqual(['company_name', 'email'])
  })
  it('ignores blade syntax', () => {
    expect(extractGeneralVarsClient('{{ $name }}')).toEqual([])
  })
  it('handles empty content', () => {
    expect(extractGeneralVarsClient('')).toEqual([])
  })
})

describe('email template preview (always dummy data)', () => {
  it('replaces general {vars} with dummy data', () => {
    expect(previewGeneralClient('<h1>{company_name} {unknown_xyz}</h1>')).toBe('<h1>Acme Corporation Sample Value</h1>')
  })
  it('replaces blade echoes with dummy data (with or without $)', () => {
    expect(previewBladeClient('<p>{{ $company_name }}</p>')).toContain('Acme Corporation')
    expect(previewBladeClient('<p>{{ company_name }}</p>')).toContain('Acme Corporation')
    expect(previewBladeClient('<p>{{$company_name}}</p>')).toContain('Acme Corporation')
    expect(previewBladeClient('<p>{{ $company_name }}</p>')).not.toContain('{{')
  })
  it('strips comments, verbatim and @php logic from blade preview', () => {
    const out = previewBladeClient(
      '{{-- {{ $in_comment }} --}}\n@verbatim {{ $raw }} @endverbatim\n@php $g = 1; @endphp\n<h1>{{ $company_name }}</h1>',
    )
    expect(out).not.toContain('in_comment')
    expect(out).not.toContain('--}}')
    expect(out).not.toContain('$raw')
    expect(out).not.toContain('@verbatim')
    expect(out).not.toContain('$g')
    expect(out).not.toContain('@php')
    expect(out).toContain('Acme Corporation')
  })
})
describe('blade raw extraction (client)', () => {
  it('extracts {{ }} and {!! !!} raws, deduped and normalized', () => {
    const out = extractBladeRawsClient('<h1>{{ $a }}</h1>{{    $a   }}{!! $b !!}<p>hi</p>')
    expect(out).toEqual(['{{ $a }}', '{!! $b !!}'])
  })
  it('normalizes whitespace for comparison', () => {
    expect(normalizeBladeRaw('{{    $a   }}')).toBe('{{ $a }}')
  })
})

describe('laravel project filter', () => {
  it('matches Laravel only (case-insensitive)', () => {
    expect(isLaravelProject('Laravel')).toBe(true)
    expect(isLaravelProject('laravel')).toBe(true)
    expect(isLaravelProject('React')).toBe(false)
    expect(isLaravelProject('Unknown')).toBe(false)
    expect(isLaravelProject('')).toBe(false)
    expect(isLaravelProject(undefined)).toBe(false)
  })
})

describe('smart blade analysis (client)', () => {
  const src = [
    '{{-- {{ $in_comment }} --}}',
    '@verbatim {{ $raw }} @endverbatim',
    "@php $greeting = 'Hi'; @endphp",
    "@props(['type', 'subject' => 'Hello'])",
    "@inject('metrics', 'App\\Metrics')",
    '@foreach($employees as $employee)',
    '<p>{{ $loop->iteration }} {{ $employee->name }}</p>',
    '@endforeach',
    '@isset($maybe)<p>{{ $maybe }}</p>@endisset',
    "@error('email')<p>{{ $message }}</p>@enderror",
    '<p>{{ $company_name }} {{ $ghost }}</p>',
  ].join('\n')

  it('finds defined vars and only flags truly-external unknowns', () => {
    const r = analyzeBladeClient(src, ['company_name'])
    expect(r.defined).toEqual(expect.arrayContaining(['greeting', 'employee', 'metrics', 'type', 'subject']))
    expect(r.defined).not.toContain('Hello') // prop default value, not a prop
    const names = r.unknown.map((u) => u.name)
    expect(names).toEqual(expect.arrayContaining(['ghost', 'employees']))
    for (const legit of ['company_name', 'loop', 'maybe', 'message', 'greeting', 'employee', 'metrics', 'type']) {
      expect(names).not.toContain(legit)
    }
    expect(r.unknown.find((u) => u.name === 'ghost')?.raw).toBe('{{ $ghost }}')
  })

  it('ignores comments and verbatim', () => {
    const r = analyzeBladeClient('{{-- {{ $a }} --}} @verbatim {{ $b }} @endverbatim {{ $c }}')
    expect(r.unknown.map((u) => u.name)).toEqual(['c'])
  })
})
describe('email template badges', () => {
  it('renders GENERAL and PROJECT badges', () => {
    const g = render(<GeneralEmailTemplateBadge />)
    expect(g.container.textContent).toContain('GENERAL')
    const p = render(<ProjectEmailTemplateBadge />)
    expect(p.container.textContent).toContain('PROJECT')
  })
})

describe('email template preview', () => {
  it('renders html in sandboxed iframe with mock badge', () => {
    const { container } = render(<EmailTemplatePreview html="<h1>Hi</h1>" mock />)
    const iframe = container.querySelector('iframe')
    expect(iframe).not.toBeNull()
    expect(iframe?.getAttribute('sandbox')).toBe('')
    expect(container.textContent).toContain('Mock data')
  })
})
