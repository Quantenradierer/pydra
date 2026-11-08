"""Runs the Robot Battler golden snippets in CPython and prints the results as JSON.

Usage: python3 -I scripts/golden-runner.py < snippets.json > golden.json
Each snippet becomes {"out": <stdout>, "error": <exception class or null>, "line": <line or null>}.
"""
import contextlib
import io
import json
import sys
import traceback


def run(code):
    out = io.StringIO()
    try:
        compiled = compile(code, "<snippet>", "exec")
    except SyntaxError as e:
        return {"out": "", "error": type(e).__name__, "line": e.lineno}
    try:
        with contextlib.redirect_stdout(out):
            exec(compiled, {"__name__": "__snippet__"})
    except RecursionError:
        return {"out": out.getvalue(), "error": "RecursionError", "line": None}
    except Exception as e:  # noqa: BLE001
        line = None
        for frame in traceback.extract_tb(e.__traceback__):
            if frame.filename == "<snippet>":
                line = frame.lineno
        return {"out": out.getvalue(), "error": type(e).__name__, "line": line}
    return {"out": out.getvalue(), "error": None, "line": None}


snippets = json.load(sys.stdin)
json.dump([run(s) for s in snippets], sys.stdout, ensure_ascii=False, indent=0)
