# Alazab Translator - Local Proxy Server
$port    = 3000
$root    = Join-Path $PSScriptRoot "public"
$apiKey  = if ($env:ANTHROPIC_API_KEY) { $env:ANTHROPIC_API_KEY } else { "" }

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

function Invoke-Claude($sysPrompt, $userContent, $maxTokens) {
    $payload = ConvertTo-Json -Depth 5 @{
        model      = "claude-haiku-4-5"
        max_tokens = $maxTokens
        system     = $sysPrompt
        messages   = @(@{ role = "user"; content = $userContent })
    }
    $headers = @{
        "x-api-key"         = $apiKey
        "anthropic-version" = "2023-06-01"
        "content-type"      = "application/json"
    }
    $webResp = Invoke-WebRequest -Uri "https://api.anthropic.com/v1/messages" -Method POST -Headers $headers -Body $payload -UseBasicParsing
    $raw     = [System.Text.Encoding]::UTF8.GetString($webResp.RawContentStream.ToArray())
    return ($raw | ConvertFrom-Json).content[0].text
}

function Clean-Json($text) {
    return $text.Trim() -replace '^```json\s*','' -replace '^```\s*','' -replace '```\s*$','' | ForEach-Object { $_.Trim() }
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

        # ── /api/translate ──
        if ($req.HttpMethod -eq "POST" -and ($req.Url.LocalPath -eq "/api/translate" -or $req.Url.LocalPath -eq "/translate")) {
            try {
                $reader  = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
                $data    = $reader.ReadToEnd() | ConvertFrom-Json

                $srcLang   = if ($data.srcLang)   { $data.srcLang }   else { "English" }
                $tgtLang   = if ($data.tgtLang)   { $data.tgtLang }   else { "Spanish" }
                $formality = if ($data.formality) { $data.formality } else { "neutral" }

                $fNote = ""
                if ($formality -eq "formal") { $fNote = " Use formal, polite register." }
                if ($formality -eq "casual") { $fNote = " Use casual, informal, everyday language." }

                $isAuto     = ($srcLang -eq "Auto Detect")
                $needsRoman = @("Arabic","Chinese","Japanese") -contains $tgtLang
                $outObj     = @{}

                # Step 1: Detect language if needed
                $effectiveSrc = $srcLang
                if ($isAuto) {
                    $detected = Invoke-Claude "Identify the language. Reply ONLY with the language name in English (e.g. Spanish, French, Arabic). Nothing else." $data.text.Substring(0, [Math]::Min(300, $data.text.Length)) 50
                    $outObj.detectedLang = $detected.Trim()
                    $effectiveSrc = $detected.Trim()
                }

                # Step 2: Translate (plain text — always reliable)
                $sys = "You are Alazab Translator. Translate from $effectiveSrc to $tgtLang. Output ONLY the translation.$fNote"
                $translation = Invoke-Claude $sys $data.text 1024
                $outObj.translation = $translation

                # Step 3: Romanize if needed (separate call — no JSON parsing issues)
                if ($needsRoman) {
                    $romanSys = "Provide the romanization (pronunciation in Latin alphabet) of this $tgtLang text. Output ONLY the romanization, nothing else."
                    $roman = Invoke-Claude $romanSys $translation 500
                    $outObj.romanization = $roman.Trim()
                }

                Write-Resp $resp "application/json" (ConvertTo-Json $outObj)

            } catch {
                $resp.StatusCode = 500
                Write-Resp $resp "application/json" (ConvertTo-Json @{ error = $_.Exception.Message })
            }
            continue
        }

        # ── /api/romanize ──
        if ($req.HttpMethod -eq "POST" -and $req.Url.LocalPath -eq "/api/romanize") {
            try {
                $reader = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
                $data   = $reader.ReadToEnd() | ConvertFrom-Json
                $sys = "Provide the romanization (pronunciation guide using Latin alphabet) of the following $($data.lang) text. Output ONLY the romanization, nothing else — no explanations, no original script."
                $roman = Invoke-Claude $sys $data.text 500
                Write-Resp $resp "application/json" (ConvertTo-Json @{ romanization = $roman.Trim() })
            } catch {
                $resp.StatusCode = 500
                Write-Resp $resp "application/json" (ConvertTo-Json @{ error = $_.Exception.Message })
            }
            continue
        }

        # ── /api/alternatives ──
        if ($req.HttpMethod -eq "POST" -and $req.Url.LocalPath -eq "/api/alternatives") {
            try {
                $reader = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
                $data   = $reader.ReadToEnd() | ConvertFrom-Json

                $sys = "The sentence below is in $($data.tgtLang). Give exactly 3 alternative $($data.tgtLang) words or short phrases to replace the given word. All alternatives MUST be in $($data.tgtLang) — do NOT use English. Respond ONLY with a JSON array: [`"alt1`",`"alt2`",`"alt3`"]"
                $msg = "Sentence in $($data.tgtLang): `"$($data.context)`"`nWord to replace: `"$($data.word)`""
                $raw = Invoke-Claude $sys $msg 200
                $alts = (Clean-Json $raw) | ConvertFrom-Json
                Write-Resp $resp "application/json" (ConvertTo-Json @{ alternatives = $alts })

            } catch {
                $resp.StatusCode = 500
                Write-Resp $resp "application/json" (ConvertTo-Json @{ error = $_.Exception.Message })
            }
            continue
        }

        # ── Static files ──
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
