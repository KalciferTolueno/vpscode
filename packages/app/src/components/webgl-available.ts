let cached: boolean | undefined

export function webglAvailable() {
  if (cached !== undefined) return cached
  if (typeof document === "undefined") {
    cached = false
    return false
  }
  try {
    const canvas = document.createElement("canvas")
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl")
    cached = !!gl
    gl?.getExtension("WEBGL_lose_context")?.loseContext()
    return cached
  } catch {
    cached = false
    return false
  }
}

export function markWebGLUnavailable() {
  cached = false
}
