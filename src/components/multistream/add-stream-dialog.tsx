
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Platform } from '@/shared/auth-types';
import { useMultiStreamStore } from '@/store/multistream-store';
import { Plus } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AddStreamDialogProps {

}

export function AddStreamDialog() {
    const [open, setOpen] = useState(false);
    const [channel, setChannel] = useState('');
    const [platform, setPlatform] = useState<Platform>('twitch');
    const addStream = useMultiStreamStore(state => state.addStream);

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        if (channel.trim()) {
            addStream(platform, channel.trim());
            setChannel('');
            setOpen(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Stream
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Stream</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleAdd} className="space-y-4 pt-4">
                    <div className="grid gap-2">
                        <label className="text-sm font-medium">Platform</label>
                        <Select
                            value={platform}
                            onValueChange={(val) => setPlatform(val as Platform)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select platform" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="twitch">Twitch</SelectItem>
                                <SelectItem value="kick">Kick</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-2">
                        <label htmlFor="channel-name" className="text-sm font-medium">Channel Name</label>
                        <input
                            id="channel-name"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder="e.g. xqc"
                            value={channel}
                            onChange={(e) => setChannel(e.target.value)}
                            autoFocus
                        />
                    </div>

                    <div className="flex justify-end pt-4">
                        <Button type="submit" disabled={!channel.trim()}>
                            Add to Layout
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
