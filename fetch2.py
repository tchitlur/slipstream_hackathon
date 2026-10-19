#!/usr/bin/env python3
"""Round 2: HMDA (with diagnostics), building permits, LIHTC, Picture of Subsidized Households, ACS variable labels."""
import csv, io, json, os, re, sys, time, zipfile, traceback
from datetime import datetime, timezone
import requests

OUT = "data"
for d in ("raw", "hmda", "acs"): os.makedirs(f"{OUT}/{d}", exist_ok=True)
MPATH = f"{OUT}/manifest.json"
MANIFEST = json.load(open(MPATH)) if os.path.exists(MPATH) else []
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) CMU-180DC-case-research/1.0 (contact: nchitlur@yahoo.com)"}

def log(**kw):
    kw["ts_utc"] = datetime.now(timezone.utc).isoformat(); MANIFEST.append(kw); print(json.dumps(kw)[:400], flush=True)
    json.dump(MANIFEST, open(MPATH, "w"), indent=1)
import hashlib
def sha(b): return hashlib.sha256(b).hexdigest()
def get(url, timeout=600, retries=2, **kw):
    for i in range(retries + 1):
        try: return requests.get(url, headers=UA, timeout=timeout, **kw)
        except Exception as e:
            if i == retries: log(url=url, status="EXC", error=str(e)[:300]); return None
            time.sleep(5)
def save(url, path, min_bytes=200):
    r = get(url)
    if r is None: return False
    ok = r.status_code == 200 and len(r.content) >= min_bytes
    if ok: open(path, "wb").write(r.content)
    log(url=url, status=r.status_code, bytes=len(r.content), sha256=sha(r.content) if ok else None, saved=path if ok else None, head=None if ok else r.text[:200])
    return ok
def first_ok(urls, path, **kw):
    for u in urls:
        if save(u, path, **kw): return u
def _hook(t, v, tb):
    msg = "".join(traceback.format_exception(t, v, tb)); log(step="FATAL", error=msg[-3000:])
sys.excepthook = _hook

TOP = [r for r in csv.DictReader(open(f"{OUT}/msa_top200.csv"))]

# ---------------- ACS variable labels (metadata endpoint; no key needed)
first_ok(["https://api.census.gov/data/2024/acs/acs5/variables.json"], f"{OUT}/acs/acs5_2024_variables.json", min_bytes=10000)

# ---------------- Building permits: Census BPS metro, December year-to-date files = annual totals
for yy, y in [("19", "2019"), ("20", "2020"), ("21", "2021"), ("22", "2022"), ("23", "2023"), ("24", "2024"), ("25", "2025")]:
    first_ok([f"https://www2.census.gov/econ/bps/Metro/ma{yy}12y.txt", f"https://www2.census.gov/econ/bps/Metro/ma{y}a.txt"], f"{OUT}/raw/bps_metro_{y}_ytd_dec.txt", min_bytes=1000)
# directory listing for diagnostics
r = get("https://www2.census.gov/econ/bps/Metro/")
if r is not None and r.status_code == 200:
    names = sorted(set(re.findall(r'href="(ma\d{4}[a-z]\.txt)"', r.text)))
    log(step="bps_dir", n=len(names), last=names[-12:])
    for n in names[-3:]:
        save(f"https://www2.census.gov/econ/bps/Metro/{n}", f"{OUT}/raw/bps_metro_{n}", min_bytes=1000)

# ---------------- LIHTC database: discover link
for page in ["https://lihtc.huduser.gov/", "https://www.huduser.gov/portal/datasets/lihtc.html"]:
    r = get(page)
    if r is not None and r.status_code == 200:
        links = re.findall(r'href="([^"]+\.(?:zip|csv|xlsx))"', r.text, flags=re.I)
        log(step="lihtc_links", page=page, links=links[:30])
        for l in links:
            if "lihtcpub" in l.lower() or "lihtc" in l.lower() and l.lower().endswith(".zip"):
                u = l if l.startswith("http") else requests.compat.urljoin(page, l)
                if save(u, f"{OUT}/raw/lihtcpub.zip", min_bytes=100000):
                    with zipfile.ZipFile(f"{OUT}/raw/lihtcpub.zip") as z:
                        log(step="lihtc_zip", files=z.namelist())
                        for n in z.namelist():
                            if n.lower().endswith((".csv", ".pdf", ".xlsx")):
                                open(f"{OUT}/raw/lihtc_{os.path.basename(n)}", "wb").write(z.read(n))
                    os.remove(f"{OUT}/raw/lihtcpub.zip"); break
        break
if not os.path.exists(f"{OUT}/raw/lihtc_LIHTCPUB.CSV") and not any(f.lower().startswith("lihtc_") for f in os.listdir(f"{OUT}/raw")):
    first_ok(["https://www.huduser.gov/portal/datasets/lihtc/lihtcpub.zip", "https://lihtc.huduser.gov/LIHTCPUB.zip"], f"{OUT}/raw/lihtcpub.zip", min_bytes=100000)

# ---------------- Picture of Subsidized Households: discover links
r = get("https://www.huduser.gov/portal/datasets/assthsg.html")
if r is not None and r.status_code == 200:
    links = re.findall(r'href="([^"]+\.(?:xlsx|xls|zip|csv))"', r.text, flags=re.I)
    log(step="picture_links", links=links[:60])
    for l in links:
        low = l.lower()
        if any(k in low for k in ("cbsa", "county", "state", "us_", "national")) and ("2024" in low or "2025" in low or "2023" in low):
            u = l if l.startswith("http") else requests.compat.urljoin("https://www.huduser.gov/portal/datasets/assthsg.html", l)
            save(u, f"{OUT}/raw/hud_picture_{os.path.basename(l)}")

