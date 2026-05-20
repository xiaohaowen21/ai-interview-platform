import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../hooks/useTheme';

interface DottedSurfaceProps {
  className?: string;
}

type SurfaceTheme = 'light' | 'dark';
type ThreeModule = typeof import('three');

const SEPARATION = 150;
const AMOUNT_X = 40;
const AMOUNT_Y = 60;
const PARTICLE_SIZE = 11;
const LIGHT_POINT_RGB = '17, 24, 39';
const DARK_POINT_RGB = '228, 232, 240';

function clearChildren(node: HTMLElement) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function supportsWebGl() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      canvas.getContext('webgl') || canvas.getContext('experimental-webgl'),
    );
  } catch {
    return false;
  }
}

function setupFallbackCanvas(canvas: HTMLCanvasElement, theme: SurfaceTheme) {
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) {
    return () => undefined;
  }

  let animationFrame: number | null = null;
  let intersectionObserver: IntersectionObserver | null = null;
  let visible = true;
  let width = 0;
  let height = 0;
  let time = 0;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const resize = () => {
    const bounds = canvas.getBoundingClientRect();
    width = Math.max(320, Math.round(bounds.width || window.innerWidth));
    height = Math.max(260, Math.round(bounds.height || window.innerHeight * 0.55));

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const draw = () => {
    context.clearRect(0, 0, width, height);

    const columns = Math.max(18, Math.round(width / 40));
    const rows = Math.max(10, Math.round(height / 28));
    const horizontalGap = width / columns;
    const verticalGap = height / rows;
    const baseY = height * 0.18;
    const dotColor = theme === 'dark' ? DARK_POINT_RGB : LIGHT_POINT_RGB;

    for (let row = 0; row <= rows; row += 1) {
      for (let column = 0; column <= columns; column += 1) {
        const x = column * horizontalGap;
        const wave =
          Math.sin(column * 0.52 + time) * 12 +
          Math.cos(row * 0.68 + time * 0.92) * 8 +
          Math.sin((column + row) * 0.18 + time * 0.65) * 7;
        const y = baseY + row * verticalGap + wave;
        const radius = 2.5 + ((column + row) % 5 === 0 ? 2.2 : 1.1);
        const alphaBase = theme === 'dark' ? 0.26 : 0.34;
        const alpha = alphaBase + ((row + column) % 6) * 0.035;

        context.beginPath();
        context.fillStyle = `rgba(${dotColor}, ${alpha})`;
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }
    }
  };

  const animate = () => {
    if (!visible) {
      animationFrame = null;
      return;
    }

    draw();
    time += reduceMotion ? 0.015 : 0.05;
    animationFrame = window.requestAnimationFrame(animate);
  };

  const handleVisibilityChange = () => {
    visible = !document.hidden;
    if (visible && animationFrame === null) {
      animate();
    }
  };

  resize();
  draw();

  intersectionObserver = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting && !document.hidden;
      if (visible && animationFrame === null) {
        animate();
      }
    },
    { threshold: 0.02 },
  );
  intersectionObserver.observe(canvas);

  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  animate();

  return () => {
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    intersectionObserver?.disconnect();
    if (animationFrame !== null) {
      window.cancelAnimationFrame(animationFrame);
    }
  };
}

