#!/usr/bin/env python3
"""
Backend və Frontend serverləri eyni zamanda işə salmaq üçün Python script
"""

import os
import sys
import subprocess
import platform
import signal
import time
from pathlib import Path
from threading import Thread
import queue
import socket
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# Rənglər (Windows üçün)
if platform.system() == 'Windows':
    os.system('color')

class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    MAGENTA = '\033[95m'
    RESET = '\033[0m'

def print_colored(text, color=Colors.RESET):
    """Rəngli mətn çap et"""
    print(f"{color}{text}{Colors.RESET}")

def get_local_ip():
    """Lokal şəbəkə IP ünvanını qaytar"""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        # 8.8.8.8-ə qoşulmağa cəhd et (paket göndərmir)
        sock.connect(("8.8.8.8", 80))
        ip = sock.getsockname()[0]
        sock.close()
        return ip
    except:
        return None

def check_command(command):
    """Komandanın mövcud olub olmadığını yoxla"""
    try:
        if platform.system() == 'Windows':
            # Windows-da npm.cmd və ya shell=True ilə yoxla
            subprocess.run([command, '--version'], 
                          capture_output=True, 
                          check=True, 
                          shell=True)
        else:
            subprocess.run([command, '--version'], 
                          capture_output=True, 
                          check=True)
        return True
    except:
        # Windows-da npm.cmd yoxla
        if platform.system() == 'Windows' and command == 'npm':
            try:
                subprocess.run(['npm.cmd', '--version'], 
                              capture_output=True, 
                              check=True, 
                              shell=True)
                return True
            except:
                pass
        return False

def run_command(command, cwd=None, shell=None):
    """Komanda işlədir"""
    if shell is None:
        shell = platform.system() == 'Windows'
    
    try:
        result = subprocess.run(
            command,
            cwd=cwd,
            shell=shell,
            check=True,
            text=True,
            capture_output=True
        )
        return True, result.stdout
    except subprocess.CalledProcessError as e:
        return False, e.stderr

def print_output(process, prefix, color):
    """Process output-unu çap et"""
    try:
        # Windows-da encoding problemi üçün errors='replace' istifadə et
        for line in iter(process.stdout.readline, b'' if platform.system() == 'Windows' else ''):
            if line:
                try:
                    # Windows-da bytes kimi gəlir, decode et
                    if isinstance(line, bytes):
                        decoded_line = line.decode('utf-8', errors='replace')
                    else:
                        decoded_line = line
                    print_colored(f"[{prefix}] {decoded_line.rstrip()}", color)
                except Exception:
                    # Əgər decode olunmasa, errors='replace' ilə cəhd et
                    try:
                        if isinstance(line, bytes):
                            decoded_line = line.decode('cp1254', errors='replace')
                        else:
                            decoded_line = line
                        print_colored(f"[{prefix}] {decoded_line.rstrip()}", color)
                    except:
                        # Son çarə - sadəcə çap et
                        try:
                            print_colored(f"[{prefix}] {str(line).rstrip()}", color)
                        except:
                            pass
    except Exception:
        # Encoding xətası olsa belə davam et
        pass
    finally:
        try:
            process.stdout.close()
        except:
            pass

