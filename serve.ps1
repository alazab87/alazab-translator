# Alazab Translator - Local Proxy Server
$port = 3000
$root = Join-Path $PSScriptRoot "public"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

Write-Host ""
Write-Host "  Alazab Translator is running!" -ForegroundColor Cyan
Write-Host "  Open: http://localhost:$port" -ForegroundColor Green
Write-Host "  Press Ctrl+C to stop." -ForegroundColor Gray
Write-Host ""

Start-Process "http://localhost:$port"

function Write-Resp($resp, $mime, $body) {
    $resp.Headers.Add("Access-Control-Allow-Origin", "*")
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
    $resp.ContentType = $mime + "; charset=utf-8"
    $resp.ContentLength64 = $bytes.Length
    $resp.OutputStream.Write($bytes, 0, $bytes.Length)
    $resp.OutputStream.Close()
}

try {
    while ($listener.IsListening) {
        $ctx  = $listener.GetContext()
        $req  = $ctx.Request
        $resp = $ctx.Response

        if ($req.HttpMethod -eq "OPTIONS") {
            $resp.Headers.Add("Access-Control-Allow-Origin", "*")
            $resp.Headers.Add("Access-Control-Allow-Headers", "*")
            $resp.StatusCode = 204
            $resp.OutputStream.Close()
            continue
        }

        if ($req.HttpMethod -eq "POST" -and ($req.Url.LocalPath -eq "/api/translate" -or $req.Url.LocalPath -eq "/translate")) {
            try {
                $reader  = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
                $bodyRaw = $reader.ReadToEnd()
                $data    = $bodyRaw | ConvertFrom-Json

                $srcLang = "English"
                $tgtLang = "Spanish"
                if ($data.direction -ne "en-es") {
                    $srcLang = "Spanish"
                    $tgtLang = "English"
                }

                $sysPrompt = "You are Alazab Translator. Translate from $srcLang to $tgtLang. Output ONLY the translation, no explanations, no alternatives, no notes. Preserve tone, formality, idioms, and punctuation."

                $payload = ConvertTo-Json -Depth 5 @{
                    model      = "claude-haiku-4-5"
                    max_tokens = 1024
                    system     = $sysPrompt
                    messages   = @(@{ role = "user"; content = $data.text })
                }

                $headers = @{
                    "x-api-key"         = $data.apiKey
                    "anthropic-version" = "2023-06-01"
                    "content-type"      = "application/json"
                }

                # Use WebRequest + explicit UTF-8 decoding to preserve Spanish characters
                $webResp     = Invoke-WebRequest -Uri "https://api.anthropic.com/v1/messages" -Method POST -Headers $headers -Body $payload -UseBasicParsing
                $rawText     = [System.Text.Encoding]::UTF8.GetString($webResp.RawContentStream.ToArray())
                $result      = $rawText | ConvertFrom-Json
                $translation = $result.content[0].text
                $out         = ConvertTo-Json @{ translation = $translation }
                Write-Resp $resp "application/json" $out

            } catch {
                $errMsg = $_.Exception.Message
                Write-Host "API error: $errMsg" -ForegroundColor Red
                $resp.StatusCode = 500
                Write-Resp $resp "application/json" (ConvertTo-Json @{ error = $errMsg })
            }
            continue
        }

        $urlPath  = $req.Url.LocalPath
        if ($urlPath -eq "/" -or $urlPath -eq "") { $urlPath = "/index.html" }
        $filePath = Join-Path $root ($urlPath.TrimStart("/").Replace("/", [IO.Path]::DirectorySeparatorChar))

        if (Test-Path $filePath -PathType Leaf) {
            $ext  = [IO.Path]::GetExtension($filePath)
            $mime = "text/plain"
            if ($ext -eq ".html") { $mime = "text/html" }
            elseif ($ext -eq ".js")  { $mime = "application/javascript" }
            elseif ($ext -eq ".css") { $mime = "text/css" }
            $bytes = [IO.File]::ReadAllBytes($filePath)
            $resp.Headers.Add("Access-Control-Allow-Origin", "*")
            $resp.ContentType     = $mime + "; charset=utf-8"
            $resp.ContentLength64 = $bytes.Length
            $resp.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $resp.StatusCode = 404
            $resp.ContentLength64 = 0
        }
        $resp.OutputStream.Close()
    }
} finally {
    $listener.Stop()
    Write-Host "Server stopped." -ForegroundColor Gray
}
