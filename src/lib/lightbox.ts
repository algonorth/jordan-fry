/** Gallery lightbox on a native <dialog>: arrow keys, Esc, backdrop click, focus returned to the opener. */
const dialog = document.getElementById('lightbox') as HTMLDialogElement | null;

if (dialog) {
  const slides = Array.from(dialog.querySelectorAll<HTMLElement>('[data-slide]'));
  const status = dialog.querySelector<HTMLElement>('#lightbox-status')!;
  const count = dialog.querySelector<HTMLElement>('#lightbox-count');
  const caption = dialog.querySelector<HTMLElement>('#lightbox-caption');
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
  dialog.querySelector('[data-lightbox-prev]')?.addEventListener('click', () => show(index - 1));
  dialog.querySelector('[data-lightbox-next]')?.addEventListener('click', () => show(index + 1));
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(index - 1);
    if (e.key === 'ArrowRight') show(index + 1);
  });
  // Backdrop click: the slide list ignores pointer events, so empty space targets the dialog itself.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => opener?.focus());
}
