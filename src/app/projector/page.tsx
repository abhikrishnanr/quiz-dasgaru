import { Suspense } from 'react';
import { ProjectorClient } from './_components/ProjectorClient';

export default function ProjectorPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">Initialize...</div>}>
            <ProjectorClient />
        </Suspense>
    );
}
