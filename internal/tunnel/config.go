package tunnel

import (
	"fmt"
	"os/exec"
)

// GenerateConfig generates a ready-to-use cloudflared configuration file snippet.
func GenerateConfig(tunnelUUID, domain string, cosmodromePort int) string {
	return fmt.Sprintf(`# Cloudflare Tunnel Configuration for Cosmodrome
tunnel: %s
credentials-file: /root/.cloudflared/%s.json

ingress:
  # Route wildcard to Cosmodrome reverse proxy
  - hostname: "*.%s"
    service: http://localhost:%d
  # Direct root domain to dashboard
  - hostname: "%s"
    service: http://localhost:%d
  # Catch-all
  - service: http_status:404
`, tunnelUUID, tunnelUUID, domain, cosmodromePort, domain, cosmodromePort)
}

// CheckCloudflaredInstalled checks if cloudflared CLI is in PATH.
func CheckCloudflaredInstalled() bool {
	_, err := exec.LookPath("cloudflared")
	return err == nil
}
