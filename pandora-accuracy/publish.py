"""Publish allowlisted Live V2 evidence from a read-only local ledger."""

import argparse
from collections import Counter
from contextlib import closing
import json
import math
import os
from pathlib import Path
import sqlite3
import time
from urllib.request import Request, urlopen


URL = "https://rannta.com/api/pandora/live-accuracy/publish"
INTERVAL = 120
WINDOW = 434
HOME = Path(os.environ["LOCALAPPDATA"]) / "RANNTA"
LEDGER = HOME / "Pandora" / "Pandora-Live-V2.sqlite3"
TOKEN = HOME / "PandoraPublicAccuracy" / "token"


def snapshot(path=LEDGER):
    with closing(sqlite3.connect(path.resolve().as_uri()+"?mode=ro",uri=True,timeout=4)) as db:
        db.execute("PRAGMA query_only=ON")
        db.execute("BEGIN")
        rows=db.execute("""SELECT p.id,p.issued,p.target,p.settled,p.outcome,
            coalesce(i.active,f.old_probabilities),p.realized,p.origin,p.status
            FROM pairs p LEFT JOIN inactivity_pairs i ON i.pair_id=p.id
            LEFT JOIN flow_pairs f ON f.pair_id=p.id
            WHERE json_extract(p.features,'$.threshold_bps')=.5
            AND json_extract(p.features,'$.budget_s')=10 AND
            (p.status='pending' OR (p.status='resolved' AND p.settled>p.issued
            AND ((p.outcome IN (0,1) AND p.settled<p.target)
            OR (p.outcome=2 AND p.settled BETWEEN p.target AND p.target+3))))
            ORDER BY p.issued,p.id""").fetchall()
        runtime=db.execute("SELECT json_extract(payload,'$.updated'),json_extract(payload,'$.status') FROM runtime").fetchone()
    settled=sorted((r for r in rows if r[-1]=="resolved"),key=lambda r:r[3])
    evidence=[]
    previous=[]
    cursor=0
    pending=None
    now=time.time()
    for id_,issued,target,resolved,outcome,raw,move,origin,status in rows:
        while cursor<len(settled) and settled[cursor][3]<issued:
            previous.append(settled[cursor][4])
            cursor+=1
        if len(previous)<10 or not raw or target<=issued or not issued<=now:
            continue
        probabilities=json.loads(raw)
        if len(probabilities)!=3 or not all(0<=p<=1 for p in probabilities) or not math.isclose(sum(probabilities),1.,abs_tol=1e-8):
            continue
        history=previous[-10:]
        counts=Counter(history)
        baseline=max(reversed(history),key=counts.__getitem__)
        receipt=dict(id=id_,issued=issued,target=target,call=max(range(3),key=probabilities.__getitem__),
                     probabilities=probabilities,baseline=baseline,origin=origin)
        if status=="resolved" and resolved<=now:
            evidence.append(dict(receipt,settled=resolved,outcome=outcome,move_bps=move if outcome!=2 else None))
        elif status=="pending" and target>now:
            pending=receipt
    cohort=evidence[-WINDOW:]
    return dict(schema="pandora-public-accuracy-v1",as_of=now,source_t=runtime[0] if runtime else None,
                source_online=bool(runtime and runtime[1]=="online" and 0<=now-runtime[0]<10),
                n=len(cohort),first_id=cohort[0]["id"] if cohort else None,last_id=cohort[-1]["id"] if cohort else None,
                model_correct=sum(r["call"]==r["outcome"] for r in cohort),
                baseline_correct=sum(r["baseline"]==r["outcome"] for r in cohort),
                receipts=list(reversed(cohort[-24:])),pending=pending)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    mode=parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--once",action="store_true")
    mode.add_argument("--watch",action="store_true")
    mode.add_argument("--preview",action="store_true")
    options=parser.parse_args()
    if options.preview:
        print(json.dumps(snapshot(),allow_nan=False))
        return
    token=TOKEN.read_text(encoding="ascii").strip()
    while True:
        try:
            data=snapshot()
            body=json.dumps(data,allow_nan=False,separators=(",",":")).encode()
            request=Request(URL,data=body,headers={"Authorization":"Bearer "+token,"Content-Type":"application/json",
                                                   "User-Agent":"RANNTA-Pandora-Publisher/1.0"})
            with urlopen(request,timeout=25) as response:
                if response.status!=204:
                    raise RuntimeError(f"Unexpected HTTP {response.status}")
            print(f"Published {data['n']} receipts through #{data['last_id']}",flush=True)
        except Exception as error:
            if options.once:
                raise
            print(f"Publication failed: {type(error).__name__}: {error}",flush=True)
        if options.once:
            return
        time.sleep(INTERVAL)


if __name__=="__main__":
    main()
