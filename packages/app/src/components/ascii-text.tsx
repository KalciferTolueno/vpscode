import { createEffect, createSignal, mergeProps, onCleanup } from "solid-js"
import { CanvAscii, type CanvAsciiOptions } from "./ascii-text-engine"
import "./ascii-text.css"

export interface ASCIITextProps {
  text?: string
  asciiFontSize?: number
  textFontSize?: number
  textColor?: string
  planeBaseHeight?: number
  enableWaves?: boolean
}

const defaults = {
  text: "vpscode",
  asciiFontSize: 8,
  textFontSize: 200,
  textColor: "#fdf9f3",
  planeBaseHeight: 8,
  enableWaves: true,
}

function optionsOf(props: Required<ASCIITextProps>): CanvAsciiOptions {
  return {
    text: props.text,
    asciiFontSize: props.asciiFontSize,
    textFontSize: props.textFontSize,
    textColor: props.textColor,
    planeBaseHeight: props.planeBaseHeight,
    enableWaves: props.enableWaves,
  }
}

function measure(el: HTMLDivElement) {
  const rect = el.getBoundingClientRect()
  return {
    width: rect.width || el.clientWidth,
    height: rect.height || el.clientHeight,
  }
}

function createEngine(el: HTMLDivElement, props: Required<ASCIITextProps>) {
  const size = measure(el)
  if (size.width < 1 || size.height < 1) return
  try {
    const instance = new CanvAscii(optionsOf(props), el, size.width, size.height)
    instance.init()
    instance.load()
    return instance
  } catch {
    return
  }
}

export function ASCIIText(raw: ASCIITextProps) {
  const props = mergeProps(defaults, raw)
  const [container, setContainer] = createSignal<HTMLDivElement>()

  createEffect(() => {
    const el = container()
    if (!el) return
    let instance = createEngine(el, props)
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const width = entry.contentRect.width
      const height = entry.contentRect.height
      if (width < 1 || height < 1) return
      if (!instance) {
        instance = createEngine(el, props)
        return
      }
      instance.setSize(width, height)
    })
    ro.observe(el)
    onCleanup(() => {
      ro.disconnect()
      instance?.dispose()
    })
  })

  return (
    <div ref={setContainer} class="ascii-text-container" aria-hidden="true">
      <div class="ascii-text-fallback">{props.text}</div>
    </div>
  )
}
