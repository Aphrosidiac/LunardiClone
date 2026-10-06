import type { Metadata } from 'next';
import { Inter, Ubuntu_Mono } from 'next/font/google';
import { Suspense, type ReactNode } from 'react';
import { DitherProvider } from '@/components/dither/dither-provider';
import { CursorsScript } from '@/components/header/cursors-toggle';
import { Header, HeaderSkeleton } from '@/components/header/header';
import { InteractiveSounds } from '@/components/header/interactive-sounds';
import { KeyboardFocusMode } from '@/components/header/keyboard-focus-mode';
import { NotificationWindow } from '@/components/header/notification-window';
import { SoundScript } from '@/components/header/sound-toggle';
import { Presence } from '@/components/presence/presence';
import { WindowManagerProvider } from '@/components/window/window-manager';
import { JSON_LD, NOTIFICATION, SITE } from '@/content/site';
import './globals.css';

// Reference: Inter 400/600 (normal only, no italic faces in the stylesheet) and Ubuntu Mono 400.
const inter = Inter({ subsets: ['latin'], weight: ['400', '600'], variable: '--font-inter' });
const ubuntuMono = Ubuntu_Mono({ subsets: ['latin'], weight: '400', variable: '--font-ubuntu-mono' });

// Applies the saved palette before first paint (ThemeSwitcher writes `theme`).
const THEME_SCRIPT = `
          try {
            var theme = localStorage.getItem('theme');
            if (theme) {
              document.documentElement.setAttribute('data-theme', theme);
            }
          } catch (e) {}
        `;

// Canonical URLs are set per page: a canonical declared here would be inherited by every route
// that does not override it and point them all at the home page.
export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: SITE.title, template: `%s | ${SITE.name}` },
  description: SITE.description,
  openGraph: {
    title: SITE.title,
    description: SITE.description,
    url: SITE.url,
    siteName: SITE.name,
    type: 'website',
    images: [{ url: '/og.jpg', width: 1200, height: 630, alt: 'FF Dev Studio' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE.title,
    description: SITE.description,
    images: ['/og.jpg'],
  },
};

const jsonLd = JSON.stringify(JSON_LD).replace(/</g, '\\u003c');

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${ubuntuMono.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <SoundScript />
        <CursorsScript />
      </head>
      <body>
        <KeyboardFocusMode />
        <Suspense fallback={null}>
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
        </Suspense>
        <InteractiveSounds />
        <Suspense fallback={null}>
          <Presence url={SITE.presenceUrl} />
        </Suspense>
        <Suspense fallback={<HeaderSkeleton />}>
          <Header />
        </Suspense>
        <WindowManagerProvider>
          <main>
            <DitherProvider>{children}</DitherProvider>
          </main>
          <Suspense fallback={null}>
            <NotificationWindow title={NOTIFICATION.title}>{NOTIFICATION.body}</NotificationWindow>
          </Suspense>
        </WindowManagerProvider>
      </body>
    </html>
  );
}
