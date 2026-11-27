"""Local privacy-preserving incident analytics."""
import argparse
from collections import Counter
from datetime import datetime, timezone, timedelta
import json
from pathlib import Path

def summarize(paths, now=None):
    now = now or datetime.now(timezone.utc)
    kinds, flags, actions = Counter(), Counter(), Counter()
    invalid = 0
    for path in paths:
        try:
            stream = path.open(encoding='utf-8', errors='replace')
        except FileNotFoundError:
            continue
        with stream:
            for line in stream:
                try:
                    if len(line)>8192:
                        raise ValueError('oversized')
                    e=json.loads(line)
                    when=datetime.fromisoformat(e['time'].replace('Z','+00:00'))
                    if when.tzinfo is None:
                        raise ValueError('timezone')
                    if not timedelta(0)<=now-when<=timedelta(hours=24):
                        continue
                    kind,action,labels=e['kind'],e['action'],e.get('flags',[])
                    if not isinstance(kind,str) or not isinstance(action,str) or not isinstance(labels,list) or not all(isinstance(v,str) for v in labels):
                        raise ValueError('invalid event')
                    kinds[kind[:80]]+=1
                    actions[action[:80]]+=1
                    flags.update(v[:80] for v in labels)
                except (ValueError,TypeError,KeyError,AttributeError,OverflowError):
                    invalid+=1
    return {'events':sum(kinds.values()),'kinds':kinds,'flags':flags,'actions':actions,'invalid':invalid}

def main():
    p=argparse.ArgumentParser()
    p.add_argument('file',type=Path)
    args=p.parse_args()
    r=summarize([Path(str(args.file)+'.1'),args.file])
    print('Security report | last 24 hours')
    print('Logged events:',r['events'],'| Invalid lines:',r['invalid'])
    for section in ('kinds','flags','actions'):
        print(section.capitalize()+':')
        for name,count in r[section].most_common(8):
            print(' -',name,count)

if __name__=='__main__':
    main()