class PrismaSchemaHandler(FileSystemEventHandler):
    """Prisma schema dəyişikliklərini izləyən file watcher"""
    def __init__(self, backend_dir, backend_env_ref, processes_ref, threads_ref):
        self.backend_dir = backend_dir
        self.backend_env_ref = backend_env_ref
        self.processes_ref = processes_ref
        self.threads_ref = threads_ref
        self.last_restart = 0
        self.restart_delay = 5  # 5 saniyə gözlə
        
    def on_modified(self, event):
        if event.is_directory:
            return
        
        # Yalnız schema.prisma faylının dəyişikliklərini izlə
        if event.src_path.endswith('schema.prisma'):
            current_time = time.time()
            # Çox tez-tez restart olmasın
            if current_time - self.last_restart < self.restart_delay:
                return
            
            self.last_restart = current_time
            print_colored("\n" + "=" * 70, Colors.YELLOW)
            print_colored("🔄 Prisma schema dəyişikliyi aşkar edildi!", Colors.YELLOW)
            print_colored("=" * 70, Colors.YELLOW)
            
            # Əvvəlcə backend-i dayandır (Prisma Client lock-unu açmaq üçün)
            print_colored("⏸️  Backend serveri dayandırılır...", Colors.YELLOW)
            backend_proc = None
            backend_idx = -1
            for i, (name, proc, color) in enumerate(self.processes_ref):
                if name == 'Backend':
                    backend_proc = proc
                    backend_idx = i
                    break
            
            backend_was_running = False
            if backend_proc and backend_proc.poll() is None:
                backend_was_running = True
                try:
                    backend_proc.terminate()
                    backend_proc.wait(timeout=5)
                    print_colored("✅ Backend serveri dayandırıldı", Colors.GREEN)
                except:
                    try:
                        backend_proc.kill()
                        print_colored("✅ Backend serveri zorla dayandırıldı", Colors.GREEN)
                    except:
                        pass
                
                # Windows-da prosesləri daha güclü şəkildə dayandır
                if platform.system() == 'Windows':
                    try:
                        # Backend dizinindəki node proseslərini tap və dayandır
                        import psutil
                        backend_path = os.path.abspath(self.backend_dir).lower()
                        for proc in psutil.process_iter(['pid', 'name', 'cmdline', 'cwd']):
                            try:
                                if proc.info['name'] and 'node.exe' in proc.info['name'].lower():
                                    cmdline = proc.info['cmdline']
                                    cwd = proc.info.get('cwd', '')
                                    # Backend dizinindəki və ya ts-node-dev istifadə edən prosesləri dayandır
                                    if cmdline and (any('ts-node-dev' in str(cmd) for cmd in cmdline) or 
                                                   (cwd and backend_path in cwd.lower())):
                                        if 'start.py' not in str(cmdline):  # start.py-ni özünü dayandırmasın
                                            proc.terminate()
                            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                                pass
                    except ImportError:
                        # psutil yoxdursa, sadəcə daha uzun gecikmə ver
                        pass
            
            # Daha uzun gecikmə (lock-un açılması üçün)
            print_colored("⏳ Gecikmə (lock-un açılması üçün)...", Colors.YELLOW)
            time.sleep(5)  # 5 saniyəyə artırdıq
            
            # Prisma Client generate et
            print_colored("🔧 Prisma Client yenidən generate edilir...", Colors.YELLOW)
            is_windows = platform.system() == 'Windows'
            prisma_env = os.environ.copy()
            prisma_env['DATABASE_URL'] = self.backend_env_ref['DATABASE_URL']
            
            try:
                # Prisma Client generate et (bir neçə dəfə cəhd et)
                max_retries = 3
                result = None
                for attempt in range(max_retries):
                    if attempt > 0:
                        print_colored(f"   Cəhd {attempt + 1}/{max_retries}...", Colors.YELLOW)
                        time.sleep(2)
                    
                    result = subprocess.run(
                        ['npx', 'prisma', 'generate'],
                        cwd=self.backend_dir,
                        shell=is_windows,
                        env=prisma_env,
                        capture_output=True,
                        text=True,
                        timeout=60
                    )
                    
                    if result.returncode == 0:
                        break
                # Database-i schema ilə sinxronizasiya et (Prisma Client generate uğurlu olsun və ya olmasın)
                print_colored("🔄 Database schema sinxronizasiya edilir...", Colors.YELLOW)
                db_push_result = subprocess.run(
                    ['npx', 'prisma', 'db', 'push', '--accept-data-loss'],
                    cwd=self.backend_dir,
                    shell=is_windows,
                    env=prisma_env,
                    capture_output=True,
                    text=True,
                    timeout=60
                )
                if db_push_result.returncode == 0:
                    print_colored("✅ Database schema sinxronizasiya olundu", Colors.GREEN)
                else:
                    print_colored("⚠️  Database sinxronizasiya xətası", Colors.YELLOW)
                    if db_push_result.stderr:
                        print_colored(f"Xəta: {db_push_result.stderr[:500]}", Colors.YELLOW)
                    if db_push_result.stdout:
                        print_colored(f"Çıxış: {db_push_result.stdout[:500]}", Colors.YELLOW)
                
                if result and result.returncode == 0:
                    print_colored("✅ Prisma Client yenidən generate edildi", Colors.GREEN)
                else:
                    print_colored("⚠️  Prisma Client generate edilə bilmədi (file lock)", Colors.YELLOW)
                    print_colored("   Backend-i yenidən başlatdıqda Prisma Client avtomatik yüklənəcək", Colors.YELLOW)
                    if result and result.stderr:
                        print_colored(f"Xəta: {result.stderr[:500]}", Colors.YELLOW)
                    if result and result.stdout:
                        print_colored(f"Çıxış: {result.stdout[:500]}", Colors.YELLOW)
                
                # Backend serveri yenidən başlat (həmişə)
                print_colored("🔄 Backend serveri yenidən başladılır...", Colors.YELLOW)
                try:
                    self.restart_backend()
                except Exception as restart_error:
                    print_colored(f"⚠️  Backend-i yenidən başlatmaq mümkün olmadı: {str(restart_error)}", Colors.YELLOW)
                    print_colored(f"   Xəta detalları: {str(restart_error)}", Colors.YELLOW)
            except Exception as e:
                print_colored(f"❌ Xəta: {str(e)}", Colors.RED)
                # Yəni də backend-i yenidən başlat
                print_colored("🔄 Backend serveri yenidən başladılır...", Colors.YELLOW)
                try:
                    self.restart_backend()
                except Exception as restart_error:
                    print_colored(f"⚠️  Backend-i yenidən başlatmaq mümkün olmadı: {str(restart_error)}", Colors.YELLOW)
                    print_colored(f"   Xəta detalları: {str(restart_error)}", Colors.YELLOW)
    
    def restart_backend(self):
        """Backend serveri yenidən başlat"""
        # Köhnə backend prosesini tap və dayandır
        backend_proc = None
        backend_idx = -1
        backend_thread_idx = -1
        for i, (name, proc, color) in enumerate(self.processes_ref):
            if name == 'Backend':
                backend_proc = proc
                backend_idx = i
                break
        
        # Köhnə thread-i tap
        for i, thread in enumerate(self.threads_ref):
            if thread and thread.is_alive():
                # Thread-in hansı prosesi izlədiyini bilmək çətindir, amma backend thread-i backend prosesi ilə eyni index-də olmalıdır
                if backend_idx >= 0 and i == backend_idx:
                    backend_thread_idx = i
                    break
        
        if backend_proc and backend_proc.poll() is None:
            try:
                print_colored("   Köhnə backend prosesi dayandırılır...", Colors.YELLOW)
                backend_proc.terminate()
                backend_proc.wait(timeout=5)
            except:
                try:
                    backend_proc.kill()
                except:
                    pass
        
        # Əlavə gecikmə (prosesin tam dayanması üçün)
        time.sleep(2)
        
        # Yeni backend prosesi başlat
        try:
            is_windows = platform.system() == 'Windows'
            new_backend_proc = subprocess.Popen(
                ['npm', 'run', 'dev'],
                cwd=self.backend_dir,
                shell=is_windows,
                env=self.backend_env_ref,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=False,
                bufsize=1
            )
            
            # Process list-də yenilə və ya əlavə et
            if backend_idx >= 0:
                self.processes_ref[backend_idx] = ('Backend', new_backend_proc, Colors.CYAN)
            else:
                # Əgər list-də yoxdursa, əlavə et
                self.processes_ref.append(('Backend', new_backend_proc, Colors.CYAN))
                backend_idx = len(self.processes_ref) - 1
            
            # Yeni output thread-i yarat
            new_thread = Thread(target=print_output, args=(new_backend_proc, 'Backend', Colors.CYAN), daemon=True)
            new_thread.start()
            
            # Thread list-də yenilə və ya əlavə et
            if backend_thread_idx >= 0 and backend_thread_idx < len(self.threads_ref):
                self.threads_ref[backend_thread_idx] = new_thread
            else:
                # Əgər list-də yoxdursa, əlavə et
                if backend_idx < len(self.threads_ref):
                    self.threads_ref[backend_idx] = new_thread
                else:
                    # Thread list-i proses list-indən qısa ola bilər, uzat
                    while len(self.threads_ref) <= backend_idx:
                        self.threads_ref.append(None)
                    self.threads_ref[backend_idx] = new_thread
            
            print_colored("✅ Backend serveri yenidən başladıldı", Colors.GREEN)
            print_colored("=" * 70 + "\n", Colors.RESET)
        except Exception as e:
            print_colored(f"❌ Backend serveri yenidən başladıla bilmədi: {str(e)}", Colors.RED)
            import traceback
            print_colored(f"   Xəta detalları: {traceback.format_exc()}", Colors.RED)

