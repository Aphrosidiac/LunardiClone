// The reference root layout's notFound boundary: screen-reader text plus the BIOS crash screen,
// which reboots to the home page on any key.
import { CrashScreen } from '@/components/crash-screen';

export default function NotFound() {
  return (
    <>
      <h1 className="sr-only">404: Page not found</h1>
      <a className="sr-only" href="/">
        Back to the homepage
      </a>
      <CrashScreen redirectTo="/" />
    </>
  );
}
