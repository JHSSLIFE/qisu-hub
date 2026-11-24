#!/usr/bin/env python3
"""Compatibility entry point; use build_release.py for new integrations."""
from build_release import main

if __name__ == "__main__":
    raise SystemExit(main())
