/* Frozen demonstration boundary. Kept local to every immutable snapshot. */
(() => {
  const NativeDate = Date;
  const epoch = NativeDate.parse('2026-09-15T02:00:00Z');
  function FrozenDate(...args) {
    if (!new.target) return new NativeDate(epoch).toString();
    return Reflect.construct(NativeDate, args.length ? args : [epoch], new.target);
  }
  Object.setPrototypeOf(FrozenDate, NativeDate);
  FrozenDate.prototype = NativeDate.prototype;
  FrozenDate.now = () => epoch;
  window.Date = FrozenDate;
  let seed = 915;
  Math.random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  let failed = false;
  window.addEventListener('error', () => { failed = true; }, true);
  window.addEventListener('unhandledrejection', () => { failed = true; });
  const base = new URL('.', location.href);
  const notify = (type) => {
    if (window.parent !== window) window.parent.postMessage({ type, path: location.pathname }, '*');
  };
  window.addEventListener('load', () => {
    const label = document.createElement('div');
    label.id = 'ui-lab-freeze-notice';
    label.textContent = '冻结交互快照 · 全部为演示数据 · 不代表当前正式产品';
    label.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:2147483647;padding:5px 10px;background:#202020;color:#fff;font:11px/1.5 system-ui;text-align:center;pointer-events:none';
    document.body.append(label);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const imagesOK = [...document.images].every(img => !img.src || (img.complete && img.naturalWidth > 0));
      notify(failed || !imagesOK ? 'ui-lab:error' : 'ui-lab:ready');
    }));
  });
  document.addEventListener('submit', event => event.preventDefault());
  // Sandbox blocks native form submission before submit handlers can run.
  // Dispatch only local events, retaining native constraint validation.
  function submitDemo(form, submitter) {
    if (!form.reportValidity()) return;
    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true, submitter }));
  }
  document.addEventListener('click', event => {
    const button = event.target.closest?.('button, input[type="submit"]');
    if (button?.form && button.type === 'submit') {
      event.preventDefault();
      submitDemo(button.form, button);
    }
  }, true);
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    if (!link) return;
    const dest = new URL(link.getAttribute('href'), location.href);
    if (dest.origin !== base.origin || !dest.pathname.startsWith(base.pathname) || link.target || link.hasAttribute('download')) {
      event.preventDefault();
      const label = document.getElementById('ui-lab-freeze-notice');
      if (label) label.textContent = '冻结快照仅保留版本内页面，请使用外层查看器返回。';
    }
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') notify('ui-lab:exit');
    if (event.key === 'Enter' && !event.isComposing && event.target.matches?.('input:not([type="checkbox"]):not([type="radio"])') && event.target.form) {
      event.preventDefault();
      submitDemo(event.target.form, null);
    }
  });
})();
