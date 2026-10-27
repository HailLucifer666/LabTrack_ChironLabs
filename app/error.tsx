"use client";

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
      <section className="error-card" role="alert">
        <span className="error-eyebrow">LABTRACK · RECOVERY</span>
        <h1>Something on this page broke.</h1>
        <p>
          Your demo workspace may hold corrupted data from an earlier session. Resetting the sample data
          restores the original demo cases; nothing else on your machine is touched.
        </p>
        <div className="error-actions">
          <button className="primary-button" onClick={resetDemoData}>Reset demo data</button>
          <button className="secondary-button" onClick={reset}>Try again</button>
        </div>
      </section>
    </main>
  );
}
