import { rebuildLedger } from "./lib/llm";
const l = rebuildLedger();
console.log(`ledger rebuilt from cache: $${l.totalUsd.toFixed(3)} ${JSON.stringify(Object.fromEntries(Object.entries(l.byStage).map(([k, v]) => [k, { calls: v.calls, usd: Number(v.usd.toFixed(3)) }])))}`);
