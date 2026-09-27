$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$base = 'http://localhost:3000'
# Resolve paths relative to this script so the repo works from any clone location.
$root = $PSScriptRoot

function Report($name, $ok, $info) {
  $tag = if ($ok) { 'PASS' } else { 'FAIL' }
  Write-Output "[$tag] $name -- $info"
}

function Get-Ids {
  $map = @{}
  $idsPath = Join-Path $root 'ids.txt'
  if (-not (Test-Path $idsPath)) {
    throw "ids.txt introuvable — exécutez d'abord : npx tsx scripts/pick-ids.ts"
  }
  foreach ($line in (Get-Content $idsPath)) {
    $parts = $line -split '=', 2
    if ($parts.Count -eq 2) { $map[$parts[0]] = $parts[1] }
  }
  return $map
}

function Login($email, $password) {
  $s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $csrf = Invoke-RestMethod "$base/api/auth/csrf" -WebSession $s
  $body = 'email=' + [uri]::EscapeDataString($email) +
          '&password=' + [uri]::EscapeDataString($password) +
          '&csrfToken=' + [uri]::EscapeDataString($csrf.csrfToken) +
          '&callbackUrl=%2F&json=true'
  $r = Invoke-WebRequest "$base/api/auth/callback/credentials" -Method Post -Body $body `
    -ContentType 'application/x-www-form-urlencoded' -WebSession $s -UseBasicParsing
  return @{ session = $s; ok = ($r.StatusCode -eq 200) }
}

$ids = Get-Ids

try {
  $r = Invoke-WebRequest "$base/dashboard" -UseBasicParsing -MaximumRedirection 0
  Report 'unauth /dashboard' ($r.StatusCode -eq 307) "status=$($r.StatusCode)"
} catch {
  $sc = $_.Exception.Response.StatusCode.value__
  Report 'unauth /dashboard' ($sc -in 301,302,307) "status=$sc"
}

try {
  $admin = Login 'admin@ecomcolab.tn' 'Admin123!'
  Report 'admin login' $admin.ok "ok=$($admin.ok)"
} catch {
  Report 'admin login' $false $_.Exception.Message
  $admin = @{ session = $null; ok = $false }
}
$sAdmin = $admin.session

try {
  $d = Invoke-WebRequest "$base/dashboard" -WebSession $sAdmin -UseBasicParsing
  Report 'admin /dashboard' (($d.StatusCode -eq 200) -and ($d.Content -match 'Partenaires actifs')) "status=$($d.StatusCode)"
} catch { Report 'admin /dashboard' $false $_.Exception.Message }

try {
  $p = Invoke-WebRequest "$base/produits" -WebSession $sAdmin -UseBasicParsing
  $ok = ($p.StatusCode -eq 200) -and ($p.Content -match 'Mini Machine') -and ($p.Content -match 'produit\(s\)')
  Report 'admin /produits lists 15 products' $ok "status=$($p.StatusCode)"
} catch { Report 'admin /produits' $false $_.Exception.Message }

try {
  $n = Invoke-WebRequest "$base/produits/nouveau" -WebSession $sAdmin -UseBasicParsing
  Report 'admin /produits/nouveau' ($n.StatusCode -eq 200) "status=$($n.StatusCode)"
} catch { Report 'admin /produits/nouveau' $false $_.Exception.Message }

try {
  $pl = Invoke-WebRequest "$base/partenaires" -WebSession $sAdmin -UseBasicParsing
  $ok = ($pl.StatusCode -eq 200) -and ($pl.Content -match 'Nour Ben Salah')
  Report 'admin /partenaires lists partners' $ok "status=$($pl.StatusCode)"
} catch { Report 'admin /partenaires' $false $_.Exception.Message }

try {
  $m = Invoke-WebRequest "$base/marketing" -WebSession $sAdmin -UseBasicParsing
  $ok = ($m.StatusCode -eq 200) -and ($m.Content -match 'Kit marketing')
  Report 'admin /marketing' $ok "status=$($m.StatusCode)"
} catch { Report 'admin /marketing' $false $_.Exception.Message }

try {
  $r = Invoke-WebRequest "$base/catalogue" -WebSession $sAdmin -UseBasicParsing -MaximumRedirection 0
  Report 'admin blocked /catalogue' ($r.StatusCode -eq 307) "status=$($r.StatusCode)"
} catch {
  $sc = $_.Exception.Response.StatusCode.value__
  $loc = $_.Exception.Response.Headers['Location']
  Report 'admin blocked /catalogue' (($sc -in 301,302,307) -and ("$loc" -like '*dashboard*')) "status=$sc loc=$loc"
}

try {
  $partner = Login 'nour@partner.tn' 'Partner123!'
  Report 'partner login' $partner.ok "ok=$($partner.ok)"
} catch {
  Report 'partner login' $false $_.Exception.Message
  $partner = @{ session = $null; ok = $false }
}
$sPartner = $partner.session

try {
  $c = Invoke-WebRequest "$base/catalogue" -WebSession $sPartner -UseBasicParsing
  $ok = ($c.StatusCode -eq 200) -and ($c.Content -match 'assign')
  Report 'partner /catalogue' $ok "status=$($c.StatusCode)"
} catch { Report 'partner /catalogue' $false $_.Exception.Message }

if ($ids['assigned']) {
  try {
    $a = Invoke-WebRequest "$base/catalogue/$($ids['assigned'])" -WebSession $sPartner -UseBasicParsing
    $ok = ($a.StatusCode -eq 200) -and ($a.Content -match 'Kit marketing')
    Report 'partner assigned product (200 + kit)' $ok "status=$($a.StatusCode)"
  } catch { Report 'partner assigned product' $false $_.Exception.Message }
} else {
  Report 'partner assigned product' $false 'no assigned id'
}

if ($ids['unassigned']) {
  try {
    $u = Invoke-WebRequest "$base/catalogue/$($ids['unassigned'])" -WebSession $sPartner -UseBasicParsing -MaximumRedirection 0
    Report 'partner non-assigned product blocked' ($u.StatusCode -eq 404) "status=$($u.StatusCode) EXPECTED 404"
  } catch {
    $sc = $_.Exception.Response.StatusCode.value__
    Report 'partner non-assigned product blocked' ($sc -eq 404) "status=$sc EXPECTED 404"
  }
} else {
  Report 'partner non-assigned product blocked' $false 'no unassigned id'
}

try {
  $r = Invoke-WebRequest "$base/produits" -WebSession $sPartner -UseBasicParsing -MaximumRedirection 0
  Report 'partner blocked /produits' ($r.StatusCode -eq 307) "status=$($r.StatusCode)"
} catch {
  $sc = $_.Exception.Response.StatusCode.value__
  $loc = $_.Exception.Response.Headers['Location']
  Report 'partner blocked /produits' (($sc -in 301,302,307) -and ("$loc" -like '*tableau-de-bord*')) "status=$sc loc=$loc"
}

try {
  $r = Invoke-WebRequest "$base/partenaires" -WebSession $sPartner -UseBasicParsing -MaximumRedirection 0
  Report 'partner blocked /partenaires' ($r.StatusCode -eq 307) "status=$($r.StatusCode)"
} catch {
  $sc = $_.Exception.Response.StatusCode.value__
  Report 'partner blocked /partenaires' ($sc -in 301,302,307) "status=$sc"
}



# [24] Logistics hub
try {
  $lg = Invoke-WebRequest "$base/logistique" -WebSession $sAdmin -UseBasicParsing
  $ok = ($lg.StatusCode -eq 200) -and ($lg.Content -match 'Retours / Refus')
  Report 'admin /logistique lanes' $ok "status=$($lg.StatusCode)"
} catch { Report 'admin /logistique' $false $_.Exception.Message }

try {
  $lgr = Invoke-WebRequest "$base/logistique?lane=RETURNS" -WebSession $sAdmin -UseBasicParsing
  $ok = ($lgr.StatusCode -eq 200) -and ($lgr.Content -match 'Retours / Refus')
  Report 'admin /logistique?lane=RETURNS' $ok "status=$($lgr.StatusCode)"
} catch { Report 'admin /logistique RETURNS' $false $_.Exception.Message }

# [25] Partner blocked from logistics
try {
  $r = Invoke-WebRequest "$base/logistique" -WebSession $sPartner -UseBasicParsing -MaximumRedirection 0
  Report 'partner blocked /logistique' ($r.StatusCode -eq 307) "status=$($r.StatusCode)"
} catch {
  $sc = $_.Exception.Response.StatusCode.value__
  Report 'partner blocked /logistique' ($sc -in 301,302,307) "status=$sc"
}

# [15] Admin orders list with filters
try {
  $o = Invoke-WebRequest "$base/commandes" -WebSession $sAdmin -UseBasicParsing
  $ok = ($o.StatusCode -eq 200) -and ($o.Content -match 'commande\(s\)')
  Report 'admin /commandes' $ok "status=$($o.StatusCode)"
} catch { Report 'admin /commandes' $false $_.Exception.Message }

try {
  $od = Invoke-WebRequest "$base/commandes?status=DELIVERED" -WebSession $sAdmin -UseBasicParsing
  $ok = ($od.StatusCode -eq 200) -and ($od.Content -match 'Livr')
  Report 'admin /commandes?status=DELIVERED' $ok "status=$($od.StatusCode)"
} catch { Report 'admin /commandes filter' $false $_.Exception.Message }

# [16] Admin order detail with frozen financial snapshot
if ($ids['otherOrder']) {
  try {
    $det = Invoke-WebRequest "$base/commandes/$($ids['otherOrder'])" -WebSession $sAdmin -UseBasicParsing
    $ok = ($det.StatusCode -eq 200) -and ($det.Content -match 'snapshot fig') -and ($det.Content -match 'Contribution')
    Report 'admin order detail (snapshot)' $ok "status=$($det.StatusCode)"
  } catch { Report 'admin order detail' $false $_.Exception.Message }
} else { Report 'admin order detail' $false 'no order id' }

# [17] Admin clients directory
try {
  $cl = Invoke-WebRequest "$base/clients" -WebSession $sAdmin -UseBasicParsing
  $ok = ($cl.StatusCode -eq 200) -and ($cl.Content -match 'client\(s\)')
  Report 'admin /clients' $ok "status=$($cl.StatusCode)"
} catch { Report 'admin /clients' $false $_.Exception.Message }

# [18] Partner new-order form (confirmation checkbox present)
try {
  $nc = Invoke-WebRequest "$base/nouvelle-commande" -WebSession $sPartner -UseBasicParsing
  $ok = ($nc.StatusCode -eq 200) -and ($nc.Content -match 'Confirmer et enregistrer')
  Report 'partner /nouvelle-commande' $ok "status=$($nc.StatusCode)"
} catch { Report 'partner /nouvelle-commande' $false $_.Exception.Message }

# [19] Partner order list shows own orders
try {
  $mc = Invoke-WebRequest "$base/mes-commandes" -WebSession $sPartner -UseBasicParsing
  $ok = ($mc.StatusCode -eq 200) -and ($mc.Content -match 'gain')
  Report 'partner /mes-commandes' $ok "status=$($mc.StatusCode)"
} catch { Report 'partner /mes-commandes' $false $_.Exception.Message }

# [20] Partner can open OWN order
if ($ids['ownOrder']) {
  try {
    $own = Invoke-WebRequest "$base/mes-commandes/$($ids['ownOrder'])" -WebSession $sPartner -UseBasicParsing
    $ok = ($own.StatusCode -eq 200) -and ($own.Content -match 'Historique')
    Report 'partner own order detail' $ok "status=$($own.StatusCode)"
  } catch { Report 'partner own order detail' $false $_.Exception.Message }
} else { Report 'partner own order detail' $false 'no own order id' }

# [21] Partner CANNOT open another partner order (404 isolation)
if ($ids['otherOrder']) {
  try {
    $stolen = Invoke-WebRequest "$base/mes-commandes/$($ids['otherOrder'])" -WebSession $sPartner -UseBasicParsing -MaximumRedirection 0
    Report 'partner other order blocked' ($stolen.StatusCode -eq 404) "status=$($stolen.StatusCode) EXPECTED 404"
  } catch {
    $sc = $_.Exception.Response.StatusCode.value__
    Report 'partner other order blocked' ($sc -eq 404) "status=$sc EXPECTED 404"
  }
} else { Report 'partner other order blocked' $false 'no other order id' }

# [22] Partner blocked from admin orders area
try {
  $r = Invoke-WebRequest "$base/commandes" -WebSession $sPartner -UseBasicParsing -MaximumRedirection 0
  Report 'partner blocked /commandes' ($r.StatusCode -eq 307) "status=$($r.StatusCode)"
} catch {
  $sc = $_.Exception.Response.StatusCode.value__
  Report 'partner blocked /commandes' ($sc -in 301,302,307) "status=$sc"
}

# [26] Finance — admin ledger view (Phase 5)
try {
  $fin = Invoke-WebRequest "$base/finance" -WebSession $sAdmin -UseBasicParsing
  $ok = ($fin.StatusCode -eq 200) -and ($fin.Content -match 'Ledger immuable') -and ($fin.Content -match 'Demandes de retrait')
  Report 'admin /finance ledger' $ok "status=$($fin.StatusCode)"
} catch { Report 'admin /finance ledger' $false $_.Exception.Message }

try {
  $finp = Invoke-WebRequest "$base/finance?page=1" -WebSession $sAdmin -UseBasicParsing
  Report 'admin /finance ledger page 1' ($finp.StatusCode -eq 200) "status=$($finp.StatusCode)"
} catch { Report 'admin /finance ledger page 1' $false $_.Exception.Message }

# [27] Finance — partner wallet (balance + withdraw form)
try {
  $wal = Invoke-WebRequest "$base/portefeuille" -WebSession $sPartner -UseBasicParsing
  $ok = ($wal.StatusCode -eq 200) -and ($wal.Content -match 'Solde disponible') -and ($wal.Content -match 'Retirable maintenant') -and ($wal.Content -match 'Demander un retrait')
  Report 'partner /portefeuille + retrait' $ok "status=$($wal.StatusCode)"
} catch { Report 'partner /portefeuille' $false $_.Exception.Message }

# [28] RBAC — partner blocked from the admin finance area
try {
  $r = Invoke-WebRequest "$base/finance" -WebSession $sPartner -UseBasicParsing -MaximumRedirection 0
  Report 'partner blocked /finance' ($r.StatusCode -eq 307) "status=$($r.StatusCode)"
} catch {
  $sc = $_.Exception.Response.StatusCode.value__
  Report 'partner blocked /finance' ($sc -in 301,302,307) "status=$sc"
}

# [29] Admin partner detail exposes the finance summary
if ($ids['partnerId']) {
  try {
    $pd = Invoke-WebRequest "$base/partenaires/$($ids['partnerId'])" -WebSession $sAdmin -UseBasicParsing
    $ok = ($pd.StatusCode -eq 200) -and ($pd.Content -match 'Solde disponible') -and ($pd.Content -match 'Gains en attente') -and ($pd.Content -match 'Finances')
    Report 'admin partner detail finance' $ok "status=$($pd.StatusCode)"
  } catch { Report 'admin partner detail finance' $false $_.Exception.Message }
} else { Report 'admin partner detail finance' $false 'no partner id' }

# [30] Settlement cron — never publicly runnable without the shared secret
try {
  $cr = Invoke-WebRequest "$base/api/cron/settle" -UseBasicParsing -MaximumRedirection 0
  Report 'cron without key blocked' $false "status=$($cr.StatusCode) EXPECTED 401"
} catch {
  $sc = $_.Exception.Response.StatusCode.value__
  Report 'cron without key blocked' ($sc -eq 401) "status=$sc EXPECTED 401"
}

# [31] Settlement cron — authorised run is idempotent (200 + ok:true)
$cronSecret = ''
foreach ($line in (Get-Content 'd:\e-com collab\.env')) {
  if ($line -match '^CRON_SECRET="?(.+?)"?\s*$') { $cronSecret = $Matches[1] }
}
if ($cronSecret) {
  try {
    $run = Invoke-WebRequest "$base/api/cron/settle?key=$cronSecret" -UseBasicParsing
    $body = $run.Content | ConvertFrom-Json
    Report 'cron authorised run' (($run.StatusCode -eq 200) -and ($body.ok -eq $true)) "settled=$($body.settled) partners=$($body.partners)"
  } catch { Report 'cron authorised run' $false $_.Exception.Message }
} else {
  Report 'cron authorised run' $false 'CRON_SECRET not found in .env'
}

Write-Output 'SMOKE-ALL-DONE'


