import React, { useState, useEffect } from 'react';
import { LuShieldCheck } from 'react-icons/lu';

import { AdBlockStatus } from '@/shared/adblock-types';

interface AdBlockFallbackOverlayProps {
    status: AdBlockStatus;
    channelName: string;
}

/**
 * Rich overlay that appears when all backup player types fail.
 * 
 * NOTE: This overlay is DISABLED for seamless ad blocking experience.
 * We block ads at the HLS level silently without interrupting the user.
 * The overlay code is preserved in case it's needed for debugging or
 * if users want to opt-in to see ad blocking status in the future.
 */
export function AdBlockFallbackOverlay({ status, channelName }: AdBlockFallbackOverlayProps) {
    const [elapsed, setElapsed] = useState(0);

    // Update elapsed time counter
    useEffect(() => {
        if (!status.adStartTime) {
            setElapsed(0);
            return;
        }

        // Calculate initial elapsed
        setElapsed(Math.floor((Date.now() - status.adStartTime) / 1000));

        // Update every second
        const interval = setInterval(() => {
            if (status.adStartTime) {
                setElapsed(Math.floor((Date.now() - status.adStartTime) / 1000));
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [status.adStartTime]);

    // DISABLED: We want seamless ad blocking without visual interruption
    // The stream should continue playing as if ads don't exist
    // Keep overlay hidden - ads are blocked at network/HLS level
    return null;
    
    // Original overlay code preserved below for reference/debugging:
    // if (!status.isUsingFallbackMode || !status.isShowingAd) {
    //     return null;
    // }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _unusedForLinting = { elapsed, channelName };

    return (
        <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center z-50 pointer-events-none">
            {/* Channel name */}
            <p className="text-white/80 text-lg mb-4">{channelName}</p>
            
            {/* Status message with shield icon */}
            <div className="flex items-center gap-2 text-white">
                <LuShieldCheck className="w-5 h-5 text-green-500" />
                <span>{status.isMidroll ? 'Blocking midroll ads' : 'Blocking ads'} • Audio muted</span>
            </div>
            
            {/* Elapsed timer */}
            <p className="text-white/50 text-sm mt-4">
                Waiting for stream to resume... ({elapsed}s)
            </p>
            
            {/* Pulsing indicator */}
            <div className="mt-6 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        </div>
    );
}
