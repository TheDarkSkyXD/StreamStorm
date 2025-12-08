import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

const config: ForgeConfig = {
  packagerConfig: {
    name: 'StreamStorm',
    executableName: 'streamstorm',
    appBundleId: 'com.streamstorm.app',
    appCopyright: `Copyright © ${new Date().getFullYear()} StreamStorm`,
    asar: true,
    // Icon paths - uncomment when icons are created
    // icon: './assets/icons/icon',
    // Windows specific
    win32metadata: {
      CompanyName: 'StreamStorm',
      ProductName: 'StreamStorm',
      FileDescription: 'Unified streaming app for Twitch and Kick',
    },
  },
  rebuildConfig: {},
  makers: [
    // Windows installer (Squirrel)
    new MakerSquirrel({
      name: 'StreamStorm',
      // setupIcon: './assets/icons/icon.ico', // Uncomment when icon exists
      // iconUrl: 'https://raw.githubusercontent.com/TheDarkSkyXD/StreamStorm/main/assets/icons/icon.ico',
    }),
    // macOS ZIP
    new MakerZIP({}, ['darwin']),
    // macOS DMG
    new MakerDMG({
      // icon: './assets/icons/icon.icns', // Uncomment when icon exists
      format: 'ULFO',
    }),
    // Linux DEB
    new MakerDeb({
      options: {
        name: 'streamstorm',
        productName: 'StreamStorm',
        genericName: 'Streaming App',
        description: 'Unified streaming app for Twitch and Kick',
        categories: ['Video', 'AudioVideo', 'Network'],
        // icon: './assets/icons/icon.png', // Uncomment when icon exists
        homepage: 'https://github.com/TheDarkSkyXD/StreamStorm',
      },
    }),
    // Linux RPM
    new MakerRpm({
      options: {
        name: 'streamstorm',
        productName: 'StreamStorm',
        genericName: 'Streaming App',
        description: 'Unified streaming app for Twitch and Kick',
        categories: ['Video', 'AudioVideo', 'Network'],
        // icon: './assets/icons/icon.png', // Uncomment when icon exists
        homepage: 'https://github.com/TheDarkSkyXD/StreamStorm',
      },
    }),
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload/index.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    // Electron Fuses for security hardening
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  // Publishers (for auto-updates)
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'TheDarkSkyXD',
          name: 'StreamStorm',
        },
        prerelease: false,
        draft: true,
      },
    },
  ],
};

export default config;
