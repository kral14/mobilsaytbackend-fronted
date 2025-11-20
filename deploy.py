#!/usr/bin/env python3
"""
MobilSayt – Render/Git deploy helper

Bu skript aşağıdakı ardıcıllığı avtomatlaşdırır:
1. İstəyə görə `npm run build` (root script web + mobil + backend build)
2. Git dəyişikliklərini stage edir və commit yaradır
3. Məlum remote-a push edir (default: origin/main)

İstifadə:
    python deploy.py --message "feat: yeni render config"
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Sequence

ROOT_DIR = Path(__file__).resolve().parent
RENDER_BLUEPRINT = ROOT_DIR / "render.yaml"


def _normalize_command(cmd: Sequence[str]) -> Sequence[str]:
    if os.name == "nt" and cmd:
        binary = cmd[0].lower()
        if binary in {"npm", "npx", "pnpm"}:
            npm_path = shutil.which(f"{binary}.cmd")
            if npm_path:
                cmd = [npm_path, *cmd[1:]]
    return cmd


def run(cmd: Sequence[str], *, cwd: Path | None = None, check: bool = True) -> None:
    """Run shell command with pretty logging."""
    display_path = cwd if cwd else ROOT_DIR
    normalized_cmd = list(_normalize_command(cmd))
    print(f"\n$ (cd {display_path}) {' '.join(normalized_cmd)}")
    process = subprocess.run(normalized_cmd, cwd=cwd, text=True)
    if check and process.returncode != 0:
        raise RuntimeError(f"Command failed: {' '.join(cmd)}")


def ensure_in_repo() -> None:
    if not (ROOT_DIR / ".git").exists():
        print("❌ Bu skript Git repository kökündə işlədilməlidir.")
        sys.exit(1)


def check_render_blueprint() -> None:
    if not RENDER_BLUEPRINT.exists():
        print("❗ Xəbərdarlıq: render.yaml tapılmadı. Blueprint deploy aktiv olmayacaq.")


def git_has_changes() -> bool:
    result = subprocess.run(
        ["git", "status", "--short"],
        cwd=ROOT_DIR,
        text=True,
        capture_output=True,
        check=True,
    )
    return bool(result.stdout.strip())


def main() -> None:
    parser = argparse.ArgumentParser(description="Render deploy helper")
    parser.add_argument(
        "--message",
        "-m",
        default=f"deploy: auto commit {datetime.now(timezone.utc):%Y-%m-%d %H:%M:%S} UTC",
        help="Git commit mesajı",
    )
    parser.add_argument(
        "--skip-build",
        action="store_true",
        help="`npm run build` mərhələsini keç",
    )
    parser.add_argument(
        "--push-remote",
        default="origin",
        help="Push ediləcək remote adı (default: origin)",
    )
    parser.add_argument(
        "--push-branch",
        default="main",
        help="Push ediləcək branch adı (default: main)",
    )
    args = parser.parse_args()

    ensure_in_repo()
    check_render_blueprint()

    if not args.skip_build:
        run(["npm", "install"])
        run(["npm", "run", "build"])
    else:
        print("⚠️  Build mərhələsi atlandı (`--skip-build`).")

    if not git_has_changes():
        print("ℹ️  Commit üçün dəyişiklik yoxdur. Push mərhələsi atlanır.")
        return

    run(["git", "add", "."])
    run(["git", "commit", "-m", args.message])
    run(["git", "push", args.push_remote, args.push_branch])

    print(
        "\n✅ Deploy hazırdır! Render Blueprint bu push-u izləyirsə, avtomatik build/deploy başlayacaq."
    )
    print("Render URL-də `/api/health` endpoint-i ilə backend statusunu yoxlamağı unutma.")


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as exc:
        print(f"\n❌ {exc}")
        sys.exit(1)

