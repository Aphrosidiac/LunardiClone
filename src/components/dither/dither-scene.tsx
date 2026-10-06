'use client';

// DitherScene — port of reference module 419053 (chunk 338_hf8lga-6v.js).
//
// A full-viewport R3F canvas: an fbm wave field (distorted by a cached noise map) rendered into an
// offscreen buffer, then pixelated + Bayer-dithered by a "RetroEffect" post pass.
//
// The reference runs the post pass through the bundled `postprocessing` (v6) EffectComposer via
// `@react-three/postprocessing`'s <EffectComposer> + wrapEffect. Only one effect is ever mounted, so
// the composer below reproduces exactly that single-effect path (RenderPass -> EffectPass to screen,
// UnsignedByte sRGB input buffer, NoToneMapping, autoClear handling, effect shader composition with
// the `e0` prefix and the NORMAL blend) instead of pulling in both libraries.

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

import { useIsTouchDevice } from '@/hooks/use-breakpoint';
import { hexToRgb } from '@/lib/utils';

type RGB = [number, number, number];

export type DitherSceneProps = {
  waveSpeed?: number;
  waveFrequency?: number;
  waveAmplitude?: number;
  waveColor?: RGB;
  colorNum?: number;
  pixelSize?: number;
  enableMouseInteraction?: boolean;
  mouseRadius?: number;
  active?: boolean;
};

/* -------------------------------------------------------------------------------------------------
 * Shaders (verbatim from the reference)
 * -----------------------------------------------------------------------------------------------*/

const WAVE_VERTEX_SHADER = `
  precision mediump float;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const NOISE_GLSL = `
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

  #define OCTAVES 4
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
`;

const NOISE_MAP_VERTEX_SHADER = `
  precision mediump float;
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const NOISE_MAP_FRAGMENT_SHADER = `
  precision mediump float;
  uniform vec2 invResolution;
  uniform float aspect;
  uniform float waveFrequency;
  uniform float waveAmplitude;
  ${NOISE_GLSL}
  void main() {
    vec2 uv = gl_FragCoord.xy * invResolution;
    uv -= 0.5;
    uv.x *= aspect;
    float baseNoise = fbm(uv);
    float distortedNoise = fbm(uv + baseNoise * 0.5);
    gl_FragColor = vec4(distortedNoise * 0.5, 0.0, 0.0, 1.0);
  }
`;

