// Module 823944. Returns a ref callback; while `enabled`, the node takes focus on attach
// (`[data-autofocus]`, else its first tabbable, else itself) and Tab/Shift+Tab wrap inside it.
import { useCallback, useEffect, useRef } from 'react';

function getTabbable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]')).filter(
    (el) =>
      el.tabIndex >= 0 &&
      !el.hasAttribute('disabled') &&
      el.getAttribute('aria-hidden') !== 'true' &&
      el.getClientRects().length > 0,
  );
}

function trapTab(root: HTMLElement, event: KeyboardEvent) {
  const tabbable = getTabbable(root);
  if (tabbable.length === 0) return event.preventDefault();
  const first = tabbable[0];
  const last = tabbable[tabbable.length - 1];
  const active = document.activeElement;
  if (active === (event.shiftKey ? first : last) || active === root) {
    event.preventDefault();
    (event.shiftKey ? last : first)?.focus();
  }
}

export function useFocusTrap(enabled = true) {
  const nodeRef = useRef<HTMLElement | null>(null);

  const ref = useCallback(
    (node: HTMLElement | null) => {
      nodeRef.current = node;
      if (enabled && node) {
        (node.querySelector<HTMLElement>('[data-autofocus]') ?? getTabbable(node)[0] ?? node).focus({
          preventScroll: true,
        });
      }
    },
    [enabled],
  );

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const node = nodeRef.current;
      if (event.key === 'Tab' && node) trapTab(node, event);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [enabled]);

  return ref;
}
