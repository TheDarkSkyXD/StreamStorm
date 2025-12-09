
export class PopoutManager {
    static openStreamPopout(platform: string, channel: string) {
        // Construct the URL relative to the current application base
        // In React/SPA, we want to route to the specific path
        // We assume the router handles this path on the same index.html
        const url = `#/popout/${platform}/${channel}`; // Hash router usually used in Electron, or regular path if configured.
        // NOTE: TanStack Router might be using history mode. If using hash mode, prepend #.
        // If using history mode in Electron, it might be tricky without dev server. 
        // Usually Electron apps use HashRouter or MemoryRouter.
        // Let's assume standard link behavior.

        // Check if we are in dev or prod to construct URL properly? 
        // window.location.href usually gives the base.

        const features = `width=1280,height=720,frame=true`;
        window.open(url, `StreamPopout-${platform}-${channel}`, features);
    }
}
