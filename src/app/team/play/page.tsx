import { Suspense } from 'react';
import { TeamGameClient } from './_components/TeamGameClient';

export default function TeamPlayPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Loading...</div>}>
            <TeamGameClient />
        </Suspense>
    );
}
