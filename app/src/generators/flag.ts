/**
 * Procedural SVG flag generator.
 *
 * Ported from the Go `flag-generator` service (flagimage/flagimage.go). The
 * structure is preserved: a background colour plus 2–3 random layers, where a
 * layer is one of {filled circle, empty circle, rectangle, triangle, symbol},
 * and a symbol is one of {star, signal, eye}. "Feature points" accumulate as
 * layers are drawn so later layers tend to anchor onto earlier ones.
 *
 * Output is NOT byte-identical to the Go service (different PRNG), but it is
 * fully deterministic: the same seed always yields the same flag, which is what
 * the peer-to-peer model relies on.
 */
import { Rng } from '../lib/rng.js'

const RATIO = 1.5
const FLAG_HEIGHT = 500
const FLAG_WIDTH = Math.round(FLAG_HEIGHT * RATIO) // 750

/** Palette carried over verbatim from the Go service (sRGB → hex). */
const PALETTE = [
  '#ce1126',
  '#00335b',
  '#fcd116',
  '#108042',
  '#ff8430',
  '#75aadb',
  '#000000',
  '#ffffff'
] as const

interface Coord {
  x: number
  y: number
}

const CORNER_POINTS: readonly Coord[] = [
  { x: 0, y: 0 },
  { x: FLAG_WIDTH, y: 0 },
  { x: FLAG_WIDTH / 2, y: 0 },
  { x: FLAG_WIDTH / 2, y: FLAG_HEIGHT },
  { x: FLAG_WIDTH / 3, y: 0 },
  { x: FLAG_WIDTH / 3, y: FLAG_HEIGHT },
  { x: (2 * FLAG_WIDTH) / 3, y: 0 },
  { x: (2 * FLAG_WIDTH) / 3, y: FLAG_HEIGHT },
  { x: 0, y: FLAG_HEIGHT },
  { x: 0, y: FLAG_HEIGHT / 2 },
  { x: FLAG_WIDTH, y: FLAG_HEIGHT / 2 },
  { x: FLAG_WIDTH, y: FLAG_HEIGHT }
]

export interface Flag {
  /** Complete, standalone SVG document string. */
  svg: string
  /** Number of layers drawn on top of the background (2 or 3). */
  layers: number
}

/**
 * Minimal SVG builder. Mirrors the subset of the svgo API the Go service used,
 * but emits a clean, embeddable document (with xmlns + viewBox).
 */
class Svg {
  private parts: string[] = []

  constructor(
    private readonly width: number,
    private readonly height: number
  ) {}

  rect(x: number, y: number, w: number, h: number, style: string): void {
    this.parts.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" style="${style}"/>`
    )
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, style: string): void {
    this.parts.push(
      `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" style="${style}"/>`
    )
  }

  polygon(xs: number[], ys: number[], style: string): void {
    const points = xs.map((x, i) => `${x},${ys[i]}`).join(' ')
    this.parts.push(`<polygon points="${points}" style="${style}"/>`)
  }

  path(d: string, style: string): void {
    this.parts.push(`<path d="${d}" style="${style}"/>`)
  }

  groupStart(attrs = ''): void {
    this.parts.push(`<g${attrs ? ' ' + attrs : ''}>`)
  }

  groupEnd(): void {
    this.parts.push('</g>')
  }

  toString(): string {
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" ` +
      `height="${this.height}" viewBox="0 0 ${this.width} ${this.height}">` +
      this.parts.join('') +
      '</svg>'
    )
  }
}

function abs(n: number): number {
  return Math.abs(n)
}

function distance(a: Coord, b: Coord): Coord {
  return { x: b.x - a.x, y: b.y - a.y }
}

function coordEquals(a: Coord, b: Coord): boolean {
  return a.x === b.x && a.y === b.y
}

function coordInArray(arr: readonly Coord[], p: Coord): boolean {
  return arr.some((v) => coordEquals(v, p))
}

function isFlagSizeRect(a: Coord, b: Coord): boolean {
  const v = distance(a, b)
  return v.x === FLAG_WIDTH && v.y === FLAG_HEIGHT
}

