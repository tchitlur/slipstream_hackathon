#!/usr/bin/env python3
"""
Primary-source data fetcher for the PNC x CMU 180DC housing-affordability case.
Runs on a GitHub Actions runner (open internet). Every download is logged to
data/manifest.json with URL, HTTP status, bytes, sha256 and UTC timestamp so
each number on a slide can be traced to the primary file it came from.
Large all-geography files are filtered to CBSA / county rows before commit.
"""
import csv, hashlib, io, json, os, re, sys, time, zipfile, gzip
from datetime import datetime, timezone
import requests, traceback

OUT = "data"
os.makedirs(f"{OUT}/raw", exist_ok=True)
os.makedirs(f"{OUT}/acs", exist_ok=True)
os.makedirs(f"{OUT}/hmda", exist_ok=True)
os.makedirs(f"{OUT}/qcew", exist_ok=True)
MANIFEST = []
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) CMU-180DC-case-research/1.0 (contact: nchitlur@yahoo.com)"}

def log(**kw):
    kw["ts_utc"] = datetime.now(timezone.utc).isoformat()
    MANIFEST.append(kw)
    print(json.dumps(kw), flush=True)
    with open(f"{OUT}/manifest.json", "w") as f:
        json.dump(MANIFEST, f, indent=1)

def sha(b): return hashlib.sha256(b).hexdigest()

def get(url, timeout=600, stream=False, retries=2):
    for i in range(retries + 1):
        try:
            r = requests.get(url, headers=UA, timeout=timeout, stream=stream)
            return r
        except Exception as e:
            if i == retries:
                log(url=url, status="EXC", error=str(e)[:300]); return None
            time.sleep(5)

def save(url, path, min_bytes=200):
    r = get(url)
    if r is None: return False
    ok = r.status_code == 200 and len(r.content) >= min_bytes
    if ok:
        with open(path, "wb") as f: f.write(r.content)
    log(url=url, status=r.status_code, bytes=len(r.content), sha256=sha(r.content) if ok else None, saved=path if ok else None)
    return ok

def first_ok(urls, path, **kw):
    for u in urls:
        if save(u, path, **kw): return u
    return None

def _hook(t, v, tb):
    msg = "".join(traceback.format_exception(t, v, tb))
    log(step="FATAL", error=msg[-3000:])
    with open(f"{OUT}/traceback.txt", "w") as f: f.write(msg)
sys.excepthook = _hook

# ---------------------------------------------------------------- 1. Geography
first_ok(["https://www2.census.gov/programs-surveys/metro-micro/geographies/reference-files/2023/delineation-files/list1_2023.xlsx",
          "https://www2.census.gov/programs-surveys/metro-micro/geographies/reference-files/2020/delineation-files/list1_2020.xls"],
         f"{OUT}/raw/cbsa_delineation.xlsx")
save("https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2023_Gazetteer/2023_Gaz_cbsa_national.zip", f"{OUT}/raw/gaz_cbsa_2023.zip")

# ---------------------------------------------------------------- 2. Population estimates (CBSA, incl. migration components)
save("https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/metro/totals/cbsa-est2024-alldata.csv", f"{OUT}/raw/cbsa-est2024-alldata.csv")
save("https://www2.census.gov/programs-surveys/popest/datasets/2010-2019/metro/totals/cbsa-est2019-alldata.csv", f"{OUT}/raw/cbsa-est2019-alldata.csv")

# Build the MSA list (top N by 2024 population) used for the per-metro API loops
msas = []
try:
    with open(f"{OUT}/raw/cbsa-est2024-alldata.csv", encoding="latin-1") as f:
        for row in csv.DictReader(f):
            if row.get("LSAD") == "Metropolitan Statistical Area":
                msas.append((row["CBSA"], row["NAME"], int(row["POPESTIMATE2024"])))
    msas.sort(key=lambda x: -x[2])
except Exception as e:
    log(step="msa_list", error=str(e))
