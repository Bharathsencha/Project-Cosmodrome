# Cosmodrome

Cosmodrome is a self-hosted platform-as-a-service (PaaS) engine for Linux. It provides deployment automation for Node.js and Go backend services as well as React and Svelte frontends.

## Goal

Provide a minimal, self-hosted deployment system on Linux servers with native process supervision, Git continuous deployment, internal reverse proxying, and Cloudflare Tunnel integration without external container or browser dependencies.

## Features

- Backend deployment for Node.js and Go applications
- Frontend deployment and static file serving for React and Svelte
- Automatic Git fetch and build pipeline
- Process supervision with process group management and restart handling
- Dynamic reverse proxy routing via Host headers
- Real-time log streaming
- Cloudflare Tunnel ingress support for exposure behind NAT/Wi-Fi

## License

GNU General Public License v3.0 (GPL-3.0). See LICENSE file for details.
