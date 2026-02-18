import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Admin Dashboard | DUK AI Quiz',
    description: 'Manage quiz sessions, teams, and questions.',
};

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