const WAVE_FRAGMENT_SHADER = `
  precision mediump float;
  uniform vec2 resolution;
  uniform vec2 invResolution;
  uniform float time;
  uniform float waveSpeed;
  uniform float waveFrequency;
  uniform float waveAmplitude;
  uniform vec3 waveColor;
  uniform vec2 mousePos;
  uniform int enableMouseInteraction;
  uniform float mouseRadius;
  uniform float aspect;
  uniform sampler2D distortedNoiseMap;
  varying vec2 vUv;

  ${NOISE_GLSL}

  float pattern(vec2 p, float distortedNoise) {
    vec2 p2 = p - time * waveSpeed;
    return fbm(p2 + distortedNoise * 0.1);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy * invResolution;
    uv -= 0.5;
    uv.x *= aspect;
    float distortedNoise = texture2D(distortedNoiseMap, vUv).r * 2.0;
    float f = pattern(uv, distortedNoise);
    if (enableMouseInteraction == 1) {
      vec2 mouseNDC = (mousePos * invResolution - 0.5) * vec2(1.0, -1.0);
      mouseNDC.x *= aspect;
      float dist = length(uv - mouseNDC);
      float effect = 1.0 - smoothstep(0.0, mouseRadius, dist);
      f -= 0.5 * effect;
    }
    f = smoothstep(0.2, 0.8, f);
    vec3 col = mix(vec3(0.1), waveColor * 2.0, f);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const RETRO_FRAGMENT_SHADER = `
  precision mediump float;
  uniform float colorNum;
  uniform float pixelSize;
  const float bayerMatrix8x8[64] = float[64](
    0.0/64.0, 48.0/64.0, 12.0/64.0, 60.0/64.0,  3.0/64.0, 51.0/64.0, 15.0/64.0, 63.0/64.0,
    32.0/64.0,16.0/64.0, 44.0/64.0, 28.0/64.0, 35.0/64.0,19.0/64.0, 47.0/64.0, 31.0/64.0,
    8.0/64.0, 56.0/64.0,  4.0/64.0, 52.0/64.0, 11.0/64.0,59.0/64.0,  7.0/64.0, 55.0/64.0,
    40.0/64.0,24.0/64.0, 36.0/64.0, 20.0/64.0, 43.0/64.0,27.0/64.0, 39.0/64.0, 23.0/64.0,
    2.0/64.0, 50.0/64.0, 14.0/64.0, 62.0/64.0,  1.0/64.0,49.0/64.0, 13.0/64.0, 61.0/64.0,
    34.0/64.0,18.0/64.0, 46.0/64.0, 30.0/64.0, 33.0/64.0,17.0/64.0, 45.0/64.0, 29.0/64.0,
    10.0/64.0,58.0/64.0,  6.0/64.0, 54.0/64.0,  9.0/64.0,57.0/64.0,  5.0/64.0, 53.0/64.0,
    42.0/64.0,26.0/64.0, 38.0/64.0, 22.0/64.0, 41.0/64.0,25.0/64.0, 37.0/64.0, 21.0/64.0
  );

  vec3 dither(vec2 uv, vec3 color) {
    vec2 scaledCoord = floor(uv * resolution / pixelSize);
    int x = int(mod(scaledCoord.x, 8.0));
    int y = int(mod(scaledCoord.y, 8.0));
    float threshold = bayerMatrix8x8[y * 8 + x] - 0.25;
    float step = 1.0 / (colorNum - 1.0);
    color += threshold * step;
    float bias = 0.2;
    color = clamp(color - bias, 0.0, 1.0);
    return floor(color * (colorNum - 1.0) + 0.5) / (colorNum - 1.0);
  }

  void mainImage(in vec4 inputColor, in vec2 uv, out vec4 outputColor) {
    vec2 normalizedPixelSize = pixelSize / resolution;
    vec2 uvPixel = normalizedPixelSize * floor(uv / normalizedPixelSize);
    vec4 color = texture2D(inputBuffer, uvPixel);
    color.rgb = dither(uv, color.rgb);
    outputColor = color;
  }
