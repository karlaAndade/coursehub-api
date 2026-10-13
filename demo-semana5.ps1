# Demostración Semana 5 - CourseHub API
# Uso: powershell -ExecutionPolicy Bypass -File .\demo-semana5.ps1

$base = "http://localhost:3000"
$sufijo = Get-Date -Format "yyyyMMddHHmmss"
$archivo = Join-Path $PSScriptRoot "evidencia-semana5.txt"

Set-Content -Path $archivo -Encoding utf8 -Value @"
EVIDENCIA - Proyecto práctico Semana 5
CourseHub API persistente: estudiantes y matrículas
Fecha: $(Get-Date -Format "yyyy-MM-dd HH:mm")
"@

function Log([string]$texto) {
    Write-Host $texto
    Add-Content -Path $archivo -Encoding utf8 -Value $texto
}

function Invoke-Api {
    param([string]$Method, [string]$Path, $Body = $null)
    $params = @{ Method = $Method; Uri = "$base$Path"; UseBasicParsing = $true }
    if ($null -ne $Body) {
        $json = $Body | ConvertTo-Json -Depth 5
        $params.ContentType = "application/json; charset=utf-8"
        $params.Body = [System.Text.Encoding]::UTF8.GetBytes($json)
    }
    try {
        $r = Invoke-WebRequest @params
        return [pscustomobject]@{ Status = [int]$r.StatusCode; Body = $r.Content }
    }
    catch {
        $status = 0
        $content = ""
        if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
        if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
            $content = $_.ErrorDetails.Message
        }
        else {
            try {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $content = $reader.ReadToEnd()
            } catch { $content = $_.Exception.Message }
        }
        return [pscustomobject]@{ Status = $status; Body = $content }
    }
}

function Paso {
    param(
        [string]$Titulo,
        [string]$Method,
        [string]$Path,
        $Body = $null,
        [int]$Esperado
    )
    Log ""
    Log "=== $Titulo ==="
    Log "Petición: $Method $Path"
    if ($null -ne $Body) { Log ("Cuerpo: " + ($Body | ConvertTo-Json -Compress)) }
    $r = Invoke-Api -Method $Method -Path $Path -Body $Body
    $estado = if ($r.Status -eq $Esperado) { "OK" } else { "REVISAR" }
    Log "Código esperado: $Esperado | obtenido: $($r.Status) -> $estado"
    if ($r.Body) { Log "Respuesta: $($r.Body)" } else { Log "Respuesta: (sin contenido)" }
    return $r
}

# CASO 1. Crear un curso y un estudiante activo
$curso = @{
    title = "NestJS Persistente $sufijo"
    level = "intermediate"
}
$r = Paso "CASO 1a. Crear curso" POST "/courses" $curso 201
$courseId = ($r.Body | ConvertFrom-Json).id

$activo = @{
    name     = "Ana Pérez"
    email    = "ana.$sufijo@mail.com"
    age      = 21
    career   = "Diseño"
    semester = 4
    isActive = $true
}
$r = Paso "CASO 1b. Crear estudiante activo" POST "/students" $activo 201
$studentId = ($r.Body | ConvertFrom-Json).id

if (-not $courseId -or -not $studentId) {
    Log ""
    Log "No se pudo crear el curso o el estudiante. Revisa la respuesta de arriba."
    exit 1
}

# CASO 2. Crear una matrícula válida
$mat = @{ studentId = $studentId; courseId = $courseId }
$r = Paso "CASO 2. Crear matrícula válida" POST "/enrollments" $mat 201
$enrollmentId = ($r.Body | ConvertFrom-Json).id

# CASO 3. Reiniciar la API y consultar la misma matrícula
Log ""
Log "=== CASO 3. Reinicio de la API ==="
Log "Se detiene la API con Ctrl+C y se vuelve a iniciar con: npm run start:dev"
Write-Host "Reinicia ahora la API (en la otra terminal)." -ForegroundColor Yellow
Read-Host "Cuando la API esté arriba otra vez, presiona Enter"
Log "API reiniciada. Se consultan los datos creados antes del reinicio."

$null = Paso "CASO 3a. El estudiante sigue existiendo" GET "/students/$studentId" $null 200
$null = Paso "CASO 3b. El curso sigue existiendo" GET "/courses/$courseId" $null 200
$null = Paso "CASO 3c. La matrícula sigue existiendo" GET "/enrollments?studentId=$studentId" $null 200

# CASO 4. Matrícula duplicada
$null = Paso "CASO 4. Matrícula duplicada" POST "/enrollments" $mat 409

# CASO 5. Estudiante inactivo
$inactivo = @{
    name     = "Luis Mora"
    email    = "luis.$sufijo@mail.com"
    age      = 23
    career   = "Diseño"
    semester = 6
    isActive = $false
}
$r = Paso "CASO 5a. Crear estudiante inactivo" POST "/students" $inactivo 201
$inactiveId = ($r.Body | ConvertFrom-Json).id
$null = Paso "CASO 5b. Matricular estudiante inactivo" POST "/enrollments" @{ studentId = $inactiveId; courseId = $courseId } 400

# CASO 6. Filtrar matrículas por estudiante o curso
$null = Paso "CASO 6a. Filtrar por estudiante" GET "/enrollments?studentId=$studentId" $null 200
$null = Paso "CASO 6b. Filtrar por curso" GET "/enrollments?courseId=$courseId" $null 200
$null = Paso "CASO 6c. Filtros combinados" GET "/enrollments?studentId=$studentId&courseId=$courseId" $null 200
$null = Paso "CASO 6d. Ruta /students/:id/enrollments" GET "/students/$studentId/enrollments" $null 200
$null = Paso "CASO 6e. Ruta /courses/:id/enrollments" GET "/courses/$courseId/enrollments" $null 200

# CASO 7. Cancelar la matrícula y comprobar que ya no se encuentra
$null = Paso "CASO 7a. Cancelar matrícula" DELETE "/enrollments/$enrollmentId" $null 204
$null = Paso "CASO 7b. El listado ya no la muestra (debe ser [])" GET "/enrollments?studentId=$studentId" $null 200
$null = Paso "CASO 7c. Cancelar otra vez: ya no existe" DELETE "/enrollments/$enrollmentId" $null 404

# PRUEBAS ADICIONALES DEL CONTRATO HTTP
$null = Paso "EXTRA 1. Crear estudiante con correo repetido" POST "/students" $activo 409
$null = Paso "EXTRA 2. Actualizar con el correo de otro estudiante" PATCH "/students/$inactiveId" @{ email = $activo.email } 409
$null = Paso "EXTRA 3. Matrícula con estudiante inexistente" POST "/enrollments" @{ studentId = 999999; courseId = $courseId } 404
$null = Paso "EXTRA 4. Matrícula con curso inexistente" POST "/enrollments" @{ studentId = $studentId; courseId = 999999 } 404
$null = Paso "EXTRA 5. Matrícula con datos inválidos" POST "/enrollments" @{ studentId = "abc"; courseId = $courseId } 400

Log ""
Log "FIN DE LA DEMOSTRACIÓN"
Write-Host "Evidencia guardada en: $archivo" -ForegroundColor Green

