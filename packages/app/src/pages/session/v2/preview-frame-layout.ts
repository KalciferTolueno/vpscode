export function previewFrameLayout(input: {
  key: "desktop" | "tablet" | "mobile"
  width: number
  height: number
  availW: number
  availH: number
  fill: boolean
  zoom: number
}) {
  const zoom = Math.max(0.05, input.zoom)
  if (input.fill || input.key === "desktop") {
    return {
      vw: input.availW / zoom,
      vh: input.availH / zoom,
      scale: zoom,
      shellW: input.availW,
      shellH: input.availH,
    }
  }
  const fit = Math.min(input.availW / input.width, input.availH / input.height, 1)
  const scale = Math.max(0.05, fit * zoom)
  return {
    vw: input.width,
    vh: input.height,
    scale,
    shellW: input.width * scale,
    shellH: input.height * scale,
  }
}
