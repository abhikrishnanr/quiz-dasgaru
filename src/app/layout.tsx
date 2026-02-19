import type { Metadata } from 'next';
import { GlobalToaster } from '@/src/app/_components/global-toaster';
import './globals.css';

// (Optional) If you still want Navbar, keep the import + render it.
// import { Navbar } from '@/src/app/_components/Navbar';

export const metadata: Metadata = {
  title: 'DUK AI Quiz Frontend',
  description: 'Minimal Next.js frontend for quiz admin, display, and team views.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full w-full">
      <body className="m-0 h-full w-full p-0 overflow-x-hidden">
        <GlobalToaster />

        {/* Full-bleed app container */}
        <div className="h-full w-full">
          {/*
            If you want Navbar but still full-bleed, mount it without padding:
            <div className="w-full">
              <Navbar />
            </div>
          */}
          {children}
        </div>
      </body>
    </html>
  );
}
