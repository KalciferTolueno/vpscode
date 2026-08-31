let pointerInitiated = false
let listening = false

function ensureInputListeners() {
  if (listening || typeof window === "undefined") return
  listening = true
  window.addEventListener("pointerdown", () => {
    pointerInitiated = true
  }, true)
  window.addEventListener("keydown", () => {
    pointerInitiated = false
  }, true)
}

export function shouldViewTransition(input: {
  reducedMotion: boolean
  supported: boolean
  pointerInitiated: boolean
}) {
  if (input.reducedMotion) return false
  if (!input.supported) return false
  return input.pointerInitiated
}

export function runViewTransition(update: () => void) {
  ensureInputListeners()
  if (typeof document === "undefined") {
    update()
    return
  }
  const supported = typeof document.startViewTransition === "function"
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  if (!shouldViewTransition({ reducedMotion, supported, pointerInitiated })) {
    update()
    return
  }
  document.startViewTransition(update).finished.catch(() => {})
}
