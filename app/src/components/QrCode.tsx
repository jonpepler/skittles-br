import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

/** Renders a scannable QR code (as inline SVG) for the given value. */
export function QrCode({ value, size = 160 }: { value: string; size?: number }) {
  const [svg, setSvg] = useState('')

  useEffect(() => {
    let active = true
    QRCode.toString(value, { type: 'svg', margin: 1, width: size })
      .then((out) => {
        if (active) setSvg(out)
      })
      .catch(() => {
        if (active) setSvg('')
      })
    return () => {
      active = false
    }
  }, [value, size])

  return (
    <div
      className="qr"
      role="img"
      aria-label="Join QR code"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
