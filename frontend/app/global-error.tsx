"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f7f5f1", color: "#0f342f" }}>
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <div
            style={{
              maxWidth: 420,
              width: "100%",
              textAlign: "center",
              background: "#fff",
              border: "1px solid #e5e1d8",
              borderRadius: 24,
              padding: 32,
            }}
          >
            <p style={{ color: "#c89a58", fontWeight: 700, fontSize: 12, letterSpacing: "0.12em" }}>ALSHANTAF</p>
            <h1 style={{ margin: "8px 0 0", fontSize: 22 }}>Something went wrong</h1>
            <p style={{ marginTop: 8, fontSize: 14, color: "#5c6b66", lineHeight: 1.5 }}>
              {error?.digest ? `Error ${error.digest}` : "Please reload the page."}
            </p>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                marginTop: 20,
                height: 44,
                padding: "0 24px",
                borderRadius: 999,
                border: 0,
                background: "#0f342f",
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
