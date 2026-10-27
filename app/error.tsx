"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Last line of defence: if a render error ever escapes again, the user gets a
 * recoverable screen with a working reset instead of a dead white page. The
 * known crash (corrupted localStorage) is prevented upstream in
 * `lib/demo-state.ts`; this boundary covers everything we did not foresee.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("LabTrack rendering failed:", error);
  }, [error]);

  function resetDemoData() {
    try {
      window.localStorage.removeItem("labtrack-cases-v1");
    } catch {
      /* Storage unavailable — reloading is still the right recovery. */
    }
    window.location.reload();
  }

  return (
    <main className="error-shell">
      <div className="error-wrap">
        <Link className="error-brand" href="/" aria-label="LabTrack home">
          <span className="error-brand-mark">
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3.5c-3.8-2.4-8.3.3-8.3 4.8 0 5.4 5 7.9 6.6 12.2.6 1.7 2.1 1.7 2.7 0 1.6-4.3 6.6-6.8 6.6-12.2 0-4.5-4.5-7.2-8.3-4.8Z" />
              <path d="M8 9.5h8M12 6v7" />
            </svg>
          </span>
          <span>labtrack<span>.</span></span>
        </Link>
        <section className="error-card" role="alert">
          <span className="error-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3 2.8 19a1.4 1.4 0 0 0 1.2 2h16a1.4 1.4 0 0 0 1.2-2L12 3Z" />
              <path d="M12 9v4M12 17h.01" />
            </svg>
          </span>
          <span className="error-eyebrow">LabTrack · Recovery</span>
          <h1>Something on this page broke.</h1>
          <p>
            Your demo workspace may hold corrupted data from an earlier session. Resetting the sample data
            restores the original demo cases; nothing else on your machine is touched.
          </p>
          <div className="error-actions">
            <button className="primary-button" onClick={resetDemoData}>Reset demo data</button>
            <button className="secondary-button" onClick={reset}>Try again</button>
          </div>
          <p className="error-note">No data leaves this browser. Emails remain previews only.</p>
        </section>
      </div>
    </main>
  );
}
