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

                $isAuto    = ($srcLang -eq "Auto Detect")
                $needsRoman = @("Arabic","Chinese","Japanese") -contains $tgtLang
                $needsJson = $isAuto -or $needsRoman

                if ($isAuto -and $needsRoman) {
                    $sys = "Detect the source language, translate to $tgtLang, and provide romanization.$fNote Respond ONLY with valid JSON: {`"detectedLang`":`"English`",`"translation`":`"..`",`"romanization`":`"..`"}"
                } elseif ($isAuto) {
                    $sys = "Detect the language, translate to $tgtLang.$fNote Respond ONLY with valid JSON: {`"detectedLang`":`"English`",`"translation`":`"translated text`"}"
                } elseif ($needsRoman) {
                    $sys = "Translate from $srcLang to $tgtLang and provide romanization.$fNote Respond ONLY with valid JSON: {`"translation`":`"..`",`"romanization`":`"..`"}"
                } else {
                    $sys = "You are Alazab Translator. Translate from $srcLang to $tgtLang. Output ONLY the translation.$fNote"
                }

                $raw = Invoke-Claude $sys $data.text 1500

                if ($needsJson) {
                    $parsed = (Clean-Json $raw) | ConvertFrom-Json
                    $outObj = @{ translation = $parsed.translation }
                    if ($parsed.detectedLang) { $outObj.detectedLang = $parsed.detectedLang }
                    if ($parsed.romanization) { $outObj.romanization = $parsed.romanization }
                    Write-Resp $resp "application/json" (ConvertTo-Json $outObj)
                } else {
                    Write-Resp $resp "application/json" (ConvertTo-Json @{ translation = $raw })
                }

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

                $sys = "You are a translation assistant. Given a $($data.tgtLang) word and its sentence context, provide exactly 3 short alternative translations for that word. Respond ONLY with a JSON array: [`"alt1`",`"alt2`",`"alt3`"]"
                $msg = "Sentence: `"$($data.context)`"`nWord: `"$($data.word)`""
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
