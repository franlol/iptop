import { useEffect, useRef, useState } from "react"

export function usePoll<T>(fn: () => Promise<T>, intervalMs: number, initial: T): T {
  const [value, setValue] = useState<T>(initial)
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(
    function startPolling() {
      let cancelled = false
      let running = false
      const tick = async () => {
        if (running) return
        running = true
        try {
          const next = await fnRef.current()
          if (!cancelled) setValue(next)
        } catch {
          // keep the last good sample
        }
        running = false
      }
      tick()
      const id = setInterval(tick, intervalMs)
      return () => {
        cancelled = true
        clearInterval(id)
      }
    },
    [intervalMs],
  )

  return value
}
