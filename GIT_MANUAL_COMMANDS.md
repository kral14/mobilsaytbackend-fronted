# Git-ə Manual Push Etmək Üçün Komandalar

## PowerShell-də işə salın

### 1. PATH-i yeniləyin (Git tapılmırsa)
```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
```

### 2. Git config təyin edin (ilk dəfədirsə)
```powershell
git config --global user.name "Nesib"
git config --global user.email "nesib20@gmail.com"
```

### 3. Git repository-yə daxil olun
```powershell
cd C:\Users\Nesib\Desktop\mobilsayt-main
```

### 4. Git status yoxlayın
```powershell
git status
```

### 5. Bütün dəyişiklikləri əlavə edin
```powershell
git add -A
```

### 6. Commit edin
```powershell
git commit -m "Deploy: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
```

Və ya öz mesajınızı yazın:
```powershell
git commit -m "Deploy: Yeni dəyişikliklər"
```

### 7. Branch yoxlayın
```powershell
git branch
```

### 8. Remote repository yoxlayın
```powershell
git remote -v
```

Əgər remote yoxdursa, əlavə edin:
```powershell
git remote add origin https://github.com/kral14/mobilsayt.git
```

### 9. GitHub-a push edin

**Master branch-ə push:**
```powershell
git push -u origin master
```

**Main branch-ə push (GitHub default):**
```powershell
git branch -M main
git push -u origin main
```

## Tam Komanda Sırası (Copy-Paste üçün)

```powershell
# PATH yenilə
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Repository-yə daxil ol
cd C:\Users\Nesib\Desktop\mobilsayt-main

# Git config (ilk dəfədirsə)
git config --global user.name "Nesib"
git config --global user.email "nesib20@gmail.com"

# Status yoxla
git status

# Dəyişiklikləri əlavə et
git add -A

# Commit et
git commit -m "Deploy: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

# Remote yoxla
git remote -v

# Remote yoxdursa əlavə et
git remote add origin https://github.com/kral14/mobilsayt.git

# Push et (master branch)
git push -u origin master

# Və ya main branch-ə push et
git branch -M main
git push -u origin main
```

## Qeydlər

- **Master branch**: Kod hazırda `master` branch-dədir və GitHub-da var
- **Main branch**: GitHub-da default branch `main` ola bilər
- **Remote URL**: `https://github.com/kral14/mobilsayt.git`
- **GitHub Repository**: https://github.com/kral14/mobilsayt

## Xəta halında

### "Git tapılmadı" xətası
```powershell
# PowerShell-i yenidən başladın və ya PATH-i yeniləyin
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
```

### "Author identity unknown" xətası
```powershell
git config --global user.name "Nesib"
git config --global user.email "nesib20@gmail.com"
```

### "Remote repository yoxdur" xətası
```powershell
git remote add origin https://github.com/kral14/mobilsayt.git
```

### "Push rejected" xətası
```powershell
# Əvvəlcə pull edin
git pull origin master --allow-unrelated-histories

# Sonra push edin
git push -u origin master
```

