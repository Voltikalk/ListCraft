/*
 * CRTWarp — из React Bits (https://reactbits.dev/backgrounds/crt-warp, github.com/DavidHDev/react-bits).
 * Copyright (c) 2026 David Haz. Лицензия MIT + Commons Clause — см. THIRD_PARTY_NOTICES.md.
 *
 * Адаптация: шейдер перенесён без изменений, но вместо three.js — чистый WebGL (без зависимостей);
 * цвета передаются в шейдер как есть (sRGB), поэтому фон совпадает с CSS-цветом страницы;
 * при prefers-reduced-motion рисуется один неподвижный кадр; мышь отслеживается на window,
 * чтобы фон реагировал и под текстом, который лежит поверх него.
 */
'use client';

import { useEffect, useRef, type CSSProperties } from 'react';

export interface CRTWarpProps {
  color?: string;
  backgroundColor?: string;
  speed?: number;
  curvature?: number;
  scanlineStrength?: number;
  scanlineFrequency?: number;
  waveAmplitude?: number;
  waveFrequency?: number;
  bloom?: number;
  bloomRadius?: number;
  noise?: number;
  vignette?: number;
  brightness?: number;
  pixelation?: number;
  rgbShift?: number;
  mouseReact?: boolean;
  mouseStrength?: number;
  dpr?: number;
  fps?: number;
  paused?: boolean;
  className?: string;
  style?: CSSProperties;
}

const vertexShader = `
attribute vec2 position;
varying vec2 vUv;

void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentShader = `
precision highp float;

varying vec2 vUv;
uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uBackgroundColor;
uniform float uCurvature;
uniform float uScanlineStrength;
uniform float uScanlineFrequency;
uniform float uWaveAmplitude;
uniform float uWaveFrequency;
uniform float uBloom;
uniform float uBloomRadius;
uniform float uNoise;
uniform float uVignette;
uniform float uBrightness;
uniform float uPixelation;
uniform float uRgbShift;
uniform vec2 uPointer;
uniform float uMouseStrength;
uniform float uMouseReact;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec2 crtCurve(vec2 uv, float radius) {
  vec2 p = (uv - 0.5) * 2.0;
  float safeRadius = max(radius, 1.415);
  float cornerScale = safeRadius / sqrt(max(safeRadius * safeRadius - 2.0, 0.001));
  p = safeRadius * p / sqrt(max(safeRadius * safeRadius - dot(p, p), 0.001));
  p /= cornerScale;
  return p * 0.5 + 0.5;
}

float referencePlasma(vec2 uv, float t) {
  float frequencyScale = max(uWaveFrequency / 2.2, 0.001);
  uv = (uv - 0.5) * frequencyScale + 0.5;

  float scanline = 0.5 - 0.5 * cos(uv.y * 3.14159265 * uScanlineFrequency);
  scanline = mix(1.0, scanline, uScanlineStrength);

  uv *= vec2(80.0, 24.0);
  uv = ceil(uv);
  uv /= vec2(80.0, 24.0);

  float amplitude = uWaveAmplitude / 0.28;
  float field = 0.0;
  field += 0.7 * sin(0.5 * uv.x + t / 5.0);
  field += 3.0 * sin(1.6 * uv.y + t / 5.0);
  field += sin(10.0 * (uv.y * sin(t / 2.0) + uv.x * cos(t / 5.0)) + t / 2.0);

  float cx = uv.x + 0.5 * sin(t / 2.0);
  float cy = uv.y + 0.5 * cos(t / 4.0);
  field += 0.4 * sin(sqrt(100.0 * cx * cx + 100.0 * cy * cy + 1.0) + t);
  field += 0.9 * sin(sqrt(75.0 * cx * cx + 25.0 * cy * cy + 1.0) + t);
  field -= 1.4 * sin(sqrt(256.0 * cx * cx + 25.0 * cy * cy + 1.0) + t);
  field += 0.3 * sin(0.5 * uv.y + uv.x + sin(t));

  return scanline * floor(3.0 * (0.5 + 0.499 * sin(field * amplitude))) / 3.0;
}

