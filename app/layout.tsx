import type { Metadata } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Syllabuddy",
  description: "Upload a syllabus, get every deadline and grade weight out of it.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} min-h-screen bg-stone-50 font-sans text-stone-900 antialiased`}
      >
        <header className="border-b border-stone-200 bg-white">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <span aria-hidden>📚</span> Syllabuddy
            </Link>
            <nav className="flex items-center gap-5 text-sm text-stone-600">
              <Link href="/" className="hover:text-stone-900">
                Upload
              </Link>
              <Link href="/saved" className="hover:text-stone-900">
                My deadlines
              </Link>
            </nav>
          </div>
        </header>
        <Providers>
          <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
