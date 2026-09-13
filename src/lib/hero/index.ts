/**
 * "Sawdust forms the name": mounts the particle hero on a canvas behind the page.
 * The HTML <h1> is always the real headline. In live mode it stays invisible while the dust drifts
 * and flies into its glyphs, then the name motes fade out as the headline rises to full strength.
 */
import { OrthographicCamera, Scene, WebGLRenderer } from 'three';
import { createParticles } from './particles';
import { createPointer } from './pointer';
import { createScrollState } from './scroll';
import {
  assignTargets,
  measureNameBox,
  sampleText,
  waitForFont,
  type NameBox,
  type TargetSet,
} from './sampleText';
import { createFrameProbe, pickTier, TIERS, type QualityTier } from './quality';

export interface HeroOptions {
  nameEl: HTMLElement;
  heroEl: HTMLElement;
  lineSelector?: string;
  tier?: QualityTier | 'auto';
  allowSoftwareGL?: boolean;
  /**
   * `true` renders one finished frame and never animates. Defaults to `false`: Windows reports
   * `prefers-reduced-motion` whenever "Show animations in Windows" is off, which is common on
   * machines that have never asked for it, and the hero is drifting dust with no parallax or zoom,
   * so the OS flag is not consulted (user decision). Pass `'auto'` to honour it.
   */
  reducedMotion?: boolean | 'auto';
  debug?: boolean;
  onReady?: () => void;
}

export interface HeroHandle {
  readonly mode: 'live' | 'static' | 'fallback';
  readonly tier: QualityTier;
  setPaused(p: boolean): void;
  dispose(): void;
}

const SEED = 1337;
const live = new Set<HeroHandle>();

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
    return { mode: 'fallback', tier, setPaused() {}, dispose() {} };
  }

  const dispose: Array<() => void> = [];
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cfg.dprCap));
  const gl = renderer.getContext();
  const maxPoint = (gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array)[1] ?? 64;

  const css = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  const system = createParticles(
    cfg,
    SEED,
    {
      ember: token('--hero-ember', '#7A2E12'),
      amber: token('--hero-amber', '#E9A23B'),
      white: token('--hero-white', '#FFF1D6'),
    },
    maxPoint,
  );
  const { uniforms } = system;
  const scene = new Scene();
  scene.add(system.points);
  const camera = new OrthographicCamera(0, 1, 0, 1, -1, 1);

  // Compile now and check the link result. Some mobile GPU compilers reject a shader that every
  // desktop accepts; the hero must then bow out so the headline shows, instead of drawing nothing.
  renderer.compile(scene, camera);
  type Diagnosed = { diagnostics?: { runnable: boolean; programLog: string } };
  const broken = (renderer.info.programs as Diagnosed[] | null)?.find(
    (p) => p.diagnostics && !p.diagnostics.runnable,
  );
  if (broken) {
    if (opts.debug) console.warn('hero: shader failed to link, falling back', broken.diagnostics?.programLog);
    system.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    return { mode: 'fallback', tier, setPaused() {}, dispose() {} };
  }

  const mode: 'live' | 'static' = reduced ? 'static' : 'live';
  if (mode === 'static') canvas.classList.add('is-static');

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

  // --- text targets ---------------------------------------------------------
  let nb: NameBox = measureNameBox(opts.nameEl, opts.lineSelector);
  await waitForFont(nb.font);
  nb = measureNameBox(opts.nameEl, opts.lineSelector);
  let set: TargetSet = sampleText(nb, { seed: SEED });
  system.setTargets(assignTargets(set, system.count, cfg.nameFraction, SEED));

  const scroll = createScrollState(opts.heroEl, () => {
    if (mode === 'live') start();
  });
  const updateNameBox = () => {
    const y = mode === 'static' ? nb.docTop : nb.docTop - window.scrollY;
    uniforms.uNameBox.value.set(nb.left, y, nb.width, nb.height);
  };
  const resample = () => {
    nb = measureNameBox(opts.nameEl, opts.lineSelector);
    const next = sampleText(nb, { seed: SEED });
    const drift = next.signature.reduce((m, v, i) => Math.max(m, Math.abs(v - (set.signature[i] ?? 0))), 0);
    if (next.signature.length !== set.signature.length || drift > 0.005) {
      set = next;
      system.setTargets(assignTargets(set, system.count, cfg.nameFraction, SEED));
    }
    updateNameBox();
    drawDebug();
  };
  updateNameBox();

  // --- debug overlay (`?debug=hero`): sampled targets drawn over the headline ---------------------
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
    ctx.fillStyle = 'rgba(255,0,255,.6)';
    for (let i = 0; i < set.count; i += 3) {
      ctx.fillRect(nb.left + set.uv[i * 2]! * nb.width, y + set.uv[i * 2 + 1]! * nb.height, 1, 1);
    }
  };
  drawDebug();

  // --- pointer / probe ------------------------------------------------------
  const pointer = createPointer({
    coarse: matchMedia('(pointer: coarse)').matches,
    trailCount: cfg.trailCount,
  });
  dispose.push(() => pointer.dispose());
  let drawCount = system.count;
  const probe = createFrameProbe({
    warmupFrames: 45,
    sampleFrames: 60,
    thresholdMs: 20,
    maxSteps: 2,
    onStepDown() {
      drawCount = Math.floor(drawCount * 0.4);
      system.setDrawCount(drawCount);
      renderer.setPixelRatio(Math.max(1, renderer.getPixelRatio() * 0.75));
      setSize();
    },
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
  // Intro beats, in seconds of rendered time after the first frame: the canvas fades in over
  // 0.6s while the headline hands off to the dust; the dust drifts alone; then it flies in.
  const DRIFT_ALONE = 0.9;
  const MORPH_SECS = 2.1;
  const SETTLE_SECS = 1.3; // name motes fade out while the headline rises (`.is-lit`)

  const renderOnce = () => {
    updateNameBox();
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

    pointer.update(dt);
    const ps = pointer.state;
    uniforms.uPointer.value.set(ps.pos.x, ps.pos.y, ps.strength, ps.radius);
    uniforms.uPointerVel.value.copy(ps.vel);
    uniforms.uTrail.value = ps.trail;

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
    }
    raf = requestAnimationFrame(tick);
  };
  const start = () => {
    if (raf || paused || document.hidden || mode !== 'live') return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  };
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
        updateNameBox();
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

  const handle: HeroHandle = {
    mode,
    tier,
    setPaused(p) {
      paused = p;
      if (p) stop();
      else start();
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
