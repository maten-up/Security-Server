import json, tempfile, unittest
from datetime import datetime, timezone, timedelta
from pathlib import Path
from report import summarize
class ReportTests(unittest.TestCase):
    def test_rotation_and_filter(self):
        now=datetime(2026,1,1,tzinfo=timezone.utc)
        with tempfile.TemporaryDirectory() as tmp:
            p,old=Path(tmp)/'events.jsonl',Path(tmp)/'events.jsonl.1'
            def event(when):
                return json.dumps({'time':when.isoformat(),'kind':'message-risk','action':'observed','flags':['spam']})
            old.write_text(event(now-timedelta(hours=1))+'\n')
            p.write_text('\n'.join([event(now),event(now-timedelta(days=2)),event(now+timedelta(hours=1)),'invalid','{}']))
            r=summarize([old,p],now)
            self.assertEqual(r['events'],2)
            self.assertEqual(r['flags'],{'spam':2})
            self.assertEqual(r['invalid'],2)
    def test_missing(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(summarize([Path(tmp)/'missing'])['events'],0)
