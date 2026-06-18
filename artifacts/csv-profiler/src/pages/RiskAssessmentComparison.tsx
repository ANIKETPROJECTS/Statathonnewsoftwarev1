import { pageCache } from "@/pages/RiskAssessmentSingle";
import { Shield, TrendingDown, TrendingUp, Minus, AlertTriangle, CheckCircle, ArrowRight } from "lucide-react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, Cell,
} from "recharts";

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(v: number) { return `${(v * 100).toFixed(1)}%`; }

function riskBadge(risk: number) {
  if (risk > 0.2) return { label: "HIGH", cls: "bg-red-100 text-red-800 border-red-200" };
  if (risk > 0.05) return { label: "MEDIUM", cls: "bg-amber-100 text-amber-800 border-amber-200" };
  return { label: "LOW", cls: "bg-green-100 text-green-800 border-green-200" };
}

type DeltaDir = "good" | "bad" | "neutral";

interface DeltaProps {
  orig: number;
  anon: number;
  lowerIsBetter?: boolean;
  fmt?: (v: number) => string;
}

function Delta({ orig, anon, lowerIsBetter = true, fmt = pct }: DeltaProps) {
  const diff = anon - orig;
  const improved = lowerIsBetter ? diff < -0.0001 : diff > 0.0001;
  const worsened = lowerIsBetter ? diff > 0.0001 : diff < -0.0001;
  const dir: DeltaDir = improved ? "good" : worsened ? "bad" : "neutral";
  const color = dir === "good" ? "text-green-600" : dir === "bad" ? "text-red-600" : "text-gray-400";
  const Icon = dir === "good" ? TrendingDown : dir === "bad" ? TrendingUp : Minus;
  const sign = diff > 0 ? "+" : "";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${color}`}>
      <Icon className="w-3.5 h-3.5" />
      {sign}{fmt(diff)}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function RiskAssessmentComparison() {
  const orig = pageCache.original;
  const anon = pageCache.anonymized;
  const hasOrig = !!orig.result && !!orig.loadedFile;
  const hasAnon = !!anon.result && !!anon.loadedFile;

  if (!hasOrig || !hasAnon) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-teal-600 flex items-center justify-center mx-auto">
          <Shield className="w-7 h-7 text-white" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-black">Comparison Not Ready</h1>
          <p className="text-sm text-gray-500 max-w-sm">
            Run a complete risk assessment on both the <strong>Original</strong> and <strong>Anonymized</strong> files first, then return here to see the comparison.
          </p>
        </div>
        <div className="flex gap-4 mt-2">
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold ${hasOrig ? "border-green-300 bg-green-50 text-green-700" : "border-gray-200 bg-gray-50 text-gray-400"}`}>
            {hasOrig ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            📄 Original File {hasOrig ? "✓ Ready" : "— Not analysed"}
          </div>
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold ${hasAnon ? "border-green-300 bg-green-50 text-green-700" : "border-gray-200 bg-gray-50 text-gray-400"}`}>
            {hasAnon ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            🔒 Anonymized File {hasAnon ? "✓ Ready" : "— Not analysed"}
          </div>
        </div>
      </div>
    );
  }

  const or = orig.result!;
  const ar = anon.result!;
  const origHeaders = new Set(orig.loadedFile!.headers);
  const anonHeaders = new Set(anon.loadedFile!.headers);

  const suppressedCols  = orig.loadedFile!.headers.filter(h => !anonHeaders.has(h));
  const addedCols       = anon.loadedFile!.headers.filter(h => !origHeaders.has(h));
  const commonCols      = orig.loadedFile!.headers.filter(h => anonHeaders.has(h));

  const origQIs = new Set(or.quasiIdentifiers);
  const anonQIs = new Set(ar.quasiIdentifiers);
  const anonymizedQIs = or.quasiIdentifiers.filter(q => !anonQIs.has(q));
  const newQIs        = ar.quasiIdentifiers.filter(q => !origQIs.has(q));
  const sharedQIs     = or.quasiIdentifiers.filter(q => anonQIs.has(q));

  const origBadge = riskBadge(or.reIdRisk);
  const anonBadge = riskBadge(ar.reIdRisk);

  const riskReduced = ar.reIdRisk < or.reIdRisk;
  const overallImproved = riskReduced && ar.uniqueRecordsCount <= or.uniqueRecordsCount;

  const radarData = [
    { metric: "Re-ID Risk",      orig: parseFloat((or.reIdRisk * 100).toFixed(1)),        anon: parseFloat((ar.reIdRisk * 100).toFixed(1)) },
    { metric: "Uniqueness Rate", orig: parseFloat((or.uniquenessRate * 100).toFixed(1)),  anon: parseFloat((ar.uniquenessRate * 100).toFixed(1)) },
    { metric: "High-Risk Rate",  orig: parseFloat((or.highRiskRate * 100).toFixed(1)),    anon: parseFloat((ar.highRiskRate * 100).toFixed(1)) },
  ];

  const barData = [
    { name: "Re-ID Risk %",      Original: parseFloat((or.reIdRisk * 100).toFixed(1)),       Anonymized: parseFloat((ar.reIdRisk * 100).toFixed(1)) },
    { name: "Unique Records %",  Original: parseFloat((or.uniquenessRate * 100).toFixed(1)), Anonymized: parseFloat((ar.uniquenessRate * 100).toFixed(1)) },
    { name: "At-Risk Records %", Original: parseFloat((or.highRiskRate * 100).toFixed(1)),   Anonymized: parseFloat((ar.highRiskRate * 100).toFixed(1)) },
  ];

  const metricRows = [
    {
      label: "Re-ID Risk",
      desc: "Average attacker success rate",
      orig: pct(or.reIdRisk),
      anon: pct(ar.reIdRisk),
      delta: <Delta orig={or.reIdRisk} anon={ar.reIdRisk} lowerIsBetter />,
      better: ar.reIdRisk < or.reIdRisk,
    },
    {
      label: "Unique Records",
      desc: "Singletons (k=1) — 100% identifiable",
      orig: or.uniqueRecordsCount.toLocaleString(),
      anon: ar.uniqueRecordsCount.toLocaleString(),
      delta: <Delta orig={or.uniqueRecordsCount} anon={ar.uniqueRecordsCount} lowerIsBetter fmt={v => v > 0 ? `+${Math.round(v)}` : `${Math.round(v)}`} />,
      better: ar.uniqueRecordsCount < or.uniqueRecordsCount,
    },
    {
      label: "At-Risk Records",
      desc: `Records in groups smaller than k`,
      orig: `${or.atRiskCount.toLocaleString()} (${pct(or.highRiskRate)})`,
      anon: `${ar.atRiskCount.toLocaleString()} (${pct(ar.highRiskRate)})`,
      delta: <Delta orig={or.highRiskRate} anon={ar.highRiskRate} lowerIsBetter />,
      better: ar.atRiskCount < or.atRiskCount,
    },
    {
      label: "Protected Records",
      desc: "Records meeting k-anonymity threshold",
      orig: `${or.protectedCount.toLocaleString()} (${pct(1 - or.highRiskRate)})`,
      anon: `${ar.protectedCount.toLocaleString()} (${pct(1 - ar.highRiskRate)})`,
      delta: <Delta orig={1 - or.highRiskRate} anon={1 - ar.highRiskRate} lowerIsBetter={false} />,
      better: ar.protectedCount > or.protectedCount,
    },
    {
      label: "Avg EC Size",
      desc: "Mean group size sharing same QI values",
      orig: or.avgEcSize.toFixed(2),
      anon: ar.avgEcSize.toFixed(2),
      delta: <Delta orig={or.avgEcSize} anon={ar.avgEcSize} lowerIsBetter={false} fmt={v => v.toFixed(2)} />,
      better: ar.avgEcSize > or.avgEcSize,
    },
    {
      label: "Min-K",
      desc: "Smallest group size (worst-case exposure)",
      orig: or.minK.toString(),
      anon: ar.minK.toString(),
      delta: <Delta orig={or.minK} anon={ar.minK} lowerIsBetter={false} fmt={v => v.toFixed(0)} />,
      better: ar.minK > or.minK,
    },
    {
      label: "Uniqueness Rate",
      desc: "Fraction of records that are singletons",
      orig: pct(or.uniquenessRate),
      anon: pct(ar.uniquenessRate),
      delta: <Delta orig={or.uniquenessRate} anon={ar.uniquenessRate} lowerIsBetter />,
      better: ar.uniquenessRate < or.uniquenessRate,
    },
  ];

  const improvements = metricRows.filter(r => r.better).length;
  const regressions  = metricRows.filter(r => !r.better && r.label !== "Protected Records").length;

  return (
    <div className="space-y-8">

      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center flex-shrink-0">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">⚖️</span>
            <h1 className="text-2xl font-bold text-black">Dataset Comparison</h1>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">Side-by-side privacy risk comparison between original and anonymized datasets</p>
        </div>
      </div>

      {/* Overall verdict banner */}
      <div className={`border rounded-xl p-5 flex items-center gap-4 flex-wrap ${overallImproved ? "border-green-300 bg-green-50" : "border-amber-300 bg-amber-50"}`}>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${overallImproved ? "bg-green-600" : "bg-amber-500"}`}>
          {overallImproved ? <CheckCircle className="w-5 h-5 text-white" /> : <AlertTriangle className="w-5 h-5 text-white" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-bold text-base ${overallImproved ? "text-green-800" : "text-amber-800"}`}>
            {overallImproved
              ? "✅ Anonymization Effective — Privacy risk is reduced"
              : "⚠️ Anonymization Needs Review — Risk metrics have not improved sufficiently"}
          </p>
          <p className={`text-sm mt-0.5 ${overallImproved ? "text-green-700" : "text-amber-700"}`}>
            {improvements} metric{improvements !== 1 ? "s" : ""} improved · {regressions} regression{regressions !== 1 ? "s" : ""} detected ·{" "}
            Re-ID risk changed from <strong>{pct(or.reIdRisk)}</strong> → <strong>{pct(ar.reIdRisk)}</strong>
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">Original</p>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${origBadge.cls}`}>{origBadge.label} RISK</span>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-400" />
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">Anonymized</p>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${anonBadge.cls}`}>{anonBadge.label} RISK</span>
          </div>
        </div>
      </div>

      {/* Column diff */}
      <div className="border border-gray-200 rounded-2xl overflow-hidden">
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
          <h2 className="text-base font-semibold text-black">Column Analysis</h2>
          <p className="text-sm text-gray-500 mt-0.5">What changed between the two datasets at the schema level</p>
        </div>
        <div className="p-6 grid grid-cols-1 gap-5 md:grid-cols-3">

          {/* Suppressed */}
          <div className="border border-red-200 rounded-xl overflow-hidden">
            <div className="bg-red-50 px-4 py-3 border-b border-red-200 flex items-center justify-between">
              <p className="text-sm font-semibold text-red-800">🗑 Suppressed / Removed</p>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">{suppressedCols.length}</span>
            </div>
            <div className="p-3 space-y-1.5 min-h-[80px]">
              {suppressedCols.length === 0
                ? <p className="text-xs text-gray-400 text-center py-4">No columns removed</p>
                : suppressedCols.map(c => (
                  <div key={c} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 border border-red-100">
                    <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                    <span className="font-mono text-xs text-red-800 truncate">{c}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Common */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">✓ Present in Both</p>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">{commonCols.length}</span>
            </div>
            <div className="p-3 space-y-1.5 max-h-64 overflow-y-auto min-h-[80px]">
              {commonCols.map(c => {
                const isOrigQI = origQIs.has(c);
                const isAnonQI = anonQIs.has(c);
                const changed = isOrigQI !== isAnonQI;
                return (
                  <div key={c} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${changed ? "border-amber-200 bg-amber-50" : "border-gray-100 bg-white"}`}>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${changed ? "bg-amber-400" : "bg-gray-300"}`} />
                    <span className={`font-mono text-xs truncate flex-1 ${changed ? "text-amber-800" : "text-gray-700"}`}>{c}</span>
                    {isOrigQI && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-semibold flex-shrink-0">QI</span>}
                    {!isOrigQI && isAnonQI && <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-semibold flex-shrink-0">QI*</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Added */}
          <div className="border border-teal-200 rounded-xl overflow-hidden">
            <div className="bg-teal-50 px-4 py-3 border-b border-teal-200 flex items-center justify-between">
              <p className="text-sm font-semibold text-teal-800">➕ Added / New</p>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">{addedCols.length}</span>
            </div>
            <div className="p-3 space-y-1.5 min-h-[80px]">
              {addedCols.length === 0
                ? <p className="text-xs text-gray-400 text-center py-4">No new columns added</p>
                : addedCols.map(c => (
                  <div key={c} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-teal-50 border border-teal-100">
                    <span className="w-2 h-2 rounded-full bg-teal-400 flex-shrink-0" />
                    <span className="font-mono text-xs text-teal-800 truncate">{c}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* QI Treatment diff */}
        {(anonymizedQIs.length > 0 || newQIs.length > 0) && (
          <div className="border-t border-gray-200 px-6 py-4 bg-amber-50/50">
            <p className="text-sm font-semibold text-amber-900 mb-3">⚠️ Quasi-Identifier Treatment Changed</p>
            <div className="flex flex-wrap gap-3">
              {anonymizedQIs.map(q => (
                <div key={q} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-xs">
                  <span className="font-mono font-semibold text-black">{q}</span>
                  <span className="text-gray-400">was QI in original</span>
                  <ArrowRight className="w-3 h-3 text-amber-500" />
                  <span className="text-amber-700 font-semibold">removed from QIs</span>
                </div>
              ))}
              {newQIs.map(q => (
                <div key={q} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-purple-300 text-xs">
                  <span className="font-mono font-semibold text-black">{q}</span>
                  <span className="text-gray-400">not a QI in original</span>
                  <ArrowRight className="w-3 h-3 text-purple-500" />
                  <span className="text-purple-700 font-semibold">added as QI</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Shared QIs note */}
        {sharedQIs.length > 0 && (
          <div className="border-t border-gray-200 px-6 py-3 bg-gray-50/60">
            <p className="text-xs text-gray-500">
              <span className="font-semibold text-gray-700">Same QIs analysed in both:</span>{" "}
              {sharedQIs.map(q => <code key={q} className="mx-0.5 px-1 py-0.5 rounded bg-gray-100 text-gray-700 text-xs">{q}</code>)}
            </p>
          </div>
        )}
      </div>

      {/* Metrics comparison table */}
      <div className="border border-gray-200 rounded-2xl overflow-hidden">
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
          <h2 className="text-base font-semibold text-black">Privacy Metrics Comparison</h2>
          <p className="text-sm text-gray-500 mt-0.5">Key re-identification risk metrics side by side</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-5 py-3 text-left font-semibold text-gray-500 text-xs uppercase tracking-wide">Metric</th>
                <th className="px-5 py-3 text-center font-semibold text-blue-600 text-xs uppercase tracking-wide">📄 Original</th>
                <th className="px-5 py-3 text-center font-semibold text-purple-600 text-xs uppercase tracking-wide">🔒 Anonymized</th>
                <th className="px-5 py-3 text-center font-semibold text-gray-500 text-xs uppercase tracking-wide">Change</th>
                <th className="px-5 py-3 text-center font-semibold text-gray-500 text-xs uppercase tracking-wide">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {metricRows.map((row, i) => (
                <tr key={i} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-semibold text-black text-sm">{row.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{row.desc}</p>
                  </td>
                  <td className="px-5 py-3.5 text-center font-mono font-bold text-blue-700">{row.orig}</td>
                  <td className="px-5 py-3.5 text-center font-mono font-bold text-purple-700">{row.anon}</td>
                  <td className="px-5 py-3.5 text-center">{row.delta}</td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${row.better ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {row.better ? "✓ Better" : "✗ Worse"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="border border-gray-200 rounded-2xl p-5 bg-white space-y-4">
          <div>
            <p className="font-semibold text-black text-sm">Risk Metrics — Side by Side</p>
            <p className="text-xs text-gray-400 mt-0.5">Lower values are better for all three metrics</p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} margin={{ bottom: 10 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} unit="%" />
              <Tooltip formatter={(v) => [`${v}%`]} />
              <Legend />
              <Bar dataKey="Original" fill="#2563EB" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Anonymized" fill="#7C3AED" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="border border-gray-200 rounded-2xl p-5 bg-white space-y-4">
          <div>
            <p className="font-semibold text-black text-sm">Risk Profile Radar</p>
            <p className="text-xs text-gray-400 mt-0.5">Smaller polygon = better privacy protection</p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10 }} />
              <Radar name="Original" dataKey="orig" stroke="#2563EB" fill="#2563EB" fillOpacity={0.25} />
              <Radar name="Anonymized" dataKey="anon" stroke="#7C3AED" fill="#7C3AED" fillOpacity={0.25} />
              <Legend />
              <Tooltip formatter={(v) => [`${v}%`]} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* EC Size Distribution comparison */}
      <div className="border border-gray-200 rounded-2xl overflow-hidden">
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
          <h2 className="text-base font-semibold text-black">Equivalence Class Distribution</h2>
          <p className="text-sm text-gray-500 mt-0.5">How records are distributed across group sizes — larger groups = better privacy</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-5 py-3 text-left font-semibold text-gray-500 text-xs uppercase tracking-wide">EC Size</th>
                <th className="px-5 py-3 text-center font-semibold text-blue-600 text-xs uppercase tracking-wide">📄 Original Records</th>
                <th className="px-5 py-3 text-center font-semibold text-blue-600 text-xs uppercase tracking-wide">Original %</th>
                <th className="px-5 py-3 text-center font-semibold text-purple-600 text-xs uppercase tracking-wide">🔒 Anonymized Records</th>
                <th className="px-5 py-3 text-center font-semibold text-purple-600 text-xs uppercase tracking-wide">Anonymized %</th>
                <th className="px-5 py-3 text-center font-semibold text-gray-500 text-xs uppercase tracking-wide">Change</th>
              </tr>
            </thead>
            <tbody>
              {or.ecSizeTable.map((oRow, i) => {
                const aRow = ar.ecSizeTable[i];
                const origPctNum = parseFloat(oRow.pct);
                const anonPctNum = aRow ? parseFloat(aRow.pct) : 0;
                const isRiskyBucket = i === 0;
                const improved = isRiskyBucket ? anonPctNum < origPctNum : anonPctNum > origPctNum;
                const diff = anonPctNum - origPctNum;
                return (
                  <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <span className={`text-sm font-semibold ${isRiskyBucket ? "text-red-700" : "text-gray-800"}`}>{oRow.label}</span>
                    </td>
                    <td className="px-5 py-3 text-center font-mono text-blue-700">{oRow.numRecords.toLocaleString()}</td>
                    <td className="px-5 py-3 text-center font-mono text-blue-600">{oRow.pct}</td>
                    <td className="px-5 py-3 text-center font-mono text-purple-700">{aRow?.numRecords.toLocaleString() ?? "—"}</td>
                    <td className="px-5 py-3 text-center font-mono text-purple-600">{aRow?.pct ?? "—"}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold ${improved ? "text-green-600" : diff === 0 ? "text-gray-400" : "text-red-600"}`}>
                        {diff > 0 ? <TrendingUp className="w-3 h-3" /> : diff < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                        {diff > 0 ? "+" : ""}{diff.toFixed(1)}pp
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* L-Diversity / T-Closeness comparison */}
      {(or.lDiversityResults.length > 0 || ar.lDiversityResults.length > 0) && (
        <div className="border border-gray-200 rounded-2xl overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
            <h2 className="text-base font-semibold text-black">L-Diversity & T-Closeness Comparison</h2>
            <p className="text-sm text-gray-500 mt-0.5">Sensitive attribute protection checks in both datasets</p>
          </div>
          <div className="p-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* L-Diversity */}
            <div>
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">L-Diversity</p>
              {[{ rows: or.lDiversityResults, label: "📄 Original", cls: "border-blue-200 bg-blue-50/40" }, { rows: ar.lDiversityResults, label: "🔒 Anonymized", cls: "border-purple-200 bg-purple-50/40" }].map(({ rows, label, cls }) => (
                rows.length > 0 && (
                  <div key={label} className={`border rounded-xl overflow-hidden mb-3 ${cls}`}>
                    <div className="px-4 py-2.5 border-b border-inherit">
                      <p className="text-xs font-semibold text-gray-700">{label}</p>
                    </div>
                    <div className="divide-y divide-inherit">
                      {rows.map(r => (
                        <div key={r.sa} className="px-4 py-2.5 flex items-center justify-between gap-3">
                          <span className="font-mono text-xs text-gray-700 truncate flex-1">{r.sa}</span>
                          <span className="text-xs text-gray-500">Min-L: {r.minL}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.status === "PASS" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{r.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              ))}
              {or.lDiversityResults.length === 0 && ar.lDiversityResults.length === 0 && (
                <p className="text-xs text-gray-400">No sensitive attributes selected in either analysis</p>
              )}
            </div>
            {/* T-Closeness */}
            <div>
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">T-Closeness</p>
              {[{ rows: or.tClosenessResults, label: "📄 Original", cls: "border-blue-200 bg-blue-50/40" }, { rows: ar.tClosenessResults, label: "🔒 Anonymized", cls: "border-purple-200 bg-purple-50/40" }].map(({ rows, label, cls }) => (
                rows.length > 0 && (
                  <div key={label} className={`border rounded-xl overflow-hidden mb-3 ${cls}`}>
                    <div className="px-4 py-2.5 border-b border-inherit">
                      <p className="text-xs font-semibold text-gray-700">{label}</p>
                    </div>
                    <div className="divide-y divide-inherit">
                      {rows.map(r => (
                        <div key={r.sa} className="px-4 py-2.5 flex items-center justify-between gap-3">
                          <span className="font-mono text-xs text-gray-700 truncate flex-1">{r.sa}</span>
                          <span className="text-xs text-gray-500">Max TVD: {r.maxDistance.toFixed(3)}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.status === "PASS" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{r.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              ))}
              {or.tClosenessResults.length === 0 && ar.tClosenessResults.length === 0 && (
                <p className="text-xs text-gray-400">No sensitive attributes selected in either analysis</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Summary recommendations */}
      <div className="border border-teal-200 rounded-2xl overflow-hidden bg-teal-50/30">
        <div className="bg-teal-50 border-b border-teal-200 px-6 py-4">
          <h2 className="text-base font-semibold text-black">Comparison Summary & Recommendations</h2>
          <p className="text-sm text-gray-500 mt-0.5">What the anonymization achieved and what still needs attention</p>
        </div>
        <div className="p-6 space-y-3">
          {suppressedCols.length > 0 && (
            <div className="flex items-start gap-2.5 text-sm">
              <span className="mt-0.5 flex-shrink-0">✅</span>
              <span className="text-gray-700"><strong>{suppressedCols.length} column{suppressedCols.length !== 1 ? "s" : ""} suppressed</strong> from the anonymized dataset: {suppressedCols.map(c => <code key={c} className="mx-0.5 px-1 py-0.5 rounded bg-teal-100 text-teal-800 text-xs">{c}</code>)}. This reduces the attack surface.</span>
            </div>
          )}
          {riskReduced && (
            <div className="flex items-start gap-2.5 text-sm">
              <span className="mt-0.5 flex-shrink-0">✅</span>
              <span className="text-gray-700"><strong>Re-ID risk reduced</strong> from <strong className="text-blue-700">{pct(or.reIdRisk)}</strong> to <strong className="text-purple-700">{pct(ar.reIdRisk)}</strong> — a {pct(Math.abs(ar.reIdRisk - or.reIdRisk))} improvement.</span>
            </div>
          )}
          {ar.uniqueRecordsCount < or.uniqueRecordsCount && (
            <div className="flex items-start gap-2.5 text-sm">
              <span className="mt-0.5 flex-shrink-0">✅</span>
              <span className="text-gray-700"><strong>Singleton records reduced</strong> from <strong className="text-blue-700">{or.uniqueRecordsCount.toLocaleString()}</strong> to <strong className="text-purple-700">{ar.uniqueRecordsCount.toLocaleString()}</strong>. Fewer fully re-identifiable individuals.</span>
            </div>
          )}
          {ar.minK > or.minK && (
            <div className="flex items-start gap-2.5 text-sm">
              <span className="mt-0.5 flex-shrink-0">✅</span>
              <span className="text-gray-700"><strong>Min-K improved</strong> from <strong className="text-blue-700">{or.minK}</strong> to <strong className="text-purple-700">{ar.minK}</strong>. Worst-case exposure is reduced.</span>
            </div>
          )}
          {!riskReduced && (
            <div className="flex items-start gap-2.5 text-sm">
              <span className="mt-0.5 flex-shrink-0">⚠️</span>
              <span className="text-gray-700"><strong>Re-ID risk did not decrease</strong> ({pct(or.reIdRisk)} → {pct(ar.reIdRisk)}). Consider applying stronger k-anonymisation, generalizing more QI columns, or suppressing additional high-risk records.</span>
            </div>
          )}
          {ar.uniqueRecordsCount >= or.uniqueRecordsCount && or.uniqueRecordsCount > 0 && (
            <div className="flex items-start gap-2.5 text-sm">
              <span className="mt-0.5 flex-shrink-0">⚠️</span>
              <span className="text-gray-700"><strong>Singleton records not reduced</strong> — the anonymized dataset still has <strong>{ar.uniqueRecordsCount.toLocaleString()}</strong> unique individuals. Suppress or generalise these rows before release.</span>
            </div>
          )}
          {ar.reIdRisk <= 0.05 && ar.uniqueRecordsCount === 0 && (
            <div className="flex items-start gap-2.5 text-sm">
              <span className="mt-0.5 flex-shrink-0">🎉</span>
              <span className="text-gray-700"><strong>Dataset is ready for release.</strong> Re-ID risk is below 5% and no singleton records remain. The anonymization is effective.</span>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
