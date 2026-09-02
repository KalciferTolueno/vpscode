import {
  Clock,
  Color,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
} from "three"
import { markWebGLUnavailable, webglAvailable } from "./webgl-available"

const vertexShader = `
precision highp float;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`

const fragmentShader = `
precision highp float;
uniform vec2 resolution;
uniform float time;
uniform float waveSpeed;
uniform float waveFrequency;
uniform float waveAmplitude;
uniform vec3 waveColor;
uniform vec2 mousePos;
uniform float enableMouseInteraction;
uniform float mouseRadius;
uniform float colorNum;
uniform float pixelSize;

vec4 mod289(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec2 fade(vec2 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }

float cnoise(vec2 P) {
  vec4 Pi = floor(P.xyxy) + vec4(0.0,0.0,1.0,1.0);
  vec4 Pf = fract(P.xyxy) - vec4(0.0,0.0,1.0,1.0);
  Pi = mod289(Pi);
  vec4 ix = Pi.xzxz;
  vec4 iy = Pi.yyww;
  vec4 fx = Pf.xzxz;
  vec4 fy = Pf.yyww;
  vec4 i = permute(permute(ix) + iy);
  vec4 gx = fract(i * (1.0/41.0)) * 2.0 - 1.0;
  vec4 gy = abs(gx) - 0.5;
  vec4 tx = floor(gx + 0.5);
  gx = gx - tx;
  vec2 g00 = vec2(gx.x, gy.x);
  vec2 g10 = vec2(gx.y, gy.y);
  vec2 g01 = vec2(gx.z, gy.z);
  vec2 g11 = vec2(gx.w, gy.w);
  vec4 norm = taylorInvSqrt(vec4(dot(g00,g00), dot(g01,g01), dot(g10,g10), dot(g11,g11)));
  g00 *= norm.x; g01 *= norm.y; g10 *= norm.z; g11 *= norm.w;
  float n00 = dot(g00, vec2(fx.x, fy.x));
  float n10 = dot(g10, vec2(fx.y, fy.y));
  float n01 = dot(g01, vec2(fx.z, fy.z));
  float n11 = dot(g11, vec2(fx.w, fy.w));
  vec2 fade_xy = fade(Pf.xy);
  vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
  return 2.3 * mix(n_x.x, n_x.y, fade_xy.y);
}

const int OCTAVES = 4;
float fbm(vec2 p) {
  float value = 0.0;
  float amp = 1.0;
  float freq = waveFrequency;
  for (int i = 0; i < OCTAVES; i++) {
    value += amp * abs(cnoise(p));
    p *= freq;
    amp *= waveAmplitude;
  }
  return value;
}

float pattern(vec2 p) {
  vec2 p2 = p - time * waveSpeed;
  return fbm(p + fbm(p2));
}

const float bayerMatrix8x8[64] = float[64](
  0.0/64.0, 48.0/64.0, 12.0/64.0, 60.0/64.0, 3.0/64.0, 51.0/64.0, 15.0/64.0, 63.0/64.0,
  32.0/64.0,16.0/64.0, 44.0/64.0, 28.0/64.0, 35.0/64.0,19.0/64.0, 47.0/64.0, 31.0/64.0,
  8.0/64.0, 56.0/64.0, 4.0/64.0, 52.0/64.0, 11.0/64.0,59.0/64.0, 7.0/64.0, 55.0/64.0,
  40.0/64.0,24.0/64.0, 36.0/64.0, 20.0/64.0, 43.0/64.0,27.0/64.0, 39.0/64.0, 23.0/64.0,
  2.0/64.0, 50.0/64.0, 14.0/64.0, 62.0/64.0, 1.0/64.0,49.0/64.0, 13.0/64.0, 61.0/64.0,
  34.0/64.0,18.0/64.0, 46.0/64.0, 30.0/64.0, 33.0/64.0,17.0/64.0, 45.0/64.0, 29.0/64.0,
  10.0/64.0,58.0/64.0, 6.0/64.0, 54.0/64.0, 9.0/64.0,57.0/64.0, 5.0/64.0, 53.0/64.0,
  42.0/64.0,26.0/64.0, 38.0/64.0, 22.0/64.0, 41.0/64.0,25.0/64.0, 37.0/64.0, 21.0/64.0
);

vec3 dither(vec2 frag, vec3 color) {
  vec2 scaledCoord = floor(frag / pixelSize);
  int x = int(mod(scaledCoord.x, 8.0));
  int y = int(mod(scaledCoord.y, 8.0));
  float threshold = bayerMatrix8x8[y * 8 + x] - 0.25;
  float step = 1.0 / max(colorNum - 1.0, 1.0);
  color += threshold * step;
  color = clamp(color - 0.2, 0.0, 1.0);
  return floor(color * (colorNum - 1.0) + 0.5) / max(colorNum - 1.0, 1.0);
}

void main() {
  vec2 pixelated = pixelSize * floor(gl_FragCoord.xy / pixelSize);
  vec2 uv = pixelated / resolution.xy;
  uv -= 0.5;
  uv.x *= resolution.x / resolution.y;
  float f = pattern(uv);
  if (enableMouseInteraction > 0.5) {
    vec2 mouseNDC = (mousePos / resolution - 0.5) * vec2(1.0, -1.0);
    mouseNDC.x *= resolution.x / resolution.y;
    float dist = length(uv - mouseNDC);
    f -= 0.5 * (1.0 - smoothstep(0.0, mouseRadius, dist));
  }
  vec3 col = mix(vec3(0.0), waveColor, f);
  gl_FragColor = vec4(dither(pixelated, col), 1.0);
}
`

