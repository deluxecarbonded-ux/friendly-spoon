import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { sql } from "@/db";
import type { ReactNode } from "react";
import { Ambient } from "@/components/ambient";
import { Providers } from "@/components/providers";
import { asAccount } from "@/db/rls";
import { getCurrentAccount } from "@/lib/auth";
import "./globals.css";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono2" });

const siteUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://devilexotix.com";

export const metadata: Metadata = {
  title: "EXOTIC â€” A Rage-Bait Platformer",
  description:
    "A monochrome 2D troll platformer. The floor lies, the flags lie, gravity lies. Every death is remembered.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  openGraph: {
    title: "EXOTIC â€” A Rage-Bait Platformer",
    description:
      "A monochrome 2D troll platformer. The floor lies, the flags lie, gravity lies. Every death is remembered.",
    images: [
      {
        url: `${siteUrl}/logo.svg`,
        width: 128,
        height: 128,
        alt: "EXOTIC game logo",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "EXOTIC â€” A Rage-Bait Platformer",
    description:
      "A monochrome 2D troll platformer. The floor lies, the flags lie, gravity lies.",
    images: [`${siteUrl}/logo.svg`],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f1ee" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0c" },
  ],
};

export const dynamic = "force-dynamic";

/** Theme is read from Postgres on the server — zero storage, zero flash. */
async function resolveTheme(): Promise<"light" | "dark"> {
  try {
    const account = await getCurrentAccount();
    if (!account) return "dark";
    return await asAccount(account.id, async (tx) => {
      const r = await tx.query(
        sql`select theme from settings where account_id = ${account.id}::uuid`,
      );
      const row = r.rows[0] as { theme?: string } | undefined;
      return row?.theme === "light" ? "light" : "dark";
    });
  } catch {
    return "dark";
  }
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const theme = await resolveTheme();
  const siteUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://devilexotix.com";
  return (
    <html
      lang="en"
      className={`${display.variable} ${mono.variable}${theme === "dark" ? " dark" : ""}`}
    >
      <head>
        <meta property="og:title" content="EXOTIC — A Rage-Bait Platformer" />
        <meta property="og:description" content="A monochrome 2D troll platformer. The floor lies, the flags lie, gravity lies. Every death is remembered." />
        <meta property="og:image" content={`${siteUrl}/logo.svg`} />
        <meta property="og:image:width" content="128" />
        <meta property="og:image:height" content="128" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="EXOTIC — A Rage-Bait Platformer" />
        <meta name="twitter:description" content="A monochrome 2D troll platformer. The floor lies, the flags lie, gravity lies." />
        <meta name="twitter:image" content={`${siteUrl}/logo.svg`} />
      </head>
      <body className="min-h-screen bg-bg font-sans text-fg antialiased">
        <Providers initialTheme={theme}>
          <Ambient />
          {children}
        </Providers>
      </body>
    </html>
  );
}
