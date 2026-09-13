/** Contact form: inline validation, JSON submit to Web3Forms, in-place success without a reload. */
const form = document.getElementById('contact-form') as HTMLFormElement | null;

if (form) {
  const button = form.querySelector<HTMLButtonElement>('button[type=submit]')!;
  const success = form.querySelector<HTMLElement>('#contact-success')!;
  const networkErr = form.querySelector<HTMLElement>('#cf-network-err')!;
  const fields = ['name', 'reach', 'need'].map(
    (n) => form.elements.namedItem(n) as HTMLInputElement | HTMLTextAreaElement,
  );
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRe = /^[+()\-.\s\d]{7,}$/;

  const setError = (field: HTMLInputElement | HTMLTextAreaElement, message: string | null) => {
    const el = document.getElementById(`${field.id}-err`)!;
    if (message) {
      el.textContent = message;
      el.hidden = false;
      field.setAttribute('aria-invalid', 'true');
    } else {
      el.hidden = true;
      field.removeAttribute('aria-invalid');
    }
  };

  const validate = (): boolean => {
    let firstInvalid: HTMLElement | null = null;
    for (const field of fields) {
      const value = field.value.trim();
      let message: string | null = null;
      if (!value) message = field.dataset.errEmpty ?? null;
      else if (field.name === 'reach' && !emailRe.test(value) && !phoneRe.test(value))
        message = field.dataset.errInvalid ?? null;
      setError(field, message);
      if (message && !firstInvalid) firstInvalid = field;
    }
    firstInvalid?.focus();
    return !firstInvalid;
  };

  for (const field of fields) field.addEventListener('input', () => setError(field, null));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    networkErr.hidden = true;
    if (!validate()) return;

    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const reach = data.reach.trim();
    if (reach.includes('@')) data.email = reach;
    else data.phone = reach;
    data.subject = `New project inquiry from ${data.name.trim()}`;

    button.disabled = true;
    button.textContent = form.dataset.sending ?? '';
    form.setAttribute('aria-busy', 'true');
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) throw new Error('rejected');
      success.hidden = false;
      requestAnimationFrame(() => {
        form.classList.add('is-sent');
        success.focus();
      });
    } catch {
      networkErr.hidden = false;
      button.disabled = false;
      button.textContent = form.dataset.submit ?? '';
    } finally {
      form.removeAttribute('aria-busy');
    }
  });
}
