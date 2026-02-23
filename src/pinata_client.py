#!/usr/bin/env python3
"""BlackRoad Archive — Pinata IPFS Client.

Pins content to IPFS via Pinata API for permanent decentralized storage.
Reads PINATA_JWT from environment variable (never hardcoded).
"""

from __future__ import annotations
import hashlib
import json
import logging
import os
from pathlib import Path
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

PINATA_API = "https://api.pinata.cloud"
PINATA_GATEWAY = "https://gateway.pinata.cloud/ipfs"


class PinataClient:
    """Async Pinata IPFS client for pinning and retrieving content."""

    def __init__(self, jwt: Optional[str] = None):
        self.jwt = jwt or os.environ.get("PINATA_JWT", "")
        if not self.jwt:
            raise ValueError(
                "PINATA_JWT not set. Export it: export PINATA_JWT=your_token"
            )
        self._headers = {
            "Authorization": f"Bearer {self.jwt}",
            "Content-Type": "application/json",
        }

    async def test_auth(self) -> bool:
        """Verify API credentials."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{PINATA_API}/data/testAuthentication",
                headers=self._headers,
                timeout=10,
            )
            return resp.status_code == 200

    async def pin_json(self, data: dict, name: str, metadata: dict | None = None) -> str:
        """Pin a JSON object to IPFS. Returns CID."""
        payload = {
            "pinataContent": data,
            "pinataMetadata": {"name": name, **(metadata or {})},
            "pinataOptions": {"cidVersion": 1},
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{PINATA_API}/pinning/pinJSONToIPFS",
                headers=self._headers,
                json=payload,
                timeout=30,
            )
            resp.raise_for_status()
            result = resp.json()
            cid = result["IpfsHash"]
            logger.info("Pinned %s → ipfs://%s", name, cid)
            return cid

    async def pin_file(self, path: Path, name: str | None = None) -> str:
        """Pin a file to IPFS. Returns CID."""
        file_name = name or path.name
        headers = {"Authorization": f"Bearer {self.jwt}"}
        async with httpx.AsyncClient() as client:
            with open(path, "rb") as f:
                resp = await client.post(
                    f"{PINATA_API}/pinning/pinFileToIPFS",
                    headers=headers,
                    files={"file": (file_name, f, "application/octet-stream")},
                    data={"pinataMetadata": json.dumps({"name": file_name})},
                    timeout=60,
                )
                resp.raise_for_status()
                cid = resp.json()["IpfsHash"]
                logger.info("Pinned file %s → ipfs://%s", file_name, cid)
                return cid

    async def unpin(self, cid: str) -> bool:
        """Unpin content from Pinata."""
        async with httpx.AsyncClient() as client:
            resp = await client.delete(
                f"{PINATA_API}/pinning/unpin/{cid}",
                headers=self._headers,
                timeout=15,
            )
            return resp.status_code == 200

    async def list_pins(self, limit: int = 50) -> list[dict]:
        """List pinned content."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{PINATA_API}/data/pinList",
                headers=self._headers,
                params={"pageLimit": limit, "status": "pinned"},
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json().get("rows", [])

    def gateway_url(self, cid: str) -> str:
        """Get public gateway URL for a CID."""
        return f"{PINATA_GATEWAY}/{cid}"


async def archive_world_artifact(artifact_id: str, content: str, node: str) -> str:
    """Archive a world artifact to IPFS. Returns CID."""
    client = PinataClient()
    sha256 = hashlib.sha256(content.encode()).hexdigest()
    data = {
        "id": artifact_id,
        "node": node,
        "content": content,
        "sha256": sha256,
        "archived_by": "BlackRoad-Archive/archive-core",
    }
    return await client.pin_json(data, name=f"world-{artifact_id}", metadata={"node": node})


if __name__ == "__main__":
    import asyncio

    async def main():
        try:
            client = PinataClient()
            ok = await client.test_auth()
            print(f"Pinata auth: {'✓ OK' if ok else '✗ FAIL'}")
            if ok:
                pins = await client.list_pins(limit=5)
                print(f"Pinned items: {len(pins)}")
                for pin in pins:
                    print(f"  {pin['ipfs_pin_hash']} — {pin['metadata']['name']}")
        except ValueError as e:
            print(f"Error: {e}")

    asyncio.run(main())
