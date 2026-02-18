'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Navbar() {
    const pathname = usePathname();

    // Hide Admin and Health links on team and display pages
    const isPortalView = pathname?.startsWith('/team') || pathname?.startsWith('/display');

    if (isPortalView) return null;

    const navItems = [
        { href: '/admin', label: 'Admin' },
        { href: '/health', label: 'Health' },
    ];

    return (
        <nav className="flex gap-2">
            {navItems.map((item) => (
                <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                >
                    {item.label}
                </Link>
            ))}
        </nav>
    );
}
