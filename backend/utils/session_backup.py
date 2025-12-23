import base64
import json
import os
import time
from typing import Any, Dict, Optional


def _runtime_dir() -> str:
    # Prefer explicit env var, otherwise create a runtime folder beside backend/
    base = os.getenv("RUNTIME_DIR")
    if base:
        return base
    return os.path.join(os.path.dirname(os.path.dirname(__file__)), "runtime")


def _path() -> str:
    return os.getenv("SESSION_BACKUP_PATH", os.path.join(_runtime_dir(), "session.tmp"))


def _enabled() -> bool:
    return os.getenv("SESSION_FILE_BACKUP", "false").lower() == "true"


def _read_all() -> Dict[str, Any]:
    p = _path()
    if not os.path.exists(p):
        return {}
    try:
        with open(p, "rb") as f:
            raw = f.read()
        if not raw:
            return {}
        # Stored as base64(JSON) to avoid plain text; not meant as security.
        decoded = base64.b64decode(raw)
        return json.loads(decoded.decode("utf-8"))
    except Exception:
        return {}


def _write_all(obj: Dict[str, Any]) -> None:
    p = _path()
    os.makedirs(os.path.dirname(p), exist_ok=True)
    tmp = p + ".tmp"
    data = base64.b64encode(json.dumps(obj, separators=(",", ":")).encode("utf-8"))
    with open(tmp, "wb") as f:
        f.write(data)
    # atomic replace on both Windows + Linux
    os.replace(tmp, p)


def save_session_backup(session_id: str, data: Dict[str, Any], ttl_seconds: int = 10 * 60) -> None:
    """
    Best-effort session backup to a local runtime file.

    NOTE: This does NOT replace Redis in Azure multi-instance.
    It only helps single-instance deployments or local dev.
    """
    if not _enabled():
        return
    if not session_id:
        return
    now = int(time.time())
    all_data = _read_all()
    all_data[str(session_id)] = {
        "ts": now,
        "ttl": int(ttl_seconds),
        "data": data,
    }
    _write_all(all_data)


def load_session_backup(session_id: str) -> Optional[Dict[str, Any]]:
    """Load a session backup if present and not expired."""
    if not _enabled():
        return None
    if not session_id:
        return None
    now = int(time.time())
    all_data = _read_all()
    rec = all_data.get(str(session_id))
    if not rec:
        return None
    ts = int(rec.get("ts", 0))
    ttl = int(rec.get("ttl", 0))
    if ttl > 0 and (now - ts) > ttl:
        # expired -> delete
        try:
            del all_data[str(session_id)]
            _write_all(all_data)
        except Exception:
            pass
        return None
    return rec.get("data") or None


def delete_session_backup(session_id: str) -> None:
    if not _enabled():
        return
    if not session_id:
        return
    all_data = _read_all()
    if str(session_id) in all_data:
        try:
            del all_data[str(session_id)]
            _write_all(all_data)
        except Exception:
            pass