export type DitherOptions = {
  waveSpeed: number
  waveFrequency: number
  waveAmplitude: number
  waveColor: [number, number, number]
  colorNum: number
  pixelSize: number
  disableAnimation: boolean
  enableMouseInteraction: boolean
  mouseRadius: number
}

function createRenderer() {
  try {
    return new WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: "low-power",
    })
  } catch {
    markWebGLUnavailable()
    return
  }
}

export function createDither(el: HTMLElement, options: DitherOptions) {
  if (!webglAvailable()) return { dispose() {} }
  const renderer = createRenderer()
  if (!renderer) return { dispose() {} }
  renderer.setPixelRatio(1)
  renderer.setClearColor(0x000000, 0)
  renderer.domElement.style.display = "block"
  renderer.domElement.style.width = "100%"
  renderer.domElement.style.height = "100%"
  el.appendChild(renderer.domElement)

  const uniforms = {
    time: { value: 0 },
    resolution: { value: new Vector2(1, 1) },
    waveSpeed: { value: options.waveSpeed },
    waveFrequency: { value: options.waveFrequency },
    waveAmplitude: { value: options.waveAmplitude },
    waveColor: { value: new Color().setRGB(options.waveColor[0], options.waveColor[1], options.waveColor[2]) },
    mousePos: { value: new Vector2(0, 0) },
    enableMouseInteraction: { value: options.enableMouseInteraction ? 1 : 0 },
    mouseRadius: { value: options.mouseRadius },
    colorNum: { value: options.colorNum },
    pixelSize: { value: options.pixelSize },
  }
  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  })
  const mesh = new Mesh(new PlaneGeometry(2, 2), material)
  const scene = new Scene()
  scene.add(mesh)
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const clock = new Clock()
  const state = { frame: 0, running: true }

  const resize = () => {
    const width = Math.max(1, el.clientWidth)
    const height = Math.max(1, el.clientHeight)
    renderer.setSize(width, height, false)
    uniforms.resolution.value.set(width, height)
  }

  const tick = () => {
    if (!state.running) return
    state.frame = requestAnimationFrame(tick)
    if (document.hidden) return
    if (!options.disableAnimation) uniforms.time.value = clock.getElapsedTime()
    renderer.render(scene, camera)
  }

  const onPointerMove = (event: PointerEvent) => {
    if (!options.enableMouseInteraction) return
    const rect = renderer.domElement.getBoundingClientRect()
    uniforms.mousePos.value.set(event.clientX - rect.left, event.clientY - rect.top)
  }

  const observer = new ResizeObserver(resize)
  observer.observe(el)
  resize()
  if (options.enableMouseInteraction) el.addEventListener("pointermove", onPointerMove)
  tick()

  return {
    dispose() {
      state.running = false
      cancelAnimationFrame(state.frame)
      observer.disconnect()
      if (options.enableMouseInteraction) el.removeEventListener("pointermove", onPointerMove)
      mesh.geometry.dispose()
      material.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