function pointsOnSameAxis(points: Coord[]): boolean {
  const allEqual = (arr: number[]): boolean => arr.every((v) => v === arr[0])
  return allEqual(points.map((p) => p.x)) || allEqual(points.map((p) => p.y))
}

function midpoint(points: Coord[]): Coord {
  const sum = points.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 }
  )
  const count = points.length
  return { x: Math.trunc(sum.x / count), y: Math.trunc(sum.y / count) }
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/** Encapsulates a single flag drawing so feature-point state isn't shared. */
class FlagPainter {
  private featurePoints: Coord[]

  constructor(
    private readonly rng: Rng,
    private readonly svg: Svg
  ) {
    this.featurePoints = [{ x: FLAG_WIDTH / 2, y: FLAG_HEIGHT / 2 }]
  }

  private randomCorner(): Coord {
    return this.rng.pick(CORNER_POINTS)
  }

  private randomFeaturePoint(): Coord {
    return this.rng.pick(this.featurePoints)
  }

  private addFeaturePoint(...points: Coord[]): void {
    this.featurePoints.push(...points)
  }

  addBackground(colour: string): void {
    this.svg.rect(0, 0, FLAG_WIDTH, FLAG_HEIGHT, `fill:${colour}`)
  }

  addRandomLayer(colour: string): void {
    const layers = [
      () => this.addFilledCircle(colour),
      () => this.addEmptyCircle(colour),
      () => this.addRect(colour),
      () => this.addTriangle(colour),
      () => this.addSymbol(colour)
    ]
    this.rng.pick(layers)()
  }

  private addFilledCircle(colour: string): void {
    const p = this.randomFeaturePoint()
    const r = this.rng.int(FLAG_HEIGHT / 2)
    this.svg.ellipse(p.x, p.y, r, r, `fill:${colour};stroke:${colour}`)
  }

  private addEmptyCircle(colour: string): void {
    const p = this.randomFeaturePoint()
    const r = this.rng.int(FLAG_HEIGHT / 2)
    this.svg.ellipse(
      p.x,
      p.y,
      r,
      r,
      `fill:none;stroke:${colour};stroke-width:100;`
    )
  }

  private addRect(colour: string): void {
    const a = this.randomCorner()
    if (a.x === FLAG_WIDTH) a.x = 0
    if (a.y === FLAG_HEIGHT) a.y = 0

    let b = this.randomCorner()
    // Guard against pathological seeds: the Go version loops unbounded.
    let guard = 0
    while (
      (a.x >= b.x || a.y >= b.y || isFlagSizeRect(a, b)) &&
      guard++ < 100
    ) {
      b = this.randomCorner()
    }

    const bVector = distance(a, b)
    this.addFeaturePoint({
      x: a.x + Math.trunc(bVector.x / 2),
      y: a.y + Math.trunc(bVector.y / 2)
    })
    this.svg.rect(
      a.x,
      a.y,
      abs(bVector.x),
      abs(bVector.y),
      `fill:${colour};stroke:${colour}`
    )
  }

  private addTriangle(colour: string): void {
    const tri: Coord[] = []
    let guard = 0
    while (tri.length < 3 && guard++ < 100) {
      const p = this.randomCorner()
      if (coordInArray(tri, p)) continue
      if (tri.length === 2 && pointsOnSameAxis([...tri, p])) continue
      tri.push({ ...p })
    }

    this.addFeaturePoint(midpoint(tri))
    this.svg.polygon(
      tri.map((c) => c.x),
      tri.map((c) => c.y),
      `fill:${colour};stroke:${colour}`
    )
  }

  private addSymbol(colour: string): void {
    const size = this.rng.int(FLAG_HEIGHT / 2 - 50) + 50
    const p = this.randomFeaturePoint()
    const symbols = [
      () => this.addStar(colour, p, size),
      () => this.addSignal(colour, p, size),
      () => this.addEye(colour, p, size)
    ]
    this.svg.groupStart(`id="symbol_at_${p.x}_${p.y}"`)
    this.rng.pick(symbols)()
    this.svg.groupEnd()
  }

