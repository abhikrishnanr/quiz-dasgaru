# AWS Quiz - Create Production Package
# Run this script AFTER stopping the dev server (Ctrl+C)

Write-Host "🚀 Creating AWS Quiz Production Package..." -ForegroundColor Cyan

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

# Create deployment package
Write-Host "📦 Creating zip file..." -ForegroundColor Yellow

$files = @(
    ".next",
    "public",
    "package.json",
    "package-lock.json",
    "next.config.ts",
    ".env.example",
    "README.md",
    "DEPLOYMENT.md"
)

# Remove old zip if exists
if (Test-Path "aws-quiz-production.zip") {
    Remove-Item "aws-quiz-production.zip" -Force
}

# Create zip
try {
    Compress-Archive -Path $files -DestinationPath "aws-quiz-production.zip" -Force
    Write-Host "✅ Package created successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📍 Location: $(Get-Location)\aws-quiz-production.zip" -ForegroundColor Cyan
    
    # Show file size
    $size = (Get-Item "aws-quiz-production.zip").Length / 1MB
    Write-Host "📊 Size: $([math]::Round($size, 2)) MB" -ForegroundColor Cyan
    
    Write-Host ""
    Write-Host "📧 You can now email this file!" -ForegroundColor Green
    Write-Host "📖 See DEPLOYMENT.md for deployment instructions" -ForegroundColor Yellow
    
} catch {
    Write-Host "❌ Error creating zip: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Make sure:" -ForegroundColor Yellow
    Write-Host "   1. Dev server is stopped (Ctrl+C)" -ForegroundColor Yellow
    Write-Host "   2. No files are open in editors" -ForegroundColor Yellow
    Write-Host "   3. You have write permissions" -ForegroundColor Yellow
    exit 1
}
