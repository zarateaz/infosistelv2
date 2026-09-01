"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const PARTICLE_COUNT_DESKTOP = 22000;
const PARTICLE_COUNT_MOBILE = 9000;
const BRANCHES = 3;
const INNER_RADIUS = 0.7; // empty around the origin — the "event horizon"
const OUTER_RADIUS = 5.2;

/** Full-screen WebGL "black hole" accretion-disk galaxy behind the admin
 *  login — real Three.js this time (the user explicitly asked for actual
 *  3D and confirmed they're fine spending the extra weight on this one
 *  route). Structurally the classic Three.js Journey galaxy-generator
 *  technique (power-curved radius + per-branch spin + randomness offset,
 *  additive-blended Points) but with an excluded inner radius so the
 *  center reads as a void instead of the usual dense core, and a slowly
 *  orbiting camera on top of the disk's own rotation so parallax actually
 *  reads as 3D rather than a flat sprite field. Cyberpunk-blue only, per
 *  the user's explicit color call. Falls back to nothing (page keeps its
 *  own dark background) if WebGL isn't available — this is a login page,
 *  it has to keep working either way. */
export function GalaxyBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    } catch {
      return; // no WebGL — leave the page's plain dark background as-is
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);

    const insideColor = new THREE.Color("#bff3ff"); // near-white cyan, edge of the disk's hot inner rim
    const midColor = new THREE.Color("#2ea3ff"); // cyberpunk blue
    const outsideColor = new THREE.Color("#071b4d"); // deep indigo, outer halo

    let geometry: THREE.BufferGeometry;
    let points: THREE.Points;
    let rafId = 0;
    let disposed = false;

    function buildGalaxy(width: number) {
      if (geometry) geometry.dispose();
      if (points) scene.remove(points);

      const count = width < 768 ? PARTICLE_COUNT_MOBILE : PARTICLE_COUNT_DESKTOP;
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;

        // Power curve biases particles toward the inner edge (the bright
        // accretion ring) and thins them out toward the halo.
        const t = Math.pow(Math.random(), 2.4);
        const radius = INNER_RADIUS + t * (OUTER_RADIUS - INNER_RADIUS);

        const branchAngle = ((i % BRANCHES) / BRANCHES) * Math.PI * 2;
        const spinAngle = radius * 0.55;

        // spread already scales with radius via the ratio term — do not
        // multiply by radius again here, or outer particles fly off far
        // past OUTER_RADIUS and the disk stops reading as a cohesive shape.
        const randomPower = 2.5;
        const spread = 0.5 * (radius / OUTER_RADIUS) + 0.06;
        const randomX = Math.pow(Math.random(), randomPower) * (Math.random() < 0.5 ? 1 : -1) * spread;
        const randomY = Math.pow(Math.random(), randomPower) * (Math.random() < 0.5 ? 1 : -1) * spread * 0.2;
        const randomZ = Math.pow(Math.random(), randomPower) * (Math.random() < 0.5 ? 1 : -1) * spread;

        const angle = branchAngle + spinAngle;
        positions[i3] = Math.cos(angle) * radius + randomX;
        positions[i3 + 1] = randomY;
        positions[i3 + 2] = Math.sin(angle) * radius + randomZ;

        const mixed = insideColor.clone();
        if (t < 0.5) {
          mixed.lerpColors(insideColor, midColor, t * 2);
        } else {
          mixed.lerpColors(midColor, outsideColor, (t - 0.5) * 2);
        }
        colors[i3] = mixed.r;
        colors[i3 + 1] = mixed.g;
        colors[i3 + 2] = mixed.b;
      }

      geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: 0.045,
        sizeAttenuation: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
      });

      points = new THREE.Points(geometry, material);
      scene.add(points);
    }

    function resize() {
      const parent = canvas!.parentElement;
      if (!parent) return;
      const width = parent.clientWidth;
      const height = parent.clientHeight;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      buildGalaxy(width);
    }

    renderer.setClearColor(new THREE.Color("#04070f"), 1);

    // Spherical orbit (fixed polar angle, slow azimuth spin) — always keeps
    // the disk face-on enough to read as a full ellipse. An XZ-only orbit
    // at low elevation let the disk go edge-on at some angles and collapse
    // into a thin streak, which is what made the first pass look flat.
    let azimuth = 0.6;
    const polar = 0.85; // radians from +Y — ~49° down from directly overhead
    const camDistance = 7;
    function render(time: number) {
      if (disposed) return;
      const t = time / 1000;

      if (!reducedMotion) {
        azimuth += 0.00022;
        points.rotation.y += 0.0009;
      }
      const wobble = reducedMotion ? 0 : Math.sin(t * 0.15) * 0.05;
      camera.position.x = camDistance * Math.sin(polar + wobble) * Math.cos(azimuth);
      camera.position.z = camDistance * Math.sin(polar + wobble) * Math.sin(azimuth);
      camera.position.y = camDistance * Math.cos(polar + wobble);
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(render);
    }

    resize();
    window.addEventListener("resize", resize);
    rafId = requestAnimationFrame(render);

    return () => {
      disposed = true;
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(rafId);
      geometry?.dispose();
      (points?.material as THREE.Material | undefined)?.dispose();
      renderer.dispose();
    };
  }, [reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
