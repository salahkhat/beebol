from __future__ import annotations

import re
from dataclasses import dataclass


_VERSION_RE = re.compile(
    r"^\s*(?P<release>\d+(?:\.\d+)*)\s*(?:(?P<tag>a|b|rc)\s*(?P<tagnum>\d+))?\s*$",
    re.IGNORECASE,
)


@dataclass(frozen=True, order=False)
class StrictVersion:
    """Minimal StrictVersion implementation.

    Supports versions like:
      - 1.2
      - 1.2.3
      - 1.2rc1 / 1.2a1 / 1.2b2

    This is intentionally small: it only aims to satisfy legacy dependencies
    that used `distutils.version.StrictVersion` for simple comparisons.
    """

    vstring: str
    _release: tuple[int, ...]
    _pre_tag: str | None
    _pre_num: int | None

    def __init__(self, vstring: str):
        m = _VERSION_RE.match(str(vstring or ""))
        if not m:
            raise ValueError(f"invalid StrictVersion: {vstring!r}")

        release = tuple(int(x) for x in m.group("release").split("."))
        tag = m.group("tag")
        tagnum = m.group("tagnum")

        object.__setattr__(self, "vstring", str(vstring))
        object.__setattr__(self, "_release", release)
        object.__setattr__(self, "_pre_tag", tag.lower() if tag else None)
        object.__setattr__(self, "_pre_num", int(tagnum) if tagnum is not None else None)

    def __repr__(self) -> str:  # pragma: no cover
        return f"StrictVersion({self.vstring!r})"

    def __str__(self) -> str:
        return self.vstring

    @staticmethod
    def _pre_rank(tag: str | None) -> int:
        # Pre-releases sort before final releases.
        # Among pre-releases: a < b < rc.
        if tag is None:
            return 3
        if tag == "a":
            return 0
        if tag == "b":
            return 1
        return 2  # rc

    def _cmp_key(self):
        return (
            self._release,
            self._pre_rank(self._pre_tag),
            self._pre_num if self._pre_num is not None else -1,
        )

    def _coerce(self, other) -> "StrictVersion":
        if isinstance(other, StrictVersion):
            return other
        return StrictVersion(str(other))

    def __lt__(self, other) -> bool:
        o = self._coerce(other)
        return self._cmp_key() < o._cmp_key()

    def __le__(self, other) -> bool:
        o = self._coerce(other)
        return self._cmp_key() <= o._cmp_key()

    def __eq__(self, other) -> bool:
        try:
            o = self._coerce(other)
        except Exception:
            return False
        return self._cmp_key() == o._cmp_key()

    def __ge__(self, other) -> bool:
        o = self._coerce(other)
        return self._cmp_key() >= o._cmp_key()

    def __gt__(self, other) -> bool:
        o = self._coerce(other)
        return self._cmp_key() > o._cmp_key()
