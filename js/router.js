// Jednostavan ruter preko # adrese, sa sopstvenom istorijom za dugme "Nazad".

const stack = [];
let replaceNext = false;
let renderer = null;
let lastWasBack = false;

export const setRenderer = (fn) => { renderer = fn; };
export const rerender = () => renderer?.({ keepScroll: true });

export function go(hash, { replace = false } = {}) {
  if (replace) {
    replaceNext = true;
    location.replace(hash);
  } else {
    location.hash = hash;
  }
}

export function back(fallback = '#/') {
  if (stack.length > 1) history.back();
  else go(fallback, { replace: true });
}

/** Poziva se na svaku promenu adrese; vraća true ako je to bio korak nazad. */
export function track(hash) {
  if (replaceNext) {
    replaceNext = false;
    if (stack.length) stack[stack.length - 1] = hash; else stack.push(hash);
    lastWasBack = false;
  } else if (stack.length > 1 && stack[stack.length - 2] === hash) {
    stack.pop();
    lastWasBack = true;
  } else if (stack[stack.length - 1] !== hash) {
    stack.push(hash);
    lastWasBack = false;
  }
  return lastWasBack;
}

export const currentHash = () => location.hash || '#/';

export function el(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div;
}
