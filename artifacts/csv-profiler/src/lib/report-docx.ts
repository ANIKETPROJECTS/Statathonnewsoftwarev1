import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle,
  ShadingType, Header, Footer, PageNumber, NumberFormat,
  TableLayoutType, convertInchesToTwip, VerticalAlign,
} from "docx";
import type { ProsecutorResult } from "./prosecutor-attack";

// ── Palette ───────────────────────────────────────────────────────────────────

const INDIGO   = "4338CA";
const RED      = "DC2626";
const AMBER    = "D97706";
const GREEN    = "16A34A";
const GRAY_50  = "F9FAFB";
const GRAY_100 = "F3F4F6";
const GRAY_200 = "E5E7EB";
const WHITE    = "FFFFFF";
const BLACK    = "111827";

function riskColorHex(reIdRisk: number) {
  if (reIdRisk > 0.2)  return { hex: RED,   label: "HIGH",   shade: "FEF2F2" };
  if (reIdRisk > 0.05) return { hex: AMBER, label: "MEDIUM", shade: "FFFBEB" };
  return                        { hex: GREEN, label: "LOW",    shade: "F0FDF4" };
}

function linkScoreColorHex(ls: number): string {
  if (ls >= 0.5) return RED;
  if (ls >= 0.2) return AMBER;
  return GREEN;
}

// ── Small helpers ─────────────────────────────────────────────────────────────

const FONT = "Calibri";
const CODE_FONT = "Courier New";

function pt(n: number) { return n * 2; }     // half-points
function cm(n: number) { return convertInchesToTwip(n / 2.54); }

function run(text: string, opts: {
  bold?: boolean; italic?: boolean; color?: string; size?: number;
  font?: string; break?: boolean;
} = {}): TextRun {
  return new TextRun({
    text,
    bold: opts.bold,
    italics: opts.italic,
    color: opts.color ?? BLACK,
    size: pt(opts.size ?? 10),
    font: opts.font ?? FONT,
    break: opts.break ? 1 : 0,
  });
}

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel], color = BLACK) {
  return new Paragraph({
    heading: level,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, bold: true, color, size: pt(level === HeadingLevel.HEADING_1 ? 18 : level === HeadingLevel.HEADING_2 ? 14 : 12), font: FONT })],
  });
}

function para(children: TextRun[], opts: { spacing?: { before?: number; after?: number }; align?: typeof AlignmentType[keyof typeof AlignmentType] } = {}) {
  return new Paragraph({
    spacing: { before: 60, after: 60, ...opts.spacing },
    alignment: opts.align,
    children,
  });
}

function divider() {
  return new Paragraph({
    spacing: { before: 120, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: GRAY_200, space: 6 } },
    children: [],
  });
}

function kpiTable(items: { label: string; value: string; danger: boolean }[]) {
  const cell = (label: string, value: string, danger: boolean) => new TableCell({
    width: { size: 25, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.SOLID, color: danger ? "FEF2F2" : "F0FDF4" },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: danger ? RED : GREEN },
      bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
    },
    margins: { top: cm(0.15), bottom: cm(0.15), left: cm(0.2), right: cm(0.2) },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({ children: [run(label, { size: 8, color: "6B7280" })] }),
      new Paragraph({ children: [run(value, { bold: true, size: 18, color: danger ? RED : GREEN })] }),
    ],
  });

  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ children: items.map(i => cell(i.label, i.value, i.danger)) })],
  });
}

function sectionHeader(text: string, emoji = "") {
  return new Paragraph({
    spacing: { before: 280, after: 80 },
    shading: { type: ShadingType.SOLID, color: "EEF2FF" },
    indent: { left: cm(0.2), right: cm(0.2) },
    children: [
      run(emoji ? emoji + "  " : "", { size: 12 }),
      run(text, { bold: true, size: 12, color: INDIGO }),
    ],
  });
}

