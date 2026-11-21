import json
import struct
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def png_size(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise AssertionError(f"{path} is not a PNG file")
    return struct.unpack(">II", data[16:24])


class PwaManifestIconsTest(unittest.TestCase):
    def test_manifest_icons_exist_and_match_declared_sizes(self) -> None:
        manifest = json.loads((ROOT / "public/manifest.webmanifest").read_text(encoding="utf-8"))
        icons = manifest.get("icons", [])
        self.assertTrue(icons, "the manifest must declare at least one icon")

        declared = {(icon["src"], icon["sizes"], icon["purpose"]) for icon in icons}
        self.assertIn(("/brand/sac-icon-192.png", "192x192", "any"), declared)
        self.assertIn(("/brand/sac-icon-512.png", "512x512", "any"), declared)
        self.assertIn(("/brand/sac-icon-maskable-512.png", "512x512", "maskable"), declared)

        for icon in icons:
            path = ROOT / "public" / icon["src"].lstrip("/")
            self.assertTrue(path.is_file(), f"missing icon asset: {icon['src']}")
            width, height = png_size(path)
            self.assertEqual(f"{width}x{height}", icon["sizes"], icon["src"])

    def test_index_declares_favicon_and_apple_touch_icon(self) -> None:
        index = (ROOT / "index.html").read_text(encoding="utf-8")
        self.assertIn('rel="apple-touch-icon"', index)
        self.assertIn("/brand/apple-touch-icon.png", index)
        self.assertIn('rel="icon"', index)
        self.assertTrue((ROOT / "public/brand/apple-touch-icon.png").is_file())
        self.assertTrue((ROOT / "public/brand/sac-logo.png").is_file())


if __name__ == "__main__":
    unittest.main()
