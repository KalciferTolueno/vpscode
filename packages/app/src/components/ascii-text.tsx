import { createEffect, mergeProps, onCleanup } from "solid-js"
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

let shared: CanvAscii | null = null

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

function acquire(el: HTMLDivElement, props: Required<ASCIITextProps>) {
  const size = measure(el)
  if (size.width < 1 || size.height < 1) return
  if (shared) {
    shared.attach(el, size.width, size.height)
    shared.load()
    return shared
  }
  const instance = new CanvAscii(optionsOf(props), el, size.width, size.height)
  instance.init()
  instance.load()
  shared = instance
  return instance
}

export function ASCIIText(raw: ASCIITextProps) {
  const props = mergeProps(defaults, raw)

  let container!: HTMLDivElement

  createEffect(() => {
    const el = container
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const width = entry.contentRect.width
      const height = entry.contentRect.height
      if (width < 1 || height < 1) return
      if (!shared) {
        acquire(el, props)
        return
      }
      shared.setSize(width, height)
    })
    ro.observe(el)
    onCleanup(() => ro.disconnect())
  })

  onCleanup(() => shared?.detach())

  return (
    <div
      ref={(el) => {
        container = el
        if (el) acquire(el, props)
      }}
      class="ascii-text-container"
      aria-hidden="true"
    />
  )
}