def setup_backend(backend_dir):
    """Backend-i hazırla"""
    print_colored("🔧 Backend hazırlanır...", Colors.YELLOW)
    
    # Environment variables təyin et
    database_url = "postgresql://neondb_owner:npg_NVL31qxTnQrC@ep-wild-queen-adh4tc1u-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
    os.environ['DATABASE_URL'] = database_url
    if not os.environ.get('JWT_SECRET'):
        os.environ['JWT_SECRET'] = 'your-secret-key-change-this-in-production'
    if not os.environ.get('PORT'):
        os.environ['PORT'] = '5000'
    if not os.environ.get('NODE_ENV'):
        os.environ['NODE_ENV'] = 'development'
    
    # node_modules yoxla
    node_modules = backend_dir / "node_modules"
    if not node_modules.exists():
        print_colored("📦 Backend paketləri quraşdırılır...", Colors.YELLOW)
        is_windows = platform.system() == 'Windows'
        success, output = run_command(['npm', 'install'], cwd=backend_dir, shell=is_windows)
        if not success:
            print_colored("❌ Backend paketləri quraşdırıla bilmədi!", Colors.RED)
            print_colored(f"Xəta: {output}", Colors.RED)
            return False
        print_colored("✅ Backend paketləri quraşdırıldı", Colors.GREEN)
    
    # Environment variable-ları Prisma üçün təyin et
    prisma_env = os.environ.copy()
    prisma_env['DATABASE_URL'] = database_url
    is_windows = platform.system() == 'Windows'
    
    # Prisma schema-nı bazaya push et (cədvəlləri yaradır/yeniləyir)
    print_colored("🔧 Prisma schema bazaya push edilir...", Colors.YELLOW)
    try:
        if is_windows:
            result = subprocess.run(
                ['npx', 'prisma', 'db', 'push', '--accept-data-loss'],
                cwd=backend_dir,
                shell=True,
                env=prisma_env,
                capture_output=True,
                text=True,
                check=True
            )
        else:
            result = subprocess.run(
                ['npx', 'prisma', 'db', 'push', '--accept-data-loss'],
                cwd=backend_dir,
                env=prisma_env,
                capture_output=True,
                text=True,
                check=True
            )
        print_colored("✅ Prisma schema bazaya push edildi", Colors.GREEN)
    except subprocess.CalledProcessError as e:
        error_msg = e.stderr.lower() if e.stderr else ""
        if "already in sync" in error_msg.lower() or "already up to date" in error_msg.lower():
            print_colored("✅ Prisma schema artıq bazada aktualdır", Colors.GREEN)
        else:
            print_colored("⚠️  Prisma db push xətası (baza artıq aktual ola bilər)", Colors.YELLOW)
            if e.stderr:
                print_colored(f"Xəta: {e.stderr[:200]}", Colors.YELLOW)
            # Davam et, çünki baza artıq düzgün ola bilər
    
    # Prisma Client generate et
    print_colored("🔧 Prisma Client generate edilir...", Colors.YELLOW)
    
    # Prisma Client-in artıq mövcud olub olmadığını yoxla
    prisma_client_path = backend_dir / "node_modules" / ".prisma" / "client"
    client_exists = prisma_client_path.exists() and any(prisma_client_path.iterdir())
    
    try:
        if is_windows:
            result = subprocess.run(
                ['npx', 'prisma', 'generate'],
                cwd=backend_dir,
                shell=True,
                env=prisma_env,
                capture_output=True,
                text=True,
                check=True
            )
        else:
            result = subprocess.run(
                ['npx', 'prisma', 'generate'],
                cwd=backend_dir,
                env=prisma_env,
                capture_output=True,
                text=True,
                check=True
            )
        print_colored("✅ Prisma Client generate edildi", Colors.GREEN)
    except subprocess.CalledProcessError as e:
        # Windows-da icazə xətası ola bilər, amma client artıq mövcud ola bilər
        error_msg = e.stderr.lower() if e.stderr else ""
        if ("eperm" in error_msg or "operation not permitted" in error_msg) and client_exists:
            print_colored("⚠️  Prisma Client generate edilərkən icazə xətası, amma client artıq mövcuddur", Colors.YELLOW)
            print_colored("✅ Prisma Client istifadəyə hazırdır", Colors.GREEN)
        else:
            print_colored("❌ Prisma Client generate edilə bilmədi!", Colors.RED)
            if e.stderr:
                print_colored(f"Xəta: {e.stderr}", Colors.RED)
            if e.stdout:
                print_colored(f"Çıxış: {e.stdout}", Colors.YELLOW)
            # Prisma Client artıq mövcuddursa davam et
            if not client_exists:
                return False
            else:
                print_colored("⚠️  Prisma Client artıq mövcuddur, davam edilir...", Colors.YELLOW)
    
    return True

