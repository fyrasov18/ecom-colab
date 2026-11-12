"use client";

import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  alpha: number;
  life: number;
  maxLife: number;
};

const COLORS = [
  "#f59e0b", // Amber
  "#eab308", // Yellow
  "#ec4899", // Pink
  "#8b5cf6", // Purple
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#ef4444", // Red
];

export function CelebrationConfetti({ duration = 4000 }: { duration?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // Respect user's reduced-motion preference for accessibility
    if (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const particles: Particle[] = [];
    const count = 120;

    for (let i = 0; i < count; i++) {
      particles.push({
        x: width * (0.2 + Math.random() * 0.6),
        y: height * 0.4 + Math.random() * 50,
        vx: (Math.random() - 0.5) * 16,
        vy: -Math.random() * 14 - 4,
        size: Math.random() * 8 + 5,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        alpha: 1,
        life: 0,
        maxLife: Math.random() * 100 + 80,
      });
    }

    let animationFrameId: number;
    const startTime = Date.now();

    const render = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed > duration && particles.length === 0) {
        return;
      }

      ctx.clearRect(0, 0, width, height);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.35; // Gravity
        p.vx *= 0.98; // Air drag
        p.rotation += p.rotationSpeed;

        if (p.life > p.maxLife * 0.7) {
          p.alpha = Math.max(0, 1 - (p.life - p.maxLife * 0.7) / (p.maxLife * 0.3));
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();

        if (p.life >= p.maxLife || p.y > height + 20) {
          particles.splice(i, 1);
        }
      }

      if (particles.length > 0 || elapsed < duration) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
    };
  }, [duration]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-60"
      style={{ width: "100%", height: "100%" }}
    />
  );
}