function styledTable(headers: string[], rows: (string | { text: string; color?: string; bold?: boolean })[][], headerColor = INDIGO) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map(h => new TableCell({
      shading: { type: ShadingType.SOLID, color: headerColor },
      margins: { top: cm(0.1), bottom: cm(0.1), left: cm(0.15), right: cm(0.15) },
      children: [new Paragraph({ children: [run(h, { bold: true, color: WHITE, size: 9 })] })],
    })),
  });

  const dataRows = rows.map((row, ri) => new TableRow({
    children: row.map(cell => {
      const isObj = typeof cell === "object";
      const text = isObj ? cell.text : cell;
      const color = isObj ? (cell.color ?? BLACK) : BLACK;
      const bold = isObj ? (cell.bold ?? false) : false;
      return new TableCell({
        shading: { type: ShadingType.SOLID, color: ri % 2 === 0 ? WHITE : GRAY_50 },
        margins: { top: cm(0.08), bottom: cm(0.08), left: cm(0.15), right: cm(0.15) },
        children: [new Paragraph({ children: [run(text, { size: 9, color, bold, font: text.match(/^\d/) ? CODE_FONT : FONT })] })],
      });
    }),
  }));

  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  });
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function generateProsecutorReportDocx(
  result: ProsecutorResult,
  fileLabel: string,
  fileName: string,
  kThreshold: number,
  lThreshold: number,
  tThreshold: number,
  samplePct: number,
  selectedSAs: string[],
): Promise<Blob> {
  const rc = riskColorHex(result.reIdRisk);
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  const children: (Paragraph | Table)[] = [];

  // ── Cover / Title block ────────────────────────────────────────────────────

  children.push(
    new Paragraph({ spacing: { before: 0, after: 40 }, children: [run("AIRAVATA DEA", { bold: true, size: 10, color: INDIGO })] }),
    new Paragraph({
      spacing: { before: 0, after: 20 },
      children: [run("Privacy Risk Assessment Report", { bold: true, size: 22, color: BLACK })],
    }),
    new Paragraph({
      spacing: { before: 0, after: 60 },
      children: [run("Prosecutor Attack  ·  NISTIR 8053 Framework", { italic: true, size: 11, color: "6B7280" })],
    }),
    new Paragraph({
      spacing: { before: 0, after: 160 },
      border: { bottom: { style: BorderStyle.THICK, size: 6, color: INDIGO, space: 8 } },
      children: [],
    }),
  );

  // Meta table
  children.push(
    new Table({
      layout: TableLayoutType.FIXED,
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        ["Dataset file", fileName],
        ["File type", fileLabel === "original" ? "Original (pre-anonymization)" : "Anonymized (post-anonymization)"],
        ["Generated on", `${dateStr} at ${timeStr}`],
        ["Methodology", "NISTIR 8053 — De-Identification of Personal Health Information"],
        ["Platform", "Airavata DEA — Convert, Anonymize & Decrypt"],
      ].map(([k, v]) => new TableRow({
        children: [
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: GRAY_100 },
            margins: { top: cm(0.1), bottom: cm(0.1), left: cm(0.15), right: cm(0.15) },
            children: [new Paragraph({ children: [run(k, { bold: true, size: 9, color: "6B7280" })] })],
          }),
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            margins: { top: cm(0.1), bottom: cm(0.1), left: cm(0.15), right: cm(0.15) },
            children: [new Paragraph({ children: [run(v, { size: 9 })] })],
          }),
        ],
      })),
    }),
    new Paragraph({ spacing: { before: 200, after: 0 }, children: [] }),
  );

  // ── §1 — Executive Summary Banner ─────────────────────────────────────────

  children.push(sectionHeader("1. Executive Summary", "🎯"));

  children.push(
    new Paragraph({
      spacing: { before: 100, after: 80 },
      shading: { type: ShadingType.SOLID, color: rc.shade },
      border: {
        left: { style: BorderStyle.THICK, size: 12, color: rc.hex, space: 8 },
      },
      indent: { left: cm(0.3), right: cm(0.3) },
      children: [
        run(`RISK LEVEL: ${rc.label}  ·  Re-ID Risk: ${(result.reIdRisk * 100).toFixed(1)}%  ·  Min-K: ${result.minK}`, { bold: true, size: 12, color: rc.hex }),
      ],
    }),
    para([
      run(
        `An attacker who already knows a specific person is in this dataset can correctly re-identify ` +
        `${(result.reIdRisk * 100).toFixed(1)}% of individuals using only the quasi-identifiers ` +
        `(${result.quasiIdentifiers.join(", ")}). ` +
        `Out of ${result.totalRecords.toLocaleString()} records analysed, ` +
        `${result.uniqueRecordsCount.toLocaleString()} record${result.uniqueRecordsCount !== 1 ? "s are" : " is"} completely unique — ` +
        `identifiable with 100% certainty.`
      ),
    ], { spacing: { before: 80, after: 80 } }),
  );

  // ── §2 — Configuration ────────────────────────────────────────────────────

  children.push(divider(), sectionHeader("2. Analysis Configuration", "⚙"));
  children.push(
    styledTable(
      ["Parameter", "Value", "Description"],
      [
        ["Quasi-Identifiers", result.quasiIdentifiers.join(", "), "Columns used to form equivalence classes"],
        ["Sensitive Attributes", selectedSAs.length > 0 ? selectedSAs.join(", ") : "(none selected)", "Columns evaluated for L-Diversity & T-Closeness"],
        ["k-Threshold", String(kThreshold), "Minimum acceptable equivalence class size"],
        ["l-Threshold", String(lThreshold), "Minimum distinct SA values per EC"],
        ["t-Threshold", String(tThreshold), "Maximum allowable Total Variation Distance"],
        ["Sample Percentage", `${samplePct}%`, "Fraction of dataset used for analysis"],
        ["Records Analysed", result.totalRecords.toLocaleString(), "Actual row count after sampling"],
      ],
    ),
  );

  // ── §3 — Key Metrics ──────────────────────────────────────────────────────

  children.push(divider(), sectionHeader("3. Key Risk Metrics", "📊"));
  children.push(
    kpiTable([
      { label: "Re-Identification Risk", value: `${(result.reIdRisk * 100).toFixed(1)}%`, danger: result.reIdRisk > 0.2 },
      { label: "Unique Records (k=1)", value: result.uniqueRecordsCount.toLocaleString(), danger: result.uniqueRecordsCount > 0 },
      { label: "Average EC Size", value: result.avgEcSize.toFixed(1), danger: result.avgEcSize < kThreshold },
      { label: "Minimum-K", value: String(result.minK), danger: result.minK < kThreshold },
    ]),
    new Paragraph({ spacing: { before: 80, after: 80 }, children: [] }),
    styledTable(
      ["Metric", "Value", "Threshold", "Status"],
      [
        [
          "Re-ID Risk (avg link score)",
          `${(result.reIdRisk * 100).toFixed(1)}%`,
          "< 5%",
          { text: result.reIdRisk <= 0.05 ? "✓ PASS" : "✗ FAIL", color: result.reIdRisk <= 0.05 ? GREEN : RED, bold: true },
        ],
        [
          "Uniqueness Rate",
          `${(result.uniquenessRate * 100).toFixed(1)}%`,
          "0%",
          { text: result.uniquenessRate === 0 ? "✓ PASS" : "✗ FAIL", color: result.uniquenessRate === 0 ? GREEN : RED, bold: true },
        ],
        [
          "At-Risk Records",
          `${result.atRiskCount.toLocaleString()} (${(result.highRiskRate * 100).toFixed(1)}%)`,
          "0",
          { text: result.atRiskCount === 0 ? "✓ PASS" : "✗ FAIL", color: result.atRiskCount === 0 ? GREEN : RED, bold: true },
        ],
        [
          "Minimum-K (worst EC)",
          String(result.minK),
          `≥ ${kThreshold}`,
          { text: result.minK >= kThreshold ? "✓ PASS" : "✗ FAIL", color: result.minK >= kThreshold ? GREEN : RED, bold: true },
        ],
        [
          "Protected Records",
          `${result.protectedCount.toLocaleString()} (${((result.protectedCount / result.totalRecords) * 100).toFixed(1)}%)`,
          "100%",
          { text: result.protectedCount === result.totalRecords ? "✓ PASS" : "⚠ PARTIAL", color: result.protectedCount === result.totalRecords ? GREEN : AMBER, bold: true },
        ],
      ] as Parameters<typeof styledTable>[1],
    ),
  );

  // ── §4 — EC Size Distribution ─────────────────────────────────────────────

  children.push(divider(), sectionHeader("4. Equivalence Class Size Distribution", "📋"));
  children.push(
    para([run("The table below shows how records are distributed across equivalence class size buckets. Smaller EC sizes indicate higher re-identification risk.", { size: 9, color: "6B7280" })]),
    styledTable(
      ["EC Size Bucket", "# Equivalence Classes", "# Records", "% of Dataset", "Avg Risk %"],
      result.ecSizeTable.map((row, i) => [
        { text: row.label, bold: true, color: [RED, "#EA580C", AMBER, "2563EB", GREEN][i] ?? BLACK },
        row.numECs.toLocaleString(),
        row.numRecords.toLocaleString(),
        row.pct,
        `${result.histogram[i]?.risk ?? 0}%`,
      ]) as Parameters<typeof styledTable>[1],
    ),
  );

  // ── §5 — Link Score Distribution ──────────────────────────────────────────

  children.push(divider(), sectionHeader("5. Link Score Distribution", "🔗"));
  children.push(
    para([run("Link score = 1 / (EC size). A score of 1.0 means 100% attacker certainty (singleton record). Lower scores mean better privacy protection.", { size: 9, color: "6B7280" })]),
    styledTable(
      ["Score Range", "# Records", "% of Total", "Attacker Certainty"],
      [
        ["1.00 (certain)", , , "100% — singleton record"],
        ["0.51–0.99 (high)", , , "More likely correct than not"],
        ["0.26–0.50 (medium)", , , "Coin-flip or worse"],
        ["0.01–0.25 (low)", , , "Attacker has < 25% chance"],
        ["0.00 (safe)", , , "Effectively anonymous"],
      ].map((row, i) => {
        const count = result.linkScoreDistribution[i]?.count ?? 0;
        const pct = result.totalRecords > 0 ? ((count / result.totalRecords) * 100).toFixed(1) + "%" : "0%";
        return [
          { text: row[0] as string, bold: true },
          count.toLocaleString(),
          pct,
          row[3] as string,
        ];
      }) as Parameters<typeof styledTable>[1],
    ),
  );

  // ── §6 — Top 10 Most Vulnerable Records ───────────────────────────────────

  children.push(divider(), sectionHeader("6. Top 10 Most Vulnerable Records", "⚠"));
  children.push(
    para([run("These records present the highest re-identification risk and should be suppressed or generalized before dataset release.", { size: 9, color: "6B7280" })]),
    styledTable(
      ["Rank", "QI Combination", "Link Score", "EC Size", "Reason"],
      result.topVulnerable.map((tv, i) => [
        { text: String(i + 1), bold: true },
        tv.qiCombo.length > 60 ? tv.qiCombo.slice(0, 60) + "…" : tv.qiCombo,
        { text: tv.linkScore.toFixed(4), color: linkScoreColorHex(tv.linkScore), bold: true },
        String(tv.ecSize),
        tv.reason,
      ]) as Parameters<typeof styledTable>[1],
    ),
  );

  // ── §7 — Attack Simulation Narrative ──────────────────────────────────────

  if (result.topVulnerableRecord) {
    const tvr = result.topVulnerableRecord;
    children.push(divider(), sectionHeader("7. Attack Simulation Narrative", "🎯"));
    children.push(
      para([run(`The following is a step-by-step simulation of the Prosecutor Attack using real values from the most vulnerable record (Row #${tvr.rowIdx}).`, { size: 9, color: "6B7280" })]),
      new Paragraph({
        spacing: { before: 80, after: 20 },
        shading: { type: ShadingType.SOLID, color: "FFF7ED" },
        border: { left: { style: BorderStyle.THICK, size: 8, color: AMBER, space: 6 } },
        indent: { left: cm(0.3) },
        children: [run("Step 1 — Attacker's Knowledge", { bold: true, size: 10, color: AMBER })],
      }),
      para([run(`The attacker knows a specific person is in this dataset. From a public record they know: ${Object.entries(tvr.qiValues).map(([k, v]) => `${k} = "${v}"`).join(", ")}.`, { size: 9 })]),
      new Paragraph({
        spacing: { before: 80, after: 20 },
        shading: { type: ShadingType.SOLID, color: "FFF7ED" },
        border: { left: { style: BorderStyle.THICK, size: 8, color: AMBER, space: 6 } },
        indent: { left: cm(0.3) },
        children: [run("Step 2 — Database Query", { bold: true, size: 10, color: AMBER })],
      }),
      para([run(`Attacker queries: "Show records where ${Object.entries(tvr.qiValues).map(([k, v]) => `${k}="${v}"`).join(" AND ")}". Result: ${tvr.ecSize} record${tvr.ecSize !== 1 ? "s" : ""} found.`, { size: 9, font: CODE_FONT })]),
      new Paragraph({
        spacing: { before: 80, after: 20 },
        shading: { type: ShadingType.SOLID, color: "FFF7ED" },
        border: { left: { style: BorderStyle.THICK, size: 8, color: AMBER, space: 6 } },
        indent: { left: cm(0.3) },
        children: [run("Step 3 — Re-identification", { bold: true, size: 10, color: AMBER })],
      }),
      para([
        run(
          tvr.ecSize === 1
            ? `Since only 1 record matches, the attacker has identified this person with 100% certainty.`
            : `With ${tvr.ecSize} records matching, the attacker has a ${(tvr.linkScore * 100).toFixed(1)}% chance of correctly identifying this individual.`,
          { size: 9 }
        ),
      ]),
      new Paragraph({
        spacing: { before: 80, after: 20 },
        shading: { type: ShadingType.SOLID, color: "FFF7ED" },
        border: { left: { style: BorderStyle.THICK, size: 8, color: AMBER, space: 6 } },
        indent: { left: cm(0.3) },
        children: [run("Step 4 — Scale", { bold: true, size: 10, color: AMBER })],
      }),
      para([
        run(
          `This attack was possible (link score ≥ 0.5) on ${result.recordTable.filter(r => r.linkScore >= 0.5).length.toLocaleString()} out of ${result.totalRecords.toLocaleString()} records. ` +
          `${(result.uniquenessRate * 100).toFixed(1)}% of the dataset is fully re-identifiable.`,
          { size: 9 }
        ),
      ]),
    );
  } else {
    children.push(divider(), sectionHeader("7. Attack Simulation Narrative", "🎯"));
    children.push(para([run("No vulnerable record found — all records are protected.", { size: 9, color: GREEN })]));
  }

  // ── §8 — L-Diversity ──────────────────────────────────────────────────────

  if (result.lDiversityResults.length > 0) {
    children.push(divider(), sectionHeader("8. L-Diversity Check", "🔍"));
    children.push(
      para([run("L-Diversity (Machanavajjhala et al., 2007) requires each equivalence class to contain at least l distinct values for every sensitive attribute. This guards against homogeneity attacks.", { size: 9, color: "6B7280" })]),
      styledTable(
        ["Sensitive Attribute", "Min Distinct Values", "Violating ECs", "Total ECs", "Records in Violation", "Status"],
        result.lDiversityResults.map(r => [
          { text: r.sa, bold: true },
          String(r.minL),
          String(r.violatingEcs),
          String(r.totalEcs),
          `${r.violatingRecordPct}%`,
          { text: r.status === "PASS" ? "✓ PASS" : "✗ FAIL", color: r.status === "PASS" ? GREEN : RED, bold: true },
        ]) as Parameters<typeof styledTable>[1],
      ),
    );
  }

  // ── §9 — T-Closeness ──────────────────────────────────────────────────────

  if (result.tClosenessResults.length > 0) {
    children.push(divider(), sectionHeader("9. T-Closeness Check (TVD)", "📐"));
    children.push(
      para([run("T-Closeness (Li et al., 2007) requires the SA distribution within each EC to be within t Total Variation Distance of the global distribution. TVD ∈ [0, 1]: 0 = identical, 1 = completely disjoint.", { size: 9, color: "6B7280" })]),
      styledTable(
        ["Sensitive Attribute", "Max TVD", "Threshold", "Violating ECs", "Total ECs", "Status"],
        result.tClosenessResults.map(r => [
          { text: r.sa, bold: true },
          r.maxDistance.toFixed(4),
          String(tThreshold),
          String(r.violatingEcs),
          String(r.totalEcs),
          { text: r.status === "PASS" ? "✓ PASS" : "✗ FAIL", color: r.status === "PASS" ? GREEN : RED, bold: true },
        ]) as Parameters<typeof styledTable>[1],
      ),
    );
  }

  // ── §10 — Recommendations ─────────────────────────────────────────────────

  children.push(divider(), sectionHeader("10. Recommendations", "📝"));
  result.recommendations.forEach((rec, i) => {
    children.push(
      new Paragraph({
        spacing: { before: 60, after: 40 },
        numbering: undefined,
        indent: { left: cm(0.3) },
        children: [
          run(`${i + 1}.  `, { bold: true, size: 9, color: INDIGO }),
          run(rec, { size: 9 }),
        ],
      }),
    );
  });

  // ── §11 — Record-Level Data (capped at 500 rows) ──────────────────────────

  const maxRows = 500;
  const tableRows = result.recordTable.slice(0, maxRows);
  children.push(divider(), sectionHeader(`11. Record-Level Attack Data (first ${Math.min(maxRows, result.totalRecords).toLocaleString()} of ${result.totalRecords.toLocaleString()} records)`, "📄"));
  children.push(
    para([run("Link Score = 1 / EC size. UNIQUELY_IDENTIFIABLE = singleton (k=1). LOW_PROTECTION = EC size < k-threshold. PROTECTED = EC size ≥ k-threshold.", { size: 8, color: "6B7280" })]),
    styledTable(
      ["Row #", ...result.quasiIdentifiers, "EC Size", "Link Score", "Status"],
      tableRows.map(r => {
        const st = r.linkScore === 1.0 ? "UNIQUELY_IDENTIFIABLE" : r.atRisk ? "LOW_PROTECTION" : "PROTECTED";
        const stColor = r.linkScore === 1.0 ? RED : r.atRisk ? AMBER : GREEN;
        return [
          String(r.rowIdx),
          ...result.quasiIdentifiers.map(qi => r.qiValues[qi] ?? ""),
          String(r.ecSize),
          { text: r.linkScore.toFixed(4), color: linkScoreColorHex(r.linkScore), bold: r.linkScore >= 0.5 },
          { text: st, color: stColor, bold: r.linkScore === 1.0 },
        ] as Parameters<typeof styledTable>[1][number];
      }),
    ),
  );

  // ── §12 — References ──────────────────────────────────────────────────────

  children.push(divider(), sectionHeader("12. Methodology & References", "📚"));
  [
    "NISTIR 8053 — De-Identification of Personal Health Information. NIST, 2015.",
    "Sweeney, L. (2002). k-Anonymity: A Model for Protecting Privacy. International Journal of Uncertainty, Fuzziness and Knowledge-Based Systems.",
    "Machanavajjhala, A. et al. (2007). l-Diversity: Privacy Beyond k-Anonymity. ACM Transactions on Knowledge Discovery from Data.",
    "Li, N. et al. (2007). t-Closeness: Privacy Beyond k-Anonymity and l-Diversity. IEEE ICDE.",
    "El Emam, K. et al. (2011). A Systematic Review of Re-Identification Attacks on Health Data. PLOS ONE.",
  ].forEach(ref => {
    children.push(para([run("• " + ref, { size: 8, color: "6B7280" })], { spacing: { before: 30, after: 30 } }));
  });

  // ── Assemble document ─────────────────────────────────────────────────────

  const doc = new Document({
    numbering: { config: [] },
    styles: {
      default: {
        document: {
          run: { font: FONT, size: pt(10), color: BLACK },
          paragraph: { spacing: { after: 80 } },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: cm(2.5), bottom: cm(2.5), left: cm(2.5), right: cm(2) },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: GRAY_200, space: 6 } },
              children: [
                run("AIRAVATA DEA  —  Privacy Risk Assessment  ·  Prosecutor Attack", { size: 8, color: "9CA3AF" }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              border: { top: { style: BorderStyle.SINGLE, size: 1, color: GRAY_200, space: 6 } },
              children: [
                run(`Generated by Airavata DEA  ·  ${dateStr}  ·  Page `, { size: 8, color: "9CA3AF" }),
                new TextRun({ children: [PageNumber.CURRENT], size: pt(8), color: "9CA3AF", font: FONT }),
                run(" of ", { size: 8, color: "9CA3AF" }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: pt(8), color: "9CA3AF", font: FONT }),
              ],
            }),
          ],
        }),
      },
      children,
    }],
  });

  const buf = await Packer.toBlob(doc);
  return buf;
}
