"""Generate opaque Home Screen PNGs using only Python's standard library.

Run from the repository root: python scripts/build-admin-push-icons.py
"""
import struct
import zlib
from pathlib import Path


def chunk(kind, data):
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))


for size in (180, 192, 512):
    pixels = bytearray()
    for y in range(size):
        pixels.append(0)
        for x in range(size):
            nx, ny = x / size, y / size
            stem = .30 <= nx <= .41 and .24 <= ny <= .76
            bowl = .40 <= nx <= .62 and (.24 <= ny <= .34 or .46 <= ny <= .56)
            edge = .60 <= nx <= .70 and .30 <= ny <= .50
            pixels.extend((216, 179, 111) if stem or bowl or edge else (16, 24, 39))
    header = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    output = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(pixels)) + chunk(b"IEND", b"")
    Path(f"public/admin-push-icon-{size}.png").write_bytes(output)
