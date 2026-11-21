from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
SW = (ROOT / "public" / "sw.js").read_text(encoding="utf-8")


class OrdinaryNotificationServiceWorkerTests(unittest.TestCase):
    def test_sw_recognises_only_the_three_ordinary_kinds(self):
        self.assertIn('kind==="ordinary_reminder"', SW)
        self.assertIn('kind==="family_event"', SW)
        self.assertIn('kind==="clinic_reminder"', SW)

    def test_ordinary_branch_is_not_an_sos_alarm(self):
        ordinary = SW[SW.index("if(ordinaryPushKind(payload.kind))"):SW.index("const title=\"Alerte privée SAC\"")]
        self.assertIn("requireInteraction:false", ordinary)
        self.assertIn("Un rappel vous attend", ordinary)
        self.assertNotIn("requireInteraction:true", ordinary)
        self.assertNotIn("médicament", ordinary.lower())

    def test_sos_branch_keeps_its_alarm_behaviour(self):
        sos = SW[SW.index("const title=\"Alerte privée SAC\""):SW.index("self.addEventListener(\"notificationclick\"")]
        self.assertIn("requireInteraction:true", sos)
        self.assertIn("sac-private-alert", sos)

    def test_click_target_is_same_origin_and_controlled(self):
        self.assertIn("function safeTarget", SW)
        self.assertIn("new URL(safeTarget(event.notification.data&&event.notification.data.url),self.location.origin)", SW)
        self.assertIn('data:{url:target}', SW)

    def test_sw_cache_version_was_advanced(self):
        self.assertIn('const CACHE_NAME="sac-shell-v3"', SW)


if __name__ == "__main__":
    unittest.main()
