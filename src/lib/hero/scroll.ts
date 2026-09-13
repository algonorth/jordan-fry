export type Zone = 'hero' | 'ambient' | 'far';

/** Scroll position → dissolve target and render zone. Reads layout only in measure(). */
export function createScrollState(heroEl: HTMLElement, onScroll?: () => void) {
  let heroH = 1;
  let vh = 1;
  const state = { y: 0, dissolveTarget: 0, zone: 'hero' as Zone };

  const update = () => {
    const y = window.scrollY;
    state.y = y;
    state.dissolveTarget = Math.min(1, Math.max(0, y / (0.8 * heroH)));
    state.zone = y < heroH ? 'hero' : y < heroH + 1.5 * vh ? 'ambient' : 'far';
  };
  const measure = () => {
    heroH = heroEl.offsetHeight || 1;
    vh = window.innerHeight || 1;
    update();
  };
  const handler = () => {
    update();
    onScroll?.();
  };
  addEventListener('scroll', handler, { passive: true });
  measure();

  return {
    get y() {
      return state.y;
    },
    get dissolveTarget() {
      return state.dissolveTarget;
    },
    get zone() {
      return state.zone;
    },
    measure,
    dispose() {
      removeEventListener('scroll', handler);
    },
  };
}
