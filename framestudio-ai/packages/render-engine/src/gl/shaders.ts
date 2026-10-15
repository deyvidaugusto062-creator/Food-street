/** Shaders GLSL ES 3.00 do pipeline de processamento de camadas. */

export const VERT = `#version 300 es
precision highp float;
const vec2 P[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
out vec2 vUv;
void main() {
  vec2 p = P[gl_VertexID];
  vUv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}`;

const HEADER = `#version 300 es
precision highp float;
precision highp sampler3D;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTex;
uniform vec2 uRes;
uniform float uTime;
uniform float uFrame;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
`;

/** Recorte da fonte + correção de cor completa (exposição, balanço, níveis, curvas, HSL, LUT). */
export const COLOR_FRAG = `${HEADER}
uniform vec4 uSrcRect; // x, y, w, h em UV
uniform float uExposure, uBrightness, uContrast, uSaturation, uVibrance, uTemperature, uTint, uHue;
uniform float uShadows, uHighlights, uBlacks, uWhites, uGamma;
uniform sampler2D uCurves; uniform bool uUseCurves;
uniform vec4 uHsl[8]; uniform bool uUseHsl;
uniform sampler3D uLut; uniform bool uUseLut; uniform float uLutSize; uniform float uLutIntensity;

vec3 toLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 toSrgb(vec3 c) { c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}
vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}
float hueDist(float a, float b) { float d = abs(a - b); return min(d, 1.0 - d); }

void main() {
  vec2 uv = uSrcRect.xy + vUv * uSrcRect.zw;
  vec4 src = texture(uTex, uv);
  vec3 c = src.rgb;
  // Exposição em espaço linear (EV).
  c = toSrgb(toLinear(c) * exp2(uExposure));
  // Balanço de branco.
  c *= vec3(1.0 + 0.25 * uTemperature, 1.0 - 0.18 * uTint, 1.0 - 0.25 * uTemperature);
  // Pretos e brancos (níveis).
  float bp = -0.15 * uBlacks;
  float wp = 1.0 - 0.15 * uWhites;
  c = (c - bp) / max(wp - bp, 1e-3);
  // Sombras e realces ponderados pela luminância.
  float l = luma(c);
  c += uShadows * 0.35 * (1.0 - smoothstep(0.0, 0.55, l));
  c += uHighlights * 0.35 * smoothstep(0.45, 1.0, l);
  // Contraste e brilho.
  c = (c - 0.5) * (1.0 + uContrast) + 0.5;
  c += uBrightness * 0.35;
  // Gamma.
  c = pow(max(c, 0.0), vec3(1.0 / uGamma));
  // Saturação e vibrance.
  l = luma(c);
  c = mix(vec3(l), c, 1.0 + uSaturation);
  float mx = max(c.r, max(c.g, c.b));
  float mn = min(c.r, min(c.g, c.b));
  float sat = mx - mn;
  c = mix(vec3(luma(c)), c, 1.0 + uVibrance * (1.0 - sat));
  // Matiz.
  if (abs(uHue) > 0.001) { vec3 h = rgb2hsv(clamp(c, 0.0, 1.0)); h.x = fract(h.x + uHue / 360.0); c = hsv2rgb(h); }
  // HSL por faixa de cor.
  if (uUseHsl) {
    vec3 h = rgb2hsv(clamp(c, 0.0, 1.0));
    vec3 acc = vec3(0.0); float wsum = 0.0;
    for (int i = 0; i < 8; i++) {
      float w = max(0.0, 1.0 - hueDist(h.x, uHsl[i].x) / (1.0/8.0));
      acc += w * uHsl[i].yzw; wsum += w;
    }
    if (wsum > 0.0) {
      acc /= max(wsum, 1.0);
      h.x = fract(h.x + acc.x / 360.0);
      h.y = clamp(h.y * (1.0 + acc.y), 0.0, 1.0);
      h.z = clamp(h.z * (1.0 + acc.z * 0.5), 0.0, 1.0);
      c = hsv2rgb(h);
    }
  }
  c = clamp(c, 0.0, 1.0);
  // Curvas RGB (tabela 256×1: r, g, b, master).
  if (uUseCurves) {
    c.r = texture(uCurves, vec2(c.r * 255.0/256.0 + 0.5/256.0, 0.5)).r;
    c.g = texture(uCurves, vec2(c.g * 255.0/256.0 + 0.5/256.0, 0.5)).g;
    c.b = texture(uCurves, vec2(c.b * 255.0/256.0 + 0.5/256.0, 0.5)).b;
    c.r = texture(uCurves, vec2(c.r * 255.0/256.0 + 0.5/256.0, 0.5)).a;
    c.g = texture(uCurves, vec2(c.g * 255.0/256.0 + 0.5/256.0, 0.5)).a;
    c.b = texture(uCurves, vec2(c.b * 255.0/256.0 + 0.5/256.0, 0.5)).a;
  }
  // LUT 3D.
  if (uUseLut) {
    vec3 coord = c * ((uLutSize - 1.0) / uLutSize) + 0.5 / uLutSize;
    c = mix(c, texture(uLut, coord).rgb, uLutIntensity);
  }
  outColor = vec4(clamp(c, 0.0, 1.0), src.a);
}`;

