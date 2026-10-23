import { verifyEmail } from "@/lib/client-api";

export default function VerifyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Verifying your email…</h1>
        <p className="text-zinc-400">Please wait.</p>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (async () => {
                const params = new URLSearchParams(window.location.search);
                const token = params.get("token");
                if (!token) {
                  window.location.href = "/settings?verify=error";
                  return;
                }
                try {
                  const res = await fetch("/api/verify", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ token }),
                    credentials: "same-origin",
                  });
                  const data = await res.json();
                  if (data.ok) {
                    window.location.href = "/settings?verify=ok";
                  } else {
                    window.location.href = "/settings?verify=error";
                  }
                } catch {
                  window.location.href = "/settings?verify=error";
                }
              })();
            `,
          }}
        />
      </div>
    </div>
  );
}