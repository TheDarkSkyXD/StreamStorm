
import React, { useState, useRef, useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { User, Settings, LogOut, LayoutDashboard } from 'lucide-react';

import { useUserInfo } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/auth-store';

export function ProfileDropdown() {
    const { avatar, displayName, hasAnyUser } = useUserInfo();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const logoutTwitch = useAuthStore(state => state.logoutTwitch);
    const logoutKick = useAuthStore(state => state.logoutKick);
    const loginTwitch = useAuthStore(state => state.loginTwitch);
    const loginKick = useAuthStore(state => state.loginKick);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = async () => {
        await Promise.all([logoutTwitch(), logoutKick()]);
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-1 py-1 rounded-full hover:bg-[var(--color-background-secondary)] transition-colors outline-none"
            >
                {hasAnyUser && avatar ? (
                    <img
                        src={avatar}
                        alt={displayName}
                        className="w-8 h-8 rounded-full ring-2 ring-[var(--color-storm-primary)]/30"
                    />
                ) : (
                    <div className="w-8 h-8 rounded-full bg-[var(--color-background-tertiary)] flex items-center justify-center">
                        <User size={16} className="text-[var(--color-foreground-secondary)]" />
                    </div>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 rounded-lg border border-[var(--color-border)] bg-[var(--color-background-elevated)] shadow-xl p-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-3 py-3 border-b border-[var(--color-border)] mb-1 flex items-center gap-3">
                        {hasAnyUser && avatar ? (
                            <img
                                src={avatar}
                                alt={displayName}
                                className="w-10 h-10 rounded-full ring-2 ring-[var(--color-storm-primary)]/30"
                            />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-[var(--color-background-tertiary)] flex items-center justify-center">
                                <User size={20} className="text-[var(--color-foreground-secondary)]" />
                            </div>
                        )}
                        <div className="flex flex-col overflow-hidden">
                            <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-white truncate">{displayName}</p>
                                {!hasAnyUser && (
                                    <span className="inline-flex items-center rounded-full bg-[var(--color-background-tertiary)] text-[var(--color-foreground-muted)] text-xs px-1.5 py-0.5 font-medium">
                                        Guest
                                    </span>
                                )}
                            </div>
                            {!hasAnyUser && (
                                <p className="text-xs text-[var(--color-foreground-muted)] mt-0.5">
                                    Connect an account for full access
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="p-1 space-y-0.5">
                        {/* Connect Account options for guests */}
                        {!hasAnyUser && (
                            <>
                                <button
                                    onClick={() => { loginTwitch(); setIsOpen(false); }}
                                    className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-white hover:bg-[#9146FF]/20 w-full text-left text-sm"
                                >
                                    <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#9146FF]" fill="currentColor">
                                        <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
                                    </svg>
                                    Connect Twitch
                                </button>
                                <button
                                    onClick={() => { loginKick(); setIsOpen(false); }}
                                    className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-white hover:bg-[#53FC18]/20 w-full text-left text-sm"
                                >
                                    <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#53FC18]" fill="currentColor">
                                        <path d="M9 3a1 1 0 0 1 1 1v3h1v-1a1 1 0 0 1 .883 -.993l.117 -.007h1v-1a1 1 0 0 1 .883 -.993l.117 -.007h6a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-1v1a1 1 0 0 1 -.883 .993l-.117 .007h-1v2h1a1 1 0 0 1 .993 .883l.007 .117v1h1a1 1 0 0 1 .993 .883l.007 .117v4a1 1 0 0 1 -1 1h-6a1 1 0 0 1 -1 -1v-1h-1a1 1 0 0 1 -.993 -.883l-.007 -.117v-1h-1v3a1 1 0 0 1 -.883 .993l-.117 .007h-5a1 1 0 0 1 -1 -1v-16a1 1 0 0 1 1 -1z" />
                                    </svg>
                                    Connect Kick
                                </button>
                                <div className="my-1 border-t border-[var(--color-border)]" />
                            </>
                        )}

                        <Link
                            to="/settings"
                            className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-white hover:bg-[var(--color-background-tertiary)] hover:text-white w-full text-left text-sm"
                            onClick={() => setIsOpen(false)}
                        >
                            <Settings size={16} />
                            Settings
                        </Link>

                        {hasAnyUser && (
                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-red-500 hover:bg-red-500/10 w-full text-left text-sm"
                            >
                                <LogOut size={16} />
                                Sign Out
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
