// ═══════════════════════════════════════════════════════════════════════════
// Minimal WebGL2 layer — programs, fullscreen quads, render targets.
//
// Ported from PRISM's gl.js (credit: Charles's zero-dependency GL core),
// trimmed to what the Kinetica backdrop needs: no 3D math, no video textures.
// One quirk fixed for React life-cycles: the fullscreen-triangle VAO is cached
// PER CONTEXT (WeakMap), so a remounted canvas never draws with a dead VAO.
// ═══════════════════════════════════════════════════════════════════════════

export function initGL(canvas: HTMLCanvasElement): WebGL2RenderingContext | null {
  return canvas.getContext("webgl2", {
    antialias: false,
    alpha: true, // the backdrop composites under the DOM art layer
    preserveDrawingBuffer: false,
    powerPreference: "high-performance",
  });
}

export const QUAD_VS = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }
`;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    const lines = src.split("\n").map((l, i) => `${i + 1}: ${l}`).join("\n");
    throw new Error(`Shader compile error:\n${log}\n${lines}`);
  }
  return sh;
}

export class Program {
  private gl: WebGL2RenderingContext;
  private prog: WebGLProgram;
  private locs = new Map<string, WebGLUniformLocation | null>();
  private texUnit = 0;

  constructor(gl: WebGL2RenderingContext, vsSrc: string, fsSrc: string) {
    this.gl = gl;
    const vs = compile(gl, gl.VERTEX_SHADER, vsSrc);
    const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc);
    this.prog = gl.createProgram()!;
    gl.attachShader(this.prog, vs);
    gl.attachShader(this.prog, fs);
    gl.linkProgram(this.prog);
    if (!gl.getProgramParameter(this.prog, gl.LINK_STATUS)) {
      throw new Error("Program link error: " + gl.getProgramInfoLog(this.prog));
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
  }
  private loc(name: string) {
    if (!this.locs.has(name)) this.locs.set(name, this.gl.getUniformLocation(this.prog, name));
    return this.locs.get(name)!;
  }
  use() { this.gl.useProgram(this.prog); this.texUnit = 0; return this; }
  f(name: string, v: number) { const l = this.loc(name); if (l) this.gl.uniform1f(l, v); return this; }
  i(name: string, v: number) { const l = this.loc(name); if (l) this.gl.uniform1i(l, v); return this; }
  v2(name: string, x: number, y: number) { const l = this.loc(name); if (l) this.gl.uniform2f(l, x, y); return this; }
  v3(name: string, x: number, y: number, z: number) { const l = this.loc(name); if (l) this.gl.uniform3f(l, x, y, z); return this; }
  tex(name: string, texture: WebGLTexture) {
    const l = this.loc(name);
    if (l) {
      const unit = this.texUnit++;
      this.gl.activeTexture(this.gl.TEXTURE0 + unit);
      this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
      this.gl.uniform1i(l, unit);
    }
    return this;
  }
  dispose() { this.gl.deleteProgram(this.prog); }
}

// One fullscreen triangle per context — survives React remounts.
const quadVaos = new WeakMap<WebGL2RenderingContext, WebGLVertexArrayObject>();
export function drawQuad(gl: WebGL2RenderingContext) {
  let vao = quadVaos.get(gl);
  if (!vao) {
    vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    quadVaos.set(gl, vao);
  }
  gl.bindVertexArray(vao);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindVertexArray(null);
}

export interface RT { fb: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number }

export function createRT(gl: WebGL2RenderingContext, w: number, h: number): RT {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fb = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fb, tex, w, h };
}

export function disposeRT(gl: WebGL2RenderingContext, rt: RT | null) {
  if (!rt) return;
  gl.deleteFramebuffer(rt.fb);
  gl.deleteTexture(rt.tex);
}

export function bindRT(gl: WebGL2RenderingContext, rt: RT | null) {
  if (rt) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, rt.fb);
    gl.viewport(0, 0, rt.w, rt.h);
  } else {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  }
}

// Shared GLSL snippets (PRISM's noise kit — hash/value-noise/fbm/hsl)
export const GLSL_NOISE = `
float hash21(vec2 p) { p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
vec2 hash22(vec2 p) { float n = hash21(p); return vec2(n, hash21(p + n)); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), u.x),
             mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) { v += a * vnoise(p); p = rot * p * 2.03; a *= 0.5; }
  return v;
}
vec3 hsl2rgb(vec3 c) {
  vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return c.z + c.y * (rgb - 0.5) * (1.0 - abs(2.0 * c.z - 1.0));
}
`;
