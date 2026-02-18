# AWS Quiz - Create Production Package (Safe Mode - Fixed)
# This version includes all necessary files for deployment

Write-Host "🚀 Creating AWS Quiz Production Package (Safe Mode)..." -ForegroundColor Cyan

# Check if .next exists
if (-not (Test-Path ".next")) {
    Write-Host "❌ Error: .next folder not found. Run 'npm run build' first!" -ForegroundColor Red
    exit 1
}

# Create .env.example from .env (without sensitive values)
Write-Host "📝 Creating .env.example..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Get-Content .env | ForEach-Object {
        if ($_ -match "^([^=]+)=(.*)$") {
            "$($matches[1])=your_value_here"
        } else {
            $_
        }
    } | Set-Content ".env.example"
}

# Create temporary directory
$tempDir = "aws-quiz-temp"
if (Test-Path $tempDir) {
    Remove-Item $tempDir -Recurse -Force
}
New-Item -ItemType Directory -Path $tempDir | Out-Null

Write-Host "📦 Copying files..." -ForegroundColor Yellow

# Copy .next folder excluding dev files
Write-Host "   Copying .next (excluding dev files)..." -ForegroundColor Gray
robocopy ".next" "$tempDir\.next" /E /XD "dev" "cache" /NFL /NDL /NJH /NJS | Out-Null

# Copy source code (REQUIRED for Next.js)
Write-Host "   Copying src..." -ForegroundColor Gray
Copy-Item "src" "$tempDir\src" -Recurse -Force

# Copy other necessary files
Write-Host "   Copying public..." -ForegroundColor Gray
Copy-Item "public" "$tempDir\public" -Recurse -Force

Write-Host "   Copying config files..." -ForegroundColor Gray
Copy-Item "package.json" "$tempDir\" -Force
Copy-Item "package-lock.json" "$tempDir\" -Force
Copy-Item "next.config.ts" "$tempDir\" -Force
Copy-Item "tsconfig.json" "$tempDir\" -Force
Copy-Item "tailwind.config.ts" "$tempDir\" -Force
Copy-Item "postcss.config.mjs" "$tempDir\" -Force
Copy-Item ".env.example" "$tempDir\" -Force
Copy-Item "README.md" "$tempDir\" -Force
Copy-Item "DEPLOYMENT.md" "$tempDir\" -Force

# Create zip from temp directory
Write-Host "📦 Creating zip file..." -ForegroundColor Yellow

# Remove old zip if exists
if (Test-Path "aws-quiz-production.zip") {
    Remove-Item "aws-quiz-production.zip" -Force
}

try {
    Compress-Archive -Path "$tempDir\*" -DestinationPath "aws-quiz-production.zip" -Force
    
    # Clean up temp directory
    Remove-Item $tempDir -Recurse -Force
    
    Write-Host "✅ Package created successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📍 Location: $(Get-Location)\aws-quiz-production.zip" -ForegroundColor Cyan
    
    # Show file size
    $size = (Get-Item "aws-quiz-production.zip").Length / 1MB
    Write-Host "📊 Size: $([math]::Round($size, 2)) MB" -ForegroundColor Cyan
    
    Write-Host ""
    Write-Host "� Package includes:" -ForegroundColor Yellow
    Write-Host "   ✓ .next (production build)" -ForegroundColor Gray
    Write-Host "   ✓ src (source code)" -ForegroundColor Gray
    Write-Host "   ✓ public (static assets)" -ForegroundColor Gray
    Write-Host "   ✓ Configuration files" -ForegroundColor Gray
    Write-Host "   ✓ Documentation" -ForegroundColor Gray
    Write-Host ""
    Write-Host "�📧 You can now email this file!" -ForegroundColor Green
    Write-Host "📖 See DEPLOYMENT.md for deployment instructions" -ForegroundColor Yellow
    
} catch {
    Write-Host "❌ Error creating zip: $_" -ForegroundColor Red
    # Clean up temp directory on error
    if (Test-Path $tempDir) {
        Remove-Item $tempDir -Recurse -Force
    }
    exit 1
}
