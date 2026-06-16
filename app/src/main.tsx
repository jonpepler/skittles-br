import { createRoot } from 'react-dom/client'
import App from './App.js'
import './styles.css'

// StrictMode is intentionally omitted: its double-invoked effects would join
// and leave the Trystero room twice in development, confusing peer presence.
const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')
createRoot(root).render(<App />)
