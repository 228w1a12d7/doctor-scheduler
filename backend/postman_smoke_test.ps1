$ErrorActionPreference = "Stop"
$base = "http://127.0.0.1:8000"
$results = @()

function Add-Result {
    param([string]$Api, [bool]$Ok, [string]$Details)
    $status = if ($Ok) { "PASS" } else { "FAIL" }
    $script:results += [pscustomobject]@{
        API = $Api
        Status = $status
        Details = $Details
    }
}

$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$email = "sree$ts@gmail.com"
$token = $null
$userId = $null
$doctorId = $null
$clinicId = $null
$appointmentId = $null

try {
    $signupBody = @{ name = "Sree"; email = $email; password = "123456"; role = "patient" } | ConvertTo-Json
    $signup = Invoke-RestMethod -Uri "$base/auth/signup" -Method Post -ContentType "application/json" -Body $signupBody
    $userId = $signup.user_id
    Add-Result "/auth/signup" $true ($signup | ConvertTo-Json -Compress)
} catch {
    Add-Result "/auth/signup" $false $_.Exception.Message
}

try {
    $loginBody = @{ email = $email; password = "123456" } | ConvertTo-Json
    $login = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" -Body $loginBody
    $token = $login.token
    Add-Result "/auth/login" $true ($login | ConvertTo-Json -Compress)
} catch {
    Add-Result "/auth/login" $false $_.Exception.Message
}

$headers = @{}
if ($token) {
    $headers = @{ Authorization = "Bearer $token" }
}

try {
    $doctorForm = @{ name = "Dr Ravi"; speciality = "Cardiology" }
    $doctor = Invoke-RestMethod -Uri "$base/doctors" -Method Post -Headers $headers -Form $doctorForm
    $doctorId = $doctor.id
    Add-Result "/doctors [POST]" $true ($doctor | ConvertTo-Json -Compress)
} catch {
    Add-Result "/doctors [POST]" $false $_.Exception.Message
}

try {
    $doctors = Invoke-RestMethod -Uri "$base/doctors" -Method Get -Headers $headers
    Add-Result "/doctors [GET]" $true ("$(@($doctors).Count) records")
} catch {
    Add-Result "/doctors [GET]" $false $_.Exception.Message
}

try {
    $clinicForm = @{ name = "City Clinic"; location = "Hyderabad" }
    $clinic = Invoke-RestMethod -Uri "$base/clinics" -Method Post -Headers $headers -Form $clinicForm
    $clinicId = $clinic.id
    Add-Result "/clinics [POST]" $true ($clinic | ConvertTo-Json -Compress)
} catch {
    Add-Result "/clinics [POST]" $false $_.Exception.Message
}

try {
    $clinics = Invoke-RestMethod -Uri "$base/clinics" -Method Get -Headers $headers
    Add-Result "/clinics [GET]" $true ("$(@($clinics).Count) records")
} catch {
    Add-Result "/clinics [GET]" $false $_.Exception.Message
}

try {
    $mapBody = @{ doctor_id = $doctorId; clinic_id = $clinicId } | ConvertTo-Json
    $map = Invoke-RestMethod -Uri "$base/doctor-clinic" -Method Post -Headers $headers -ContentType "application/json" -Body $mapBody
    Add-Result "/doctor-clinic" $true ($map | ConvertTo-Json -Compress)
} catch {
    Add-Result "/doctor-clinic" $false $_.Exception.Message
}

try {
    $availabilityBody = @{ doctor_id = $doctorId; clinic_id = $clinicId; day = "Monday"; start_time = "09:00"; end_time = "14:00" } | ConvertTo-Json
    $availability = Invoke-RestMethod -Uri "$base/availability" -Method Post -Headers $headers -ContentType "application/json" -Body $availabilityBody
    Add-Result "/availability [POST]" $true ($availability | ConvertTo-Json -Compress)
} catch {
    Add-Result "/availability [POST]" $false $_.Exception.Message
}

