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

/**
 * Raspored ekrana: sve osim donje trake (.actionbar) ide u .scroller koji se skroluje,
 * a traka ostaje ispod njega. Ostaje isti element, pa rukovaoci događaja i dalje rade.
 */
export function layoutView(root) {
  const oldScroller = root.querySelector(':scope > .scroller');
  const keep = oldScroller ? oldScroller.scrollTop : 0;
  root.classList.add('view-root');
  const nodes = [...root.childNodes];
  const bar = nodes.find((n) => n.nodeType === 1 && n.classList.contains('actionbar'));
  const scroller = document.createElement('div');
  scroller.className = 'scroller';
  for (const n of nodes) {
    if (n === bar) continue;
    if (n === oldScroller) { while (n.firstChild) scroller.appendChild(n.firstChild); n.remove(); }
    else scroller.appendChild(n);
  }
  root.replaceChildren(scroller);
  if (bar) root.appendChild(bar);
  scroller.scrollTop = keep;
  return scroller;
}

export function el(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div;
}
