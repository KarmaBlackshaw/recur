#!/usr/bin/env python3
"""Drive the app on an Android emulator through uiautomator.

  ui.py dump [regex]               visible text/content-desc nodes as "x,y label"
  ui.py has <regex>                exit 0 when a node matches (prints matches), else 1
  ui.py wait <regex> [seconds]     poll until a node matches (default 15 s), else exit 1
  ui.py tap <regex> [n]            tap the n-th (0-based) match
  ui.py swipe <regex> left|right   swipe across the first match (row actions)
  ui.py shot <file.png>            save a screenshot

Regexes are case-insensitive and match a node's text or content-desc.
Targets ANDROID_SERIAL on the adb server at ANDROID_ADB_SERVER_PORT, defaulting
to the private QA emulator (emulator-5602 on server 5099).
"""
import os
import re
import shutil
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

ENV = dict(os.environ)
ENV.setdefault("ANDROID_ADB_SERVER_PORT", "5099")
ENV.setdefault("ANDROID_SERIAL", "emulator-5602")
SDK = os.environ.get("ANDROID_HOME", "/opt/homebrew/share/android-commandlinetools")
ADB = shutil.which("adb") or os.path.join(SDK, "platform-tools", "adb")


def adb(*args):
    return subprocess.run([ADB, *args], env=ENV, capture_output=True, text=True).stdout


def is_icon_glyph(label):
    return all(0xE000 <= ord(c) <= 0xF8FF for c in label.strip())


def nodes():
    xml = ""
    for _ in range(3):
        adb("shell", "uiautomator", "dump", "/sdcard/ui.xml")
        xml = adb("exec-out", "cat", "/sdcard/ui.xml")
        if xml.strip().startswith("<?xml"):
            break
        time.sleep(1)
    else:
        sys.exit(f"uiautomator dump failed on {ENV['ANDROID_SERIAL']}: {xml.strip()[:200]!r}")
    out = []
    for n in ET.fromstring(xml).iter("node"):
        label = n.get("text") or n.get("content-desc") or ""
        bounds = re.findall(r"\d+", n.get("bounds", ""))
        if not label or is_icon_glyph(label) or len(bounds) != 4:
            continue
        x1, y1, x2, y2 = map(int, bounds)
        out.append({"label": label, "x1": x1, "x2": x2, "x": (x1 + x2) // 2, "y": (y1 + y2) // 2,
                    "enabled": n.get("enabled") == "true"})
    return out


def show(node):
    label = node["label"].replace("\n", " | ")
    return f"{node['x']:5d},{node['y']:5d} {'' if node['enabled'] else '[disabled] '}{label}"


def matches(pattern):
    pat = re.compile(pattern, re.I)
    return [n for n in nodes() if pat.search(n["label"])]


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    cmd, args = sys.argv[1], sys.argv[2:]
    if cmd == "dump":
        for n in matches(args[0]) if args else nodes():
            print(show(n))
    elif cmd == "has":
        hits = matches(args[0])
        for n in hits:
            print(show(n))
        sys.exit(0 if hits else 1)
    elif cmd == "wait":
        deadline = time.time() + (float(args[1]) if len(args) > 1 else 15)
        while time.time() < deadline:
            hits = matches(args[0])
            if hits:
                for n in hits:
                    print(show(n))
                return
        sys.exit(f"timed out waiting for {args[0]!r}")
    elif cmd in ("tap", "swipe"):
        hits = matches(args[0])
        idx = int(args[1]) if cmd == "tap" and len(args) > 1 else 0
        if len(hits) <= idx:
            sys.exit(f"NO MATCH for {args[0]!r}")
        n = hits[idx]
        if cmd == "tap":
            adb("shell", "input", "tap", str(n["x"]), str(n["y"]))
            print(f"tapped {show(n)}")
        else:
            # Gesture navigation reads a swipe starting near a screen edge as Back: start 15% in.
            width = n["x2"] - n["x1"]
            at = lambda pct: str(n["x1"] + width * pct // 100)
            start, end = (at(15), at(95)) if args[1] == "right" else (at(85), at(20))
            adb("shell", "input", "swipe", start, str(n["y"]), end, str(n["y"]), "400")
            print(f"swiped {args[1]} {show(n)}")
        time.sleep(1.2)
    elif cmd == "shot":
        os.makedirs(os.path.dirname(os.path.abspath(args[0])), exist_ok=True)
        with open(args[0], "wb") as f:
            f.write(subprocess.run([ADB, "exec-out", "screencap", "-p"], env=ENV, capture_output=True).stdout)
        print(os.path.abspath(args[0]))
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
