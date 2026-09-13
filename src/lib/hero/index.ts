/**
 * "Sawdust forms the name": mounts the particle hero on a canvas behind the page.
 * The HTML <h1> is the real headline for readers, screen readers and search engines, but while
 * the hero runs it is never painted: the dust drifts, flies into the glyphs and then *is* the
 * name, one mote per device pixel of the type, each a flat linen dot with its pixel's coverage,
 * so at rest the particles are the typeset headline pixel for pixel. Whatever moves a pixel (the
 * pointer, a finger, a tap's gust, the scroll) turns it back into dust until it drifts home.
 * Without WebGL, or if the hero fails to start, the headline simply shows.
 */
import { OrthographicCamera, Scene, Vector2, WebGLRenderer } from 'three';
import { BURST_N, createParticles } from './particles';
import { createPointer } from './pointer';
import { createScrollState } from './scroll';
import { measureNameBox, sampleText, waitForFont, type NameBox, type TargetSet } from './sampleText';
import { createFrameProbe, pickTier, TIERS, type QualityTier } from './quality';

export interface HeroOptions {
  nameEl: HTMLElement;
  heroEl: HTMLElement;
  lineSelector?: string;
  tier?: QualityTier | 'auto';
  allowSoftwareGL?: boolean;
  /**
   * `true` renders one still frame of the shaft's dust and leaves the typeset headline in place.
   * Defaults to `false`: Windows reports `prefers-reduced-motion` whenever "Show animations in
   * Windows" is off, which is common on machines that have never asked for it, and the hero is
   * drifting dust with no parallax or zoom, so the OS flag is not consulted (user decision). Pass
   * `'auto'` to honour it.
   */
  reducedMotion?: boolean | 'auto';
  debug?: boolean;
  onReady?: () => void;
}

export interface HeroHandle {
  readonly mode: 'live' | 'static' | 'fallback';
  readonly tier: QualityTier;
  /** motes drawn per frame: name pixels, idle grains and ambient dust */
  readonly motes: number;
  setPaused(p: boolean): void;
  /** Viewport points (CSS px) that lie well inside the glyphs: places to check the name's pixels. */
  probePoints(n?: number): [number, number][];
  /** Renders a frame and returns the brightest of the 3×3 drawing-buffer pixels around a point. */
  samplePixel(x: number, y: number): [number, number, number, number];
  dispose(): void;
}

const SEED = 1337;
const live = new Set<HeroHandle>();

const fallback = (tier: QualityTier): HeroHandle => ({
  mode: 'fallback',
  tier,
  motes: 0,
  setPaused() {},
  probePoints: () => [],
  samplePixel: () => [0, 0, 0, 0],
  dispose() {},
});

