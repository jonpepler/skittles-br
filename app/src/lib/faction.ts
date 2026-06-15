/** A stable, vibrant colour for a faction, derived from its id. */
export function factionHue(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) >>> 0
  return h % 360
}

export function factionColour(id: string, lightness = 64, saturation = 70): string {
  return `hsl(${factionHue(id)} ${saturation}% ${lightness}%)`
}
