# archive-core

> Core archival system for long-term data preservation

Part of the [BlackRoad OS](https://blackroad.io) ecosystem — [BlackRoad-Archive](https://github.com/BlackRoad-Archive)

---

# BlackRoad Archive Core

Long-term archival for BlackRoad OS data and history.

## Storage Backends
- **IPFS** — Distributed, content-addressed (via `blackroad-ipfs`)
- **Cloudflare R2** — Object storage for large files
- **Local** — `~/.blackroad/archive/`

## Commands
```bash
br backup create     # Create backup
br backup restore    # Restore from backup
br backup list       # List backups
```
