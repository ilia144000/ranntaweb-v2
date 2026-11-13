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
PUBLIC_HISTORY = 40
HOME = Path(os.environ["LOCALAPPDATA"]) / "RANNTA"
LEDGER = HOME / "Pandora" / "Pandora-Live-V2.sqlite3"
TOKEN = HOME / "PandoraPublicAccuracy" / "token"
OFFICIAL = HOME / "Pandora" / "Pandora-Official-Forecasts.sqlite3"
HORIZONS = (60, 900, 3600, 25200, 86400, 604800)

# Explicit public contract. Never expose internal model provenance, raw origin
# prices, precise settlement prices, training metadata or private identifiers.
PUBLIC_RECEIPT_FIELDS = (
    "id", "issued", "target", "call", "probabilities", "baseline",
    "settled", "outcome", "pending_status",
)
PUBLIC_SUMMARY_FIELDS = (
    "n", "first_id", "last_id", "model_correct", "baseline_correct",
    "brier", "log_loss", "accuracy_history", "verified_total",
    "source_online", "target_type", "labels",
)


def public_receipt(raw):
    if not isinstance(raw, dict):
        return None
    result = {key: raw[key] for key in PUBLIC_RECEIPT_FIELDS if key in raw}
    probs = result.get("probabilities")
    if isinstance(probs, (list, tuple)) and len(probs) == 3:
        # Keep user-visible probabilities, not full internal floating-point precision.
        p0, p1 = round(float(probs[0]), 4), round(float(probs[1]), 4)
        result["probabilities"] = [p0, p1, round(1 - p0 - p1, 4)]
    return result


def public_horizon(raw):
    result = {key: raw[key] for key in PUBLIC_SUMMARY_FIELDS if key in raw}
    result["receipts"] = [public_receipt(r) for r in raw.get("receipts", []) if isinstance(r, dict)]
    result["latest"] = public_receipt(raw.get("latest"))
    return result


def public_snapshot(raw):
    """Minimal browser-visible schema shared by publisher and Pages snapshots."""
    result = {
        "schema": raw["schema"],
        "as_of": raw["as_of"],
        "source_online": raw.get("source_online", False),
    }
    result.update({key: raw[key] for key in PUBLIC_SUMMARY_FIELDS if key in raw})
    result["receipts"] = [public_receipt(r) for r in raw.get("receipts", []) if isinstance(r, dict)]
    result["pending"] = public_receipt(raw.get("pending"))
    result["horizons"] = {
        str(h): public_horizon(value)
        for h, value in raw.get("horizons", {}).items()
        if str(h) in {str(x) for x in HORIZONS} and isinstance(value, dict)
    }
    return result


def summarize(cohort):
    n=len(cohort)
    return dict(n=n,first_id=cohort[0]["id"] if n else None,last_id=cohort[-1]["id"] if n else None,
                model_correct=sum(r["call"]==r["outcome"] for r in cohort),
                baseline_correct=sum(r["baseline"]==r["outcome"] for r in cohort),
                brier=sum(sum((p-(i==r["outcome"]))**2 for i,p in enumerate(r["probabilities"]))
                          for r in cohort)/n if n else None,
                log_loss=-sum(math.log(max(1e-12,r["probabilities"][r["outcome"]])) for r in cohort)/n if n else None,
                receipts=list(reversed(cohort[-PUBLIC_HISTORY:])),
                accuracy_history=[round(sum(r["call"]==r["outcome"] for r in cohort[i:i+25])/len(cohort[i:i+25]),4)
                                  for i in range(0,n,25)])


def official_horizon(db,h,now):
    grace=max(5,min(120,h*.2)) if h<=60 else max(30,min(7200,h*.015))
    rows=db.execute("""SELECT origin,issued,committed,price,version,model,odds,band,actual,resolved,
        settlement_price,status FROM receipts WHERE horizon=? AND committed<=?
        AND status IN ('resolved','pending') ORDER BY origin""",(h,now)).fetchall()
    verified=[]
    latest=None
    for origin,issued,committed,price,version,model,raw,band,actual,settled,settlement_price,status in rows:
        target=origin+h
        if not origin<=issued<=committed<origin+min(h,5) or not price>0 or not band>=0:
            continue
        p=json.loads(raw)
        if len(p)!=3 or not all(0<=v<=1 for v in p) or not math.isclose(sum(p),1.,abs_tol=1e-8):
            continue
        receipt=dict(id=f"{h}/{origin:.6f}",origin_t=origin,issued=issued,committed=committed,target=target,origin=price,
                     probabilities=p,call=max(range(3),key=p.__getitem__),model=model,version=version,band_bps=band)
        if status=="resolved" and actual is not None and math.isfinite(actual) and target<=settled<=min(now,target+grace):
            receipt.update(settled=settled,outcome=0 if actual>band else 1 if actual<-band else 2,
                           move_bps=actual,settlement_price=settlement_price)
            verified.append(receipt)
            latest=receipt
        elif status=="pending":
            latest=dict(receipt,pending_status="pending" if target>now else "awaiting_settlement")
    cohort=[]
    previous=[]
    cursor=0
    for r in verified:
        # The stored settlement timestamp is the quote time. Allow the full
        # settlement window before treating its outcome as known to a baseline.
        while cursor<len(verified) and verified[cursor]["target"]+grace<r["issued"]:
            previous.append(verified[cursor]["outcome"])
            cursor+=1
        # Flat is the no-change baseline until 10 eligible earlier labels exist.
        past=previous[-10:]
        counts=Counter(past)
        r["baseline"]=max(reversed(past),key=counts.__getitem__) if len(past)==10 else 2
        cohort.append(r)
    result=summarize(cohort[-WINDOW:])
    return dict(result,latest=latest,verified_total=len(verified),source_t=latest["issued"] if latest else None,
                source_online=bool(latest and now<=latest["target"]+grace),
                settlement_grace_s=grace,target_type="official_terminal_mid",labels=["UP","DOWN","FLAT"])


def official_snapshot(now,path=OFFICIAL):
    with closing(sqlite3.connect(path.resolve().as_uri()+"?mode=ro",uri=True,timeout=4)) as db:
        db.execute("PRAGMA query_only=ON")
        db.execute("BEGIN")
        return {str(h):official_horizon(db,h,now) for h in HORIZONS}


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
    result=dict(schema="pandora-public-accuracy-v1",as_of=now,source_t=runtime[0] if runtime else None,
                source_online=bool(runtime and runtime[1]=="online" and 0<=now-runtime[0]<10),
                n=len(cohort),first_id=cohort[0]["id"] if cohort else None,last_id=cohort[-1]["id"] if cohort else None,
                model_correct=sum(r["call"]==r["outcome"] for r in cohort),
                baseline_correct=sum(r["baseline"]==r["outcome"] for r in cohort),
                receipts=list(reversed(cohort[-PUBLIC_HISTORY:])),pending=pending)
    result.update({key:value for key,value in summarize(cohort).items() if key!="receipts"})
    result["target_type"]="first_mid_move"
    result["labels"]=["UP","DOWN","NO MOVE"]
    result["model"]="Live V2"
    result["version"]="live-v2-gamma-risk-1"
    result["horizons"]=official_snapshot(now)
    return public_snapshot(result)


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
