# Every second: TCP states from netstat (fast), the TCP error counters, and the memory; the excluded port ranges once.
param([string]$Out)
netsh int ipv4 show excludedportrange protocol=tcp | Out-File -FilePath $Out -Append
netsh int ipv4 show dynamicport tcp | Out-File -FilePath $Out -Append
while ($true) {
  $lines = netstat -ano -p tcp
  $states = $lines | ForEach-Object { ($_ -split '\s+')[4] } | Where-Object { $_ } | Group-Object | ForEach-Object { "$($_.Name)=$($_.Count)" }
  $stats = (netstat -s -p tcp | Select-String 'Failed Connection Attempts|Reset Connections|Segments Retransmitted' | ForEach-Object { ($_ -replace '\s+', ' ').Trim() }) -join '; '
  $os = Get-CimInstance Win32_OperatingSystem
  "$(Get-Date -Format HH:mm:ss.fff) $($states -join ' ') | $stats | freeMB=$([int]($os.FreePhysicalMemory/1024))" | Out-File -FilePath $Out -Append
  Start-Sleep -Milliseconds 1000
}
