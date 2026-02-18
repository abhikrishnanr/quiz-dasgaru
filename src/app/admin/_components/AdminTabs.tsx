import { AdminTab } from "../types";

interface AdminTabsProps {
    activeTab: AdminTab;
    onTabChange: (tab: AdminTab) => void;
}

export function AdminTabs({ activeTab, onTabChange }: AdminTabsProps) {
    const tabs: { id: AdminTab; label: string }[] = [

        { id: 'QUESTIONS', label: 'Questions' },
        { id: 'TEAMS', label: 'Teams' },
        { id: 'ANSWERS', label: 'Answers' },
        { id: 'SETTINGS', label: 'Settings' },
    ];

    return (
        <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`
                            whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium
                            ${activeTab === tab.id
                                ? 'border-indigo-500 text-indigo-600'
                                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}
                        `}
                    >
                        {tab.label}
                    </button>
                ))}
            </nav>
        </div>
    );
}
