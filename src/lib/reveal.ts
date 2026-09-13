/** Section reveals: children of [data-reveal] fade and rise once when the group enters the viewport. */
const groups = document.querySelectorAll<HTMLElement>('[data-reveal]');

if (groups.length) {
  for (const group of groups) {
    Array.from(group.children).forEach((child, i) =>
      (child as HTMLElement).style.setProperty('--i', String(i)),
    );
  }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) {
    groups.forEach((g) => g.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -12% 0px' },
    );
    groups.forEach((g) => io.observe(g));
  }
}
