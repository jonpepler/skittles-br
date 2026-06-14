import { useMemo } from 'react'
import { generateFlag } from '../generators/flag.js'

/** Renders a procedurally generated flag for the given seed. */
export function FlagImage({ seed, className }: { seed: string; className?: string }) {
  // The SVG is generated locally from our own code, so inlining it is safe.
  const svg = useMemo(() => generateFlag(seed).svg, [seed])
  return (
    <div
      className={className}
      role="img"
      aria-label="civilisation flag"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
