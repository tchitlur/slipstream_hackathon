import re, json, os, requests, time
from datetime import datetime, timezone
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) CMU-180DC-case-research/1.0 (contact: nchitlur@yahoo.com)"}
OUT="data"; M=json.load(open(f"{OUT}/manifest.json"))
def log(**kw):
    kw["ts_utc"]=datetime.now(timezone.utc).isoformat(); M.append(kw); print(json.dumps(kw)[:600]); json.dump(M,open(f"{OUT}/manifest.json","w"),indent=1)
def get(u,**k):
    try: return requests.get(u,headers=UA,timeout=300,**k)
    except Exception as e: log(url=u,status="EXC",error=str(e)[:200]); return None
# BPS directory
for d in ["https://www2.census.gov/econ/bps/Metro/","https://www2.census.gov/econ/bps/"]:
    r=get(d)
    if r is not None and r.status_code==200:
        names=re.findall(r'href="([^"?/][^"]*)"',r.text); log(step="dir",url=d,n=len(names),names=names[-60:])
        if "Metro" in d:
            cand=[n for n in names if re.search(r'(2019|2020|2021|2022|2023|2024|2025|19|20|21|22|23|24|25)',n) and n.lower().endswith(('.txt','.csv','.xls','.xlsx'))]
            for n in cand[-40:]:
                rr=get(d+n)
                if rr is not None and rr.status_code==200 and len(rr.content)>500:
                    open(f"{OUT}/raw/bps_{n}","wb").write(rr.content); log(url=d+n,status=200,bytes=len(rr.content))
# LIHTC pages: dump all hrefs
for p in ["https://www.huduser.gov/portal/datasets/lihtc.html","https://lihtc.huduser.gov/","https://www.huduser.gov/portal/datasets/lihtc/lihtcpub.zip","https://www.huduser.gov/portal/datasets/lihtc/LIHTCPUB.ZIP"]:
    r=get(p)
    if r is None: continue
    hrefs=re.findall(r'href="([^"]+)"',r.text) if "html" in r.headers.get("content-type","") else []
    log(step="page",url=p,status=r.status_code,ctype=r.headers.get("content-type"),bytes=len(r.content),hrefs=[h for h in hrefs if any(k in h.lower() for k in ("lihtc","zip","csv","xlsx","dbf"))][:40])
    if r.status_code==200 and len(r.content)>1_000_000 and "html" not in r.headers.get("content-type",""):
        open(f"{OUT}/raw/lihtc_candidate.zip","wb").write(r.content)
log(step="DONE3")
