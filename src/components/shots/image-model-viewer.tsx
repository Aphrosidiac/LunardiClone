'use client';

// Module 454198. A screenshot shown as a thin slab (a 0.02-deep box: the image on both faces, its
// edges painted with the image's corner colour) turning slowly about Y in a perspective camera.
// Drag orbits it (drei OrbitControls, damped), wheel/pinch dollies between 2 and 8 units.
import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { memo, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  BoxGeometry,
  LinearFilter,
  MeshBasicMaterial,
  NoToneMapping,
  SRGBColorSpace,
  TextureLoader,
  type Mesh,
} from 'three';
import { cx } from '@/lib/cx';
import { VIEWER_FOV, VIEWER_MAX_WIDTH_RATIO, VIEWER_PLANE_HEIGHT, VIEWER_ZOOM } from './image-viewer-loader';

/** Spin about Y, in radians per second. */
const SPIN_SPEED = 0.2;
/** Slab thickness in world units. */
const SLAB_DEPTH = 0.02;
/** Pixel sampled for the edge colour when none is given. */
const EDGE_SAMPLE = 5;

export type ImageModelViewerProps = {
  src: string;
  /** Colour of the slab's four edges; sampled from the image when omitted. */
  edgeColor?: string;
  className?: string;
  /** Initial camera distance. */
  initialZoom?: number;
  /** Called once the texture has loaded and the slab is mounted. */
  onReady?: () => void;
};

const ImagePlane = memo(function ImagePlane({
  src,
  edgeColor,
  onReady,
}: {
  src: string;
  edgeColor?: string;
  onReady?: () => void;
}) {
  const texture = useLoader(TextureLoader, src);
  const meshRef = useRef<Mesh>(null);
  const [sampledColor, setSampledColor] = useState('#ffffff');
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const aspect = useThree((state) => state.size.width / state.size.height);

  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;

  useEffect(() => {
    gl.outputColorSpace = SRGBColorSpace;
    gl.toneMapping = NoToneMapping;
  }, [gl]);

  useEffect(() => {
    onReady?.();
  }, [onReady]);

  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.rotation.y += SPIN_SPEED * delta;
  });

  const { width, height } = useMemo(() => {
    const image = texture.image as { width: number; height: number };
    const h = VIEWER_PLANE_HEIGHT;
    const ar = image.width / image.height;
    // Deviation: the reference only ever shows portrait certificates. Our shots are mostly wide
    // browser captures, and a wide slab spinning about Y swings its near edge into the lens, so the
    // long side is capped (2.6 keeps the near edge inside the frame at VIEWER_ZOOM).
    const MAX_WIDTH = 2.6;
    if (h * ar > MAX_WIDTH) return { width: MAX_WIDTH, height: MAX_WIDTH / ar };
    return { width: h * ar, height: h };
  }, [texture]);

  // Back the camera off far enough that a wide image stays within VIEWER_MAX_WIDTH_RATIO of the
  // canvas width; never closer than VIEWER_ZOOM.
  useLayoutEffect(() => {
    const fitDistance = width / (2 * VIEWER_MAX_WIDTH_RATIO * Math.tan((VIEWER_FOV * Math.PI) / 360) * aspect);
    camera.position.setLength(Math.max(VIEWER_ZOOM, fitDistance));
  }, [camera, aspect, width]);

  useEffect(() => {
    if (edgeColor) {
      setSampledColor(edgeColor);
      return;
    }
    const image = texture.image as CanvasImageSource & { width: number; height: number };
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0);
    const [r = 0, g = 0, b = 0] = ctx.getImageData(EDGE_SAMPLE, EDGE_SAMPLE, 1, 1).data;
    setSampledColor(`#${(0x1000000 + (r << 16) + (g << 8) + b).toString(16).slice(1)}`);
  }, [texture, edgeColor]);

  const { geometry, materials } = useMemo(() => {
    const edge = new MeshBasicMaterial({ color: sampledColor });
    const face = new MeshBasicMaterial({ map: texture });
    return {
      geometry: new BoxGeometry(width, height, SLAB_DEPTH),
      // BoxGeometry groups: +x, -x, +y, -y, +z, -z.
      materials: [edge, edge, edge, edge, face, face],
    };
  }, [texture, sampledColor, width, height]);

  useEffect(
    () => () => {
      geometry.dispose();
      for (const material of materials) material.dispose();
    },
    [geometry, materials],
  );

  return <mesh ref={meshRef} geometry={geometry} material={materials} />;
});

const GL = { alpha: true, antialias: true, powerPreference: 'high-performance' } as const;
const CANVAS_STYLE = { background: 'transparent' };
const DPR: [number, number] = [1, 2];

function bump(n: number) {
  return n + 1;
}

export function ImageModelViewer({ src, edgeColor, className, initialZoom = VIEWER_ZOOM, onReady }: ImageModelViewerProps) {
  const [grabbing, setGrabbing] = useState(false);
  const onStart = useCallback(() => setGrabbing(true), []);
  const onEnd = useCallback(() => setGrabbing(false), []);
  // A fresh Canvas whenever this component is re-attached after an unmount cleanup (Strict Mode,
  // Activity), so the WebGL context is never reused after it was torn down.
  const [canvasKey, setCanvasKey] = useState(0);
  useEffect(() => () => setCanvasKey(bump), []);

  const camera = useMemo(() => ({ position: [0, 0, initialZoom] as [number, number, number], fov: VIEWER_FOV }), [initialZoom]);

  return (
    <div className={cx('size-full', grabbing ? 'cursor-grabbing' : 'cursor-grab', className)}>
      <Canvas key={canvasKey} camera={camera} gl={GL} style={CANVAS_STYLE} dpr={DPR}>
        <Suspense fallback={null}>
          <ImagePlane src={src} edgeColor={edgeColor} onReady={onReady} />
        </Suspense>
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          minDistance={2}
          maxDistance={8}
          enablePan={false}
          onStart={onStart}
          onEnd={onEnd}
        />
      </Canvas>
    </div>
  );
}