export const COPY_FRAG = `${HEADER}
void main() { outColor = texture(uTex, vUv); }`;

/** Saída final pré-multiplicada, com máscara geométrica opcional. */
export const OUTPUT_FRAG = `${HEADER}
uniform int uMaskShape; // 0 nenhum, 1 retângulo, 2 elipse, 3 linear
uniform vec2 uMaskCenter; uniform vec2 uMaskSize; uniform float uMaskFeather; uniform float uMaskAngle; uniform bool uMaskInvert;
float maskAlpha(vec2 uv) {
  vec2 p = vec2(uv.x - 0.5, 0.5 - uv.y) - uMaskCenter; // y para baixo, como na tela
  float f = max(uMaskFeather, 1e-4);
  float a = 1.0;
  if (uMaskShape == 1) {
    vec2 d = abs(p) - uMaskSize * 0.5;
    float dist = max(d.x, d.y);
    a = 1.0 - smoothstep(-f, f, dist);
  } else if (uMaskShape == 2) {
    vec2 q = p / max(uMaskSize * 0.5, vec2(1e-4));
    float dist = (length(q) - 1.0) * min(uMaskSize.x, uMaskSize.y) * 0.5;
    a = 1.0 - smoothstep(-f, f, dist);
  } else if (uMaskShape == 3) {
    float ang = radians(uMaskAngle);
    float dist = dot(p, vec2(cos(ang), sin(ang)));
    a = 1.0 - smoothstep(-f, f, dist);
  }
  return uMaskInvert ? 1.0 - a : a;
}
void main() {
  vec4 c = texture(uTex, vUv);
  float a = c.a;
  if (uMaskShape > 0) a *= maskAlpha(vUv);
  outColor = vec4(c.rgb * a, a);
}`;