TOP = msas[:200]
with open(f"{OUT}/msa_top200.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(["cbsa", "name", "pop2024"]); w.writerows(TOP)
log(step="msa_list", n=len(TOP))

# ---------------------------------------------------------------- 3. ACS table-based summary files (filter to CBSA rows: GEO_ID starts with 310)
ACS_BASE = "https://www2.census.gov/programs-surveys/acs/summary_file/{yr}/table-based-SF/data/{per}/"
def acs_filter(yr, per, name):
    url = ACS_BASE.format(yr=yr, per=per) + f"{name}.dat"
    r = get(url, stream=True, timeout=900)
    if r is None or r.status_code != 200:
        log(url=url, status=getattr(r, "status_code", None)); return False
    kept, n = [], 0
    try:
        for i, line in enumerate(r.iter_lines(decode_unicode=True, chunk_size=1 << 20)):
            if line is None: continue
            if isinstance(line, bytes): line = line.decode("utf-8", "replace")
            if i == 0 or line.startswith("310") or line.startswith("0100000US"):
                kept.append(line + "\n")
            n += 1
    except Exception as e:
        log(url=url, status="STREAM_EXC", error=str(e)[:300], rows_seen=n)
    out = f"{OUT}/acs/{name}_cbsa.dat"
    with open(out, "w") as f: f.writelines(kept)
    log(url=url, status=200, rows_total=n, rows_kept=len(kept), saved=out)
    return True

DETAIL = ["b01003", "b19013", "b19001", "b25070", "b25091", "b25074", "b25095", "b25003", "b25004", "b25002",
          "b25077", "b25064", "b08301", "b28002", "c24030", "b25034", "b25024", "b19083", "b25119", "b25118",
          "b01002", "b15003", "b25106", "b25140", "b07201", "b25081", "b25088", "b25071", "b25092", "b25014", "b25010"]
PROFILE = ["dp02", "dp03", "dp04", "dp05"]
acs_year_used = None
for yr in ["2024", "2023"]:
    if acs_filter(yr, "5YRData", f"acsdt5y{yr}-b01003"):
        acs_year_used = yr; break
if acs_year_used:
    for t in DETAIL[1:]:
        acs_filter(acs_year_used, "5YRData", f"acsdt5y{acs_year_used}-{t}")
    for t in PROFILE:
        acs_filter(acs_year_used, "5YRData", f"acsdp5y{acs_year_used}-{t}")
    # 1-year for currency check
    for yr1 in ["2025", "2024"]:
        if acs_filter(yr1, "1YRData", f"acsdp1y{yr1}-dp04"):
            acs_filter(yr1, "1YRData", f"acsdp1y{yr1}-dp03"); break
    # Earlier 5-year for change (try table-based 2019 if it exists)
    for yr0 in ["2019", "2018"]:
        if acs_filter(yr0, "5YRData", f"acsdp5y{yr0}-dp04"):
            acs_filter(yr0, "5YRData", f"acsdp5y{yr0}-dp03"); break
    # table shells / column labels
    for yr in [acs_year_used]:
        first_ok([f"https://www2.census.gov/programs-surveys/acs/summary_file/{yr}/table-based-SF/documentation/ACS{yr}0_Table_Shells.txt",
                  f"https://www2.census.gov/programs-surveys/acs/summary_file/{yr}/table-based-SF/documentation/ACS{yr}_Table_Shells.txt"],
                 f"{OUT}/acs/table_shells_{yr}.txt")
        first_ok([f"https://www2.census.gov/programs-surveys/acs/summary_file/{yr}/table-based-SF/documentation/ACS{yr}0_DP_Table_Shells.txt"],
                 f"{OUT}/acs/dp_table_shells_{yr}.txt")

# ---------------------------------------------------------------- 4. Zillow (ZHVI, ZORI, inventory, bottom-tier)
Z = "https://files.zillowstatic.com/research/public_csvs/"
save(Z + "zhvi/Metro_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv", f"{OUT}/raw/zillow_metro_zhvi_mid.csv")
save(Z + "zhvi/Metro_zhvi_uc_sfrcondo_tier_0.0_0.33_sm_sa_month.csv", f"{OUT}/raw/zillow_metro_zhvi_bottom.csv")
save(Z + "zori/Metro_zori_uc_sfrcondomfr_sm_month.csv", f"{OUT}/raw/zillow_metro_zori.csv")
save(Z + "zori/Metro_zori_uc_sfrcondomfr_sm_sa_month.csv", f"{OUT}/raw/zillow_metro_zori_sa.csv")
save(Z + "invt_fs/Metro_invt_fs_uc_sfrcondo_sm_month.csv", f"{OUT}/raw/zillow_metro_inventory.csv")
save(Z + "new_con_sales_count_raw/Metro_new_con_sales_count_raw_uc_sfrcondo_month.csv", f"{OUT}/raw/zillow_metro_newcon_sales.csv")

# ---------------------------------------------------------------- 5. FHFA HPI
first_ok(["https://www.fhfa.gov/hpi/download/quarterly_datasets/hpi_at_metro.csv",
          "https://www.fhfa.gov/DataTools/Downloads/Documents/HPI/HPI_AT_metro.csv"], f"{OUT}/raw/fhfa_hpi_at_metro.csv")
first_ok(["https://www.fhfa.gov/hpi/download/monthly/hpi_master.csv",
          "https://www.fhfa.gov/DataTools/Downloads/Documents/HPI/HPI_master.csv"], f"{OUT}/raw/fhfa_hpi_master.csv")

# ---------------------------------------------------------------- 6. HUD: FMR, income limits, CHAS, Picture of Subsidized Households, LIHTC
first_ok(["https://www.huduser.gov/portal/datasets/fmr/fmr2027/FY27_FMRs.xlsx",
          "https://www.huduser.gov/portal/datasets/fmr/fmr2026/FY26_FMRs.xlsx",
          "https://www.huduser.gov/portal/datasets/fmr/fmr2025/FY25_FMRs.xlsx"], f"{OUT}/raw/hud_fmr.xlsx")
first_ok(["https://www.huduser.gov/portal/datasets/il/il26/Section8-FY26.xlsx",
          "https://www.huduser.gov/portal/datasets/il/il25/Section8-FY25.xlsx"], f"{OUT}/raw/hud_income_limits.xlsx")
chas = first_ok(["https://www.huduser.gov/portal/datasets/cp/2019thru2023-050-csv.zip",
                 "https://www.huduser.gov/portal/datasets/cp/2018thru2022-050-csv.zip",
                 "https://www.huduser.gov/portal/datasets/cp/2017thru2021-050-csv.zip"], f"{OUT}/raw/hud_chas_county.zip", min_bytes=100000)
if chas:
    try:
        with zipfile.ZipFile(f"{OUT}/raw/hud_chas_county.zip") as z:
            names = z.namelist(); log(step="chas_zip", files=names[:40])
            for n in names:
                base = os.path.basename(n).lower()
                if base in ("table8.csv", "table1.csv", "table15c.csv", "table9.csv", "table18c.csv", "table7.csv") or "dictionary" in base.lower():
                    with z.open(n) as src, open(f"{OUT}/raw/chas_{os.path.basename(n)}", "wb") as dst: dst.write(src.read())
        os.remove(f"{OUT}/raw/hud_chas_county.zip")
    except Exception as e:
        log(step="chas_unzip", error=str(e))
for lvl in ["CBSA", "COUNTY", "STATE", "US"]:
    first_ok([f"https://www.huduser.gov/portal/datasets/pictures/files/{lvl}_2025.xlsx",
              f"https://www.huduser.gov/portal/datasets/pictures/files/{lvl}_2024.xlsx",
              f"https://www.huduser.gov/portal/datasets/pictures/files/{lvl}_2023.xlsx"], f"{OUT}/raw/hud_picture_{lvl.lower()}.xlsx")
if save("https://lihtc.huduser.gov/lihtcpub.zip", f"{OUT}/raw/lihtcpub.zip", min_bytes=100000):
    try:
        with zipfile.ZipFile(f"{OUT}/raw/lihtcpub.zip") as z:
            names = z.namelist(); log(step="lihtc_zip", files=names)
            for n in names:
                if n.lower().endswith(".csv") or n.lower().endswith(".pdf"):
                    with z.open(n) as src, open(f"{OUT}/raw/lihtc_{os.path.basename(n)}", "wb") as dst: dst.write(src.read())
        os.remove(f"{OUT}/raw/lihtcpub.zip")
    except Exception as e:
        log(step="lihtc_unzip", error=str(e))

# ---------------------------------------------------------------- 7. Building permits (Census BPS, metro annual)
for y in ["2019", "2020", "2021", "2022", "2023", "2024", "2025"]:
    save(f"https://www2.census.gov/econ/bps/Metro/ma{y}a.txt", f"{OUT}/raw/bps_metro_{y}a.txt", min_bytes=1000)
    save(f"https://www2.census.gov/econ/bps/Metro/ma{y}y.txt", f"{OUT}/raw/bps_metro_{y}y.txt", min_bytes=1000)

# ---------------------------------------------------------------- 8. Mortgage rates
first_ok(["https://www.freddiemac.com/pmms/docs/PMMS_history.csv",
          "https://fred.stlouisfed.org/graph/fredgraph.csv?id=MORTGAGE30US"], f"{OUT}/raw/mortgage30_history.csv")
save("https://fred.stlouisfed.org/graph/fredgraph.csv?id=MORTGAGE30US", f"{OUT}/raw/fred_mortgage30us.csv")

# ---------------------------------------------------------------- 9. BLS QCEW by MSA (2024 & 2018 annual averages; employment composition + wages)
KEEP_AGG = {"41", "43", "44"}  # MSA total; MSA domain by ownership; MSA supersector by ownership
for year in ["2024", "2018"]:
    rows_out = []
    hdr = None
    for cbsa, name, pop in TOP:
        area = "C" + cbsa[:4]
        url = f"https://data.bls.gov/cew/data/api/{year}/a/area/{area}.csv"
        r = get(url, timeout=120)
        if r is None or r.status_code != 200:
            log(url=url, status=getattr(r, "status_code", None)); continue
        rd = csv.reader(io.StringIO(r.text))
        h = next(rd)
        if hdr is None: hdr = h
        ai = h.index("agglvl_code"); oi = h.index("own_code")
        for row in rd:
            if row[ai] in KEEP_AGG and row[oi] in ("0", "5"):
                rows_out.append(row)
        time.sleep(0.15)
    if hdr:
        with open(f"{OUT}/qcew/qcew_msa_{year}.csv", "w", newline="") as f:
            w = csv.writer(f); w.writerow(hdr); w.writerows(rows_out)
        log(step=f"qcew_{year}", rows=len(rows_out), saved=f"{OUT}/qcew/qcew_msa_{year}.csv")

# ---------------------------------------------------------------- 10. HMDA (FFIEC data browser) per-MSA LAR -> aggregated
# First-lien, site-built, 1-4 unit, home-purchase, owner-occupied-ish filters applied server side where possible.
HM = "https://ffiec.cfpb.gov/v2/data-browser-api/view/csv"
def hmda_year_available(y):
    r = get(f"{HM}?years={y}&msamds=38300&actions_taken=1&loan_purposes=1&lien_statuses=1&construction_methods=1&total_units=1", timeout=180)
    return r is not None and r.status_code == 200 and len(r.content) > 1000
hmda_year = next((y for y in ["2024", "2023"] if hmda_year_available(y)), None)
log(step="hmda_year", year=hmda_year)

def num(x):
    try: return float(x)
    except: return None

if hmda_year:
    agg_rows = []
    for cbsa, name, pop in TOP:
        url = f"{HM}?years={hmda_year}&msamds={cbsa}&actions_taken=1,2,3&loan_purposes=1&lien_statuses=1&construction_methods=1&total_units=1"
        r = get(url, timeout=600)
        if r is None or r.status_code != 200:
            log(url=url, status=getattr(r, "status_code", None)); continue
        rd = csv.DictReader(io.StringIO(r.text))
        n = 0
        c = {"apps": 0, "orig": 0, "denied": 0,
             "lmi_apps": 0, "lmi_orig": 0, "lmi_denied": 0,
             "nonlmi_apps": 0, "nonlmi_denied": 0,
             "lmitract_orig": 0,
             "w_apps": 0, "w_den": 0, "b_apps": 0, "b_den": 0, "h_apps": 0, "h_den": 0, "a_apps": 0, "a_den": 0,
             "den_dti": 0, "den_credit": 0, "den_collateral": 0, "den_other": 0,
             "ltv_hi": 0, "ltv_n": 0, "orig_amt_sum": 0.0, "inc_sum": 0.0, "inc_n": 0, "mfi": None}
        amts = []; incs = []; dtis_hi = 0; dti_n = 0
        for row in rd:
            n += 1
            act = row.get("action_taken")
            inc = num(row.get("income"))
            mfi = num(row.get("ffiec_msa_md_median_family_income"))
            if mfi: c["mfi"] = mfi
            lmi = (inc is not None and mfi) and (inc * 1000 < 0.8 * mfi)
            tract_pct = num(row.get("tract_to_msa_income_percentage"))
            lmitract = tract_pct is not None and tract_pct < 80
            race = row.get("derived_race", ""); eth = row.get("derived_ethnicity", "")
            c["apps"] += 1
            if lmi: c["lmi_apps"] += 1
            else: c["nonlmi_apps"] += 1
            if act == "1":
                c["orig"] += 1
                if lmi: c["lmi_orig"] += 1
                if lmitract: c["lmitract_orig"] += 1
                a = num(row.get("loan_amount"))
                if a: amts.append(a)
                if inc is not None: incs.append(inc)
            if act == "3":
                c["denied"] += 1
                if lmi: c["lmi_denied"] += 1
                else: c["nonlmi_denied"] += 1
                reasons = {row.get(f"denial_reason-{i}") for i in range(1, 5)}
                if "1" in reasons: c["den_dti"] += 1
                if "3" in reasons: c["den_credit"] += 1
                if "4" in reasons: c["den_collateral"] += 1
            if eth == "Hispanic or Latino":
                c["h_apps"] += 1; c["h_den"] += (act == "3")
            elif race == "White":
                c["w_apps"] += 1; c["w_den"] += (act == "3")
            elif race == "Black or African American":
                c["b_apps"] += 1; c["b_den"] += (act == "3")
            elif race == "Asian":
                c["a_apps"] += 1; c["a_den"] += (act == "3")
            ltv = num(row.get("combined_loan_to_value_ratio"))
            if ltv is not None and act == "1":
                c["ltv_n"] += 1; c["ltv_hi"] += (ltv > 95)
            dti = row.get("debt_to_income_ratio", "")
            if act == "1" and dti:
                dti_n += 1
                if dti in (">60%", "50%-60%") or dti.isdigit() and int(dti) >= 43: dtis_hi += 1
        amts.sort(); incs.sort()
        med = lambda L: L[len(L)//2] if L else None
        c.update({"cbsa": cbsa, "name": name, "year": hmda_year, "rows": n,
                  "median_loan_amount": med(amts), "median_applicant_income_k": med(incs),
                  "dti_ge43_share": (dtis_hi / dti_n) if dti_n else None})
        agg_rows.append(c)
        log(url=url, status=200, rows=n)
        time.sleep(0.2)
    if agg_rows:
        keys = list(agg_rows[0].keys())
        with open(f"{OUT}/hmda/hmda_msa_aggregates_{hmda_year}.csv", "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=keys); w.writeheader(); w.writerows(agg_rows)
        log(step="hmda_agg", n=len(agg_rows), saved=f"{OUT}/hmda/hmda_msa_aggregates_{hmda_year}.csv")

log(step="DONE")
