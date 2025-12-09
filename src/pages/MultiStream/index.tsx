
import React, { useState, useEffect, useCallback } from 'react';
import { useMultiStreamStore } from '@/store/multistream-store';
import { MultiStreamGrid } from '@/components/multistream/grid-layout';
import { AddStreamDialog } from '@/components/multistream/add-stream-dialog';
import { PresetManager } from '@/components/multistream/preset-manager';
import { Button } from '@/components/ui/button';
import { Settings, LayoutGrid, Maximize, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function MultiStreamPage() {
    const {
        streams,
        layout,
        setLayout,
        isChatOpen,
        toggleChat,
        chatStreamId
    } = useMultiStreamStore();

    // Chat Resizing Logic (Copied from StreamPage)
    const [chatWidth, setChatWidth] = useState(350);
    const [isResizing, setIsResizing] = useState(false);

    const startResizing = useCallback(() => {
        setIsResizing(true);
        document.body.style.userSelect = 'none';
    }, []);

    const stopResizing = useCallback(() => {
        setIsResizing(false);
        document.body.style.userSelect = '';
    }, []);

    const resize = useCallback(
        (mouseMoveEvent: MouseEvent) => {
            if (isResizing) {
                const newWidth = window.innerWidth - mouseMoveEvent.clientX;
                if (newWidth > 300 && newWidth < 600) {
                    setChatWidth(newWidth);
                }
            }
        },
        [isResizing]
    );

    useEffect(() => {
        if (isResizing) {
            window.addEventListener("mousemove", resize);
            window.addEventListener("mouseup", stopResizing);
        }
        return () => {
            window.removeEventListener("mousemove", resize);
            window.removeEventListener("mouseup", stopResizing);
        };
    }, [isResizing, resize, stopResizing]);

    const activeChatStream = streams.find(s => s.id === chatStreamId);

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* MultiStream Header / Toolbar */}
            <div className="h-14 border-b border-[var(--color-border)] flex items-center px-4 shrink-0 bg-[var(--color-background)] gap-4">
                <h1 className="font-semibold text-lg mr-auto">MultiStream</h1>

                <div className="flex items-center gap-2">
                    <Button
                        variant={layout === 'grid' ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setLayout('grid')}
                        title="Grid Layout"
                    >
                        <LayoutGrid className="h-4 w-4" />
                    </Button>
                    <Button
                        variant={layout === 'focus' ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setLayout('focus')}
                        disabled={streams.length === 0}
                        title="Focus Layout"
                    >
                        <Maximize className="h-4 w-4" />
                    </Button>
                </div>

                <div className="h-6 w-px bg-[var(--color-border)] mx-2" />

                <PresetManager />
                <div className="h-6 w-px bg-[var(--color-border)] mx-2" />
                <AddStreamDialog />

                <div className="h-6 w-px bg-[var(--color-border)] mx-2" />

                <Button
                    variant={isChatOpen ? "secondary" : "ghost"}
                    size="sm"
                    onClick={toggleChat}
                    disabled={streams.length === 0}
                >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Chat
                </Button>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex min-h-0 overflow-hidden relative">
                <div className="flex-1 min-w-0 bg-[var(--color-background-tertiary)] p-1">
                    <MultiStreamGrid />
                </div>

                {/* Chat Panel */}
                {isChatOpen && streams.length > 0 && (
                    <>
                        {/* Resize Handle */}
                        <div className="relative z-20 shrink-0">
                            <div
                                className="absolute inset-y-0 -left-1 w-2 cursor-ew-resize"
                                onMouseDown={startResizing}
                            />
                            <div className="w-1 h-full bg-[var(--color-border)] hover:bg-[var(--color-primary)] transition-colors" />
                        </div>

                        <div
                            style={{ width: chatWidth }}
                            className="bg-[var(--color-background-secondary)] flex flex-col shrink-0 relative border-l border-[var(--color-border)]"
                        >
                            <div className="p-3 border-b border-[var(--color-border)] flex justify-between items-center">
                                <h2 className="font-semibold text-sm">
                                    Chat: <span className="text-[var(--color-primary)]">{activeChatStream?.channelName || 'Control'}</span>
                                </h2>
                            </div>
                            <div className="flex-1 p-3">
                                {/* Placeholder for real chat component */}
                                <p className="text-[var(--color-foreground-muted)] text-sm">
                                    {activeChatStream
                                        ? `Chat for ${activeChatStream.channelName} (${activeChatStream.platform})`
                                        : "Select a stream to view chat"
                                    }
                                </p>
                            </div>
                            <div className="p-3 border-t border-[var(--color-border)]">
                                <input
                                    type="text"
                                    placeholder="Send a message..."
                                    disabled={!activeChatStream}
                                    className="w-full h-10 px-3 rounded-md border border-[var(--color-border)] bg-[var(--color-background-tertiary)] text-sm focus:outline-none focus:ring-1 focus:ring-white"
                                />
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
