'use client';

// Module 26314. The 13px round title-bar button. `hit-x-2 hit-y-6` widen its hit area to a
// comfortable target without changing its size. `asChild` (radix Slot) renders the child element
// with these props merged in instead of a <button>.
import {
  Children,
  cloneElement,
  isValidElement,
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';
import { useComposedRefs } from '@/lib/compose-refs';
import { cx } from '@/lib/cx';

type AnyProps = Record<string, unknown>;

/** Radix `mergeProps`: child handlers run first, styles merge, classNames join, child wins otherwise. */
function mergeProps(slotProps: AnyProps, childProps: AnyProps): AnyProps {
  const overrides: AnyProps = { ...childProps };
  for (const key in childProps) {
    const slotValue = slotProps[key];
    const childValue = childProps[key];
    if (/^on[A-Z]/.test(key)) {
      if (slotValue && childValue) {
        overrides[key] = (...args: unknown[]) => {
          const result = (childValue as (...a: unknown[]) => unknown)(...args);
          (slotValue as (...a: unknown[]) => unknown)(...args);
          return result;
        };
      } else if (slotValue) overrides[key] = slotValue;
    } else if (key === 'style') {
      overrides[key] = { ...(slotValue as object), ...(childValue as object) };
    } else if (key === 'className') {
      overrides[key] = [slotValue, childValue].filter(Boolean).join(' ');
    }
  }
  return { ...slotProps, ...overrides };
}

function Slot({ children, ref, ...slotProps }: AnyProps & { children?: ReactNode; ref?: Ref<HTMLElement> }) {
  const child = Children.count(children) === 1 && isValidElement(children) ? (children as ReactElement<AnyProps>) : null;
  const childRef = (child?.props.ref as Ref<HTMLElement> | undefined) ?? undefined;
  const composedRef = useComposedRefs(ref, childRef);
  if (!child) {
    if (children || children === 0)
      throw new Error('WindowControl failed to slot onto its children. Expected a single React element child or `Slottable`.');
    return children;
  }
  const merged = mergeProps(slotProps, child.props);
  merged.ref = ref ? composedRef : childRef;
  return cloneElement(child, merged);
}

export type WindowControlProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  ref?: Ref<HTMLButtonElement>;
  asChild?: boolean;
};

export function WindowControl({ asChild, children, type, className, ...props }: WindowControlProps) {
  const resolvedType = type === undefined ? (asChild ? undefined : 'button') : type;
  const Comp = (asChild ? Slot : 'button') as 'button';
  return (
    <Comp
      type={resolvedType}
      className={cx(
        'hit-x-2 hit-y-6 flex size-13 cursor-pointer items-center rounded-full border border-transparent bg-theme-fg text-theme-bg hover:border-theme-fg hover:bg-transparent hover:text-theme-fg',
        className,
      )}
      {...props}
    >
      {children}
    </Comp>
  );
}
