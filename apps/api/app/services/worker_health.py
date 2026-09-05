"""Container-local progress probe; never a claim of successful message delivery."""
import math
import os
import time
from pathlib import Path

HEARTBEAT = Path("/tmp/voysse-worker-progress")
MAX_AGE_SECONDS = 300


def reset(path: Path = HEARTBEAT) -> None:
    # A container restart must not inherit a previous process's healthy state.
    path.unlink(missing_ok=True)


def record_progress(path: Path = HEARTBEAT) -> None:
    temporary = path.with_suffix(".tmp")
    temporary.write_text(str(time.monotonic()), encoding="ascii")
    temporary.chmod(0o600)
    os.replace(temporary, path)


def healthy(path: Path = HEARTBEAT, max_age: float = MAX_AGE_SECONDS) -> bool:
    try:
        timestamp = float(path.read_text(encoding="ascii"))
    except (OSError, ValueError, UnicodeError):
        return False
    age = time.monotonic() - timestamp
    return math.isfinite(age) and 0 <= age <= max_age


if __name__ == "__main__":
    raise SystemExit(0 if healthy() else 1)
