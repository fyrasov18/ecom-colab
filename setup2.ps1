# Phase 1 setup chain: dependency pins + script approvals + DB bootstrap.
$ErrorActionPreference = 'Continue'
# Run from the repo root regardless of where this script is invoked from.
Set-Location $PSScriptRoot
$log = Join-Path $PSScriptRoot 'setup2.log'
Remove-Item $log -ErrorAction SilentlyContinue

function Step($name, $cmd) {
  Add-Content $log "`n=== $name ==="
  Invoke-Expression $cmd 2>&1 | Add-Content $log
  Add-Content $log "exit=$LASTEXITCODE"
}

Step 'approve-scripts' 'npm approve-scripts prisma @prisma/engines esbuild unrs-resolver'
Step 'pin-prisma6-zod3' 'npm install prisma@6 @prisma/client@6 zod@3 --no-audit --no-fund'
Step 'rebuild-scripts' 'npm rebuild'
Add-Content $log 'SETUP2-DEPS-DONE'

# Wait for PostgreSQL (up to 6 minutes)
$ok = $false
for ($i = 0; $i -lt 72; $i++) {
  docker exec ecomcolab-db pg_isready -U ecomcolab -d ecomcolab 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) { $ok = $true; break }
  Start-Sleep -Seconds 5
}
if (-not $ok) { Add-Content $log 'POSTGRES-NEVER-READY'; exit 1 }
Add-Content $log 'POSTGRES-READY'

Step 'prisma-generate' 'npx prisma generate'
Step 'prisma-db-push' 'npx prisma db push --skip-generate'
Step 'seed' 'npx tsx prisma/seed.ts'
Add-Content $log 'SETUP2-ALL-DONE'
