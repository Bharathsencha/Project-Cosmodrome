package api

import (
	"bufio"
	"fmt"
	"os"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
)

var (
	startTime     = time.Now()
	lastCPUTotal  uint64
	lastCPUIdle   uint64
	lastCPURate   float64
	cpuLock       sync.Mutex
	lastSampleTime time.Time
)

// SystemStats contains real-time host metrics.
type SystemStats struct {
	CPUUsagePercent float64 `json:"cpu_usage_percent"`
	CPUCores        int     `json:"cpu_cores"`
	MemTotalMB      uint64  `json:"mem_total_mb"`
	MemUsedMB       uint64  `json:"mem_used_mb"`
	MemFreeMB       uint64  `json:"mem_free_mb"`
	MemUsagePercent float64 `json:"mem_usage_percent"`
	DiskTotalGB     uint64  `json:"disk_total_gb"`
	DiskUsedGB      uint64  `json:"disk_used_gb"`
	DiskFreeGB      uint64  `json:"disk_free_gb"`
	DiskUsagePercent float64 `json:"disk_usage_percent"`
	SystemUptimeSec uint64  `json:"system_uptime_sec"`
	ServerUptimeSec uint64  `json:"server_uptime_sec"`
	OS              string  `json:"os"`
	GoVersion       string  `json:"go_version"`
	ActiveApps      int     `json:"active_apps"`
	TotalApps       int     `json:"total_apps"`
}

// GetSystemStats reads Linux /proc stats and filesystem info.
func GetSystemStats(totalApps, activeApps int) SystemStats {
	stats := SystemStats{
		CPUCores:        runtime.NumCPU(),
		OS:              runtime.GOOS,
		GoVersion:       runtime.Version(),
		ServerUptimeSec: uint64(time.Since(startTime).Seconds()),
		TotalApps:       totalApps,
		ActiveApps:      activeApps,
	}

	// 1. CPU Usage
	stats.CPUUsagePercent = readCPUUsage()

	// 2. Memory Usage from /proc/meminfo
	readMemInfo(&stats)

	// 3. Disk Usage
	readDiskUsage("/", &stats)

	// 4. System Uptime from /proc/uptime
	stats.SystemUptimeSec = readSystemUptime()

	return stats
}

func readCPUUsage() float64 {
	cpuLock.Lock()
	defer cpuLock.Unlock()

	// Limit sampling rate to avoid 0-interval reads
	if time.Since(lastSampleTime) < 500*time.Millisecond && lastSampleTime != (time.Time{}) {
		return lastCPURate
	}

	file, err := os.Open("/proc/stat")
	if err != nil {
		return 0.0
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	if scanner.Scan() {
		line := scanner.Text()
		fields := strings.Fields(line)
		if len(fields) >= 5 && fields[0] == "cpu" {
			var user, nice, system, idle, iowait, irq, softirq, steal uint64
			user, _ = strconv.ParseUint(fields[1], 10, 64)
			nice, _ = strconv.ParseUint(fields[2], 10, 64)
			system, _ = strconv.ParseUint(fields[3], 10, 64)
			idle, _ = strconv.ParseUint(fields[4], 10, 64)
			if len(fields) > 5 {
				iowait, _ = strconv.ParseUint(fields[5], 10, 64)
			}
			if len(fields) > 6 {
				irq, _ = strconv.ParseUint(fields[6], 10, 64)
			}
			if len(fields) > 7 {
				softirq, _ = strconv.ParseUint(fields[7], 10, 64)
			}
			if len(fields) > 8 {
				steal, _ = strconv.ParseUint(fields[8], 10, 64)
			}

			total := user + nice + system + idle + iowait + irq + softirq + steal
			idleTotal := idle + iowait

			if lastCPUTotal != 0 && total > lastCPUTotal {
				deltaTotal := float64(total - lastCPUTotal)
				deltaIdle := float64(idleTotal - lastCPUIdle)
				if deltaTotal > 0 {
					lastCPURate = ((deltaTotal - deltaIdle) / deltaTotal) * 100.0
					if lastCPURate < 0 {
						lastCPURate = 0
					} else if lastCPURate > 100 {
						lastCPURate = 100
					}
				}
			}

			lastCPUTotal = total
			lastCPUIdle = idleTotal
			lastSampleTime = time.Now()
		}
	}

	return lastCPURate
}

func readMemInfo(stats *SystemStats) {
	file, err := os.Open("/proc/meminfo")
	if err != nil {
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	var memTotal, memAvailable uint64
	for scanner.Scan() {
		line := scanner.Text()
		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		valFields := strings.Fields(parts[1])
		if len(valFields) == 0 {
			continue
		}
		val, _ := strconv.ParseUint(valFields[0], 10, 64) // in kB

		switch key {
		case "MemTotal":
			memTotal = val
		case "MemAvailable":
			memAvailable = val
		}
	}

	if memTotal > 0 {
		stats.MemTotalMB = memTotal / 1024
		memUsed := memTotal - memAvailable
		stats.MemUsedMB = memUsed / 1024
		stats.MemFreeMB = memAvailable / 1024
		stats.MemUsagePercent = (float64(memUsed) / float64(memTotal)) * 100.0
	}
}

func readDiskUsage(path string, stats *SystemStats) {
	var stat syscall.Statfs_t
	if err := syscall.Statfs(path, &stat); err != nil {
		return
	}

	totalBytes := stat.Blocks * uint64(stat.Bsize)
	freeBytes := stat.Bavail * uint64(stat.Bsize)
	usedBytes := totalBytes - freeBytes

	stats.DiskTotalGB = totalBytes / (1024 * 1024 * 1024)
	stats.DiskFreeGB = freeBytes / (1024 * 1024 * 1024)
	stats.DiskUsedGB = usedBytes / (1024 * 1024 * 1024)

	if totalBytes > 0 {
		stats.DiskUsagePercent = (float64(usedBytes) / float64(totalBytes)) * 100.0
	}
}

func readSystemUptime() uint64 {
	data, err := os.ReadFile("/proc/uptime")
	if err != nil {
		return 0
	}
	fields := strings.Fields(string(data))
	if len(fields) > 0 {
		uptimeFloat, err := strconv.ParseFloat(fields[0], 64)
		if err == nil {
			return uint64(uptimeFloat)
		}
	}
	return 0
}

// FormatUptime formats seconds into human-readable string (e.g. "4d 12h 30m" or "5m 20s").
func FormatUptime(sec uint64) string {
	d := time.Duration(sec) * time.Second
	days := int(d.Hours() / 24)
	hours := int(d.Hours()) % 24
	mins := int(d.Minutes()) % 60
	secs := int(d.Seconds()) % 60

	if days > 0 {
		return fmt.Sprintf("%dd %dh %dm", days, hours, mins)
	}
	if hours > 0 {
		return fmt.Sprintf("%dh %dm %ds", hours, mins, secs)
	}
	if mins > 0 {
		return fmt.Sprintf("%dm %ds", mins, secs)
	}
	return fmt.Sprintf("%ds", secs)
}
