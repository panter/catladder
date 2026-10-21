#!/usr/bin/env python3
"""Exercise watch-list migration and rejection of unsafe/ambiguous input."""
import importlib.util
import tempfile
import os
import subprocess
import sys
import unittest
from pathlib import Path

sys.dont_write_bytecode = True

spec = importlib.util.spec_from_file_location(
    "watch_entries", Path(__file__).with_name("upstream-watch-entries.py")
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class WatchEntriesTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "upstream-watch.d").mkdir()

    def write(self, name, text):
        (self.root / name).write_text(text)

    def test_directory_and_legacy(self):
        self.write("upstream-watch.d/gascity-12.tsv", "# comment\ngastownhall/gascity\t12\tpr\tremove workaround\tcity-test\n")
        self.write("upstream-watch.tsv", "# legacy\ngastownhall/beads\t13\tissue\twatch fix\n")
        rows = module.load_entries(self.root)
        self.assertEqual(rows, [
            ["gastownhall/gascity", "12", "pr", "remove workaround", "city-test"],
            ["gastownhall/beads", "13", "issue", "watch fix"],
        ])
        (self.root / "upstream-watch.tsv").unlink()
        self.assertEqual(module.load_entries(self.root), rows[:1])

    def test_version_tag(self):
        self.write("upstream-watch.d/gascity-v1.5.1.tsv", "gastownhall/gascity\tv1.5.1\ttag\tassess hotfix\n")
        self.assertEqual(module.load_entries(self.root)[0][1:3], ["v1.5.1", "tag"])

    def test_duplicate_across_sources(self):
        row = "gastownhall/gascity\t12\tissue\treason\n"
        self.write("upstream-watch.d/one.tsv", row)
        for name in ("upstream-watch.tsv", "upstream-watch.d/two.tsv"):
            with self.subTest(name=name):
                self.write(name, row.replace("gastownhall", "Gastownhall"))
                with self.assertRaisesRegex(ValueError, "duplicate"):
                    module.load_entries(self.root)
                (self.root / name).unlink()

    def test_malformed_entries(self):
        for row in (
            "", "# only comment\n", "bad\t12\tissue\treason\n",
            "owner/repo\t0\tissue\treason\n", "owner/repo\t01\tissue\treason\n",
            "owner/repo\t1\tother\treason\n", "owner/repo\t1\tpr\t \n",
            "owner/repo\t1\tpr\treason\t\n", "owner/repo\t1\tpr\n",
            "owner/repo\t1\tpr\treason\tx\ty\n",
            "owner/repo\t../bad\ttag\treason\n",
            "owner/repo\tv1.5.1\tissue\treason\n",
            "owner/repo\t1\tpr\treason\nowner/repo\t2\tpr\treason\n",
        ):
            with self.subTest(row=row):
                self.write("upstream-watch.d/invalid.tsv", row)
                with self.assertRaises(ValueError):
                    module.load_entries(self.root)


    def test_dry_run_uses_both_sources_and_keeps_state(self):
        self.write("upstream-watch.d/gascity-12.tsv", "gastownhall/gascity\t12\tpr\tnew reason\n")
        self.write("upstream-watch.tsv", "gastownhall/beads\t13\tissue\tlegacy reason\n")
        self.write("upstream-watch.d/gascity-v1.5.1.tsv", "gastownhall/gascity\tv1.5.1\ttag\tassess hotfix\n")
        scripts = self.root / "scripts"
        scripts.mkdir()
        (scripts / "upstream-watch-entries.py").write_text(
            Path(__file__).with_name("upstream-watch-entries.py").read_text()
        )
        # Replace external service wrappers in the sandbox; run the real polling logic.
        source = Path(__file__).with_name("upstream-watch.sh").read_text().splitlines()
        sandbox = []
        for line in source:
            if line.startswith("gh()"):
                line = "gh() { case \"$2\" in */releases/latest) echo v1;; *commits*) echo abc1234;; */issues/*) echo closed;; */git/ref/tags/*) echo abc123;; esac; }"
            elif line.startswith("bd()"):
                line = "bd() { [ \"$1\" = version ] || return 99; echo test; }"
            elif line.startswith("gcv="):
                line = "gcv=test"
            sandbox.append(line)
        watcher = scripts / "upstream-watch.sh"
        watcher.write_text("\n".join(sandbox) + "\n")
        state = self.root / ".local/state/maw-city/upstream-state.tsv"
        state.parent.mkdir(parents=True)
        original = "gastownhall/gascity#12\topen\ngastownhall/gascity#12\topen\ngastownhall/beads#13\topen\ngastownhall/gascity#v1.5.1\t?\n"
        state.write_text(original)
        for _ in range(2):
            result = subprocess.run(["bash", str(watcher)], env={**os.environ, "HOME": str(self.root), "DRY_RUN": "1"}, capture_output=True, text=True, check=True)
            self.assertIn("DRY_RUN: 3", result.stdout)
            self.assertEqual(result.stdout.count("gastownhall/gascity#12|open|closed"), 1)
            self.assertIn("gastownhall/beads#13|open|closed", result.stdout)
            self.assertIn("gastownhall/gascity#v1.5.1|?|abc123", result.stdout)
            self.assertEqual(state.read_text(), original)


    def test_failed_lookups_are_not_changes(self):
        # 2026-10-13/14: every gh hiccup was recorded as "?" and created false "(open → ?)" beads.
        self.write("upstream-watch.d/gascity-12.tsv", "gastownhall/gascity\t12\tpr\treason\n")
        self.write("upstream-watch.d/gascity-v1.5.1.tsv", "gastownhall/gascity\tv1.5.1\ttag\tassess hotfix\n")
        scripts = self.root / "scripts"
        scripts.mkdir()
        (scripts / "upstream-watch-entries.py").write_text(
            Path(__file__).with_name("upstream-watch-entries.py").read_text()
        )
        sandbox = []
        for line in Path(__file__).with_name("upstream-watch.sh").read_text().splitlines():
            if line.startswith("gh()"):
                line = "gh() { return 1; }"
            elif line.startswith("bd()"):
                line = "bd() { [ \"$1\" = version ] || return 99; echo test; }"
            elif line.startswith("gcv="):
                line = "gcv=test"
            sandbox.append(line)
        watcher = scripts / "upstream-watch.sh"
        watcher.write_text("\n".join(sandbox) + "\n")
        state = self.root / ".local/state/maw-city/upstream-state.tsv"
        state.parent.mkdir(parents=True)
        state.write_text("release:gastownhall/gascity\tv1.5.0\ngastownhall/gascity#12\topen\ngastownhall/gascity#v1.5.1\tabc123\n")
        result = subprocess.run(["bash", str(watcher)], env={**os.environ, "HOME": str(self.root), "DRY_RUN": "1"},
                                capture_output=True, text=True, check=True)
        self.assertIn("DRY_RUN: 0", result.stdout)


if __name__ == "__main__":
    unittest.main()
