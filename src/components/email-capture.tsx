'use client';

// Ported from reference module 231668 (EmailCaptureContent + its form, honeypot and spam guard).
// The reference submits through a Next server action to Resend. A static export has no server, so
// `submitEmailCapture` runs in the browser: it POSTs to NEXT_PUBLIC_EMAIL_CAPTURE_URL when one is
// configured, and otherwise hands the address to the visitor's mail client as a subscribe request.
import Form from 'next/form';
import {
  Activity,
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { Icon } from '@/components/icon';
import { Portal } from '@/components/portal';
import { Window } from '@/components/window/window';
import { WindowControl } from '@/components/window/window-control';
import { useIosViewportZoomGuard } from '@/hooks/use-ios-viewport-zoom-guard';
import { SITE } from '@/content/site';
import { cx } from '@/lib/cx';

const HONEYPOT = 'website';

type EmailCaptureState =
  | { success: true; email: string }
  | { success: false; error?: string; fieldErrors?: { email?: string }; values?: { email?: string } };

const INITIAL_STATE: EmailCaptureState = { success: false };

// zod's default `z.email()` pattern, which the reference validates with.
const EMAIL = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/;

export function validateEmailCapture(value: string): { ok: true; email: string } | { ok: false; error: string } {
  const email = value.trim();
  if (email.length < 1) return { ok: false, error: 'Email is required' };
  if (!EMAIL.test(email)) return { ok: false, error: 'Invalid email' };
  return { ok: true, email };
}

async function submitEmailCapture(_previous: EmailCaptureState, formData: FormData): Promise<EmailCaptureState> {
  const raw = String(formData.get('email') ?? '');
  const result = validateEmailCapture(raw);
  if (!result.ok) return { success: false, fieldErrors: { email: result.error }, values: { email: raw } };
  if (String(formData.get(HONEYPOT) ?? '').trim()) return { success: false, error: 'Invalid submission detected.', values: { email: raw } };

  const audienceIds = [...new Set(formData.getAll('audienceIds').map(String).map((id) => id.trim()).filter(Boolean))];
  const endpoint = process.env.NEXT_PUBLIC_EMAIL_CAPTURE_URL;
  if (endpoint) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: result.email, audienceIds, submissionTime: Number(formData.get('_submissionTime')) }),
      });
      if (!response.ok) return { success: false, error: 'Something went wrong. Please try again.', values: { email: raw } };
    } catch {
      return { success: false, error: 'Something went wrong. Please try again.', values: { email: raw } };
    }
    return { success: true, email: result.email };
  }

  const subject = encodeURIComponent('Subscribe');
  const body = encodeURIComponent(`Please add ${result.email} to the list.`);
  window.location.href = `mailto:${SITE.email}?subject=${subject}&body=${body}`;
  return { success: true, email: result.email };
}

const INTERACTION_EVENTS = ['keydown', 'mousemove', 'touchstart', 'click'] as const;

type SpamCheck = { isSpam: false } | { isSpam: true; reason: string; message: string };

/** Honeypot + minimum fill time + "a human touched the form" guard. */
function useSpamPrevention({
  honeypotField = HONEYPOT,
  honeypotDuration = 2000,
  formRef,
}: {
  honeypotField?: string;
  honeypotDuration?: number;
  formRef?: RefObject<HTMLFormElement | null>;
}) {
  const startedAt = useRef(0);
  const [interacted, setInteracted] = useState(false);

  useEffect(() => {
    startedAt.current = Date.now();
    const onInteraction = () => setInteracted(true);
    const target: EventTarget = formRef?.current ?? document;
    for (const type of INTERACTION_EVENTS) target.addEventListener(type, onInteraction, { once: true });
    return () => {
      for (const type of INTERACTION_EVENTS) target.removeEventListener(type, onInteraction);
    };
  }, [formRef, honeypotField, honeypotDuration]);

  const checkSpam = useCallback(
    (form: HTMLFormElement): SpamCheck => {
      const fillTime = Date.now() - startedAt.current;
      const honeypot = form.querySelector<HTMLInputElement>(`[name="${honeypotField}"]`);
      if (honeypot?.value?.trim()) {
        return {
          isSpam: true,
          reason: 'honeypot_filled',
          message: 'Invalid submission detected. Please refresh the page and try again.',
        };
      }
      if (fillTime < honeypotDuration) {
        return {
          isSpam: true,
          reason: 'too_fast',
          message: 'Please take your time filling out the form. Form submissions are processed after a brief delay.',
        };
      }
      if (!interacted) {
        return {
          isSpam: true,
          reason: 'no_interaction',
          message: 'Please interact with the form fields before submitting. Click or type in the fields to continue.',
        };
      }
      return { isSpam: false };
    },
    [honeypotField, honeypotDuration, interacted],
  );

  const enhanceFormData = useCallback((data: FormData) => {
    data.append('_submissionTime', String(Date.now() - startedAt.current));
    return data;
  }, []);

  const reset = useCallback(() => {
    startedAt.current = Date.now();
    setInteracted(false);
    const onInteraction = () => setInteracted(true);
    const target: EventTarget = formRef?.current ?? document;
    for (const type of INTERACTION_EVENTS) target.addEventListener(type, onInteraction, { once: true });
  }, [formRef]);

  return { checkSpam, enhanceFormData, reset };
}