void main() {
  vec2 uv = vUv;
  if (uPixelation > 1.001) {
    vec2 cells = max(uResolution / uPixelation, vec2(1.0));
    uv = (floor(uv * cells) + 0.5) / cells;
  }

  float curveRadius = 1.1 + 0.42 / max(uCurvature, 0.001);
  if (uMouseReact > 0.5) {
    curveRadius *= exp(-uPointer.y * uMouseStrength * 0.4);
  }
  vec2 curvedUv = crtCurve(uv, curveRadius);
  if (uMouseReact > 0.5) {
    curvedUv.x -= uPointer.x * uMouseStrength * 0.035;
  }

  float signal = referencePlasma(curvedUv, uTime);
  float radius = 0.01 * uBloomRadius;
  float glow = signal * 0.2;
  glow += referencePlasma(curvedUv + vec2(radius, 0.0), uTime) * 0.12;
  glow += referencePlasma(curvedUv - vec2(radius, 0.0), uTime) * 0.12;
  glow += referencePlasma(curvedUv + vec2(0.0, radius), uTime) * 0.12;
  glow += referencePlasma(curvedUv - vec2(0.0, radius), uTime) * 0.12;
  glow += referencePlasma(curvedUv + vec2(radius), uTime) * 0.08;
  glow += referencePlasma(curvedUv - vec2(radius), uTime) * 0.08;
  glow += referencePlasma(curvedUv + vec2(radius, -radius), uTime) * 0.08;
  glow += referencePlasma(curvedUv + vec2(-radius, radius), uTime) * 0.08;

  float redSignal = referencePlasma(curvedUv + vec2(uRgbShift, 0.0), uTime);
  float blueSignal = referencePlasma(curvedUv - vec2(uRgbShift, 0.0), uTime);
  vec3 channelSignal = vec3(redSignal, signal, blueSignal);
  vec3 waveColor = uColor * (0.3 + signal * 0.7 + glow * uBloom * 0.65);
  waveColor += (channelSignal - signal) * 0.42;

  float edge = clamp(1.0 - dot(vUv - 0.5, vUv - 0.5) * 2.0, 0.0, 1.0);
  float edgeFade = mix(1.0, smoothstep(0.0, 1.0, edge), uVignette);
  float waveMask = clamp(signal * 0.82 + glow * 0.52, 0.0, 1.0) * edgeFade;

  float grain = hash21(gl_FragCoord.xy + vec2(fract(uTime) * 173.0));
  waveColor = max(waveColor * uBrightness, vec3(0.0));
  vec3 color = mix(uBackgroundColor, waveColor, waveMask);
  color += (grain - 0.5) * uNoise;
  gl_FragColor = vec4(max(color, vec3(0.0)), 1.0);
}
`;

const UNIFORMS = [
  'uResolution',
  'uTime',
  'uColor',
  'uBackgroundColor',
  'uCurvature',
  'uScanlineStrength',
  'uScanlineFrequency',
  'uWaveAmplitude',
  'uWaveFrequency',
  'uBloom',
  'uBloomRadius',
  'uNoise',
  'uVignette',
  'uBrightness',
  'uPixelation',
  'uRgbShift',
  'uPointer',
  'uMouseStrength',
  'uMouseReact'
] as const;

type Uniforms = Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;

/** Кадр для режима «уменьшить движение»: узор уже развёрнут, а не стоит в начальной фазе. */
const STILL_TIME = 14;

function hexToRgb(value: string): [number, number, number] {
  let hex = value.trim().replace(/^#/, '');
  if (hex.length === 3) hex = hex.replace(/./g, ch => ch + ch);
  const n = /^[0-9a-f]{6}$/i.test(hex) ? parseInt(hex, 16) : 0xffffff;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('CRTWarp: shader compile error', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function link(gl: WebGLRenderingContext) {
  const vs = compile(gl, gl.VERTEX_SHADER, vertexShader);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragmentShader);
  const program = gl.createProgram();
  if (!vs || !fs || !program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.bindAttribLocation(program, 0, 'position');
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('CRTWarp: program link error', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  const uniforms = Object.fromEntries(UNIFORMS.map(name => [name, gl.getUniformLocation(program, name)])) as Uniforms;
  return { program, uniforms };
}

export default function CRTWarp({
  color = '#c755f7',
  backgroundColor = '#05010a',
  speed = 0.5,
  curvature = 0.25,
  scanlineStrength = 0.25,
  scanlineFrequency = 200,
  waveAmplitude = 0.3,
  waveFrequency = 2.5,
  bloom = 1.5,
  bloomRadius = 1,
  noise = 0.1,
  vignette = 0,
  brightness = 1.25,
  pixelation = 1,
  rgbShift = 0.015,
  mouseReact = true,
  mouseStrength = 0.5,
  dpr = 1,
  fps = 30,
  paused = false,
  className = '',
  style
}: CRTWarpProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wakeRef = useRef<(() => void) | null>(null);
  const settings = {
    color: hexToRgb(color),
    backgroundColor: hexToRgb(backgroundColor),
    speed,
    curvature,
    scanlineStrength,
    scanlineFrequency,
    waveAmplitude,
    waveFrequency,
    bloom,
    bloomRadius,
    noise,
    vignette,
    brightness,
    pixelation,
    rgbShift,
    mouseReact,
    mouseStrength,
    dpr,
    fps: Math.max(1, fps),
    paused
  };
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  });

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const gl = canvas?.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'low-power'
    });
    if (!container || !canvas || !gl) return undefined;

    const linked = link(gl);
    if (!linked) return undefined;
    const { program, uniforms: u } = linked;

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const target = { x: 0, y: 0 };
    const pointer = { x: 0, y: 0 };
    let time = reduce ? STILL_TIME : 0;
    let raf = 0;
    let last = 0;
    let lastFrame = 0;
    let visible = true;

    const render = () => {
      const s = settingsRef.current;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(program);
      gl.uniform2f(u.uResolution, canvas.width, canvas.height);
      gl.uniform1f(u.uTime, time);
      gl.uniform3fv(u.uColor, s.color);
      gl.uniform3fv(u.uBackgroundColor, s.backgroundColor);
      gl.uniform1f(u.uCurvature, s.curvature);
      gl.uniform1f(u.uScanlineStrength, s.scanlineStrength);
      gl.uniform1f(u.uScanlineFrequency, s.scanlineFrequency);
      gl.uniform1f(u.uWaveAmplitude, s.waveAmplitude);
      gl.uniform1f(u.uWaveFrequency, s.waveFrequency);
      gl.uniform1f(u.uBloom, s.bloom);
      gl.uniform1f(u.uBloomRadius, s.bloomRadius);
      gl.uniform1f(u.uNoise, s.noise);
      gl.uniform1f(u.uVignette, s.vignette);
      gl.uniform1f(u.uBrightness, s.brightness);
      gl.uniform1f(u.uPixelation, s.pixelation);
      gl.uniform1f(u.uRgbShift, s.rgbShift);
      gl.uniform2f(u.uPointer, pointer.x, pointer.y);
      gl.uniform1f(u.uMouseStrength, s.mouseStrength);
      gl.uniform1f(u.uMouseReact, s.mouseReact && !reduce ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const frame = (now: number) => {
      raf = 0;
      if (!visible || document.hidden || reduce) return;
      raf = requestAnimationFrame(frame);
      const s = settingsRef.current;
      const interval = 1000 / s.fps;
      if (lastFrame && now - lastFrame < interval) return;
      lastFrame = lastFrame ? now - ((now - lastFrame) % interval) : now;
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      if (!s.paused) time += dt * s.speed;
      pointer.x += (target.x - pointer.x) * 0.08;
      pointer.y += (target.y - pointer.y) * 0.08;
      render();
    };

    const wake = () => {
      if (!raf && visible && !document.hidden && !reduce) raf = requestAnimationFrame(frame);
    };

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, settingsRef.current.dpr);
      canvas.width = Math.max(1, Math.round(container.clientWidth * ratio));
      canvas.height = Math.max(1, Math.round(container.clientHeight * ratio));
      render();
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const x = (event.clientX - rect.left) / Math.max(rect.width, 1);
      const y = (event.clientY - rect.top) / Math.max(rect.height, 1);
      if (x < 0 || x > 1 || y < 0 || y > 1) target.x = target.y = 0;
      else {
        target.x = x * 2 - 1;
        target.y = -(y * 2 - 1);
      }
    };
    const onPointerLeave = () => {
      target.x = target.y = 0;
    };
    const onVisibility = () => {
      last = lastFrame = 0;
      wake();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    const intersection = new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      if (visible) {
        last = lastFrame = 0;
        wake();
      }
    });
    intersection.observe(container);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onPointerLeave);
    document.addEventListener('visibilitychange', onVisibility);
    resize();
    wake();

    let lastDpr = settingsRef.current.dpr;
    wakeRef.current = () => {
      if (settingsRef.current.dpr !== lastDpr) {
        lastDpr = settingsRef.current.dpr;
        resize();
      } else if (!raf) render();
      wake();
    };

    return () => {
      cancelAnimationFrame(raf);
      wakeRef.current = null;
      resizeObserver.disconnect();
      intersection.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      document.documentElement.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      gl.deleteProgram(program);
      gl.deleteBuffer(buffer);
    };
  }, []);

  useEffect(() => {
    wakeRef.current?.();
  });

  return (
    <div
      ref={containerRef}
      className={['relative h-full w-full overflow-hidden', className].filter(Boolean).join(' ')}
      // Пока WebGL не нарисовал первый кадр (или недоступен), виден просто цвет фона.
      style={{ backgroundColor, ...style }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" aria-hidden="true" />
    </div>
  );
}
