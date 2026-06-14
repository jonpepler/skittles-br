import { describe, it, expect } from 'vitest'
import { generateFlag, FLAG_DIMENSIONS, FLAG_PALETTE } from './flag.js'

describe('generateFlag', () => {
  it('is deterministic: same seed yields an identical SVG', () => {
    expect(generateFlag('nation-1').svg).toEqual(generateFlag('nation-1').svg)
  })

  it('different seeds (almost always) yield different SVGs', () => {
    const svgs = new Set(
      Array.from({ length: 50 }, (_, i) => generateFlag(i).svg)
    )
    // Allow the odd collision but expect broad variety.
    expect(svgs.size).toBeGreaterThan(40)
  })

  it('produces a well-formed SVG document of the right size', () => {
    const { svg } = generateFlag('well-formed')
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg.endsWith('</svg>')).toBe(true)
    expect(svg).toContain(`width="${FLAG_DIMENSIONS.width}"`)
    expect(svg).toContain(`height="${FLAG_DIMENSIONS.height}"`)
    expect(svg).toContain('viewBox="0 0 750 500"')
  })

  it('draws a background plus 2–3 layers', () => {
    for (let i = 0; i < 100; i++) {
      const { layers } = generateFlag(`layers-${i}`)
      expect(layers).toBeGreaterThanOrEqual(2)
      expect(layers).toBeLessThanOrEqual(3)
    }
  })

  it('never emits NaN/undefined/Infinity in coordinates', () => {
    for (let i = 0; i < 200; i++) {
      const { svg } = generateFlag(`clean-${i}`)
      expect(svg).not.toMatch(/NaN|undefined|Infinity/)
    }
  })

  it('balances every opened <g> group', () => {
    for (let i = 0; i < 100; i++) {
      const { svg } = generateFlag(`groups-${i}`)
      const opens = (svg.match(/<g[\s>]/g) ?? []).length
      const closes = (svg.match(/<\/g>/g) ?? []).length
      expect(opens).toEqual(closes)
    }
  })

  it('only uses colours from the palette', () => {
    const allowed = new Set<string>(FLAG_PALETTE)
    for (let i = 0; i < 50; i++) {
      const { svg } = generateFlag(`palette-${i}`)
      const hexes = svg.match(/#[0-9a-f]{6}/g) ?? []
      for (const hex of hexes) expect(allowed.has(hex)).toBe(true)
    }
  })

  it('starts with a full-size background rect', () => {
    const { svg } = generateFlag('bg')
    expect(svg).toMatch(
      /<svg[^>]*><rect x="0" y="0" width="750" height="500"/
    )
  })
})
