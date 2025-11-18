#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Avtomatik Git Commit və Deploy Script
Hər dəfə işə salanda dəyişiklikləri commit edir və GitHub-a push edir
Render avtomatik olaraq deploy edəcək
"""

import subprocess
import sys
import os
from datetime import datetime

# Windows-da encoding problemi üçün
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

def run_command(command, cwd=None, check=True):
    """Komanda işə salır və nəticəni qaytarır"""
    try:
        result = subprocess.run(
            command,
            shell=True,
            cwd=cwd,
            check=check,
            capture_output=True,
            text=True,
            encoding='utf-8'
        )
        return result.stdout.strip(), result.stderr.strip(), result.returncode
    except subprocess.CalledProcessError as e:
        return e.stdout.strip(), e.stderr.strip(), e.returncode

def get_git_status():
    """Git status yoxlayır"""
    stdout, stderr, code = run_command('git status --porcelain', check=False)
    return stdout, code == 0

def get_untracked_files():
    """Untracked faylları tapır"""
    stdout, stderr, code = run_command('git ls-files --others --exclude-standard', check=False)
    return stdout.split('\n') if stdout else []

def refresh_path_windows():
    """Windows-da PATH-i yeniləyir (Git quraşdırıldıqdan sonra)"""
    if sys.platform == 'win32':
        import ctypes
        from ctypes import wintypes
        
        # PATH-i sistemdən yenidən oxu
        machine_path = os.environ.get('PATH', '')
        user_path = os.environ.get('PATH', '')
        
        # Registry-dən PATH-i oxu
        try:
            import winreg
            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment") as key:
                machine_path = winreg.QueryValueEx(key, "PATH")[0]
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Environment") as key:
                user_path = winreg.QueryValueEx(key, "PATH")[0]
        except:
            pass
        
        # PATH-i yenilə
        os.environ['PATH'] = machine_path + os.pathsep + user_path

def main():
    print("🚀 Deploy Script Başladı...")
    print("=" * 60)
    
    # Git-in quraşdırılıb-quraşdırılmadığını yoxla
    stdout, stderr, code = run_command('git --version', check=False)
    
    # Windows-da Git tapılmadıqda PATH-i yenilə
    if code != 0 and sys.platform == 'win32':
        print("⚠️  Git tapılmadı, PATH yenilənir...")
        refresh_path_windows()
        stdout, stderr, code = run_command('git --version', check=False)
    
    if code != 0:
        print("❌ Xəta: Git quraşdırılmamışdır və ya PATH-də tapılmır!")
        print("\n" + "=" * 60)
        print("💡 Həll yolları:")
        if sys.platform == 'win32':
            print("   1. PowerShell-i YENİDƏN BAŞLADIN (ən sadə həll)")
            print("   2. Və ya PATH-i manual yeniləyin:")
            print("      $env:Path = [System.Environment]::GetEnvironmentVariable(\"Path\",\"Machine\") + \";\" + [System.Environment]::GetEnvironmentVariable(\"Path\",\"User\")")
            print("   3. Git quraşdırılmamışdırsa:")
            print("      - https://git-scm.com/download/win saytına daxil olun")
            print("      - Git for Windows yükləyin və quraşdırın")
            print("      - Terminal-i yenidən başladın")
        else:
            print("   1. Git quraşdırın: sudo apt-get install git (Linux) və ya brew install git (Mac)")
            print("   2. Terminal-i yenidən başladın")
        print("   4. deploy.py script-ini yenidən işə salın")
        print("\n📱 Alternativ: GitHub Desktop istifadə edin")
        print("   https://desktop.github.com/")
        print("\n📄 Manual deploy təlimatları üçün DEPLOY_RENDER.md faylını oxuyun")
        print("=" * 60)
        
        # Manual deploy təlimatları faylı yarat
        if not os.path.exists('MANUAL_DEPLOY.md'):
            print("\n📝 Manual deploy təlimatları faylı yaradılır...")
            manual_deploy_content = """# Manual Deploy Təlimatları (Git olmadan)

## 1. GitHub Desktop istifadə edin

1. GitHub Desktop yükləyin: https://desktop.github.com/
2. GitHub hesabınızla login olun
3. "File" → "Add Local Repository" → Bu qovluğu seçin
4. Dəyişiklikləri commit edin
5. "Publish repository" düyməsinə basın

## 2. Render Dashboard-da Manual Deploy

1. Render dashboard-a daxil olun: https://dashboard.render.com/
2. Service-ləri manual yaradın (DEPLOY_RENDER.md faylına baxın)
3. GitHub repository-ni bağlayın
4. Deploy edin

