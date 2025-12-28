import sqlite3
from collections import defaultdict
from pathlib import Path


def main() -> int:
    db_path = Path(__file__).resolve().parent / 'db.sqlite3'
    if not db_path.exists():
        print(f"db.sqlite3 not found at: {db_path}")
        return 2

    con = sqlite3.connect(str(db_path))
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
    if 'market_category' not in set(tables):
        print("Could not find market_category table.")
        print("Tables:")
        for t in sorted(tables):
            if 'category' in t:
                print(f"- {t}")
        return 3

    rows = cur.execute(
        "SELECT id, slug, name_ar, name_en, parent_id FROM market_category ORDER BY COALESCE(parent_id, 0), slug"
    ).fetchall()

    by_parent: dict[int | None, list[sqlite3.Row]] = defaultdict(list)
    by_id: dict[int, sqlite3.Row] = {}

    for r in rows:
        by_id[int(r['id'])] = r
        by_parent[r['parent_id']].append(r)

    def label(r: sqlite3.Row) -> str:
        na = (r['name_ar'] or '').strip()
        ne = (r['name_en'] or '').strip()
        if na and ne:
            return f"{na} / {ne}"
        return na or ne or ''

    def walk(pid: int | None, depth: int = 0) -> None:
        for r in by_parent.get(pid, []):
            indent = '  ' * depth
            print(f"{indent}- {r['id']}  {r['slug']}  {label(r)}")
            walk(int(r['id']), depth + 1)

    walk(None)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
