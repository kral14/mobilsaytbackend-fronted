import json
import os
import re
import shutil
import tempfile
import tkinter as tk
from datetime import datetime
from tkinter import filedialog, messagebox, ttk


VERSION_STATE_FILE = os.path.join(os.path.dirname(__file__), "version_state.json")


class VersionManagerApp:
    def __init__(self, master: tk.Tk) -> None:
        self.master = master
        self.master.title("Versiya Meneceri")
        self.master.geometry("720x460")
        self.master.resizable(False, False)

        self.source_var = tk.StringVar()
        self.output_var = tk.StringVar()
        self.version_display_var = tk.StringVar(value="v1.0")
        self.remove_node_modules_var = tk.BooleanVar(value=True)
        self.progress_var = tk.DoubleVar(value=0.0)
        self.note_text: tk.Text | None = None

        self.state = self._load_state()
        self.version_state: dict[str, str] = self.state["versions"]
        self.preferences: dict[str, str] = self.state["preferences"]

        self._build_layout()
        self._restore_preferences()

    def _build_layout(self) -> None:
        padding = {"padx": 10, "pady": 6}

        # Source folder
        ttk.Label(self.master, text="Proqram qovluğu:").grid(
            row=0, column=0, sticky="w", **padding
        )
        ttk.Entry(self.master, textvariable=self.source_var, width=60).grid(
            row=0, column=1, **padding
        )
        ttk.Button(
            self.master, text="Seç…", command=self._choose_source
        ).grid(row=0, column=2, **padding)

        # Output folder
        ttk.Label(self.master, text="Versiya qovluğu:").grid(
            row=1, column=0, sticky="w", **padding
        )
        ttk.Entry(self.master, textvariable=self.output_var, width=60).grid(
            row=1, column=1, **padding
        )
        ttk.Button(
            self.master, text="Seç…", command=self._choose_output
        ).grid(row=1, column=2, **padding)

        # Version name (auto)
        ttk.Label(self.master, text="Növbəti versiya:").grid(
            row=2, column=0, sticky="w", **padding
        )
        ttk.Label(self.master, textvariable=self.version_display_var).grid(
            row=2, column=1, sticky="w", **padding
        )

        # Remove node_modules checkbox
        ttk.Checkbutton(
            self.master,
            text="Zipdən əvvəl node_modules silinsin",
            variable=self.remove_node_modules_var,
        ).grid(row=2, column=2, sticky="w", **padding)

        # Version notes
        ttk.Label(self.master, text="Versiya qeydləri:").grid(
            row=3, column=0, sticky="nw", **padding
        )
        self.note_text = tk.Text(self.master, height=4, width=58)
        self.note_text.grid(row=3, column=1, columnspan=2, sticky="we", **padding)

        ttk.Button(
            self.master,
            text="Versiya Zip yarat",
            command=self._handle_build,
            width=25,
        ).grid(row=4, column=1, pady=10)

        ttk.Progressbar(
            self.master,
            variable=self.progress_var,
            maximum=100,
            mode="determinate",
        ).grid(row=5, column=0, columnspan=3, sticky="we", padx=10, pady=(0, 10))

        self.log_text = tk.Text(self.master, height=10, width=80, state="disabled")
        self.log_text.grid(row=6, column=0, columnspan=3, padx=10, pady=10)

    def _choose_source(self) -> None:
        selected = filedialog.askdirectory(title="Proqram qovluğunu seç")
        if selected:
            self.source_var.set(selected)
            self._refresh_version_label()
            self._save_preferences()

    def _choose_output(self) -> None:
        selected = filedialog.askdirectory(
            title="Versiyaların saxlanacağı qovluğu seç"
        )
        if selected:
            self.output_var.set(selected)
            self._save_preferences()

    def _handle_build(self) -> None:
        source = self.source_var.get().strip()
        output = self.output_var.get().strip()
        version_name = self._get_next_version(source)
        version_note = ""
        if self.note_text is not None:
            version_note = self.note_text.get("1.0", "end").strip()
        remove_node_modules = bool(self.remove_node_modules_var.get())

        if not source or not os.path.isdir(source):
            messagebox.showerror("Xəta", "Proqram qovluğu düzgün deyil.")
            return
        if not output:
            messagebox.showerror("Xəta", "Zəhmət olmasa təyinat qovluğunu seçin.")
            return
        if not os.path.isdir(output):
            try:
                os.makedirs(output, exist_ok=True)
            except OSError as exc:
                messagebox.showerror("Xəta", f"Qovluq yaradıla bilmədi:\n{exc}")
                return

        self._set_progress(5)

        try:
            archive_path = self._create_version_archive(
                source,
                output,
                version_name=version_name,
                version_note=version_note,
                remove_node_modules=remove_node_modules,
                progress_callback=self._set_progress,
            )
        except Exception as exc:  # pylint: disable=broad-except
            self._log(f"Uğursuz oldu: {exc}")
            messagebox.showerror("Yığma alınmadı", str(exc))
            self._set_progress(0)
            return

        self._save_version(source, version_name)
        self._log(f"Versiya yaradıldı: {archive_path}")
        messagebox.showinfo("Uğur", f"Arxiv hazırlandı:\n{archive_path}")
        self._refresh_version_label()
        self._set_progress(100)

    def _create_version_archive(
        self,
        source: str,
        destination: str,
        *,
        version_name: str,
        version_note: str,
        remove_node_modules: bool,
        progress_callback,
    ) -> str:
        project_name = os.path.basename(os.path.normpath(source)) or "project"
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        slug = self._slugify(version_name) if version_name else ""
        base_name = (
            f"{project_name}_{slug}_{timestamp}"
            if slug
            else f"{project_name}_{timestamp}"
        )

        temp_root = tempfile.mkdtemp(prefix="version_manager_")
        temp_copy = os.path.join(temp_root, project_name)

        self._log("Layihə kopyalanır…")
        shutil.copytree(source, temp_copy)
        progress_callback(35)

        if remove_node_modules:
            removed = self._remove_node_modules(temp_copy)
            if removed:
                self._log(f"{len(removed)} node_modules qovluğu silindi.")
            else:
                self._log("node_modules tapılmadı.")
        else:
            self._log("node_modules silinməsi söndürüldü.")
        progress_callback(55)

        if version_name or version_note:
            info_path = os.path.join(temp_copy, "VERSION_INFO.txt")
            with open(info_path, "w", encoding="utf-8") as info_file:
                info_file.write(f"Versiya: {version_name or 'məlum deyil'}\n")
                info_file.write(f"Yaradılma: {datetime.now():%Y-%m-%d %H:%M:%S}\n\n")
                info_file.write("Qeydlər:\n")
                info_file.write(version_note or "-")
        progress_callback(70)

        archive_base = os.path.join(destination, base_name)
        self._log("Zip arxiv yaradılır…")
        archive_path = shutil.make_archive(archive_base, "zip", temp_copy)
        progress_callback(95)

        shutil.rmtree(temp_root, ignore_errors=True)
        return archive_path

    def _remove_node_modules(self, root_path: str) -> list[str]:
        removed = []
        for dirpath, dirnames, _ in os.walk(root_path):
            if "node_modules" in dirnames:
                target = os.path.join(dirpath, "node_modules")
                shutil.rmtree(target, ignore_errors=True)
                removed.append(target)
                dirnames.remove("node_modules")
        return removed

    @staticmethod
    def _slugify(value: str) -> str:
        cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", value.strip())
        cleaned = re.sub(r"_+", "_", cleaned).strip("_")
        return cleaned[:50]

    def _get_next_version(self, source: str) -> str:
        key = os.path.abspath(source)
        current = self.version_state.get(key, "v1.0")
        major, minor = 1, 0
        match = re.match(r"v?(\d+)\.(\d+)", current)
        if match:
            major = int(match.group(1))
            minor = int(match.group(2))
            minor += 1
        return f"v{major}.{minor}"

    def _save_version(self, source: str, version: str) -> None:
        key = os.path.abspath(source)
        self.version_state[key] = version
        self._write_state()

    def _refresh_version_label(self) -> None:
        source = self.source_var.get().strip()
        if not source:
            self.version_display_var.set("v1.0")
            return
        next_version = self._get_next_version(source)
        self.version_display_var.set(next_version)

    def _restore_preferences(self) -> None:
        last_source = self.preferences.get("last_source", "")
        last_output = self.preferences.get("last_output", "")
        if last_source:
            self.source_var.set(last_source)
            self._refresh_version_label()
        if last_output:
            self.output_var.set(last_output)

    def _save_preferences(self) -> None:
        self.preferences["last_source"] = self.source_var.get().strip()
        self.preferences["last_output"] = self.output_var.get().strip()
        self._write_state()

    @staticmethod
    def _load_state() -> dict[str, dict[str, str]]:
        default = {"versions": {}, "preferences": {}}
        if not os.path.isfile(VERSION_STATE_FILE):
            return default
        try:
            with open(VERSION_STATE_FILE, "r", encoding="utf-8") as state_file:
                data = json.load(state_file)
                if isinstance(data, dict):
                    if "versions" in data or "preferences" in data:
                        versions = {
                            str(k): str(v)
                            for k, v in data.get("versions", {}).items()
                            if isinstance(v, str)
                        }
                        prefs = {
                            "last_source": str(
                                data.get("preferences", {}).get("last_source", "")
                            ),
                            "last_output": str(
                                data.get("preferences", {}).get("last_output", "")
                            ),
                        }
                        return {"versions": versions, "preferences": prefs}
                    # backward compatibility: pure versions dict
                    versions = {str(k): str(v) for k, v in data.items() if isinstance(v, str)}
                    return {"versions": versions, "preferences": {}}
        except (json.JSONDecodeError, OSError):
            return default
        return default

    def _write_state(self) -> None:
        try:
            with open(VERSION_STATE_FILE, "w", encoding="utf-8") as state_file:
                json.dump(self.state, state_file, ensure_ascii=False, indent=2)
        except OSError as exc:
            self._log(f"Versiya tarixi yazılmadı: {exc}")

    def _set_progress(self, value: float) -> None:
        self.progress_var.set(max(0, min(100, value)))
        self.master.update_idletasks()

    def _log(self, message: str) -> None:
        self.log_text.configure(state="normal")
        self.log_text.insert("end", f"{datetime.now():%H:%M:%S} - {message}\n")
        self.log_text.configure(state="disabled")
        self.log_text.see("end")


def main() -> None:
    root = tk.Tk()
    VersionManagerApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()