function Honeypot() {
  return (
    <input
      type="text"
      name={HONEYPOT}
      autoComplete="off"
      tabIndex={-1}
      aria-hidden="true"
      className="pointer-events-none absolute -left-[9999px] -z-10 h-px w-px overflow-hidden opacity-0"
    />
  );
}

function submitOnEnter(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key === 'Enter') event.currentTarget.form?.requestSubmit();
}

function EmailCaptureForm({ onReset, ctaText, audienceIds }: { onReset: () => void; ctaText?: string; audienceIds?: string[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, dispatch, pending] = useActionState(submitEmailCapture, INITIAL_STATE);
  const [email, setEmail] = useState('');
  const [spamError, setSpamError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const { checkSpam, enhanceFormData, reset } = useSpamPrevention({ formRef });
  const zoomGuard = useIosViewportZoomGuard();
  const success = state.success;
  const disabled = pending || success;

  useEffect(() => {
    if (state.success) {
      setSpamError(null);
      setEmail(state.email);
    } else if (state.values?.email !== undefined) {
      setEmail(state.values.email);
    }
  }, [state]);

  useEffect(() => {
    if (!state.success) return;
    const timeout = window.setTimeout(() => {
      reset();
      onReset();
    }, 5000);
    return () => clearTimeout(timeout);
  }, [state.success, onReset, reset]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEditing(false);
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const validation = validateEmailCapture(String(data.get('email') ?? ''));
    if (!validation.ok) {
      setValidationError(validation.error);
      return;
    }
    setValidationError(null);
    const spam = checkSpam(form);
    if (spam.isSpam) {
      setSpamError(spam.message);
      return;
    }
    enhanceFormData(data);
    setSpamError(null);
    startTransition(() => {
      dispatch(data);
    });
  };

  const error = state.success || editing ? null : (validationError ?? spamError ?? state.fieldErrors?.email ?? state.error ?? null);
  const cta = pending ? '…' : success ? 'Thank you!' : (ctaText ?? 'Submit');

  return (
    <>
      <Form ref={formRef} onSubmit={onSubmit} action={dispatch} className="flex gap-2" noValidate>
        <Honeypot />
        {audienceIds?.filter(Boolean).map((id) => <input key={id} type="hidden" name="audienceIds" value={id} />)}
        <label htmlFor="email-capture" className="sr-only">
          Email
        </label>
        <input
          type="email"
          id="email-capture"
          name="email"
          autoComplete="email"
          placeholder="Email"
          required
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setEditing(true);
          }}
          onKeyDown={submitOnEnter}
          onFocus={zoomGuard.onFocus}
          onTouchStart={zoomGuard.onTouchStart}
          onBlur={zoomGuard.onBlur}
          disabled={disabled}
          readOnly={disabled}
          className={cx(
            'min-w-0 flex-1 border border-theme-fg/30 bg-transparent px-8 py-4 outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-error',
          )}
          aria-invalid={!!error}
          aria-describedby={error ? 'email-capture-error' : undefined}
        />
        <button
          type="submit"
          disabled={disabled}
          className="shrink-0 cursor-pointer border border-theme-fg/30 px-8 py-4 outline-none hover:bg-theme-fg/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {cta}
        </button>
      </Form>
      <p id="email-capture-error" role="alert" className="sr-only">
        {error}
      </p>
      <p role="status" className="sr-only">
        {success ? 'Thank you, you are subscribed.' : ''}
      </p>
    </>
  );
}

function EmailCapture({ className, ctaText, audienceIds }: { className?: string; ctaText?: string; audienceIds?: string[] }) {
  const [generation, setGeneration] = useState(0);
  const onReset = useCallback(() => setGeneration((value) => value + 1), []);
  return (
    <div className={cx('flex flex-col gap-8', className)}>
      <EmailCaptureForm key={generation} onReset={onReset} ctaText={ctaText} audienceIds={audienceIds} />
    </div>
  );
}

export function EmailCaptureContent({
  text,
  legalText,
  ctaText,
  audienceIds,
}: {
  text?: ReactNode;
  legalText?: ReactNode;
  ctaText?: string;
  audienceIds?: string[];
}) {
  const [legalOpen, setLegalOpen] = useState(false);
  return (
    <>
      <div className="flex flex-col gap-8">
        {text}
        <EmailCapture ctaText={ctaText} audienceIds={audienceIds} />
        <p className="text-body-10">
          No spam. Unsubscribe anytime.{' '}
          {!!legalText && (
            <button type="button" onClick={() => setLegalOpen((open) => !open)} className="cursor-pointer underline">
              Privacy
            </button>
          )}
        </p>
      </div>
      {!!legalText && (
        <Portal>
          <Activity mode={legalOpen ? 'visible' : 'hidden'}>
            <Window
              id="email-capture-legal"
              left={<h2>Privacy</h2>}
              className="fixed top-1/2 left-1/2 w-320 -translate-x-1/2 -translate-y-1/2 md:w-400"
              right={
                <WindowControl aria-label="Close" onClick={() => setLegalOpen(false)}>
                  <Icon name="close" className="size-full" />
                </WindowControl>
              }
              allowFullscreen={false}
              draggable
            >
              {legalText}
            </Window>
          </Activity>
        </Portal>
      )}
    </>
  );
}