## 3. Git quraşdırın (Tövsiyə olunur)

1. https://git-scm.com/download/win saytına daxil olun
2. Git for Windows yükləyin
3. Quraşdırın
4. Terminal-i yenidən başladın
5. deploy.py script-ini işə salın
"""
            with open('MANUAL_DEPLOY.md', 'w', encoding='utf-8') as f:
                f.write(manual_deploy_content)
            print("✅ MANUAL_DEPLOY.md faylı yaradıldı")
        
        sys.exit(1)
    
    # Git repository yoxla
    stdout, stderr, code = run_command('git rev-parse --git-dir', check=False)
    if code != 0:
        print("⚠️  Bu qovluq Git repository deyil!")
        print("\n📦 Git repository yaradılır...")
        stdout, stderr, code = run_command('git init', check=False)
        if code != 0:
            print(f"❌ Xəta: git init uğursuz oldu!")
            print(f"   {stderr}")
            sys.exit(1)
        print("✅ Git repository yaradıldı")
        
        # .gitignore yoxla
        if not os.path.exists('.gitignore'):
            print("\n📝 .gitignore faylı yaradılır...")
            gitignore_content = """# Dependencies
node_modules/
dist/
build/

# Environment variables
.env
.env.local
.env.production

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Python
__pycache__/
*.pyc
*.pyo
*.pyd
.Python