def setup_frontend(web_dir):
    """Frontend-i hazırla"""
    print_colored("🔧 Frontend hazırlanır...", Colors.YELLOW)
    
    # node_modules yoxla
    node_modules = web_dir / "node_modules"
    if not node_modules.exists():
        print_colored("📦 Frontend paketləri quraşdırılır...", Colors.YELLOW)
        is_windows = platform.system() == 'Windows'
        success, output = run_command(['npm', 'install'], cwd=web_dir, shell=is_windows)
        if not success:
            print_colored("❌ Frontend paketləri quraşdırıla bilmədi!", Colors.RED)
            return False
        print_colored("✅ Frontend paketləri quraşdırıldı", Colors.GREEN)
    
    return True

def setup_mobile(mobile_dir):
    """Mobil frontend-i hazırla"""
    print_colored("🔧 Mobil UI hazırlanır...", Colors.YELLOW)
    
    node_modules = mobile_dir / "node_modules"
    if not node_modules.exists():
        print_colored("📦 Mobil paketlər quraşdırılır...", Colors.YELLOW)
        is_windows = platform.system() == 'Windows'
        success, output = run_command(['npm', 'install'], cwd=mobile_dir, shell=is_windows)
        if not success:
            print_colored("❌ Mobil paketləri quraşdırıla bilmədi!", Colors.RED)
            print_colored(f"Xəta: {output}", Colors.RED)
            return False
        print_colored("✅ Mobil paketlər quraşdırıldı", Colors.GREEN)
    
    return True

