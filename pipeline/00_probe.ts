import { files } from "./lib/paths";
import { writeJson, log } from "./lib/io";

const HOSTS: { host: string; url: string; method?: "GET" | "POST"; body?: unknown }[] = [
  { host: "www.ebi.ac.uk", url: "https://www.ebi.ac.uk/gene2phenotype/api/panels/" },
  { host: "ftp.ebi.ac.uk", url: "https://ftp.ebi.ac.uk/pub/databases/gene2phenotype/README" },
  { host: "purl.obolibrary.org", url: "https://purl.obolibrary.org/obo/hp/hpoa/phenotype.hpoa" },
  { host: "github.com", url: "https://github.com/obophenotype/human-phenotype-ontology/releases/latest" },
  { host: "raw.githubusercontent.com", url: "https://raw.githubusercontent.com/obophenotype/human-phenotype-ontology/master/README.md" },
  { host: "clinicaltrials.gov", url: "https://clinicaltrials.gov/api/v2/studies?query.cond=Dravet%20syndrome&pageSize=1" },
  { host: "api.reporter.nih.gov", url: "https://api.reporter.nih.gov/v2/projects/search", method: "POST", body: { criteria: { advanced_text_search: { operator: "and", search_field: "projecttitle", search_text: "epilepsy" }, fiscal_years: [2025] }, limit: 1 } },
  { host: "eutils.ncbi.nlm.nih.gov", url: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=SCN1A&retmax=1&retmode=json&tool=slipstream" },
  { host: "api.openai.com", url: "https://api.openai.com/v1/models" },
];

async function probe(h: (typeof HOSTS)[number]) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const headers: Record<string, string> = { "user-agent": "slipstream/0.1" };
    if (h.host === "api.openai.com" && process.env.OPENAI_API_KEY) headers.authorization = `Bearer ${process.env.OPENAI_API_KEY}`;
    if (h.body) headers["content-type"] = "application/json";
    const res = await fetch(h.url, {
      method: h.method ?? "GET",
      headers,
      body: h.body ? JSON.stringify(h.body) : undefined,
      signal: ctrl.signal,
      redirect: "manual",
    });
    // Read a little so partial downloads of big files do not hang.
    await res.body?.cancel();
    const reachable = res.status < 500 && res.status !== 403 && res.status !== 407;
    return { host: h.host, url: h.url, status: res.status, reachable };
  } catch (e) {
    return { host: h.host, url: h.url, status: null, reachable: false, error: (e as Error).message };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const results = await Promise.all(HOSTS.map(probe));
  const openaiKeySet = Boolean(process.env.OPENAI_API_KEY);
  const ncbiKeySet = Boolean(process.env.NCBI_API_KEY);
  for (const r of results) log("probe", `${r.reachable ? "reachable" : "BLOCKED  "}  ${r.host}  (HTTP ${r.status ?? "none"}${r.error ? ", " + r.error : ""})`);
  log("probe", `OPENAI_API_KEY set: ${openaiKeySet}`);
  log("probe", `NCBI_API_KEY set: ${ncbiKeySet}`);
  const out = { ranAt: new Date().toISOString(), openaiKeySet, ncbiKeySet, hosts: results };
  writeJson(files.probe, out);
  const blocked = results.filter((r) => !r.reachable);
  if (blocked.length || !openaiKeySet) {
    log("probe", `GATE A: ${blocked.length} blocked host(s)${openaiKeySet ? "" : ", OPENAI_API_KEY missing"}. See SPEC section 13.1.`);
    process.exitCode = 2;
  }
}

main();
