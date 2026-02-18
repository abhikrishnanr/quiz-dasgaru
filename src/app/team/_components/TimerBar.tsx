'use client';

interface TimerBarProps {
    remaining: number;
    total: number;
    isLive: boolean;
}

export function TimerBar({ remaining, total, isLive }: TimerBarProps) {
    const progress = Math.min(100, Math.max(0, (remaining / total) * 100));

    // Color transition based on remaining time
    let colorClass = 'bg-emerald-500';
    if (progress < 50) colorClass = 'bg-amber-500';
    if (progress < 20) colorClass = 'bg-rose-500';

    return (
        <div className="space-y-1">
            <div className="flex justify-between text-xs font-medium text-slate-500 uppercase tracking-wider">
                <span>Time Remaining</span>
                <span>{Math.ceil(remaining)}s</span>
            </div>
            <div className="h-3 w-full rounded-full bg-slate-200 overflow-hidden">
                <div
                    className={`h-full transition-all duration-1000 ease-linear ${colorClass} ${!isLive ? 'opacity-50' : ''}`}
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    );
}