try {
    $availabilityGet = Invoke-RestMethod -Uri "$base/availability?doctor_id=$doctorId" -Method Get -Headers $headers
    Add-Result "/availability [GET]" $true ("$(@($availabilityGet).Count) records")
} catch {
    Add-Result "/availability [GET]" $false $_.Exception.Message
}

try {
    $search = Invoke-RestMethod -Uri "$base/search?speciality=Cardiology" -Method Get -Headers $headers
    Add-Result "/search" $true ("$(@($search).Count) records")
} catch {
    Add-Result "/search" $false $_.Exception.Message
}

$nextMonday = (Get-Date).Date
do { $nextMonday = $nextMonday.AddDays(1) } while ($nextMonday.DayOfWeek -ne "Monday")
$appointmentDate = $nextMonday.ToString("yyyy-MM-dd")

try {
    $byDate = Invoke-RestMethod -Uri "$base/availability-by-date?doctor_id=$doctorId&date=$appointmentDate" -Method Get -Headers $headers
    Add-Result "/availability-by-date [before leave]" $true ($byDate | ConvertTo-Json -Compress)
} catch {
    Add-Result "/availability-by-date [before leave]" $false $_.Exception.Message
}

try {
    $apptBody = @{ patient_id = $userId; doctor_id = $doctorId; clinic_id = $clinicId; date = $appointmentDate; time = "10:00" } | ConvertTo-Json
    $appt = Invoke-RestMethod -Uri "$base/appointments" -Method Post -Headers $headers -ContentType "application/json" -Body $apptBody
    $appointmentId = $appt.appointment_id
    Add-Result "/appointments [POST]" $true ($appt | ConvertTo-Json -Compress)
} catch {
    Add-Result "/appointments [POST]" $false $_.Exception.Message
}

try {
    $apptList = Invoke-RestMethod -Uri "$base/appointments?patient_id=$userId" -Method Get -Headers $headers
    Add-Result "/appointments [GET]" $true ("$(@($apptList).Count) records")
} catch {
    Add-Result "/appointments [GET]" $false $_.Exception.Message
}

try {
    $util = Invoke-RestMethod -Uri "$base/utilization?clinic_id=$clinicId" -Method Get -Headers $headers
    Add-Result "/utilization" $true ($util | ConvertTo-Json -Compress)
} catch {
    Add-Result "/utilization" $false $_.Exception.Message
}

try {
    $updateBody = @{ status = "COMPLETED" } | ConvertTo-Json
    $update = Invoke-RestMethod -Uri "$base/appointments/$appointmentId" -Method Put -Headers $headers -ContentType "application/json" -Body $updateBody
    Add-Result "/appointments/{id} [PUT]" $true ($update | ConvertTo-Json -Compress)
} catch {
    Add-Result "/appointments/{id} [PUT]" $false $_.Exception.Message
}

try {
    $leaveBody = @{ doctor_id = $doctorId; start_date = $appointmentDate; end_date = $appointmentDate; reason = "Sick" } | ConvertTo-Json
    $leave = Invoke-RestMethod -Uri "$base/leaves" -Method Post -Headers $headers -ContentType "application/json" -Body $leaveBody
    Add-Result "/leaves" $true ($leave | ConvertTo-Json -Compress)
} catch {
    Add-Result "/leaves" $false $_.Exception.Message
}

try {
    $byDateAfterLeave = Invoke-RestMethod -Uri "$base/availability-by-date?doctor_id=$doctorId&date=$appointmentDate" -Method Get -Headers $headers
    Add-Result "/availability-by-date [after leave]" $true ($byDateAfterLeave | ConvertTo-Json -Compress)
} catch {
    Add-Result "/availability-by-date [after leave]" $false $_.Exception.Message
}

$passCount = @($results | Where-Object { $_.Status -eq "PASS" }).Count
$totalCount = @($results).Count

Write-Output "--- API TEST RESULTS ---"
$results | Format-Table -AutoSize
Write-Output ("SUMMARY: " + $passCount + "/" + $totalCount + " passed")
