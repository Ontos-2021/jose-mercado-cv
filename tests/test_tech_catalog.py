import unittest
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"

TECHNOLOGIES = {
    "Raspberry Pi": "assets/tech/raspberry-pi.svg",
    "ESP32": "assets/tech/esp32.svg",
    "Arduino": "assets/tech/arduino.svg",
}


class HardwareIotCatalogTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = INDEX.read_text(encoding="utf-8")

    def test_hardware_iot_group_exists(self):
        self.assertIn("<h3>Hardware e IoT</h3>", self.html)

    def test_each_technology_uses_the_existing_logo_tag_pattern(self):
        for name, relative_path in TECHNOLOGIES.items():
            expected = (
                '<span class="tag tech-tag"><span class="tech-logo-box">'
                f'<img class="tech-logo" src="{relative_path}" alt="" '
                f'aria-hidden="true"></span>{name}</span>'
            )
            with self.subTest(technology=name):
                self.assertIn(expected, self.html)

    def test_each_logo_is_a_safe_parseable_local_svg(self):
        for name, relative_path in TECHNOLOGIES.items():
            logo = ROOT / relative_path
            with self.subTest(technology=name):
                self.assertTrue(logo.is_file(), f"Missing {relative_path}")
                root = ET.parse(logo).getroot()
                self.assertEqual(root.tag.rsplit("}", 1)[-1], "svg")
                self.assertFalse(
                    any(node.tag.rsplit("}", 1)[-1] == "script" for node in root.iter()),
                    f"Script element found in {relative_path}",
                )


if __name__ == "__main__":
    unittest.main()
