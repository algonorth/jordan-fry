/**
 * Gallery lightbox on a native <dialog>: arrow keys, Esc, backdrop click, swipe on touch, and focus
 * returned to the opener.
 */
const dialog = document.getElementById('lightbox') as HTMLDialogElement | null;

if (dialog) {
  const slides = Array.from(dialog.querySelectorAll<HTMLElement>('[data-slide]'));
  const status = dialog.querySelector<HTMLElement>('#lightbox-status')!;
  const count = dialog.querySelector<HTMLElement>('#lightbox-count');
  const caption = dialog.querySelector<HTMLElement>('#lightbox-caption');
  const stage = dialog.querySelector<HTMLElement>('[data-lightbox-stage]');
  const total = slides.length;
  let index = 0;
  let opener: HTMLElement | null = null;

  const show = (i: number) => {
    index = (i + total) % total;
    slides.forEach((s, j) => (s.hidden = j !== index));
    const alt = slides[index]?.querySelector('img')?.alt ?? '';
    status.textContent = `Photo ${index + 1} of ${total}, ${alt}`;
    if (count) count.textContent = `${index + 1} / ${total}`;
    if (caption) caption.textContent = alt;
  };

  for (const el of document.querySelectorAll<HTMLElement>('[data-lightbox-open]')) {
    el.addEventListener('click', () => {
      opener = el;
      show(Number(el.dataset.lightboxOpen));
      dialog.showModal();
    });
  }
  dialog.querySelector('[data-lightbox-close]')?.addEventListener('click', () => dialog.close());
  for (const b of dialog.querySelectorAll('[data-lightbox-prev]'))
    b.addEventListener('click', () => show(index - 1));
  for (const b of dialog.querySelectorAll('[data-lightbox-next]'))
    b.addEventListener('click', () => show(index + 1));
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(index - 1);
    if (e.key === 'ArrowRight') show(index + 1);
  });

  // Swipe: a mostly horizontal pointer travel of 40px or more moves one photo.
  let startX = 0;
  let startY = 0;
  let tracking = false;
  stage?.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    startX = e.clientX;
    startY = e.clientY;
    tracking = true;
  });
  stage?.addEventListener('pointerup', (e) => {
    if (!tracking || total < 2) return;
    tracking = false;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.5) show(dx < 0 ? index + 1 : index - 1);
  });
  stage?.addEventListener('pointercancel', () => (tracking = false));

  // Backdrop click: empty space targets the dialog itself (the stage swallows clicks on the photo).
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => opener?.focus());
}