  private addStar(colour: string, p: Coord, size: number): void {
    const numberOfVertices = 10
    const outerRadius = size / 2
    const innerRadius = outerRadius * 0.4
    const rotateOffset = -90
    let path = ''
    let outer = true
    for (let d = 0; d < 360; d += 360 / numberOfVertices) {
      if (d === 0) {
        path += `M ${p.x} ${p.y - outerRadius} `
      } else {
        const r = outer ? outerRadius : innerRadius
        const x = p.x + Math.cos(degreesToRadians(d + rotateOffset)) * r
        const y = p.y + Math.sin(degreesToRadians(d + rotateOffset)) * r
        path += `L ${x} ${y} `
      }
      outer = !outer
    }
    this.svg.path(path, `fill:${colour}`)
  }

  private addSignal(colour: string, p: Coord, size: number): void {
    const xRatio = 0.9705063291
    const d =
      'M0, 0v1h-0.1700151082v-1h0.1700151082zm-0.436786782,1h0.1700151082v-0.801632968h-0.1700151082v0.801632968zm-0.2668681089,0h0.1700151082v-0.5325147064h-0.1700151082v0.5325147064zm-0.2668359639,0h0.1700151082v-0.3554598348h-0.1700151082v0.3554598348z'
    this.svg.groupStart(
      `transform="translate(${p.x + (xRatio * size) / 2}, ${p.y - size / 2}) scale(${size})"`
    )
    this.svg.path(d, `fill:${colour}`)
    this.svg.groupEnd()
  }

  private addEye(colour: string, p: Coord, size: number): void {
    const d =
      'M 0 0 l -0.030200308166409864 -0.030508474576271188 c -0.10765279917822293 -0.10991268618387265 -0.24175654853620956 -0.24673857216230102 -0.4572675911658963 -0.24673857216230102 c -0.21422701592193122 0 -0.35742167437082695 0.14535182331792504 -0.46204417051874686 0.2515151515151516 l -0.025475089881869546 0.02573189522342065 c -0.015767847971237803 0.015767847971237803 -0.015767847971237803 0.04124293785310735 0 0.05695942475603493 l 0.020595788392398565 0.02069851052901901 c 0.10539291217257321 0.10642013353877762 0.24971751412429383 0.2521314843348742 0.46692347200821777 0.2521314843348742 c 0.21828454031843864 0 0.35336414997431953 -0.1369286081150488 0.46163328197226505 -0.24689265536723168 l 0.02583461736004109 -0.025988700564971753 c 0.015767847971237803 -0.015665125834617363 0.015767847971237803 -0.04114021571648691 0 -0.05690806368772472 z m -0.48746789933230616 0.2492552645095018 c -0.17940421160760145 0 -0.29809964047252185 -0.11576784797123782 -0.40231124807396 -0.2208525937339497 c 0.10451977401129946 -0.10595788392398564 0.22321520287621985 -0.2250642013353878 0.40231124807396 -0.2250642013353878 c 0.18161273754494095 0 0.2974833076527992 0.11818181818181821 0.39979455572675915 0.22249614791987676 l 0.002516692347200822 0.0026194144838212635 c -0.10246533127889061 0.10390344119157681 -0.21890087313816128 0.2208012326656395 -0.40231124807396 0.2208012326656395 z '
    this.svg.groupStart(
      `transform="translate(${p.x + size / 2 - 2}, ${p.y - 3}) scale(${size})"`
    )
    this.svg.path(d, `fill:${colour}`)
    this.svg.groupEnd()
  }
}

/**
 * Generate a procedural SVG flag for the given seed.
 *
 * @param seed Number or string seed. The same seed always produces the same
 *             flag. Omit for a non-deterministic flag.
 */
export function generateFlag(seed?: number | string): Flag {
  const rng = new Rng(seed)
  const layers = 2 + rng.int(2) // 2 or 3
  const svg = new Svg(FLAG_WIDTH, FLAG_HEIGHT)
  const painter = new FlagPainter(rng, svg)

  painter.addBackground(rng.pick(PALETTE))
  for (let i = 0; i < layers; i++) {
    painter.addRandomLayer(rng.pick(PALETTE))
  }

  return { svg: svg.toString(), layers }
}

export const FLAG_DIMENSIONS = { width: FLAG_WIDTH, height: FLAG_HEIGHT } as const
export { PALETTE as FLAG_PALETTE }