`;

/* -------------------------------------------------------------------------------------------------
 * Single-effect composer (postprocessing v6 EffectComposer + RenderPass + EffectPass, as bundled)
 * -----------------------------------------------------------------------------------------------*/

// postprocessing's EffectMaterial fragment template (verbatim).
const EFFECT_FRAGMENT_TEMPLATE = `#include <common>
#include <packing>
#include <dithering_pars_fragment>
#define packFloatToRGBA(v) packDepthToRGBA(v)
#define unpackRGBAToFloat(v) unpackRGBAToDepth(v)
#ifdef FRAMEBUFFER_PRECISION_HIGH
uniform mediump sampler2D inputBuffer;
#else
uniform lowp sampler2D inputBuffer;
#endif
#if DEPTH_PACKING == 3201
uniform lowp sampler2D depthBuffer;
#elif defined(GL_FRAGMENT_PRECISION_HIGH)
uniform highp sampler2D depthBuffer;
#else
uniform mediump sampler2D depthBuffer;
#endif
uniform vec2 resolution;uniform vec2 texelSize;uniform float cameraNear;uniform float cameraFar;uniform float aspect;uniform float time;varying vec2 vUv;vec4 sRGBToLinear(const in vec4 value){return vec4(mix(pow(value.rgb*0.9478672986+vec3(0.0521327014),vec3(2.4)),value.rgb*0.0773993808,vec3(lessThanEqual(value.rgb,vec3(0.04045)))),value.a);}float readDepth(const in vec2 uv){
#if DEPTH_PACKING == 3201
float depth=unpackRGBAToDepth(texture2D(depthBuffer,uv));
#else
float depth=texture2D(depthBuffer,uv).r;
#endif
#if defined(USE_LOGARITHMIC_DEPTH_BUFFER) || defined(LOG_DEPTH)
float d=pow(2.0,depth*log2(cameraFar+1.0))-1.0;float a=cameraFar/(cameraFar-cameraNear);float b=cameraFar*cameraNear/(cameraNear-cameraFar);depth=a+b/d;
#elif defined(USE_REVERSED_DEPTH_BUFFER)
depth=1.0-depth;
#endif
return depth;}float getViewZ(const in float depth){
#ifdef PERSPECTIVE_CAMERA
return perspectiveDepthToViewZ(depth,cameraNear,cameraFar);
#else
return orthographicDepthToViewZ(depth,cameraNear,cameraFar);
#endif
}vec3 RGBToHCV(const in vec3 RGB){vec4 P=mix(vec4(RGB.bg,-1.0,2.0/3.0),vec4(RGB.gb,0.0,-1.0/3.0),step(RGB.b,RGB.g));vec4 Q=mix(vec4(P.xyw,RGB.r),vec4(RGB.r,P.yzx),step(P.x,RGB.r));float C=Q.x-min(Q.w,Q.y);float H=abs((Q.w-Q.y)/(6.0*C+EPSILON)+Q.z);return vec3(H,C,Q.x);}vec3 RGBToHSL(const in vec3 RGB){vec3 HCV=RGBToHCV(RGB);float L=HCV.z-HCV.y*0.5;float S=HCV.y/(1.0-abs(L*2.0-1.0)+EPSILON);return vec3(HCV.x,S,L);}vec3 HueToRGB(const in float H){float R=abs(H*6.0-3.0)-1.0;float G=2.0-abs(H*6.0-2.0);float B=2.0-abs(H*6.0-4.0);return clamp(vec3(R,G,B),0.0,1.0);}vec3 HSLToRGB(const in vec3 HSL){vec3 RGB=HueToRGB(HSL.x);float C=(1.0-abs(2.0*HSL.z-1.0))*HSL.y;return(RGB-0.5)*C+HSL.z;}FRAGMENT_HEAD void main(){FRAGMENT_MAIN_UV vec4 color0=texture2D(inputBuffer,UV);vec4 color1=vec4(0.0);FRAGMENT_MAIN_IMAGE color0.a=clamp(color0.a,0.0,1.0);gl_FragColor=color0;
#ifdef ENCODE_OUTPUT
#include <colorspace_fragment>
#endif
#include <dithering_fragment>
}`;

const EFFECT_VERTEX_TEMPLATE =
  'uniform vec2 resolution;uniform vec2 texelSize;uniform float cameraNear;uniform float cameraFar;uniform float aspect;uniform float time;varying vec2 vUv;VERTEX_HEAD void main(){vUv=position.xy*0.5+0.5;VERTEX_MAIN_SUPPORT gl_Position=vec4(position.xy,1.0,1.0);}';

// BlendFunction.NORMAL (id 23) — the effect's default; the wrapper passes no blendFunction/opacity.
const BLEND_NORMAL_ID = 23;
const BLEND_NORMAL =
  'vec4 blend(const in vec4 dst,const in vec4 src,const in float opacity){return mix(dst,src,opacity);}';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// postprocessing's EffectPass.updateMaterial for one `mainImage` effect (prefix "e0", linear in/out).
function composeEffectShaders(
  prefix: string,
  fragmentShader: string,
  uniforms: Map<string, THREE.Uniform>,
) {
  const names = new Set<string>();
  for (const match of fragmentShader.matchAll(/\w+\s+(\w+)\([\w\s,]*\)\s*{/g)) names.add(match[1]);
  for (const key of uniforms.keys()) names.add(key);
  names.delete('while');
  names.delete('for');
  names.delete('if');

  const prefixedUniforms: Record<string, THREE.IUniform> = {};
  uniforms.forEach((uniform, key) => {
    prefixedUniforms[prefix + capitalize(key)] = uniform;
  });

  let fragment = fragmentShader;
  for (const name of names) {
    const pattern = new RegExp('([^\\.])(\\b' + name + '\\b)', 'g');
    fragment = fragment.replace(pattern, '$1' + prefix + capitalize(name));
  }

  const opacityName = `${prefix}BlendOpacity`;
  const blendOpacity = new THREE.Uniform(1);
  prefixedUniforms[opacityName] = blendOpacity;

  let head = `uniform float ${opacityName};\n\n` + fragment + '\n';
  head += BLEND_NORMAL.replace(/\bblend\b/g, `blend${BLEND_NORMAL_ID}`) + '\n';
  const mainImage =
    `${prefix}MainImage(color0, UV, color1);\n\t` +
    `color0 = blend${BLEND_NORMAL_ID}(color0, color1, ${opacityName});\n\n\t`;

  const part = (s: string) => s.trim().replace(/^#/, '\n#');
  const fill = (template: string, key: string, value: string) =>
    template.split(key).join(value);

  let composedFragment = fill(EFFECT_FRAGMENT_TEMPLATE, 'FRAGMENT_HEAD', part(head));
  composedFragment = fill(composedFragment, 'FRAGMENT_MAIN_UV', part(''));
  composedFragment = fill(composedFragment, 'FRAGMENT_MAIN_IMAGE', part(mainImage));

  let composedVertex = fill(EFFECT_VERTEX_TEMPLATE, 'VERTEX_HEAD', part(''));
  composedVertex = fill(composedVertex, 'VERTEX_MAIN_SUPPORT', part(''));

  return { fragmentShader: composedFragment, vertexShader: composedVertex, uniforms: prefixedUniforms };
}

// postprocessing's shared fullscreen triangle.
function createFullscreenTriangle() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
  );
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
  return geometry;
}

class RetroComposer {
  readonly renderer: THREE.WebGLRenderer;
  readonly inputBuffer: THREE.WebGLRenderTarget;
  readonly effectUniforms: Map<string, THREE.Uniform>;
  private readonly material: THREE.ShaderMaterial;
  private readonly geometry: THREE.BufferGeometry;
  private readonly screenScene = new THREE.Scene();
  private readonly screenCamera = new THREE.OrthographicCamera();

  constructor(
    renderer: THREE.WebGLRenderer,
    camera: THREE.Camera,
    { colorNum = 4, pixelSize = 2 }: { colorNum?: number; pixelSize?: number } = {},
  ) {
    this.renderer = renderer;

    // EffectComposer input buffer: { depthBuffer: false, stencilBuffer: false, multisampling: 0,
    // frameBufferType: UnsignedByteType } → sRGB storage because the renderer outputs sRGB.
    const drawingBufferSize = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.inputBuffer = new THREE.WebGLRenderTarget(drawingBufferSize.width, drawingBufferSize.height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      samples: 0,
      stencilBuffer: false,
      depthBuffer: false,
      type: THREE.UnsignedByteType,
    });
    if (renderer.outputColorSpace === THREE.SRGBColorSpace) {
      this.inputBuffer.texture.colorSpace = THREE.SRGBColorSpace;
    }
    this.inputBuffer.texture.name = 'EffectComposer.Buffer';
    this.inputBuffer.texture.generateMipmaps = false;

    // RetroEffect uniforms.
    this.effectUniforms = new Map([
      ['colorNum', new THREE.Uniform(colorNum)],
      ['pixelSize', new THREE.Uniform(pixelSize)],
    ]);

    const composed = composeEffectShaders('e0', RETRO_FRAGMENT_SHADER, this.effectUniforms);
    const defines: Record<string, string> = {
      THREE_REVISION: THREE.REVISION.replace(/\D+/g, ''),
      DEPTH_PACKING: '0',
      ENCODE_OUTPUT: '1',
      UV: 'vUv',
    };
    const near = (camera as THREE.PerspectiveCamera).near ?? 0.3;
    const far = (camera as THREE.PerspectiveCamera).far ?? 1e3;
    if (camera instanceof THREE.PerspectiveCamera) defines.PERSPECTIVE_CAMERA = '1';

    this.material = new THREE.ShaderMaterial({
      name: 'EffectMaterial',
      defines,
      uniforms: {
        inputBuffer: new THREE.Uniform(null),
        depthBuffer: new THREE.Uniform(null),
        resolution: new THREE.Uniform(new THREE.Vector2()),
        texelSize: new THREE.Uniform(new THREE.Vector2()),
        cameraNear: new THREE.Uniform(near),
        cameraFar: new THREE.Uniform(far),
        aspect: new THREE.Uniform(1),
        time: new THREE.Uniform(0),
        ...composed.uniforms,
      },
      blending: THREE.NoBlending,
      toneMapped: false,
      depthWrite: false,
      depthTest: false,
      dithering: false,
      fragmentShader: composed.fragmentShader,
      vertexShader: composed.vertexShader,
    });

    this.geometry = createFullscreenTriangle();
    const screen = new THREE.Mesh(this.geometry, this.material);
    screen.frustumCulled = false;
    this.screenScene.add(screen);
  }

  set colorNum(value: number) {
    this.effectUniforms.get('colorNum')!.value = value;
  }

  set pixelSize(value: number) {
    this.effectUniforms.get('pixelSize')!.value = value;
  }

  setSize(width: number, height: number) {
    const renderer = this.renderer;
    const size = renderer.getSize(new THREE.Vector2());
    if (size.width !== width || size.height !== height) renderer.setSize(width, height);
    const drawingBufferSize = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.inputBuffer.setSize(drawingBufferSize.width, drawingBufferSize.height);
    const uniforms = this.material.uniforms;
    uniforms.resolution.value.set(drawingBufferSize.width, drawingBufferSize.height);
    uniforms.texelSize.value.set(1 / drawingBufferSize.width, 1 / drawingBufferSize.height);
    uniforms.aspect.value = drawingBufferSize.width / drawingBufferSize.height;
  }

  render(scene: THREE.Scene, camera: THREE.Camera, delta: number) {
    const renderer = this.renderer;

    // RenderPass: ClearPass(color, depth) then the scene into the input buffer.
    renderer.setRenderTarget(this.inputBuffer);
    renderer.clear(true, true, false);
    renderer.setRenderTarget(this.inputBuffer);
    renderer.render(scene, camera);

    // EffectPass (last pass → renders to screen).
    const uniforms = this.material.uniforms;
    uniforms.inputBuffer.value = this.inputBuffer.texture;
    uniforms.time.value += delta;
    renderer.setRenderTarget(null);
    renderer.render(this.screenScene, this.screenCamera);
  }

  dispose() {
    this.inputBuffer.dispose();
    this.material.dispose();
    this.geometry.dispose();
  }
}

// Ref-counted "force a renderer property while mounted" (postprocessing's acquire/release).
function forceRendererProperty<K extends 'autoClear' | 'toneMapping'>(
  renderer: THREE.WebGLRenderer,
  key: K,
  value: THREE.WebGLRenderer[K],
) {
  const original = renderer[key];
  renderer[key] = value;
  return () => {
    if (renderer[key] === value) renderer[key] = original;
  };
}

const composerSize = new THREE.Vector2();

function RetroEffectComposer({ colorNum, pixelSize }: { colorNum: number; pixelSize: number }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const [composer, setComposer] = useState<RetroComposer | null>(null);
  const lastSize = useRef({ width: -1, height: -1 });

  useEffect(() => {
    const releaseAutoClear = forceRendererProperty(gl, 'autoClear', false);
    const instance = new RetroComposer(gl, camera);
    gl.getSize(composerSize);
    instance.setSize(composerSize.width, composerSize.height);
    setComposer(instance);
    return () => {
      instance.dispose();
      releaseAutoClear();
    };
  }, [gl, camera]);

  useEffect(() => forceRendererProperty(gl, 'toneMapping', THREE.NoToneMapping), [gl]);

  useEffect(() => {
    if (!composer) return;
    composer.colorNum = colorNum;
    composer.pixelSize = pixelSize;
    invalidate();
  }, [composer, colorNum, pixelSize, invalidate]);

  useFrame((_, delta) => {
    if (!composer) return;
    gl.getSize(composerSize);
    if (
      composerSize.width !== lastSize.current.width ||
      composerSize.height !== lastSize.current.height
    ) {
      composer.setSize(composerSize.width, composerSize.height);
      lastSize.current.width = composerSize.width;
      lastSize.current.height = composerSize.height;
    }
    const autoClear = gl.autoClear;
    gl.autoClear = true;
    composer.render(scene, camera, delta);
    gl.autoClear = autoClear;
  }, 1);

  return null;
}

/* -------------------------------------------------------------------------------------------------
 * Frameloop controller: run only while in view, tab visible and the slot is active
 * -----------------------------------------------------------------------------------------------*/

function FrameloopController({ active }: { active: boolean }) {
  const gl = useThree((state) => state.gl);
  const setFrameloop = useThree((state) => state.setFrameloop);
  const invalidate = useThree((state) => state.invalidate);
  const visibility = useRef({
    inView: true,
    visible: typeof document === 'undefined' || !document.hidden,
  });

  useEffect(() => {
    const update = () => {
      const { inView, visible } = visibility.current;
      const running = inView && visible && active;
      setFrameloop(running ? 'always' : 'demand');
      if (running) invalidate();
    };

    const canvas = gl.domElement;
    const onVisibilityChange = () => {
      visibility.current.visible = !document.hidden;
      update();
    };
    const observer = new IntersectionObserver(
      (entries) => {
        visibility.current.inView = entries.some((entry) => entry.isIntersecting);
        update();
      },
      { threshold: 0 },
    );

    document.addEventListener('visibilitychange', onVisibilityChange);
    observer.observe(canvas);
    update();
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      observer.disconnect();
    };
  }, [gl, active, setFrameloop, invalidate]);

  return null;
}

/* -------------------------------------------------------------------------------------------------
 * Wave field
 * -----------------------------------------------------------------------------------------------*/

// Internal resolution cap (2560 × 1440).
const MAX_PIXELS = 3_686_400;

type WaveUniforms = {
  time: THREE.Uniform<number>;
  resolution: THREE.Uniform<THREE.Vector2>;
  invResolution: THREE.Uniform<THREE.Vector2>;
  waveSpeed: THREE.Uniform<number>;
  waveFrequency: THREE.Uniform<number>;
  waveAmplitude: THREE.Uniform<number>;
  waveColor: THREE.Uniform<THREE.Color>;
  mousePos: THREE.Uniform<THREE.Vector2>;
  enableMouseInteraction: THREE.Uniform<number>;
  mouseRadius: THREE.Uniform<number>;
  aspect: THREE.Uniform<number>;
  distortedNoiseMap: THREE.Uniform<THREE.Texture | null>;
};

type DitheredWavesProps = Required<Omit<DitherSceneProps, 'waveColor'>> & { waveColor: RGB };

function DitheredWaves({
  waveSpeed,
  waveFrequency,
  waveAmplitude,
  waveColor,
  colorNum,
  pixelSize,
  enableMouseInteraction,
  mouseRadius,
  active,
}: DitheredWavesProps) {
  const mesh = useRef<THREE.Mesh>(null);
  const mouse = useRef(new THREE.Vector2(0, 0));
  const mouseTarget = useRef(new THREE.Vector2(0, 0));
  const { viewport, size, gl, invalidate } = useThree();

  const uniformsRef = useRef<WaveUniforms | null>(null);
  if (uniformsRef.current === null) {
    uniformsRef.current = {
      time: new THREE.Uniform(0),
      resolution: new THREE.Uniform(new THREE.Vector2(0, 0)),
      invResolution: new THREE.Uniform(new THREE.Vector2(0, 0)),
      waveSpeed: new THREE.Uniform(waveSpeed),
      waveFrequency: new THREE.Uniform(waveFrequency),
      waveAmplitude: new THREE.Uniform(waveAmplitude),
      waveColor: new THREE.Uniform(new THREE.Color(...waveColor)),
      mousePos: new THREE.Uniform(new THREE.Vector2(0, 0)),
      enableMouseInteraction: new THREE.Uniform(enableMouseInteraction ? 1 : 0),
      mouseRadius: new THREE.Uniform(mouseRadius),
      aspect: new THREE.Uniform(1),
      distortedNoiseMap: new THREE.Uniform(null),
    };
  }
  const uniforms = uniformsRef.current;

  const noiseTarget = useMemo(
    () =>
      new THREE.WebGLRenderTarget(1, 1, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        depthBuffer: false,
        stencilBuffer: false,
      }),
    [],
  );

  const noisePass = useMemo(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      vertexShader: NOISE_MAP_VERTEX_SHADER,
      fragmentShader: NOISE_MAP_FRAGMENT_SHADER,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        invResolution: uniforms.invResolution,
        aspect: uniforms.aspect,
        waveFrequency: uniforms.waveFrequency,
        waveAmplitude: uniforms.waveAmplitude,
      },
    });
    scene.add(new THREE.Mesh(geometry, material));
    return { scene, camera, geometry, material };
  }, [uniforms]);

  const waveMaterial = useMemo(() => {
    uniforms.distortedNoiseMap.value = noiseTarget.texture;
    return new THREE.ShaderMaterial({
      vertexShader: WAVE_VERTEX_SHADER,
      fragmentShader: WAVE_FRAGMENT_SHADER,
      uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
    });
  }, [uniforms, noiseTarget]);

  // The distorted-noise map only depends on resolution/frequency/amplitude: re-render it on change.
  const noiseDirty = useRef(true);

  useEffect(() => {
    const dpr = gl.getPixelRatio();
    const bufferWidth = Math.floor(size.width * dpr);
    const bufferHeight = Math.floor(size.height * dpr);
    let width = bufferWidth;
    let height = bufferHeight;
    const pixels = width * height;
    if (pixels > MAX_PIXELS) {
      const scale = Math.sqrt(MAX_PIXELS / pixels);
      width = Math.floor(width * scale);
      height = Math.floor(height * scale);
    }
    if (width === 0 || height === 0 || bufferWidth === 0 || bufferHeight === 0) return;

    const resolution = uniforms.resolution.value;
    const resolutionChanged = resolution.x !== width || resolution.y !== height;
    const targetChanged = noiseTarget.width !== bufferWidth || noiseTarget.height !== bufferHeight;
    if (resolutionChanged) {
      resolution.set(width, height);
      uniforms.invResolution.value.set(1 / width, 1 / height);
      uniforms.aspect.value = width / height;
    }
    if (targetChanged) noiseTarget.setSize(bufferWidth, bufferHeight);
    if (resolutionChanged || targetChanged) {
      noiseDirty.current = true;
      invalidate();
    }
  }, [size, gl, invalidate, noiseTarget, uniforms]);

  useEffect(() => {
    uniforms.waveSpeed.value = waveSpeed;
    uniforms.waveColor.value.set(...waveColor);
    uniforms.enableMouseInteraction.value = enableMouseInteraction ? 1 : 0;
    uniforms.mouseRadius.value = mouseRadius;
    invalidate();
  }, [waveSpeed, waveColor, enableMouseInteraction, mouseRadius, invalidate, uniforms]);

  useEffect(() => {
    uniforms.waveFrequency.value = waveFrequency;
    uniforms.waveAmplitude.value = waveAmplitude;
    noiseDirty.current = true;
    invalidate();
  }, [waveFrequency, waveAmplitude, invalidate, uniforms]);

  useEffect(
    () => () => {
      noiseTarget.dispose();
      noisePass.geometry.dispose();
      noisePass.material.dispose();
      waveMaterial.dispose();
    },
    [noiseTarget, noisePass, waveMaterial],
  );

  useFrame((_, delta) => {
    if (noiseDirty.current && noiseTarget.width > 0 && noiseTarget.height > 0) {
      const previousTarget = gl.getRenderTarget();
      gl.setRenderTarget(noiseTarget);
      gl.render(noisePass.scene, noisePass.camera);
      gl.setRenderTarget(previousTarget);
      noiseDirty.current = false;
    }

    uniforms.time.value += Math.min(delta, 0.1);

    if (enableMouseInteraction) {
      const alpha = 1 - Math.exp(-12 * delta);
      mouse.current.lerp(mouseTarget.current, alpha);
      uniforms.mousePos.value.copy(mouse.current);
    }
  });

  useEffect(() => {
    if (!enableMouseInteraction || !active) return;
    const canvas = gl.domElement;
    let rect = canvas.getBoundingClientRect();
    const onResize = () => {
      rect = canvas.getBoundingClientRect();
    };
    const onPointerMove = (event: PointerEvent) => {
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
      mouseTarget.current.set((x / rect.width) * size.width, (y / rect.height) * size.height);
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('resize', onResize);
    };
  }, [active, enableMouseInteraction, gl, size.width, size.height]);

  return (
    <>
      <mesh ref={mesh} scale={[viewport.width, viewport.height, 1]}>
        <planeGeometry args={[1, 1]} />
        <primitive object={waveMaterial} attach="material" />
      </mesh>
      <RetroEffectComposer colorNum={colorNum} pixelSize={pixelSize} />
    </>
  );
}

/* -------------------------------------------------------------------------------------------------
 * DitherScene
 * -----------------------------------------------------------------------------------------------*/

// Fallback wave colour (#232323) until --theme-dither has been read.
const DEFAULT_WAVE_COLOR: RGB = [35 / 255, 35 / 255, 35 / 255];

const CAMERA = { position: [0, 0, 6] as [number, number, number] };
const GL = {
  antialias: false,
  stencil: false,
  depth: false,
  powerPreference: 'high-performance' as const,
};

export function DitherScene({
  waveSpeed = 0.015,
  waveFrequency = 3,
  waveAmplitude = 0.4,
  waveColor,
  colorNum = 4,
  pixelSize = 2,
  enableMouseInteraction = true,
  mouseRadius = 0.5,
  active = true,
}: DitherSceneProps) {
  const isTouchDevice = useIsTouchDevice();
  const [themeColor, setThemeColor] = useState<RGB | null>(null);

  useEffect(() => {
    const readThemeColor = () => {
      const hex = getComputedStyle(document.documentElement)
        .getPropertyValue('--theme-dither')
        .trim();
      if (!hex) return;
      try {
        setThemeColor(hexToRgb(hex).map((channel) => channel / 255) as RGB);
      } catch {}
    };
    readThemeColor();
    const onThemeChange = () => {
      readThemeColor();
    };
    document.addEventListener('theme-change', onThemeChange);
    return () => document.removeEventListener('theme-change', onThemeChange);
  }, []);

  const color = waveColor ?? themeColor ?? DEFAULT_WAVE_COLOR;
  const mouseInteraction = enableMouseInteraction && !isTouchDevice;

  return (
    <Canvas
      className="relative size-full select-none"
      camera={CAMERA}
      dpr={1}
      frameloop="always"
      gl={GL}
    >
      <FrameloopController active={active} />
      <DitheredWaves
        waveSpeed={waveSpeed}
        waveFrequency={waveFrequency}
        waveAmplitude={waveAmplitude}
        waveColor={color}
        colorNum={colorNum}
        pixelSize={pixelSize}
        enableMouseInteraction={mouseInteraction}
        mouseRadius={mouseRadius}
        active={active}
      />
    </Canvas>
  );
}
