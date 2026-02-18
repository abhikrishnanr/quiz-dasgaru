'use client';

import { useState } from 'react';
import { Dashboard } from './_components/Dashboard';
import { SessionDetailView } from './_components/SessionDetailView';

export default function AdminPage() {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  if (selectedSessionId) {
    return (
      <SessionDetailView
        sessionId={selectedSessionId}
        onBack={() => setSelectedSessionId(null)}
      />
    );
  }

  return (
    <Dashboard
      onSelectSession={setSelectedSessionId}
    />
  );
}
