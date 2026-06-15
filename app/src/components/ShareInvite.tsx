import { useState } from 'react'
import { buildJoinUrl } from '../lib/joinLink.js'
import { QrCode } from './QrCode.js'

/** Lobby invite panel: the room code, a copyable join link, and a QR code. */
export function ShareInvite({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const url = buildJoinUrl(window.location.origin, import.meta.env.BASE_URL, code)

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard may be unavailable (e.g. insecure context); ignore.
    }
  }

  return (
    <div className="share">
      <p className="game__hint">
        Share code <strong>{code}</strong> or this link to invite players:
      </p>
      <div className="share__link">
        <input className="share__url" value={url} readOnly aria-label="Join link" />
        <button className="btn" onClick={copy}>
          {copied ? 'Copied!' : 'Copy link'}
        </button>
      </div>
      <QrCode value={url} />
    </div>
  )
}