def main():
    print_colored("=" * 70, Colors.BLUE)
    print_colored("🚀 MobilSayt - Backend və Frontend Serverləri", Colors.BLUE)
    print_colored("=" * 70, Colors.BLUE)
    print()

    # Proyekt kök qovluğunu tap
    script_dir = Path(__file__).parent.absolute()
    backend_dir = script_dir / "backend"
    web_dir = script_dir / "web"
    mobile_dir = script_dir / "mobil"

    if not backend_dir.exists():
        print_colored("❌ Backend qovluğu tapılmadı!", Colors.RED)
        sys.exit(1)
    
    if not web_dir.exists():
        print_colored("❌ Web qovluğu tapılmadı!", Colors.RED)
        sys.exit(1)

    if not mobile_dir.exists():
        print_colored("❌ Mobil qovluğu tapılmadı!", Colors.RED)
        sys.exit(1)

    # Node.js yoxla
    print_colored("🔍 Node.js yoxlanılır...", Colors.YELLOW)
    if not check_command('node'):
        print_colored("❌ Node.js quraşdırılmamışdır!", Colors.RED)
        print_colored("   Zəhmət olmasa Node.js quraşdırın: https://nodejs.org/", Colors.YELLOW)
        sys.exit(1)
    
    node_version = subprocess.run(['node', '--version'], capture_output=True, text=True).stdout.strip()
    print_colored(f"✅ Node.js: {node_version}", Colors.GREEN)
    print()

    # npm yoxla
    print_colored("🔍 npm yoxlanılır...", Colors.YELLOW)
    if not check_command('npm'):
        print_colored("❌ npm quraşdırılmamışdır!", Colors.RED)
        sys.exit(1)
    
    # npm versiyasını al
    try:
        if platform.system() == 'Windows':
            npm_version = subprocess.run(['npm', '--version'], 
                                       capture_output=True, 
                                       text=True, 
                                       shell=True).stdout.strip()
        else:
            npm_version = subprocess.run(['npm', '--version'], 
                                       capture_output=True, 
                                       text=True).stdout.strip()
        print_colored(f"✅ npm: {npm_version}", Colors.GREEN)
    except:
        print_colored("✅ npm: tapıldı", Colors.GREEN)
    print()

    # Backend və Frontend hazırla
    print_colored("=" * 70, Colors.CYAN)
    print_colored("📦 Hazırlıq işləri", Colors.CYAN)
    print_colored("=" * 70, Colors.CYAN)
    print()

    if not setup_backend(backend_dir):
        sys.exit(1)
    
    if not setup_frontend(web_dir):
        sys.exit(1)

    if not setup_mobile(mobile_dir):
        sys.exit(1)
    
    print()

    # Serverləri işə sal
    print_colored("=" * 70, Colors.BLUE)
    print_colored("🚀 Serverlər işə salınır...", Colors.GREEN)
    print_colored("=" * 70, Colors.BLUE)
    print()
    print_colored("📡 Backend:  http://localhost:5000", Colors.CYAN)
    print_colored("📝 API:      http://localhost:5000/api", Colors.CYAN)
    print_colored("💚 Health:   http://localhost:5000/api/health", Colors.CYAN)
    print()
    print_colored("🌐 Frontend (PC): http://localhost:3000", Colors.MAGENTA)
    print_colored("📱 Mobil UI: http://localhost:3001", Colors.GREEN)
    local_ip = get_local_ip()
    if local_ip:
        print_colored(f"   Telefon üçün PC versiyası: http://{local_ip}:3000", Colors.MAGENTA)
        print_colored(f"   Telefon üçün Mobil versiya: http://{local_ip}:3001", Colors.GREEN)
    print()
    print()
    print_colored("Serverləri dayandırmaq üçün Ctrl+C basın", Colors.YELLOW)
    print()
    print_colored("-" * 70, Colors.RESET)
    print()

    # Port-ları yoxla və köhnə prosesləri dayandır
    def kill_process_on_port(port):
        """Port-dakı prosesi öldür"""
        try:
            import socket
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            result = sock.connect_ex(('localhost', port))
            sock.close()
            if result == 0:
                print_colored(f"⚠️  Port {port} artıq istifadədədir!", Colors.YELLOW)
                print_colored(f"   Köhnə prosesi avtomatik dayandırılır...", Colors.YELLOW)
                
                if platform.system() == 'Windows':
                    try:
                        # Windows-da port-u istifadə edən prosesi tap və öldür
                        result = subprocess.run(
                            ['netstat', '-ano'],
                            capture_output=True,
                            text=True,
                            shell=True
                        )
                        for line in result.stdout.split('\n'):
                            if f':{port}' in line and 'LISTENING' in line:
                                parts = line.split()
                                if len(parts) > 4:
                                    pid = parts[-1]
                                    try:
                                        subprocess.run(['taskkill', '/F', '/PID', pid], 
                                                     capture_output=True, shell=True)
                                        print_colored(f"✅ Port {port} üzərindəki proses {pid} dayandırıldı", Colors.GREEN)
                                        time.sleep(1)
                                        break
                                    except:
                                        pass
                    except:
                        pass
                else:
                    # Linux/Mac
                    try:
                        subprocess.run(['lsof', '-ti', f':{port}', '|', 'xargs', 'kill', '-9'], 
                                     shell=True, capture_output=True)
                    except:
                        pass
        except:
            pass
    
    print_colored("🔍 Port-lar yoxlanılır...", Colors.YELLOW)
    kill_process_on_port(5000)  # Backend port
    kill_process_on_port(3000)  # Frontend (PC) port
    kill_process_on_port(3001)  # Mobil port
    print()
    
    processes = []
    observer = None
    
    try:
        # Backend process
        backend_env = os.environ.copy()
        backend_env['DATABASE_URL'] = "postgresql://neondb_owner:npg_NVL31qxTnQrC@ep-wild-queen-adh4tc1u-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
        backend_env['JWT_SECRET'] = os.environ.get('JWT_SECRET', 'your-secret-key-change-this-in-production')
        backend_env['PORT'] = os.environ.get('PORT', '5000')
        backend_env['NODE_ENV'] = os.environ.get('NODE_ENV', 'development')
        
        is_windows = platform.system() == 'Windows'
        backend_process = subprocess.Popen(
            ['npm', 'run', 'dev'],
            cwd=backend_dir,
            shell=is_windows,
            env=backend_env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=False,  # Windows-da bytes kimi oxu
            bufsize=1
        )
        
        processes.append(('Backend', backend_process, Colors.CYAN))
        
        # Prisma schema file watcher başlat
        try:
            schema_handler = PrismaSchemaHandler(backend_dir, backend_env, processes, threads)
            observer = Observer()
            observer.schedule(schema_handler, str(backend_dir / 'prisma'), recursive=False)
            observer.start()
            print_colored("👁️  Prisma schema file watcher aktivdir", Colors.GREEN)
        except ImportError:
            print_colored("⚠️  watchdog paketi yoxdur - Prisma schema file watching aktiv deyil", Colors.YELLOW)
            print_colored("   Quraşdırmaq üçün: pip install watchdog", Colors.YELLOW)
        except Exception as e:
            print_colored(f"⚠️  File watcher başladıla bilmədi: {str(e)}", Colors.YELLOW)
        
        # Frontend process (PC versiyası) - 3000 portunda
        is_windows = platform.system() == 'Windows'
        frontend_cmd = ['npm', 'run', 'dev', '--', '--host', '0.0.0.0']
        frontend_process = subprocess.Popen(
            frontend_cmd,
            cwd=web_dir,
            shell=is_windows,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=False,  # Windows-da bytes kimi oxu
            bufsize=1
        )
        
        processes.append(('Frontend (PC)', frontend_process, Colors.MAGENTA))

        # Mobile process - 3001 portunda
        mobile_cmd_3001 = ['npm', 'run', 'dev', '--', '--host', '0.0.0.0', '--port', '3001']
        mobile_process_3001 = subprocess.Popen(
            mobile_cmd_3001,
            cwd=mobile_dir,
            shell=is_windows,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=False,
            bufsize=1
        )

        processes.append(('Mobile', mobile_process_3001, Colors.GREEN))
        
        # Output thread-ləri
        threads = []
        for name, proc, color in processes:
            thread = Thread(target=print_output, args=(proc, name, color), daemon=True)
            thread.start()
            threads.append(thread)
        
        # Process-lərin işləməsini gözlə
        print_colored("✅ Serverlər işə salındı!", Colors.GREEN)
        print()
        
        while True:
            # Process-lərin həyatda olub olmadığını yoxla
            for name, proc, _ in processes:
                exit_code = proc.poll()
                if exit_code is not None:
                    if exit_code != 0:
                        print_colored(f"❌ {name} serveri xəta ilə dayandı! (Exit code: {exit_code})", Colors.RED)
                    else:
                        print_colored(f"⚠️  {name} serveri gözlənilməz şəkildə dayandı!", Colors.YELLOW)
                    # Digər process-ləri də dayandır
                    for n, p, _ in processes:
                        if p.poll() is None:
                            try:
                                p.terminate()
                                p.wait(timeout=3)
                            except:
                                try:
                                    p.kill()
                                except:
                                    pass
                    # Observer-i də dayandır
                    try:
                        if observer:
                            observer.stop()
                            observer.join()
                    except:
                        pass
                    sys.exit(1)
            time.sleep(1)
            
    except KeyboardInterrupt:
        print()
        print_colored("=" * 70, Colors.YELLOW)
        print_colored("👋 Serverlər dayandırılır...", Colors.YELLOW)
        print_colored("=" * 70, Colors.YELLOW)
        
        # Observer-i dayandır
        try:
            if observer:
                observer.stop()
                observer.join()
        except:
            pass
        
        # Bütün process-ləri dayandır
        for name, proc, _ in processes:
            try:
                proc.terminate()
                proc.wait(timeout=5)
                print_colored(f"✅ {name} serveri dayandırıldı", Colors.GREEN)
            except:
                proc.kill()
                print_colored(f"⚠️  {name} serveri məcburi dayandırıldı", Colors.YELLOW)
        
        print()
        print_colored("👋 Görüşənədək!", Colors.BLUE)
        sys.exit(0)
    except Exception as e:
        print_colored(f"❌ Xəta: {str(e)}", Colors.RED)
        # Bütün process-ləri dayandır
        for name, proc, _ in processes:
            try:
                proc.terminate()
            except:
                pass
        sys.exit(1)

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print_colored(f"❌ Xəta: {str(e)}", Colors.RED)
        sys.exit(1)

