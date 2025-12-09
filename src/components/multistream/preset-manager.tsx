
import React, { useState } from 'react';
import { useMultiStreamStore, LayoutPreset } from '@/store/multistream-store';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Save, Trash, Play, LayoutTemplate } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';


export function PresetManager() {
    const { presets, savePreset, loadPreset, deletePreset, streams } = useMultiStreamStore();
    const [newPresetName, setNewPresetName] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPresetName.trim()) return;

        savePreset(newPresetName.trim());
        setNewPresetName('');
    };

    const handleLoad = (preset: LayoutPreset) => {
        loadPreset(preset.id);
        setIsOpen(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                    <LayoutTemplate className="h-4 w-4" />
                    Presets
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Layout Presets</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 pt-4">
                    {/* Save New Preset */}
                    <form onSubmit={handleSave} className="flex gap-2 items-end">
                        <div className="flex-1 space-y-2">
                            <label className="text-sm font-medium">Save Current Layout</label>
                            <input
                                className="flex h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background-tertiary)] px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-primary)] placeholder:text-muted-foreground"
                                placeholder="My Awesome Layout"
                                value={newPresetName}
                                onChange={(e) => setNewPresetName(e.target.value)}
                                disabled={streams.length === 0}
                            />
                        </div>
                        <Button type="submit" size="sm" disabled={!newPresetName.trim() || streams.length === 0}>
                            <Save className="h-4 w-4 mr-2" />
                            Save
                        </Button>
                    </form>

                    <div className="border-t border-[var(--color-border)]" />

                    {/* List Presets */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium">Saved Presets</h3>

                        {presets.length === 0 ? (
                            <div className="text-center py-8 text-[var(--color-foreground-muted)] text-sm">
                                No saved presets yet.
                            </div>
                        ) : (
                            <ScrollArea className="h-[200px] pr-4">
                                <div className="space-y-2">
                                    {presets.map((preset) => (
                                        <div
                                            key={preset.id}
                                            className="flex items-center justify-between p-3 rounded-md bg-[var(--color-background-tertiary)] border border-[var(--color-border)] group"
                                        >
                                            <div className="min-w-0 flex-1 mr-4">
                                                <div className="font-medium truncate">{preset.name}</div>
                                                <div className="text-xs text-[var(--color-foreground-muted)] truncate flex items-center gap-2">
                                                    <span>{preset.streams.length} streams</span>
                                                    <span>•</span>
                                                    <span className="capitalize">{preset.layout}</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Button
                                                    size="icon"
                                                    variant="secondary"
                                                    className="h-8 w-8 hover:bg-[var(--color-primary)] hover:text-white"
                                                    onClick={() => handleLoad(preset)}
                                                    title="Load Preset"
                                                >
                                                    <Play className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-8 w-8 text-[var(--color-foreground-muted)] hover:text-red-500 hover:bg-red-500/10"
                                                    onClick={() => deletePreset(preset.id)}
                                                    title="Delete Preset"
                                                >
                                                    <Trash className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