async function setupWebGlSurface(
  host: HTMLDivElement,
  theme: SurfaceTheme,
  onReady: () => void,
) {
  const THREE: ThreeModule = await import('three');
  clearChildren(host);

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fogColor = theme === 'dark' ? 0x020617 : 0xffffff;
  const pointColor = new THREE.Color(theme === 'dark' ? '#e5e7eb' : '#111827');

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(fogColor, 2000, 10000);

  const camera = new THREE.PerspectiveCamera(60, 1, 1, 10000);
  camera.position.set(0, 355, 1220);

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(fogColor, 0);
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  host.appendChild(renderer.domElement);

  const positions = new Float32Array(AMOUNT_X * AMOUNT_Y * 3);
  const colors = new Float32Array(AMOUNT_X * AMOUNT_Y * 3);

  let index = 0;
  for (let ix = 0; ix < AMOUNT_X; ix += 1) {
    for (let iy = 0; iy < AMOUNT_Y; iy += 1) {
      positions[index] = ix * SEPARATION - (AMOUNT_X * SEPARATION) / 2;
      positions[index + 1] = 0;
      positions[index + 2] = iy * SEPARATION - (AMOUNT_Y * SEPARATION) / 2;

      colors[index] = pointColor.r;
      colors[index + 1] = pointColor.g;
      colors[index + 2] = pointColor.b;
      index += 3;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: PARTICLE_SIZE,
    vertexColors: true,
    transparent: true,
    opacity: theme === 'dark' ? 0.86 : 0.74,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);

  let animationFrame: number | null = null;
  let intersectionObserver: IntersectionObserver | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let visible = true;
  let ready = false;
  let count = 0;

  const resize = () => {
    const bounds = host.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width || window.innerWidth));
    const height = Math.max(1, Math.round(bounds.height || window.innerHeight));
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };

  const renderFrame = () => {
    if (!visible) {
      animationFrame = null;
      return;
    }

    const attribute = geometry.getAttribute('position') as InstanceType<
      ThreeModule['BufferAttribute']
    >;

    let pointIndex = 0;
    for (let ix = 0; ix < AMOUNT_X; ix += 1) {
      for (let iy = 0; iy < AMOUNT_Y; iy += 1) {
        const offset = pointIndex * 3;
        positions[offset + 1] =
          Math.sin((ix + count) * 0.3) * 50 +
          Math.sin((iy + count) * 0.5) * 50;
        pointIndex += 1;
      }
    }

    attribute.needsUpdate = true;
    renderer.render(scene, camera);

    if (!ready) {
      ready = true;
      onReady();
    }

    count += reduceMotion ? 0.035 : 0.1;
    animationFrame = window.requestAnimationFrame(renderFrame);
  };

  const handleVisibilityChange = () => {
    visible = !document.hidden;
    if (visible && animationFrame === null) {
      renderFrame();
    }
  };

  resize();
  renderer.render(scene, camera);

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(host);
  } else {
    window.addEventListener('resize', resize);
  }

  intersectionObserver = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting && !document.hidden;
      if (visible && animationFrame === null) {
        renderFrame();
      }
    },
    { threshold: 0.02 },
  );
  intersectionObserver.observe(host);

  document.addEventListener('visibilitychange', handleVisibilityChange);
  renderFrame();

  return () => {
    if (animationFrame !== null) {
      window.cancelAnimationFrame(animationFrame);
    }
    intersectionObserver?.disconnect();
    resizeObserver?.disconnect();
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', handleVisibilityChange);

    geometry.dispose();
    material.dispose();
    renderer.dispose();
    renderer.forceContextLoss?.();

    if (renderer.domElement.parentNode === host) {
      host.removeChild(renderer.domElement);
    }
  };
}

export default function DottedSurface({ className = '' }: DottedSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const webglHostRef = useRef<HTMLDivElement | null>(null);
  const [webglReady, setWebglReady] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    return setupFallbackCanvas(canvas, theme);
  }, [theme]);

  useEffect(() => {
    const host = webglHostRef.current;
    if (!host) {
      return;
    }

    let mounted = true;
    let cleanup: (() => void) | undefined;

    setWebglReady(false);
    clearChildren(host);

    if (!supportsWebGl()) {
      return () => undefined;
    }

    void setupWebGlSurface(host, theme, () => {
      if (mounted) {
        setWebglReady(true);
      }
    })
      .then((dispose) => {
        cleanup = dispose;
      })
      .catch((error) => {
        console.warn('DottedSurface enhanced mode disabled, fallback preserved.', error);
        if (mounted) {
          setWebglReady(false);
          clearChildren(host);
        }
      });

    return () => {
      mounted = false;
      cleanup?.();
      clearChildren(host);
    };
  }, [theme]);

  return (
    <div
      className={`pointer-events-none relative overflow-hidden ${className}`.trim()}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 h-full w-full transition-opacity duration-500 ${
          webglReady ? 'opacity-0' : 'opacity-100'
        }`}
      />
      <div
        ref={webglHostRef}
        className={`absolute inset-0 transition-opacity duration-500 ${
          webglReady ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
}
