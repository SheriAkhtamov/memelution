import { useCallback, useEffect, useRef, useState } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
}

const COLORS = ['#FF6B00', '#7C3AED', '#2AABEE', '#22c55e', '#f59e0b', '#ef4444', '#ec4899'];

function createParticles(count: number): Particle[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * window.innerWidth,
    y: -20 - Math.random() * 100,
    vx: (Math.random() - 0.5) * 6,
    vy: Math.random() * 4 + 2,
    size: Math.random() * 8 + 4,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 10,
    opacity: 1,
  }));
}

/**
 * Lightweight canvas-based confetti overlay.
 * Renders a burst of colored particles that fall and fade out.
 */
export function ConfettiCelebration({
  active,
  onComplete,
  title,
  description,
}: {
  active: boolean;
  onComplete?: () => void;
  title?: string;
  description?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);
  const [showBanner, setShowBanner] = useState(false);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;

    for (const p of particlesRef.current) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1; // gravity
      p.rotation += p.rotationSpeed;
      p.opacity -= 0.003;

      if (p.opacity <= 0 || p.y > canvas.height + 20) continue;
      alive = true;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }

    if (alive) {
      rafRef.current = requestAnimationFrame(animate);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      onComplete?.();
    }
  }, [onComplete]);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    particlesRef.current = reducedMotion ? [] : createParticles(80);
    setShowBanner(true);
    if (!reducedMotion) {
      rafRef.current = requestAnimationFrame(animate);
    } else {
      onComplete?.();
    }

    const bannerTimer = setTimeout(() => setShowBanner(false), reducedMotion ? 1800 : 3500);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(bannerTimer);
    };
  }, [active, animate, onComplete]);

  if (!active) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[200]">
      <canvas ref={canvasRef} className="absolute inset-0" aria-hidden />
      {showBanner && title && (
        <div
          className="absolute inset-x-0 top-20 flex justify-center motion-safe:animate-in motion-safe:slide-in-from-top-8 motion-safe:fade-in motion-safe:duration-500"
          role="status"
          aria-live="polite"
        >
          <div className="pointer-events-auto rounded-2xl border border-orange-200 bg-white/95 px-8 py-5 text-center shadow-2xl backdrop-blur dark:border-orange-900 dark:bg-zinc-950/95">
            <span className="mb-2 block text-3xl" aria-hidden>🏆</span>
            <p className="text-lg font-black text-[#FF6B00]">{title}</p>
            {description && <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{description}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
