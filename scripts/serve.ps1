$port = 8080
$root = Split-Path -Parent $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:${port}/")
$listener.Start()
[Console]::WriteLine("Serving $root on http://localhost:$port")

$mimeTypes = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.svg'  = 'image/svg+xml'
  '.ico'  = 'image/x-icon'
}

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $resp = $ctx.Response

    $urlPath = $ctx.Request.Url.LocalPath
    if ($urlPath -eq '/') { $urlPath = '/index.html' }
    $filePath = Join-Path $root ($urlPath.TrimStart('/').Replace('/', '\'))

    try {
      if (Test-Path $filePath -PathType Leaf) {
        $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
        if ($mimeTypes.ContainsKey($ext)) {
          $resp.ContentType = $mimeTypes[$ext]
        } else {
          $resp.ContentType = 'application/octet-stream'
        }
        $resp.StatusCode = 200
        [byte[]]$bytes = [System.IO.File]::ReadAllBytes($filePath)
        $resp.ContentLength64 = [long]$bytes.Length
        $resp.OutputStream.Write($bytes, 0, $bytes.Length)
      } else {
        $resp.StatusCode = 404
        $resp.ContentType = 'text/plain; charset=utf-8'
        [byte[]]$msg = [System.Text.Encoding]::UTF8.GetBytes('Not Found')
        $resp.ContentLength64 = [long]$msg.Length
        $resp.OutputStream.Write($msg, 0, $msg.Length)
      }
    } catch {
      try { $resp.StatusCode = 500 } catch {}
    } finally {
      $resp.Close()
    }
  }
} finally {
  $listener.Stop()
}