# Prisma
*.db
*.db-journal
"""
            with open('.gitignore', 'w', encoding='utf-8') as f:
                f.write(gitignore_content)
            print("✅ .gitignore faylı yaradıldı")
    
    # Git config yoxla (user.name və user.email)
    print("\n👤 Git config yoxlanılır...")
    stdout, stderr, code = run_command('git config user.name', check=False)
    user_name = stdout.strip() if code == 0 else None
    
    stdout, stderr, code = run_command('git config user.email', check=False)
    user_email = stdout.strip() if code == 0 else None
    
    if not user_name or not user_email:
        print("⚠️  Git user identity təyin edilməyib!")
        print("\n" + "=" * 60)
        print("💡 Git config təyin etmək lazımdır:")
        
        if not user_name:
            name = input("   Adınızı daxil edin (məsələn: Nesib): ").strip()
            if name:
                run_command(f'git config --global user.name "{name}"')
                print(f"✅ user.name təyin edildi: {name}")
            else:
                print("❌ Ad boş ola bilməz!")
                sys.exit(1)
        
        if not user_email:
            email = input("   Email daxil edin (məsələn: nesib@example.com): ").strip()
            if email:
                run_command(f'git config --global user.email "{email}"')
                print(f"✅ user.email təyin edildi: {email}")
            else:
                print("❌ Email boş ola bilməz!")
                sys.exit(1)
        print("=" * 60)
    else:
        print(f"✅ Git config: {user_name} <{user_email}>")
    
    # Git status yoxla
    print("\n📊 Git status yoxlanılır...")
    status_output, status_ok = get_git_status()
    
    if not status_output:
        print("✅ Dəyişiklik yoxdur. Deploy lazım deyil.")
        sys.exit(0)
    
    # Dəyişiklikləri göstər
    print("\n📝 Dəyişikliklər:")
    print("-" * 60)
    lines = status_output.split('\n')
    for line in lines:
        if line.strip():
            status = line[:2]
            file = line[3:]
            if status == '??':
                print(f"  ➕ Yeni fayl: {file}")
            elif status.startswith('M'):
                print(f"  ✏️  Dəyişdirildi: {file}")
            elif status.startswith('D'):
                print(f"  🗑️  Silindi: {file}")
            elif status.startswith('A'):
                print(f"  ➕ Əlavə edildi: {file}")
    
    # Remote yoxla (commit-dən əvvəl)
    print("\n" + "=" * 60)
    stdout, stderr, code = run_command('git remote -v', check=False)
    # Default remote artıq yeni repo-ya işarə edir
    default_remote = "https://github.com/kral14/mobilsaytbackend-fronted.git"
    old_remote = "https://github.com/kral14/mobilsayt.git"
    
    if code != 0 or not stdout:
        print("⚠️  Remote repository yoxdur!")
        print(f"💡 Default remote URL: {default_remote}")
        add_remote = input("   Bu remote URL-i istifadə etmək istəyirsiniz? (y/n): ").strip().lower()
        
        if add_remote == 'y' or add_remote == '':
            remote_url = default_remote
        else:
            remote_url = input("   Remote URL daxil edin: ").strip()
            if not remote_url:
                remote_url = default_remote
                print(f"   Default URL istifadə edilir: {remote_url}")
        
        run_command(f'git remote add origin {remote_url}')
        print(f"✅ Remote əlavə edildi: {remote_url}")
    else:
        remote_info = stdout.split('\n')[0].split()[1] if stdout else 'mövcuddur'
        print(f"✅ Remote repository: {remote_info}")
        
        # Əgər köhnə repo istifadə olunursa, avtomatik yeni repo-ya keç
        if remote_info == old_remote:
            print("\n🔄 Köhnə GitHub repo aşkar edildi:")
            print(f"   {remote_info}")
            print("   Remote avtomatik olaraq yeni repo-ya yönləndirilir...")
            run_command(f'git remote set-url origin {default_remote}')
            print(f"✅ Remote yeniləndi: {default_remote}")
    
    # Commit mesajı soruş
    print("\n" + "=" * 60)
    default_message = f"Deploy: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    commit_message = input(f"💬 Commit mesajı (Enter = '{default_message}'): ").strip()
    
    if not commit_message:
        commit_message = default_message
    
    # Git add
    print("\n📦 Dəyişikliklər əlavə edilir...")
    stdout, stderr, code = run_command('git add -A')
    if code != 0:
        print(f"❌ Xəta: git add uğursuz oldu!")
        print(f"   {stderr}")
        sys.exit(1)
    print("✅ Dəyişikliklər əlavə edildi")
    
    # Git commit
    print(f"\n💾 Commit edilir: '{commit_message}'...")
    stdout, stderr, code = run_command(f'git commit -m "{commit_message}"', check=False)
    if code != 0:
        if "nothing to commit" in stderr.lower():
            print("ℹ️  Commit ediləcək dəyişiklik yoxdur")
        else:
            print(f"❌ Xəta: git commit uğursuz oldu!")
            print(f"   {stderr}")
            sys.exit(1)
    else:
        print("✅ Commit uğurla tamamlandı")
    
    # Git branch yoxla və yarad (yoxdursa)
    stdout, stderr, code = run_command('git branch --show-current', check=False)
    current_branch = stdout.strip() if stdout else None
    
    if not current_branch:
        # Branch yoxdursa, main branch yarat
        print("\n🌿 Main branch yaradılır...")
        stdout, stderr, code = run_command('git checkout -b main', check=False)
        if code != 0:
            # Branch artıq mövcud ola bilər
            stdout, stderr, code = run_command('git branch -M main', check=False)
        current_branch = 'main'
        print(f"✅ Branch: {current_branch}")
    
    # Git push
    print(f"\n🚀 GitHub-a push edilir (branch: {current_branch})...")
    stdout, stderr, code = run_command(f'git push -u origin {current_branch}', check=False)
    
    if code != 0:
        if "no upstream branch" in stderr.lower():
            # İlk push
            print("ℹ️  İlk push, upstream branch yaradılır...")
            stdout, stderr, code = run_command(f'git push --set-upstream origin {current_branch}', check=False)
        
        if code != 0:
            print(f"❌ Xəta: git push uğursuz oldu!")
            print(f"   {stderr}")
            print("\n" + "=" * 60)
            print("💡 Təklif:")
            print("   1. GitHub-da repository yaradıldığını yoxlayın")
            print("   2. Git credentials düzgündürmü yoxlayın")
            print("   3. GitHub-da Personal Access Token yaradın:")
            print("      - Settings → Developer settings → Personal access tokens")
            print("      - Token yaradın və 'repo' icazəsi verin")
            print("   4. Manual push edin:")
            print(f"      git push -u origin {current_branch}")
            print("\n📄 Daha ətraflı: DEPLOY_RENDER.md faylına baxın")
            print("=" * 60)
            sys.exit(1)
    
    print("✅ Push uğurla tamamlandı")
    
    # Render deploy info
    print("\n" + "=" * 60)
    print("🎉 Deploy tamamlandı!")
    print("\n📌 Növbəti addımlar:")
    print("   1. Render dashboard-da service-lərin deploy olduğunu yoxlayın")
    print("   2. Build log-larını yoxlayın (Render dashboard → Logs)")
    print("   3. Service URL-lərini test edin")
    print("\n🔗 Render Dashboard: https://dashboard.render.com/")
    print("=" * 60)

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Əməliyyat istifadəçi tərəfindən dayandırıldı")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Gözlənilməz xəta: {e}")
        sys.exit(1)