export async function mountHero(canvas: HTMLCanvasElement, opts: HeroOptions): Promise<HeroHandle> {
  const reduceMq = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = opts.reducedMotion === 'auto' ? reduceMq.matches : Boolean(opts.reducedMotion);
  const tier: QualityTier = opts.tier === undefined || opts.tier === 'auto' ? pickTier() : opts.tier;
  const cfg = TIERS[tier];

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: !opts.allowSoftwareGL,
    });
  } catch {
    return fallback(tier);
  }

  const dispose: Array<() => void> = [];
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cfg.dprCap));
  const gl = renderer.getContext();
  const maxPoint = (gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array)[1] ?? 64;

  const css = getComputedStyle(document.documentElement);
  const token = (name: string, fb: string) => css.getPropertyValue(name).trim() || fb;
  const system = createParticles(
    cfg,
    SEED,
    {
      ember: token('--hero-ember', '#7A2E12'),
      amber: token('--hero-amber', '#E9A23B'),
      white: token('--hero-white', '#FFF1D6'),
      linen: token('--color-fg', '#F3EBE0'),
    },
    maxPoint,
  );
  const { uniforms } = system;
  const scene = new Scene();
  scene.add(system.ambient);
  scene.add(system.name);
  const camera = new OrthographicCamera(0, 1, 0, 1, -1, 1);

  // Compile now and check the link result. Some mobile GPU compilers reject a shader that every
  // desktop accepts; the hero must then bow out so the headline shows, instead of drawing nothing.
  // (With KHR_parallel_shader_compile three fills in `diagnostics` lazily, so the link status is
  // asked of the GL program directly; that waits for the compile, once, here.)
  renderer.compile(scene, camera);
  type Compiled = { program?: WebGLProgram; diagnostics?: { runnable: boolean; programLog: string } };
  const broken = (renderer.info.programs as Compiled[] | null)?.find(
    (p) =>
      (p.diagnostics && !p.diagnostics.runnable) ||
      (p.program && !gl.getProgramParameter(p.program, gl.LINK_STATUS)),
  );
  if (broken) {
    if (opts.debug) console.warn('hero: shader failed to link, falling back', broken.diagnostics?.programLog);
    system.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    return fallback(tier);
  }

  const mode: 'live' | 'static' = reduced ? 'static' : 'live';
  if (mode === 'static') {
    // Motion off: the still frame is the shaft's dust under the real, typeset headline.
    canvas.classList.add('is-static');
    system.name.visible = false;
  }

  // --- sizing -------------------------------------------------------------
  const setSize = () => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.right = w;
    camera.bottom = h;
    camera.updateProjectionMatrix();
    uniforms.uField.value.set(w, h);
    uniforms.uShaftDir.value.set(0.35 * w, 1.2 * h).normalize();
    uniforms.uPixelRatio.value = renderer.getPixelRatio();
  };
  setSize();

  // --- the name's pixels ----------------------------------------------------------------------
  let nb: NameBox = measureNameBox(opts.nameEl, opts.lineSelector);
  await waitForFont(nb.font);
  nb = measureNameBox(opts.nameEl, opts.lineSelector);
  const sample = () => sampleText(nb, { dpr: renderer.getPixelRatio(), cap: cfg.nameCap });
  let set: TargetSet = sample();
  system.setTargets(set);

  const scroll = createScrollState(opts.heroEl, () => {
    if (mode !== 'live') return;
    if (asleep) wake();
    else start();
  });
  /** The name's top-left corner in CSS px, snapped to the device grid so every mote is a whole pixel. */
  const updateNameOrigin = () => {
    const dpr = renderer.getPixelRatio();
    const y = mode === 'static' ? nb.docTop : nb.docTop - window.scrollY;
    uniforms.uNameOrigin.value.set(Math.round(nb.left * dpr) / dpr, Math.round(y * dpr) / dpr);
    uniforms.uNameSize.value.set(nb.width * dpr, nb.height * dpr);
  };
  const resample = () => {
    nb = measureNameBox(opts.nameEl, opts.lineSelector);
    const next = sample();
    const drift = next.signature.reduce((m, v, i) => Math.max(m, Math.abs(v - (set.signature[i] ?? 0))), 0);
    if (next.signature.length !== set.signature.length || drift > 0.005 || next.count !== set.count) {
      set = next;
      system.setTargets(set);
    }
    updateNameOrigin();
    drawDebug();
  };
  updateNameOrigin();

  // --- debug overlay (`?debug=hero`): sampled pixels drawn over the headline ---------------------
  let debugCanvas: HTMLCanvasElement | null = null;
  const drawDebug = () => {
    if (!opts.debug) return;
    if (!debugCanvas) {
      debugCanvas = document.createElement('canvas');
      debugCanvas.style.cssText =
        'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:100';
      document.body.appendChild(debugCanvas);
      dispose.push(() => debugCanvas?.remove());
    }
    const w = window.innerWidth,
      h = window.innerHeight;
    debugCanvas.width = w;
    debugCanvas.height = h;
    const ctx = debugCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, w, h);
    const y = nb.docTop - window.scrollY;
    ctx.strokeStyle = 'rgba(0,255,255,.8)';
    ctx.strokeRect(nb.left, y, nb.width, nb.height);
    ctx.fillStyle = 'rgba(255,0,255,.5)';
    const dpr = renderer.getPixelRatio();
    const o = uniforms.uNameOrigin.value;
    for (let i = 0; i < set.count; i += 9) {
      ctx.fillRect(o.x + set.xy[i * 2]! / dpr, o.y + set.xy[i * 2 + 1]! / dpr, 1, 1);
    }
  };
  drawDebug();

  // --- pointer / probe ------------------------------------------------------
  const pointer = createPointer({
    coarse: matchMedia('(pointer: coarse)').matches,
    trailCount: cfg.trailCount,
  });
  dispose.push(() => pointer.dispose());
  let ambientCount = cfg.ambient;
  const probe = createFrameProbe({
    warmupFrames: 45,
    sampleFrames: 60,
    thresholdMs: 20,
    maxSteps: 2,
    onStepDown() {
      // Fewer dust motes and a coarser canvas; the name is re-sampled at the new resolution.
      ambientCount = Math.floor(ambientCount * 0.5);
      system.setAmbientCount(ambientCount);
      renderer.setPixelRatio(Math.max(1, renderer.getPixelRatio() * 0.75));
      setSize();
      resample();
    },
  });

  // --- taps: gusts that throw the dust (and the name) outward ----------------------------------
  // Slots are recycled oldest first; ages run on the wall clock, -1 while a slot is empty.
  const bursts = Array.from({ length: BURST_N }, () => ({ x: 0, y: 0, radius: 0, at: -1 }));
  let burstHead = 0;
  const tap = (x: number, y: number) => {
    if (mode !== 'live' || !lit) return;
    const b = bursts[burstHead]!;
    burstHead = (burstHead + 1) % BURST_N;
    b.x = x;
    b.y = y;
    // Wide enough that a tap on the name scatters all of it, near letters far, far ones lightly.
    b.radius = Math.min(720, Math.max(180, 0.9 * Math.max(nb.width, nb.height)));
    b.at = performance.now();
    wake();
  };
  const burstsActive = (now: number) => bursts.some((b) => b.at >= 0 && now - b.at < 2300);
  const onControl = (e: Event) =>
    Boolean((e.target as Element | null)?.closest('a, button, input, textarea, select, label'));
  // A mouse gusts on press; a finger on a tap (a swipe across the name blows it instead, and a
  // scroll never reaches pointerup).
  let downX = 0;
  let downY = 0;
  const onPointerDown = (e: PointerEvent) => {
    downX = e.clientX;
    downY = e.clientY;
    if (e.pointerType === 'mouse' && e.button === 0 && !onControl(e)) tap(e.clientX, e.clientY);
  };
  const onPointerUp = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' || onControl(e)) return;
    if (Math.hypot(e.clientX - downX, e.clientY - downY) < 12) tap(e.clientX, e.clientY);
  };
  opts.heroEl.addEventListener('pointerdown', onPointerDown);
  opts.heroEl.addEventListener('pointerup', onPointerUp);
  dispose.push(() => {
    opts.heroEl.removeEventListener('pointerdown', onPointerDown);
    opts.heroEl.removeEventListener('pointerup', onPointerUp);
  });

  // --- loop ---------------------------------------------------------------
  let raf = 0;
  let paused = false;
  let last = 0;
  let clock = 0;
  let carry = 0;
  let skip = false;
  let ready = false;
  let forming = false;
  let lit = false;
  let morphStart = -1;
  // The dust settles a few seconds after the name has formed (the still frame is the designed
  // static state, and auto-motion longer than that needs a rest); a pointer wakes it. The name's
  // pixels never dim.
  let restAt = -1;
  let asleep = false;
  const REST_AFTER = 6;
  const REST_ALPHA = 0.7; // the settled field stays visible, only stiller and a little dimmer
  // Intro beats, in seconds of rendered time after the first frame: the canvas fades in over
  // 0.6s; the dust drifts alone; it flies in; the landed dust becomes the type.
  const DRIFT_ALONE = 0.9;
  const MORPH_SECS = 2.1;
  const SETTLE_SECS = 0.9;

  const renderOnce = () => {
    updateNameOrigin();
    renderer.render(scene, camera);
  };

  const tick = (now: number) => {
    raf = 0;
    if (paused || document.hidden) return;
    const dtMs = Math.min(33, now - last);
    last = now;
    if (scroll.zone === 'far') return; // the scroll listener restarts us
    if (scroll.zone === 'ambient') {
      skip = !skip;
      if (skip) {
        carry += dtMs / 1000;
        raf = requestAnimationFrame(tick);
        return;
      }
    }
    const dt = dtMs / 1000 + carry;
    carry = 0;
    clock += dt;

    uniforms.uTime.value = clock % 3600;
    if (morphStart >= 0) {
      const t = clock - morphStart;
      uniforms.uMorph.value = Math.min(1, Math.max(0, t / MORPH_SECS));
      uniforms.uSettle.value = Math.min(1, Math.max(0, (t - MORPH_SECS) / SETTLE_SECS));
    }
    uniforms.uDissolve.value +=
      (scroll.dissolveTarget - uniforms.uDissolve.value) * (1 - Math.exp(-dt / 0.14));
    const resting = restAt >= 0 && clock >= restAt;
    // Dims slowly into the rest, comes back quickly when something moves.
    uniforms.uGlobalAlpha.value +=
      ((resting ? REST_ALPHA : 1) - uniforms.uGlobalAlpha.value) *
      (1 - Math.exp(-dt / (resting ? 1.4 : 0.5)));

    pointer.update(dt);
    const ps = pointer.state;
    uniforms.uPointer.value.set(ps.pos.x, ps.pos.y, ps.strength, ps.radius);
    uniforms.uPointerVel.value.copy(ps.vel);
    uniforms.uTrail.value = ps.trail;
    const ub = uniforms.uBurst.value;
    const ua = uniforms.uBurstAge.value;
    bursts.forEach((b, i) => {
      if (b.at >= 0 && now - b.at > 2500) b.at = -1;
      ub[i * 4] = b.x;
      ub[i * 4 + 1] = b.y;
      ub[i * 4 + 2] = b.at < 0 ? 0 : 1;
      ub[i * 4 + 3] = b.radius;
      ua[i] = b.at < 0 ? -1 : (now - b.at) / 1000;
    });

    renderOnce();
    probe.tick(dtMs);

    if (!ready) {
      ready = true;
      forming = true;
      canvas.classList.add('is-live');
      opts.heroEl.classList.add('is-forming');
      morphStart = clock + DRIFT_ALONE;
      opts.onReady?.();
    }
    if (!lit && morphStart >= 0 && clock >= morphStart + MORPH_SECS) {
      lit = true;
      opts.heroEl.classList.add('is-lit');
      restAt = clock + REST_AFTER;
    }
    if (
      resting &&
      Math.abs(uniforms.uGlobalAlpha.value - REST_ALPHA) < 0.004 &&
      !ps.active &&
      !burstsActive(now)
    ) {
      // Settled: draw one still frame and stop until a pointer, a tap or a scroll wakes the dust.
      uniforms.uGlobalAlpha.value = REST_ALPHA;
      renderOnce();
      asleep = true;
      return;
    }
    raf = requestAnimationFrame(tick);
  };
  const start = () => {
    if (raf || paused || document.hidden || mode !== 'live') return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  };
  /** A pointer movement, a tap or a scroll brings the settled dust back for another while. */
  const wake = () => {
    if (mode !== 'live' || restAt < 0) return;
    restAt = clock + REST_AFTER;
    if (asleep) {
      asleep = false;
      start();
    }
  };
  addEventListener('pointermove', wake, { passive: true });
  dispose.push(() => removeEventListener('pointermove', wake));
  const stop = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };

  if (mode === 'static') {
    uniforms.uMorph.value = 1;
    uniforms.uSettle.value = 1;
    uniforms.uDissolve.value = 0;
    uniforms.uTime.value = 12;
    renderOnce();
    canvas.classList.add('is-live');
    opts.onReady?.();
  } else {
    start();
  }

  // --- events ---------------------------------------------------------------
  const onVisibility = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', onVisibility);
  dispose.push(() => document.removeEventListener('visibilitychange', onVisibility));

  let resizeTimer = 0;
  let measureRaf = 0;
  const ro = new ResizeObserver(() => {
    setSize();
    if (mode === 'static') renderOnce();
    if (!measureRaf) {
      measureRaf = requestAnimationFrame(() => {
        measureRaf = 0;
        nb = measureNameBox(opts.nameEl, opts.lineSelector);
        updateNameOrigin();
        scroll.measure();
        if (mode === 'static') renderOnce();
      });
    }
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      resample();
      if (mode === 'static') renderOnce();
    }, 250);
  });
  ro.observe(canvas);
  dispose.push(() => {
    ro.disconnect();
    clearTimeout(resizeTimer);
    if (measureRaf) cancelAnimationFrame(measureRaf);
  });

  const onFonts = () => resample();
  document.fonts.addEventListener('loadingdone', onFonts);
  dispose.push(() => document.fonts.removeEventListener('loadingdone', onFonts));

  // Losing the context shows the typeset headline; getting it back hides it behind the dust again.
  const onLost = (e: Event) => {
    e.preventDefault();
    stop();
    canvas.classList.remove('is-live');
    opts.heroEl.classList.remove('is-forming', 'is-lit');
  };
  const onRestored = () => {
    canvas.classList.add('is-live');
    if (forming) opts.heroEl.classList.add('is-forming');
    if (lit) opts.heroEl.classList.add('is-lit');
    if (mode === 'static') renderOnce();
    else start();
  };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);
  dispose.push(() => {
    canvas.removeEventListener('webglcontextlost', onLost);
    canvas.removeEventListener('webglcontextrestored', onRestored);
  });

  const onDebugScroll = () => drawDebug();
  if (opts.debug) {
    addEventListener('scroll', onDebugScroll, { passive: true });
    dispose.push(() => removeEventListener('scroll', onDebugScroll));
  }

  const bufferSize = new Vector2();
  const handle: HeroHandle = {
    mode,
    tier,
    get motes() {
      return system.motes;
    },
    setPaused(p) {
      paused = p;
      if (p) stop();
      else start();
    },
    probePoints(n = 5) {
      updateNameOrigin();
      const dpr = renderer.getPixelRatio();
      const o = uniforms.uNameOrigin.value;
      const out: [number, number][] = [];
      const step = Math.max(1, Math.floor(set.interior.length / n));
      for (let i = 0; i < set.interior.length && out.length < n; i += step) {
        const k = set.interior[i]!;
        out.push([o.x + set.xy[k * 2]! / dpr, o.y + set.xy[k * 2 + 1]! / dpr]);
      }
      return out;
    },
    samplePixel(x, y) {
      renderOnce();
      const dpr = renderer.getPixelRatio();
      renderer.getDrawingBufferSize(bufferSize);
      const px = Math.min(bufferSize.x - 3, Math.max(0, Math.round(x * dpr) - 1));
      const py = Math.min(bufferSize.y - 3, Math.max(0, Math.round(bufferSize.y - y * dpr) - 1));
      const buf = new Uint8Array(9 * 4);
      gl.readPixels(px, py, 3, 3, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      let best = 0;
      for (let i = 1; i < 9; i++) {
        if (
          buf[i * 4]! + buf[i * 4 + 1]! + buf[i * 4 + 2]! >
          buf[best * 4]! + buf[best * 4 + 1]! + buf[best * 4 + 2]!
        )
          best = i;
      }
      return [buf[best * 4]!, buf[best * 4 + 1]!, buf[best * 4 + 2]!, buf[best * 4 + 3]!];
    },
    dispose() {
      stop();
      probe.stop();
      scroll.dispose();
      for (const fn of dispose.splice(0)) fn();
      system.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.classList.remove('is-live', 'is-static');
      opts.heroEl.classList.remove('is-forming', 'is-lit');
      live.delete(handle);
    },
  };
  live.add(handle);
  if (opts.debug) (window as Window & { __hero?: HeroHandle }).__hero = handle;

  // In 'auto' mode a preference flipped while open remounts in the other mode.
  if (opts.reducedMotion === 'auto') {
    const onReduceChange = () => {
      handle.dispose();
      void mountHero(canvas, opts);
    };
    reduceMq.addEventListener('change', onReduceChange, { once: true });
    dispose.push(() => reduceMq.removeEventListener('change', onReduceChange));
  }

  return handle;
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    for (const h of live) h.dispose();
  });
}
