/**
 * Spiral Cafe Windows Print Connector - Official Release & Download Configuration
 *
 * Cloudflare Workers enforces a maximum static asset size of 25 MiB.
 * Because the standalone connector executable is ~83.2 MiB (Node.js Single Executable Application),
 * Windows release binaries are hosted via GitHub Releases on the official repository:
 * https://github.com/tnwebz/spiral-cafe/releases
 */

export const CONNECTOR_RELEASE = {
  version: "1.2.1",
  tag: "final",
  githubRepo: "https://github.com/tnwebz/spiral-cafe",
  releasesUrl: "https://github.com/tnwebz/spiral-cafe/releases",
  releaseTagUrl: "https://github.com/tnwebz/spiral-cafe/releases/tag/final",
  installer: {
    filename: "SpiralCafe-Printer-Setup.exe",
    label: "Download Windows Installer",
    shortLabel: "Download Setup.exe",
    sizeMb: "22.2 MB",
    downloadUrl: "https://github.com/tnwebz/spiral-cafe/releases/download/final/SpiralCafe-Printer-Setup.exe",
  },
  standalone: {
    filename: "SpiralCafePrintConnector.exe",
    label: "Download Standalone Executable (.exe)",
    shortLabel: "Standalone (.exe)",
    sizeMb: "87.2 MB",
    downloadUrl: "https://github.com/tnwebz/spiral-cafe/releases/download/final/SpiralCafePrintConnector.exe",
  },
} as const;

