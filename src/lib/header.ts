/** The header is transparent over the hero and gains a blurred ink ground once the page scrolls. */
const header = document.getElementById('site-header');
if (header) {
  const update = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
  update();
  addEventListener('scroll', update, { passive: true });
}
