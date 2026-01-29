import { Link } from '@tanstack/react-router';
import { Bell, X } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';


export function NotificationsDropdown() {
    const [isOpen, setIsOpen] = React.useState(false);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    const [notifications, setNotifications] = React.useState([
        { id: 1, user: 'Ninja', platform: 'twitch', action: 'is live', title: 'Fortnite Customs!', time: '2 min ago', color: 'bg-indigo-500' },
        { id: 2, user: 'xQc', platform: 'kick', action: 'is live', title: 'GAMBA & DRAMA', time: '15 min ago', color: 'bg-green-500' },
        { id: 3, user: 'shroud', platform: 'twitch', action: 'is live', title: 'VALORANT GRIND', time: '1 hour ago', color: 'bg-cyan-600' },
        { id: 4, user: 'KaiCenat', platform: 'twitch', action: 'is live', title: 'MAFIATHON DAY 15', time: '2 hours ago', color: 'bg-orange-500' },
        { id: 5, user: 'AdinRoss', platform: 'kick', action: 'is live', title: 'E-DATING W/ 20 GIRLS', time: '3 hours ago', color: 'bg-emerald-600' },
        { id: 6, user: 'Summit1g', platform: 'twitch', action: 'is live', title: 'DayZ Adventure', time: '4 hours ago', color: 'bg-blue-600' },
    ]);

    React.useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-full hover:bg-[var(--color-background-secondary)] transition-colors outline-none"
                title="Notifications"
            >
                <Bell size={24} strokeWidth={3} className="text-white" />
                {notifications.length > 0 && (
                    <span className="absolute -bottom-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-700 text-sm font-bold text-white ring-2 ring-[var(--color-background)]">
                        {notifications.length > 99 ? '99+' : notifications.length}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-[var(--color-border)] bg-[var(--color-background-elevated)] shadow-xl p-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-3 py-2 border-b border-[var(--color-border)] mb-1 flex justify-center items-center bg-[var(--color-background-elevated)] sticky top-0 z-10">
                        <span className="text-sm font-semibold text-white">Notifications</span>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-white [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                        {notifications.length === 0 ? (
                            <div className="p-8 flex flex-col items-center justify-center text-center">
                                <Bell size={32} className="text-[var(--color-foreground-muted)] mb-2 opacity-50" />
                                <p className="text-sm text-[var(--color-foreground-secondary)]">No new notifications</p>
                            </div>
                        ) : (
                            notifications.map((notif) => (
                                <div key={notif.id} className="group px-3 py-3 hover:bg-[var(--color-background-tertiary)] transition-colors cursor-pointer flex gap-3 border-b border-[var(--color-border)] last:border-0 relative">
                                    <div className={`w-10 h-10 rounded-full shrink-0 ${notif.color} flex items-center justify-center text-white font-bold ring-2 ring-offset-1 ring-offset-[var(--color-background-elevated)] ${notif.platform === 'twitch' ? 'ring-[#9146FF]' : 'ring-[#53FC18]'}`}>
                                        {notif.user[0].toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0 pr-6">
                                        <p className="text-sm text-white">
                                            <span className={`font-bold transition-colors ${notif.platform === 'twitch' ? 'hover:text-[#9146FF]' : 'hover:text-[#53FC18]'}`}>{notif.user}</span> {notif.action}
                                        </p>
                                        <div className="text-xs text-white truncate font-medium">{notif.title}</div>
                                        <p className="text-[10px] text-white mt-1">
                                            {notif.time}
                                        </p>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setNotifications(prev => prev.filter(n => n.id !== notif.id));
                                        }}
                                        className="absolute top-2 right-2 text-white hover:bg-[var(--color-background-elevated)] rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Dismiss"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="p-2 border-t border-[var(--color-border)] bg-[var(--color-background-elevated)]">
                        <button
                            className="w-full text-xs text-center py-1.5 text-[var(--color-foreground-secondary)] hover:text-white hover:bg-[var(--color-background-tertiary)] rounded transition-colors"
                            onClick={() => setNotifications([])}
                        >
                            Clear all notifications
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
