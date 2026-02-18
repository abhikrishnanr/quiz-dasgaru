# AWS Quiz - Create Amplify Source Package
# This creates a clean source package for AWS Amplify to build from scratch

Write-Host "🚀 Creating AWS Quiz Source Package for Amplify..." -ForegroundColor Cyan

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
$tempDir = "aws-quiz-source-temp"
if (Test-Path $tempDir) {
    Remove-Item $tempDir -Recurse -Force
}
New-Item -ItemType Directory -Path $tempDir | Out-Null

Write-Host "📦 Copying source files..." -ForegroundColor Yellow

# Copy source code and config files
# EXCLUDING .next, node_modules, .git
Write-Host "   Copying src..." -ForegroundColor Gray
Copy-Item "src" "$tempDir\src" -Recurse -Force

Write-Host "   Copying public..." -ForegroundColor Gray
Copy-Item "public" "$tempDir\public" -Recurse -Force

Write-Host "   Copying config files..." -ForegroundColor Gray
Copy-Item "package.json" "$tempDir\" -Force
Copy-Item "package-lock.json" "$tempDir\" -Force
Copy-Item "next.config.ts" "$tempDir\" -Force
Copy-Item "tsconfig.json" "$tempDir\" -Force
Copy-Item "tailwind.config.ts" "$tempDir\" -Force
Copy-Item "postcss.config.mjs" "$tempDir\" -Force
Copy-Item ".eslintrc.json" "$tempDir\" -Force
Copy-Item ".gitignore" "$tempDir\" -Force
Copy-Item ".env.example" "$tempDir\" -Force
Copy-Item "README.md" "$tempDir\" -Force

# Create zip from temp directory
Write-Host "📦 Creating zip file..." -ForegroundColor Yellow

# Remove old zip if exists
if (Test-Path "aws-quiz-source.zip") {
    Remove-Item "aws-quiz-source.zip" -Force
}

try {
    Compress-Archive -Path "$tempDir\*" -DestinationPath "aws-quiz-source.zip" -Force
    
    # Clean up temp directory
    Remove-Item $tempDir -Recurse -Force
    
    Write-Host "✅ Source Package created successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📍 Location: $(Get-Location)\aws-quiz-source.zip" -ForegroundColor Cyan
    
    # Show file size
    $size = (Get-Item "aws-quiz-source.zip").Length / 1MB
    Write-Host "📊 Size: $([math]::Round($size, 2)) MB" -ForegroundColor Cyan
    
    Write-Host ""
    Write-Host "ℹ️ Upload this zip to AWS Amplify Console" -ForegroundColor Yellow
    Write-Host "   Amplify will run 'npm install' and 'npm run build' automatically." -ForegroundColor Gray
    
} catch {
    Write-Host "❌ Error creating zip: $_" -ForegroundColor Red
    # Clean up temp directory on error
    if (Test-Path $tempDir) {
        Remove-Item $tempDir -Recurse -Force
    }
    exit 1
}