# ---------------- HMDA diagnostics then loop
HM = "https://ffiec.cfpb.gov/v2/data-browser-api/view/csv"
variants = [
    "?years=2024&msamds=38300&actions_taken=1&loan_purposes=1",
    "?years=2023&msamds=38300&actions_taken=1&loan_purposes=1",
    "?years=2024&msamds=38300&actions_taken=1,2,3&loan_purposes=1&lien_statuses=1&construction_methods=1&total_units=1",
    "?years=2023&states=PA&actions_taken=1&loan_purposes=1",
]
for v in variants:
    rr = get(HM + v, timeout=300)
    log(step="hmda_diag", url=HM + v, status=getattr(rr, "status_code", None), bytes=len(rr.content) if rr is not None else None, head=(rr.text[:300] if rr is not None else None))
# aggregations endpoint check
rr = get("https://ffiec.cfpb.gov/v2/data-browser-api/view/aggregations?years=2024&msamds=38300&actions_taken=1,3&loan_purposes=1", timeout=300)
log(step="hmda_diag_agg", status=getattr(rr, "status_code", None), head=(rr.text[:500] if rr is not None else None))

def num(x):
    try: return float(x)
    except: return None

def hmda_ok(y):
    r = get(f"{HM}?years={y}&msamds=38300&actions_taken=1&loan_purposes=1", timeout=300)
    return r is not None and r.status_code == 200 and len(r.content) > 1000
hmda_year = next((y for y in ["2024", "2023"] if hmda_ok(y)), None)
log(step="hmda_year2", year=hmda_year)
if hmda_year:
    agg_rows = []
    for m in TOP:
        cbsa, name = m["cbsa"], m["name"]
        url = f"{HM}?years={hmda_year}&msamds={cbsa}&actions_taken=1,2,3&loan_purposes=1"
        r = get(url, timeout=900)
        if r is None or r.status_code != 200:
            log(url=url, status=getattr(r, "status_code", None)); continue
        rd = csv.DictReader(io.StringIO(r.text))
        c = {k: 0 for k in ["apps", "orig", "denied", "lmi_apps", "lmi_orig", "lmi_denied", "nonlmi_apps", "nonlmi_denied", "lmitract_orig",
                            "w_apps", "w_den", "b_apps", "b_den", "h_apps", "h_den", "a_apps", "a_den",
                            "den_dti", "den_credit", "den_collateral", "den_cash", "ltv_hi", "ltv_n", "dti_hi", "dti_n", "fha_va_orig", "manuf_apps"]}
        c["mfi"] = None; amts = []; incs = []; n = 0
        for row in rd:
            # restrict to first lien, site-built, 1-4 units in code (filters may not all be server-side)
            if row.get("lien_status") not in ("1", "", None): continue
            tu = row.get("total_units", "")
            if tu not in ("1", "2", "3", "4", ""): continue
            if row.get("construction_method") == "2": c["manuf_apps"] += 1; continue
            n += 1
            act = row.get("action_taken"); inc = num(row.get("income")); mfi = num(row.get("ffiec_msa_md_median_family_income"))
            if mfi: c["mfi"] = mfi
            lmi = bool(inc is not None and mfi and inc * 1000 < 0.8 * mfi)
            tp = num(row.get("tract_to_msa_income_percentage")); lmitract = tp is not None and tp < 80
            race = row.get("derived_race", ""); eth = row.get("derived_ethnicity", "")
            c["apps"] += 1; c["lmi_apps" if lmi else "nonlmi_apps"] += 1
            if act == "1":
                c["orig"] += 1
                if lmi: c["lmi_orig"] += 1
                if lmitract: c["lmitract_orig"] += 1
                if row.get("loan_type") in ("2", "3"): c["fha_va_orig"] += 1
                a = num(row.get("loan_amount")); amts.append(a) if a else None
                if inc is not None: incs.append(inc)
                ltv = num(row.get("combined_loan_to_value_ratio"))
                if ltv is not None: c["ltv_n"] += 1; c["ltv_hi"] += (ltv > 95)
                dti = row.get("debt_to_income_ratio", "")
                if dti: c["dti_n"] += 1; c["dti_hi"] += (dti in (">60%", "50%-60%") or (dti.isdigit() and int(dti) >= 43))
            if act == "3":
                c["denied"] += 1; c["lmi_denied" if lmi else "nonlmi_denied"] += 1
                reasons = {row.get(f"denial_reason-{i}") for i in range(1, 5)}
                c["den_dti"] += ("1" in reasons); c["den_credit"] += ("3" in reasons); c["den_collateral"] += ("4" in reasons); c["den_cash"] += ("5" in reasons)
            if eth == "Hispanic or Latino": c["h_apps"] += 1; c["h_den"] += (act == "3")
            elif race == "White": c["w_apps"] += 1; c["w_den"] += (act == "3")
            elif race == "Black or African American": c["b_apps"] += 1; c["b_den"] += (act == "3")
            elif race == "Asian": c["a_apps"] += 1; c["a_den"] += (act == "3")
        amts.sort(); incs.sort(); med = lambda L: L[len(L)//2] if L else None
        c.update({"cbsa": cbsa, "name": name, "year": hmda_year, "rows": n, "median_loan_amount": med(amts), "median_applicant_income_k": med(incs)})
        agg_rows.append(c); log(url=url, status=200, rows=n)
        json.dump(agg_rows, open(f"{OUT}/hmda/hmda_msa_aggregates_{hmda_year}.json", "w"))
        time.sleep(0.2)
    if agg_rows:
        with open(f"{OUT}/hmda/hmda_msa_aggregates_{hmda_year}.csv", "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=list(agg_rows[0].keys())); w.writeheader(); w.writerows(agg_rows)
        log(step="hmda_agg", n=len(agg_rows))
log(step="DONE2")
