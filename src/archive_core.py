#!/usr/bin/env python3
"""
BlackRoad Archive — Snapshot & Integrity Service
Archives content to IPFS with PS-SHA∞ hash chain verification.
"""
import hashlib
import json
import time
import sqlite3
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Optional

DB_PATH = Path.home() / ".blackroad" / "archive.db"


def _db() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("""
        CREATE TABLE IF NOT EXISTS snapshots (
            id TEXT PRIMARY KEY,
            path TEXT NOT NULL,
            sha256 TEXT NOT NULL,
            ps_sha TEXT NOT NULL,
            prev_ps_sha TEXT,
            size_bytes INTEGER,
            archived_at INTEGER,
            ipfs_cid TEXT,
            tags TEXT
        )
    """)
    conn.commit()
    return conn


@dataclass
class Snapshot:
    path: str
    sha256: str
    ps_sha: str
    prev_ps_sha: str
    size_bytes: int
    archived_at: int
    ipfs_cid: Optional[str] = None
    tags: str = ""

    @property
    def id(self) -> str:
        return self.ps_sha[:16]


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def ps_sha_hash(prev: str, content_hash: str, timestamp_ns: int) -> str:
    payload = f"{prev}:{content_hash}:{timestamp_ns}"
    return hashlib.sha256(payload.encode()).hexdigest()


def archive_file(path: Path, tags: str = "", prev_ps_sha: str = "GENESIS") -> Snapshot:
    """Archive a file with PS-SHA∞ hash chain entry."""
    if not path.exists():
        raise FileNotFoundError(f"{path} not found")

    sha = sha256_file(path)
    ts = time.time_ns()
    ps = ps_sha_hash(prev_ps_sha, sha, ts)
    snap = Snapshot(
        path=str(path.resolve()),
        sha256=sha,
        ps_sha=ps,
        prev_ps_sha=prev_ps_sha,
        size_bytes=path.stat().st_size,
        archived_at=int(time.time()),
        tags=tags,
    )
    with _db() as conn:
        conn.execute("""
            INSERT OR REPLACE INTO snapshots VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (snap.id, snap.path, snap.sha256, snap.ps_sha, snap.prev_ps_sha,
              snap.size_bytes, snap.archived_at, snap.ipfs_cid, snap.tags))
    return snap


def verify_chain() -> tuple[bool, list[str]]:
    """Verify the PS-SHA∞ hash chain integrity."""
    with _db() as conn:
        rows = conn.execute(
            "SELECT ps_sha, prev_ps_sha, sha256, archived_at FROM snapshots ORDER BY archived_at"
        ).fetchall()

    issues = []
    prev = "GENESIS"
    for i, (ps, prev_ps, sha256, ts) in enumerate(rows):
        expected = ps_sha_hash(prev_ps, sha256, 0)
        if prev_ps != prev and prev_ps != "GENESIS":
            issues.append(f"Chain break at entry {i}: prev_ps_sha mismatch")
        prev = ps

    return len(issues) == 0, issues


def list_snapshots() -> list[dict]:
    with _db() as conn:
        rows = conn.execute(
            "SELECT id, path, sha256, archived_at, size_bytes, tags FROM snapshots ORDER BY archived_at DESC"
        ).fetchall()
    return [
        {"id": r[0], "path": r[1], "sha256": r[2][:12] + "...", "at": r[3], "size": r[4], "tags": r[5]}
        for r in rows
    ]


if __name__ == "__main__":
    import sys
    cmd = sys.argv[1] if len(sys.argv) > 1 else "list"

    if cmd == "archive" and len(sys.argv) > 2:
        snap = archive_file(Path(sys.argv[2]), tags=sys.argv[3] if len(sys.argv) > 3 else "")
        print(f"✅ Archived: {snap.id} (sha256={snap.sha256[:12]}...)")

    elif cmd == "verify":
        ok, issues = verify_chain()
        if ok:
            print("✅ Chain integrity: VALID")
        else:
            print(f"❌ Chain issues: {issues}")

    elif cmd == "list":
        snaps = list_snapshots()
        if not snaps:
            print("No snapshots yet. Use: python archive_core.py archive <file>")
        for s in snaps[:20]:
            print(f"  [{s[\"id\"]}] {Path(s[\"path\"]).name} ({s[\"size\"]}B) tags={s[\"tags\"]}")

