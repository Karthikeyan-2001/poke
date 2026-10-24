import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { keyDown, keyUp } from '../audio.js'
import { buzz, H } from '../haptics.js'
import { bump } from '../store.js'

// Row 0: deep linear thock · Row 1: tactile · Row 2: clicky
const COLORS = [
  ['#ECE6D6', '#2F3B4E', '#E8693C'],
  ['#86AE92', '#E9C25E', '#5C6BF2'],
  ['#CFCFC8', '#C9433A', '#2C2C2E'],
]

const DOWN = { type: 'spring', stiffness: 2200, damping: 70 }
const UP = { type: 'spring', stiffness: 900, damping: 20, mass: 0.6 }

function Key({ color, row, homing }) {
  const [pressed, setPressed] = useState(false)
  const held = useRef(false)

  const down = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    if (held.current) return
    held.current = true
    setPressed(true)
    keyDown(row)
    buzz(row === 2 ? H.keyClicky : H.key)
    bump()
  }
  const up = () => {
    if (!held.current) return
    held.current = false
    setPressed(false)
    keyUp(row)
    buzz(H.keyUp)
  }

  return (
    <div
      data-nopage
      className="keywell"
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
      onLostPointerCapture={up}
    >
      <div className="keyskirt" style={{ '--c': color }} />
      <motion.div className="keycap" style={{ '--c': color }} animate={{ y: pressed ? 9 : 0 }} transition={pressed ? DOWN : UP}>
        <div className="keydish">
          {homing && (
            <span
              className="absolute bottom-[22%] left-1/2 h-[5px] w-[22%] -translate-x-1/2 rounded-full"
              style={{ background: 'rgba(255,255,255,.35)', boxShadow: '0 1px 1px rgba(0,0,0,.25)' }}
            />
          )}
        </div>
      </motion.div>
    </div>
  )
}

export default function Keycaps() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="keygrid">
        {COLORS.map((row, r) => row.map((c, i) => <Key key={`${r}-${i}`} color={c} row={r} homing={r === 1 && i === 1} />))}
      </div>
    </div>
  )
}
