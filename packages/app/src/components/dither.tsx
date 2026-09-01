import { createEffect, createSignal, mergeProps, onCleanup } from "solid-js"
import { createDither, type DitherOptions } from "./dither-engine"

export type DitherProps = Partial<DitherOptions>

const defaults: DitherOptions = {
  waveSpeed: 0.01,
  waveFrequency: 3.1,
  waveAmplitude: 0.3,
  waveColor: [0.5, 0.5, 0.5],
  colorNum: 3.8,
  pixelSize: 2,
  disableAnimation: false,
  enableMouseInteraction: false,
  mouseRadius: 0.3,
}

export function Dither(raw: DitherProps) {
  const props = mergeProps(defaults, raw)
  const [container, setContainer] = createSignal<HTMLDivElement>()

  createEffect(() => {
    const el = container()
    if (!el) return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const instance = createDither(el, {
      waveSpeed: props.waveSpeed,
      waveFrequency: props.waveFrequency,
      waveAmplitude: props.waveAmplitude,
      waveColor: props.waveColor,
      colorNum: props.colorNum,
      pixelSize: props.pixelSize,
      disableAnimation: props.disableAnimation || reduce,
      enableMouseInteraction: props.enableMouseInteraction,
      mouseRadius: props.mouseRadius,
    })
    onCleanup(() => instance.dispose())
  })

  return <div ref={setContainer} class="absolute inset-0 size-full" aria-hidden="true" />
}
