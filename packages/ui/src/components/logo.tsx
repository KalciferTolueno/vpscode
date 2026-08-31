import { type ComponentProps } from "solid-js"

const markShadow = "M4.6 12.2 8 18.5 11.4 12.2 9.45 12.2 8 14.85 6.55 12.2Z"
const markShape =
  "M0.8 2.2h5.35L8 9.35 9.85 2.2h5.35L9.25 18.8H6.75L0.8 2.2Zm3.95 2.35L8 13.4l3.25-8.85H9.55L8 8.7 6.45 4.55H4.75Z"

export const Mark = (props: { class?: string }) => {
  return (
    <svg
      data-component="logo-mark"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 16 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path data-slot="logo-logo-mark-shadow" d={markShadow} fill="var(--icon-weak-base)" />
      <path data-slot="logo-logo-mark-v" fill-rule="evenodd" d={markShape} fill="var(--icon-strong-base)" />
    </svg>
  )
}

export const Splash = (props: Pick<ComponentProps<"svg">, "ref" | "class">) => {
  return (
    <svg
      ref={props.ref}
      data-component="logo-splash"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 80 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M23 61 40 92.5 57 61 47.25 61 40 74.25 32.75 61Z" fill="var(--icon-base)" />
      <path
        fill-rule="evenodd"
        d="M4 11h26.75L40 46.75 49.25 11H76L46.25 94H33.75L4 11Zm19.75 11.75L40 67l16.25-44.25H47.75L40 43.5 32.25 22.75H23.75Z"
        fill="var(--icon-strong-base)"
      />
    </svg>
  )
}

export const Logo = (props: { class?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 234 42"
      fill="none"
      role="img"
      aria-label="VPS Code"
      classList={{ [props.class ?? ""]: !!props.class }}
    >
      <g transform="translate(0 3) scale(1.8)">
        <path d={markShadow} fill="var(--icon-weak-base)" />
        <path fill-rule="evenodd" d={markShape} fill="var(--icon-base)" />
      </g>
      <text
        x="40"
        y="31"
        fill="var(--icon-strong-base)"
        font-family="var(--font-family-mono)"
        font-size="28"
        font-weight="700"
        letter-spacing="0.5"
      >
        VPS Code
      </text>
    </svg>
  )
}
