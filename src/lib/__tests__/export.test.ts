import { describe, expect, it } from 'vitest'
import { generateFilename, generateMarkdown } from '../export'
import type { Idea } from '../types'

function makeIdea(overrides: Partial<Idea> = {}): Idea {
  return {
    id: 'test-id-123',
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    text: 'Test idea text',
    title: null,
    archived: false,
    sourceApp: null,
    markdownPath: null,
    ...overrides,
  }
}

describe('generateMarkdown', () => {
  it('generates valid frontmatter delimiters', () => {
    const md = generateMarkdown(makeIdea())
    const lines = md.split('\n')
    expect(lines[0]).toBe('---')
    expect(lines).toContain('---')
    // Second '---' closes frontmatter
    const secondDashIndex = lines.indexOf('---', 1)
    expect(secondDashIndex).toBeGreaterThan(0)
  })

  it('includes id and timestamps in frontmatter', () => {
    const md = generateMarkdown(makeIdea())
    expect(md).toContain('id: "test-id-123"')
    expect(md).toContain('created:')
    expect(md).toContain('updated:')
  })

  it('omits title from frontmatter when null', () => {
    const md = generateMarkdown(makeIdea({ title: null }))
    expect(md).not.toContain('title:')
  })

  it('includes title in frontmatter when present', () => {
    const md = generateMarkdown(makeIdea({ title: 'My Idea' }))
    expect(md).toContain('title: "My Idea"')
  })

  it('escapes double quotes in title', () => {
    const md = generateMarkdown(makeIdea({ title: 'He said "hello"' }))
    expect(md).toContain('title: "He said \\"hello\\""')
  })

  it('preserves newlines in title (within YAML quoted string)', () => {
    const md = generateMarkdown(makeIdea({ title: 'Line1\nLine2' }))
    expect(md).toContain('title: "Line1\nLine2"')
  })

  it('preserves colons in title', () => {
    const md = generateMarkdown(makeIdea({ title: 'Time: 3pm' }))
    expect(md).toContain('title: "Time: 3pm"')
  })

  it('preserves brackets in title', () => {
    const md = generateMarkdown(makeIdea({ title: '[Important] {urgent}' }))
    expect(md).toContain('title: "[Important] {urgent}"')
  })

  it('preserves single quotes in title', () => {
    const md = generateMarkdown(makeIdea({ title: "It's great" }))
    expect(md).toContain('title: "It\'s great"')
  })

  it('separates frontmatter from body with a blank line', () => {
    const md = generateMarkdown(makeIdea({ text: 'Body content' }))
    expect(md).toContain('---\n\nBody content\n')
  })

  it('ends with a trailing newline', () => {
    const md = generateMarkdown(makeIdea())
    expect(md.endsWith('\n')).toBe(true)
  })

  it('includes idea text as the body', () => {
    const md = generateMarkdown(makeIdea({ text: 'Multi\nline\ncontent' }))
    expect(md).toContain('Multi\nline\ncontent')
  })
})

describe('generateFilename', () => {
  it('follows YYYY-MM-DD_HHmmss_id.md format', () => {
    const idea = makeIdea({
      id: 'my-id',
      createdAt: new Date('2024-03-15T14:30:45').getTime(),
    })
    expect(generateFilename(idea)).toBe('2024-03-15_143045_my-id.md')
  })

  it('zero-pads single-digit month, day, hours, minutes, seconds', () => {
    const idea = makeIdea({
      id: 'test',
      createdAt: new Date('2024-01-05T03:02:01').getTime(),
    })
    expect(generateFilename(idea)).toBe('2024-01-05_030201_test.md')
  })

  it('produces a .md extension', () => {
    expect(generateFilename(makeIdea())).toMatch(/\.md$/)
  })

  it('includes the idea id for uniqueness', () => {
    const idea = makeIdea({ id: 'unique-abc-456' })
    expect(generateFilename(idea)).toContain('unique-abc-456')
  })

  it('produces unique filenames for same title but different ids', () => {
    const idea1 = makeIdea({ id: 'id-1', title: 'Same Title' })
    const idea2 = makeIdea({ id: 'id-2', title: 'Same Title' })
    expect(generateFilename(idea1)).not.toBe(generateFilename(idea2))
  })

  it('produces unique filenames for same id but different timestamps', () => {
    const idea1 = makeIdea({ createdAt: 1700000000000 })
    const idea2 = makeIdea({ createdAt: 1700000001000 })
    expect(generateFilename(idea1)).not.toBe(generateFilename(idea2))
  })

  it('contains no illegal path characters for standard UUID ids', () => {
    const idea = makeIdea({ id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
    const filename = generateFilename(idea)
    // No: \ / : * ? " < > |
    expect(filename).not.toMatch(/[\\/:*?"<>|]/)
  })
})
