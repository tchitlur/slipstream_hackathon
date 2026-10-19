import re, json, os, io, csv, time, requests, zipfile
from datetime import datetime, timezone
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) CMU-180DC-case-research/1.0 (contact: nchitlur@yahoo.com)"}
OUT="data"; M=json.load(open(f"{OUT}/manifest.json"))
def log(**kw):
    kw["ts_utc"]=datetime.now(timezone.utc).isoformat(); M.append(kw); print(json.dumps(kw)[:600]); json.dump(M,open(f"{OUT}/manifest.json","w"),indent=1)
def get(u,**k):
    try: return requests.get(u,headers=UA,timeout=600,**k)
    except Exception as e: log(url=u,status="EXC",error=str(e)[:200]); return None
def save(u,p,mb=500):
    r=get(u)
    if r is not None and r.status_code==200 and len(r.content)>=mb:
        open(p,"wb").write(r.content); log(url=u,status=200,bytes=len(r.content),saved=p); return True
    log(url=u,status=getattr(r,"status_code",None)); return False
# ---- BPS: list both folders, grab annual files 2019-2025
for folder in ["Metro%20(ending%202023)/","CBSA%20(beginning%20Jan%202024)/"]:
    d="https://www2.census.gov/econ/bps/"+folder
    r=get(d)
    if r is None or r.status_code!=200: log(url=d,status=getattr(r,"status_code",None)); continue
    names=[n for n in re.findall(r'href="([^"?/][^"]*)"',r.text) if not n.startswith("http")]
    log(step="bps_dir",url=d,n=len(names),sample=names[:5]+names[-25:])
    for n in names:
        low=n.lower()
        if re.search(r'(19|20|21|22|23|24|25|26)(12y|a)\.txt$',low) or re.search(r'20(19|2\d)a\.txt$',low) or re.search(r'(1912|2012|2112|2212|2312|2412|2512|2608|2609|2607)[cy]\.txt$',low):
            save(d+n,f"{OUT}/raw/bps_{n}")
# ---- LIHTC property page hrefs + download
r=get("https://www.huduser.gov/portal/datasets/lihtc/property.html")
if r is not None and r.status_code==200:
    hrefs=re.findall(r'href="([^"]+)"',r.text)
    cands=[h for h in hrefs if re.search(r'\.(zip|csv|xlsx|accdb|dbf)$',h,re.I)]
    log(step="lihtc_property_hrefs",hrefs=cands[:40])
    for h in cands:
        u=h if h.startswith("http") else requests.compat.urljoin("https://www.huduser.gov/portal/datasets/lihtc/property.html",h)
        if save(u,f"{OUT}/raw/lihtc_"+os.path.basename(h),mb=100000):
            try:
                with zipfile.ZipFile(f"{OUT}/raw/lihtc_"+os.path.basename(h)) as z:
                    log(step="lihtc_zip",files=z.namelist())
                    for n in z.namelist():
                        if n.lower().endswith((".csv",".xlsx")): open(f"{OUT}/raw/lihtc_"+os.path.basename(n),"wb").write(z.read(n))
                os.remove(f"{OUT}/raw/lihtc_"+os.path.basename(h))
            except Exception as e: log(step="lihtc_unzip",error=str(e)[:200])
# ---- HMDA for metros reported by division
HM="https://ffiec.cfpb.gov/v2/data-browser-api/view/csv"
def num(x):
    try: return float(x)
    except: return None
need=list(csv.DictReader(open(f"{OUT}/hmda_divisions_needed.csv")))
by_cbsa={}
for row in need: by_cbsa.setdefault(row["CBSA Code"],[]).append((row["Metropolitan Division Code"],row["Metropolitan Division Title"]))
top={r["cbsa"]:r["name"] for r in csv.DictReader(open(f"{OUT}/msa_top200.csv"))}
agg_rows=[]
for cbsa,divs in by_cbsa.items():
    c={k:0 for k in ["apps","orig","denied","lmi_apps","lmi_orig","lmi_denied","nonlmi_apps","nonlmi_denied","lmitract_orig","w_apps","w_den","b_apps","b_den","h_apps","h_den","a_apps","a_den","den_dti","den_credit","den_collateral","den_cash","ltv_hi","ltv_n","dti_hi","dti_n","fha_va_orig","manuf_apps"]}
    c["mfi"]=None; amts=[]; incs=[]; n=0
    for dcode,dname in divs:
        url=f"{HM}?years=2024&msamds={dcode}&actions_taken=1,2,3&loan_purposes=1"
        r=get(url)
        if r is None or r.status_code!=200: log(url=url,status=getattr(r,"status_code",None)); continue
        rd=csv.DictReader(io.StringIO(r.text)); nn=0
        for row in rd:
            if row.get("lien_status") not in ("1","",None): continue
            if row.get("total_units","") not in ("1","2","3","4",""): continue
            if row.get("construction_method")=="2": c["manuf_apps"]+=1; continue
            nn+=1; act=row.get("action_taken"); inc=num(row.get("income")); mfi=num(row.get("ffiec_msa_md_median_family_income"))
            if mfi: c["mfi"]=mfi
            lmi=bool(inc is not None and mfi and inc*1000<0.8*mfi); tp=num(row.get("tract_to_msa_income_percentage")); lmitract=tp is not None and tp<80
            race=row.get("derived_race",""); eth=row.get("derived_ethnicity","")
            c["apps"]+=1; c["lmi_apps" if lmi else "nonlmi_apps"]+=1
            if act=="1":
                c["orig"]+=1; c["lmi_orig"]+=lmi; c["lmitract_orig"]+=lmitract; c["fha_va_orig"]+=(row.get("loan_type") in ("2","3"))
                a=num(row.get("loan_amount")); amts.append(a) if a else None
                if inc is not None: incs.append(inc)
                ltv=num(row.get("combined_loan_to_value_ratio"))
                if ltv is not None: c["ltv_n"]+=1; c["ltv_hi"]+=(ltv>95)
                dti=row.get("debt_to_income_ratio","")
                if dti: c["dti_n"]+=1; c["dti_hi"]+=(dti in (">60%","50%-60%") or (dti.isdigit() and int(dti)>=43))
            if act=="3":
                c["denied"]+=1; c["lmi_denied" if lmi else "nonlmi_denied"]+=1
                rs={row.get(f"denial_reason-{i}") for i in range(1,5)}
                c["den_dti"]+=("1" in rs); c["den_credit"]+=("3" in rs); c["den_collateral"]+=("4" in rs); c["den_cash"]+=("5" in rs)
            if eth=="Hispanic or Latino": c["h_apps"]+=1; c["h_den"]+=(act=="3")
            elif race=="White": c["w_apps"]+=1; c["w_den"]+=(act=="3")
            elif race=="Black or African American": c["b_apps"]+=1; c["b_den"]+=(act=="3")
            elif race=="Asian": c["a_apps"]+=1; c["a_den"]+=(act=="3")
        n+=nn; log(url=url,status=200,rows=nn,division=dname); time.sleep(0.2)
    amts.sort(); incs.sort(); med=lambda L: L[len(L)//2] if L else None
    c.update({"cbsa":cbsa,"name":top.get(cbsa),"year":"2024","rows":n,"median_loan_amount":med(amts),"median_applicant_income_k":med(incs)})
    agg_rows.append(c)
with open(f"{OUT}/hmda/hmda_msa_aggregates_2024_divisions.csv","w",newline="") as f:
    w=csv.DictWriter(f,fieldnames=list(agg_rows[0].keys())); w.writeheader(); w.writerows(agg_rows)
log(step="DONE4",n=len(agg_rows))
