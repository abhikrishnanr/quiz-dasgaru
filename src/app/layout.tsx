import type { Metadata } from 'next';
import Link from 'next/link';
import { GlobalToaster } from '@/src/app/_components/global-toaster';
import './globals.css';

export const metadata: Metadata = {
  title: 'DUK AI Quiz Frontend',
  description: 'Minimal Next.js frontend for quiz admin, display, and team views.',
};

import { Navbar } from '@/src/app/_components/Navbar';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <GlobalToaster />
        <div className="mx-auto flex min-h-screen w-full max-w-[1800px] flex-col px-4 sm:px-6 py-8">
          <header className="mb-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h1 className="text-lg font-semibold tracking-tight">DUK AI Quiz Frontend</h1>
              <Navbar />
            </div>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
