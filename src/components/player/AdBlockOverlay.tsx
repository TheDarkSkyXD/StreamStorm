interface AdBlockOverlayProps {
    visible: boolean;
    message?: string;
    isMidroll?: boolean;
    isStripping?: boolean;
    channelName?: string;
    showBackdrop?: boolean;
}

export function AdBlockOverlay({ visible, message, isMidroll, isStripping, channelName, showBackdrop }: AdBlockOverlayProps) {
    if (!visible) return null;

    const defaultMessage = (() => {
        return `Blocking${isMidroll ? ' midroll' : ''} ads${isStripping ? ' (stripping)' : ''}`;
    })();

    const displayText = message || defaultMessage;

    return (
        <>
            {showBackdrop && (
                <div className="absolute inset-0 z-40 bg-black" aria-hidden="true" />
            )}
            <div
                className="absolute top-0 left-0 z-50 pointer-events-none select-none"
                role="status"
                aria-live="polite"
                aria-atomic="true"
            >
                <div className="bg-black/90 text-white px-3 py-1.5">
                    <p className="text-sm font-semibold font-sans m-0 leading-tight tracking-wide">
                        {displayText}
                    </p>
                </div>
            </div>
        </>
    );
}
