import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { initAudio } from './audio.js'
import './index.css'

// Unlock / resume audio on the very first touch (capture phase, before any handler plays a sound).
document.addEventListener('pointerdown', initAudio, { capture: true, passive: true })

// Kill pull-to-refresh, rubber-banding, pinch zoom, long-press menus and double-tap zoom.
const stop = (e) => e.preventDefault()
document.addEventListener('touchmove', stop, { passive: false })
document.addEventListener('gesturestart', stop, { passive: false })
document.addEventListener('contextmenu', stop)
document.addEventListener('dblclick', stop)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
