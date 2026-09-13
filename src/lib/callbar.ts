/**
 * Mobile call/text bar. It is on screen only when no other primary action is:
 * hidden while any [data-primary-cta] element is visible or a form field has focus.
 */
const bar = document.getElementById('callbar');
if (bar) {
  const targets = document.querySelectorAll<HTMLElement>('[data-primary-cta]');
  const inView = new Set<Element>();
  let fieldFocused = false;
  const update = () => bar.classList.toggle('is-visible', inView.size === 0 && !fieldFocused);

  if (targets.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          entry.isIntersecting ? inView.add(entry.target) : inView.delete(entry.target);
        update();
      },
      { threshold: 0.2 },
    );
    targets.forEach((t) => io.observe(t));
  } else {
    update();
  }
  addEventListener('focusin', (e) => {
    fieldFocused = (e.target as HTMLElement).matches?.('input, textarea, select') ?? false;
    update();
  });
  addEventListener('focusout', () => {
    fieldFocused = false;
    update();
  });
}