export const EFFECT_FRAGS: Record<string, string> = {
  // Desfoque gaussiano separável (uma direção por passada).
  gauss: `${HEADER}
uniform vec2 uDir; uniform float uRadius;
void main() {
  if (uRadius < 0.5) { outColor = texture(uTex, vUv); return; }
  float sigma = max(uRadius / 2.0, 0.5);
  int n = int(min(ceil(uRadius), 48.0));
  float stepPx = max(1.0, uRadius / 48.0);
  vec4 acc = vec4(0.0); float wsum = 0.0;
  for (int i = -48; i <= 48; i++) {
    if (i < -n || i > n) continue;
    float x = float(i) * stepPx;
    float w = exp(-0.5 * x * x / (sigma * sigma));
    vec4 s = texture(uTex, vUv + uDir * x / uRes);
    acc += vec4(s.rgb * s.a, s.a) * w; wsum += w;
  }
  acc /= wsum;
  outColor = acc.a > 1e-5 ? vec4(acc.rgb / acc.a, acc.a) : vec4(0.0);
}`,
  directional: `${HEADER}
uniform vec2 uDir; uniform float uLength;
void main() {
  if (uLength < 0.5) { outColor = texture(uTex, vUv); return; }
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 32; i++) {
    float t = (float(i) / 31.0 - 0.5) * uLength;
    vec4 s = texture(uTex, vUv + uDir * t / uRes);
    acc += vec4(s.rgb * s.a, s.a);
  }
  acc /= 32.0;
  outColor = acc.a > 1e-5 ? vec4(acc.rgb / acc.a, acc.a) : vec4(0.0);
}`,
  sharpen: `${HEADER}
uniform float uAmount;
void main() {
  vec2 px = 1.0 / uRes;
  vec4 c = texture(uTex, vUv);
  vec3 b = (texture(uTex, vUv + vec2(px.x, 0)).rgb + texture(uTex, vUv - vec2(px.x, 0)).rgb + texture(uTex, vUv + vec2(0, px.y)).rgb + texture(uTex, vUv - vec2(0, px.y)).rgb) * 0.25;
  outColor = vec4(clamp(c.rgb + uAmount * (c.rgb - b), 0.0, 1.0), c.a);
}`,
  vignette: `${HEADER}
uniform float uAmount, uSize, uSoftness;
void main() {
  vec4 c = texture(uTex, vUv);
  vec2 p = (vUv - 0.5) * vec2(uRes.x / max(uRes.x, uRes.y), uRes.y / max(uRes.x, uRes.y)) * 2.0;
  float d = length(p);
  float v = smoothstep(uSize, uSize + uSoftness, d);
  outColor = vec4(c.rgb * (1.0 - v * uAmount), c.a);
}`,
  grayscale: `${HEADER}
uniform float uAmount;
void main() { vec4 c = texture(uTex, vUv); outColor = vec4(mix(c.rgb, vec3(luma(c.rgb)), uAmount), c.a); }`,
  sepia: `${HEADER}
uniform float uAmount;
void main() {
  vec4 c = texture(uTex, vUv);
  vec3 s = vec3(dot(c.rgb, vec3(0.393, 0.769, 0.189)), dot(c.rgb, vec3(0.349, 0.686, 0.168)), dot(c.rgb, vec3(0.272, 0.534, 0.131)));
  outColor = vec4(mix(c.rgb, clamp(s, 0.0, 1.0), uAmount), c.a);
}`,
  invert: `${HEADER}
uniform float uAmount;
void main() { vec4 c = texture(uTex, vUv); outColor = vec4(mix(c.rgb, 1.0 - c.rgb, uAmount), c.a); }`,
  grain: `${HEADER}
uniform float uAmount, uSize;
void main() {
  vec4 c = texture(uTex, vUv);
  vec2 cell = floor(vUv * uRes / uSize);
  float n = hash(cell + vec2(uFrame * 17.0, uFrame * 31.0)) - 0.5;
  outColor = vec4(clamp(c.rgb + n * uAmount * 0.5, 0.0, 1.0), c.a);
}`,
  threshold: `${HEADER}
uniform float uThreshold;
void main() { vec4 c = texture(uTex, vUv); float l = luma(c.rgb); outColor = vec4(c.rgb * smoothstep(uThreshold, uThreshold + 0.1, l), c.a); }`,
  add: `${HEADER}
uniform sampler2D uBase; uniform float uAmount;
void main() { vec4 b = texture(uBase, vUv); vec4 g = texture(uTex, vUv); outColor = vec4(clamp(b.rgb + g.rgb * g.a * uAmount, 0.0, 1.0), max(b.a, g.a * uAmount)); }`,
  distort: `${HEADER}
uniform float uAmount, uFrequency, uSpeed;
void main() {
  vec2 uv = vUv;
  uv.x += sin(uv.y * uFrequency * 6.2831 + uTime * uSpeed) * uAmount;
  uv.y += cos(uv.x * uFrequency * 6.2831 + uTime * uSpeed) * uAmount * 0.5;
  outColor = texture(uTex, uv);
}`,
  glitch: `${HEADER}
uniform float uAmount, uSpeed;
void main() {
  float t = floor(uTime * uSpeed);
  float row = floor(vUv.y * 24.0);
  float r = hash(vec2(row, t));
  vec2 uv = vUv;
  if (r < uAmount * 0.6) uv.x += (hash(vec2(t, row + 7.0)) - 0.5) * 0.15 * uAmount;
  float split = 0.012 * uAmount * (hash(vec2(t, 3.0)) * 2.0 - 1.0);
  vec4 c = texture(uTex, uv);
  float rr = texture(uTex, uv + vec2(split, 0.0)).r;
  float bb = texture(uTex, uv - vec2(split, 0.0)).b;
  outColor = vec4(rr, c.g, bb, c.a);
}`,
  chromatic: `${HEADER}
uniform vec2 uOffset;
void main() {
  vec4 c = texture(uTex, vUv);
  float r = texture(uTex, vUv + uOffset / uRes).r;
  float b = texture(uTex, vUv - uOffset / uRes).b;
  outColor = vec4(r, c.g, b, c.a);
}`,
  pixelate: `${HEADER}
uniform float uSize;
void main() { vec2 cell = max(uSize, 1.0) / uRes; outColor = texture(uTex, (floor(vUv / cell) + 0.5) * cell); }`,
  flash: `${HEADER}
uniform float uAmount, uFrequency;
void main() {
  vec4 c = texture(uTex, vUv);
  float ph = fract(uTime * uFrequency);
  float f = exp(-ph * 12.0) * uAmount;
  outColor = vec4(mix(c.rgb, vec3(1.0), f), c.a);
}`,
  chromakey: `${HEADER}
uniform vec3 uKey; uniform float uSimilarity, uSmoothness, uSpill;
vec2 cbcr(vec3 c) { return vec2(-0.168736 * c.r - 0.331264 * c.g + 0.5 * c.b, 0.5 * c.r - 0.418688 * c.g - 0.081312 * c.b); }
void main() {
  vec4 c = texture(uTex, vUv);
  float d = distance(cbcr(c.rgb), cbcr(uKey));
  float a = smoothstep(uSimilarity * 0.5, uSimilarity * 0.5 + uSmoothness * 0.5 + 1e-4, d);
  // Remoção de spill: reduz o canal dominante da cor-chave.
  vec3 rgb = c.rgb;
  float spill = clamp(1.0 - a, 0.0, 1.0) * uSpill;
  if (uKey.g >= uKey.r && uKey.g >= uKey.b) rgb.g = mix(rgb.g, min(rgb.g, max(rgb.r, rgb.b)), max(spill, uSpill * 0.5));
  else if (uKey.b >= uKey.r) rgb.b = mix(rgb.b, min(rgb.b, max(rgb.r, rgb.g)), max(spill, uSpill * 0.5));
  outColor = vec4(rgb, c.a * a);
}`,
};
