import { useState, useRef, useCallback } from "react";
import { Upload, FileText, FileSpreadsheet, CheckCircle2, AlertTriangle, X, ArrowRight, Download, Eye } from "lucide-react";
import { parseLayoutFile, convertFWFToCSV, type FieldDef, type ParseLayoutResult } from "@/lib/fwf-parser";

type Step = "layout" | "data" | "done";

export default function FWFConverter() {
  const [step, setStep] = useState<Step>("layout");

  // Layout state
  const [layoutResult, setLayoutResult] = useState<ParseLayoutResult | null>(null);
  const [layoutFileName, setLayoutFileName] = useState<string>("");
  const [layoutError, setLayoutError] = useState<string>("");

  // Data file state
  const [dataFileName, setDataFileName] = useState<string>("");
  const [dataText, setDataText] = useState<string>("");
  const [dataLineCount, setDataLineCount] = useState<number>(0);
  const [dataError, setDataError] = useState<string>("");

  // Conversion state
  const [progress, setProgress] = useState<number>(0);
  const [converting, setConverting] = useState<boolean>(false);
  const [csvBlob, setCsvBlob] = useState<Blob | null>(null);
  const [outputName, setOutputName] = useState<string>("");

  // Preview
  const [preview, setPreview] = useState<string[][]>([]);

  const layoutInputRef = useRef<HTMLInputElement>(null);
  const dataInputRef = useRef<HTMLInputElement>(null);

  // ── Layout file upload ────────────────────────────────────────────────────

  const handleLayoutFile = useCallback(async (file: File) => {
    setLayoutError("");
    setLayoutResult(null);
    setLayoutFileName(file.name);
    try {
      const result = await parseLayoutFile(file);
      if (result.fields.length === 0) {
        setLayoutError(
          result.warnings.join(" ") ||
          "No fields found. Make sure your layout file has columns: Field_Name, Byte Position (Start), Byte Position (End)."
        );
        return;
      }
      setLayoutResult(result);
      setStep("data");
    } catch (e) {
      setLayoutError(`Failed to parse layout file: ${(e as Error).message}`);
    }
  }, []);

  // ── Data file upload ──────────────────────────────────────────────────────

  const handleDataFile = useCallback(async (file: File) => {
    setDataError("");
    setDataFileName(file.name);
    setDataText("");
    setDataLineCount(0);
    setCsvBlob(null);
    setPreview([]);

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
    setDataText(text);
    setDataLineCount(lines.length);

    // Build preview (first 5 rows)
    if (layoutResult) {
      const prev = lines.slice(0, 5).map((line) =>
        layoutResult.fields.map((f) => {
          const s = f.start - 1;
          const e = f.end;
          return line.padEnd(e).substring(s, e).trim();
        })
      );
      setPreview(prev);
    }

    const baseName = file.name.replace(/\.[^.]+$/, "");
    setOutputName(`${baseName}.csv`);
    setStep("done");
  }, [layoutResult]);

  // ── Convert ───────────────────────────────────────────────────────────────

  const handleConvert = useCallback(async () => {
    if (!layoutResult || !dataText) return;
    setConverting(true);
    setProgress(0);
    setCsvBlob(null);
    try {
      const blob = await convertFWFToCSV(dataText, layoutResult.fields, {
        onProgress: setProgress,
      });
      setCsvBlob(blob);
      setProgress(100);
    } catch (e) {
      setDataError(`Conversion failed: ${(e as Error).message}`);
    } finally {
      setConverting(false);
    }
  }, [layoutResult, dataText]);

  const handleDownload = () => {
    if (!csvBlob) return;
    const url = URL.createObjectURL(csvBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = outputName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setStep("layout");
    setLayoutResult(null);
    setLayoutFileName("");
    setLayoutError("");
    setDataFileName("");
    setDataText("");
    setDataLineCount(0);
    setDataError("");
    setProgress(0);
    setCsvBlob(null);
    setPreview([]);
  };

  const fields: FieldDef[] = layoutResult?.fields ?? [];

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        <StepBadge n={1} label="Upload layout" active={step === "layout"} done={step !== "layout"} />
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
        <StepBadge n={2} label="Upload data file" active={step === "data"} done={step === "done"} />
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
        <StepBadge n={3} label="Convert & download" active={step === "done"} done={false} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr]">
        {/* ── Step 1: Layout file ─────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Step 1 — Layout file</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Excel (.xlsx) or CSV with columns: Field_Name, Byte Position (Start), Byte Position (End)
              </p>
            </div>
            {layoutResult && (
              <button onClick={handleReset} className="text-xs text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {!layoutResult ? (
            <>
              <DropZone
                accept=".xlsx,.xls,.csv"
                icon={<FileSpreadsheet className="w-8 h-8 text-primary" />}
                label="Drop layout file here"
                sublabel="Excel or CSV"
                inputRef={layoutInputRef}
                onFile={handleLayoutFile}
              />
              {layoutError && <ErrorBox message={layoutError} />}
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>
                  <strong>{layoutFileName}</strong> — {fields.length} fields detected
                  {layoutResult.sheetName ? ` (sheet: ${layoutResult.sheetName})` : ""}
                </span>
              </div>
              {layoutResult.warnings.length > 0 && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  {layoutResult.warnings.join(" ")}
                </div>
              )}
              {/* Layout preview table */}
              <div className="overflow-auto max-h-72 rounded-lg border border-border">
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="px-2 py-1.5 text-left border-r border-border/50 text-muted-foreground font-medium">#</th>
                      <th className="px-2 py-1.5 text-left border-r border-border/50 text-muted-foreground font-medium">Variable</th>
                      <th className="px-2 py-1.5 text-left border-r border-border/50 text-muted-foreground font-medium">Full Name</th>
                      <th className="px-2 py-1.5 text-center border-r border-border/50 text-muted-foreground font-medium">Start</th>
                      <th className="px-2 py-1.5 text-center border-r border-border/50 text-muted-foreground font-medium">End</th>
                      <th className="px-2 py-1.5 text-center text-muted-foreground font-medium">Len</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((f) => (
                      <tr key={f.srlNo} className="border-t border-border/40 hover:bg-muted/30">
                        <td className="px-2 py-1 text-muted-foreground font-mono border-r border-border/30">{f.srlNo}</td>
                        <td className="px-2 py-1 font-medium text-foreground border-r border-border/30 whitespace-nowrap">{f.varName}</td>
                        <td className="px-2 py-1 text-muted-foreground border-r border-border/30">{f.fullName}</td>
                        <td className="px-2 py-1 text-center font-mono border-r border-border/30">{f.start}</td>
                        <td className="px-2 py-1 text-center font-mono border-r border-border/30">{f.end}</td>
                        <td className="px-2 py-1 text-center font-mono">{f.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── Step 2 + 3: Data file & Convert ─────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Step 2 — Fixed-width data file</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              The .TXT file containing the actual records
            </p>
          </div>

          {!layoutResult ? (
            <div className="flex flex-col items-center justify-center h-40 text-center text-sm text-muted-foreground border-2 border-dashed border-border/40 rounded-xl">
              Complete Step 1 first
            </div>
          ) : (
            <>
              {!dataFileName ? (
                <DropZone
                  accept=".txt,.dat,.fwf,.data"
                  icon={<FileText className="w-8 h-8 text-primary" />}
                  label="Drop fixed-width data file here"
                  sublabel=".TXT, .DAT or any fixed-width file"
                  inputRef={dataInputRef}
                  onFile={handleDataFile}
                />
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>
                      <strong>{dataFileName}</strong> — {dataLineCount.toLocaleString()} records
                    </span>
                    <button
                      onClick={() => {
                        setDataFileName("");
                        setDataText("");
                        setDataLineCount(0);
                        setCsvBlob(null);
                        setPreview([]);
                        setStep("data");
                      }}
                      className="ml-auto text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Data preview */}
                  {preview.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Eye className="w-3.5 h-3.5" />
                        Preview (first {preview.length} rows)
                      </div>
                      <div className="overflow-auto max-h-48 rounded-lg border border-border text-[11px]">
                        <table className="w-full border-collapse">
                          <thead className="bg-muted sticky top-0">
                            <tr>
                              {fields.map((f) => (
                                <th key={f.srlNo} className="px-2 py-1 text-left font-medium text-muted-foreground border-r border-border/50 whitespace-nowrap">
                                  {f.varName}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {preview.map((row, ri) => (
                              <tr key={ri} className="border-t border-border/40">
                                {row.map((cell, ci) => (
                                  <td key={ci} className="px-2 py-1 font-mono border-r border-border/30 whitespace-nowrap">
                                    {cell || <span className="text-muted-foreground/40 italic">—</span>}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {dataError && <ErrorBox message={dataError} />}

                  {/* Convert button / progress / download */}
                  {!csvBlob ? (
                    <button
                      onClick={handleConvert}
                      disabled={converting}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity"
                    >
                      {converting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                          Converting… {progress}%
                        </>
                      ) : (
                        <>
                          <ArrowRight className="w-4 h-4" />
                          Convert {dataLineCount.toLocaleString()} records to CSV
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                        <CheckCircle2 className="w-4 h-4" />
                        Conversion complete — {dataLineCount.toLocaleString()} rows, {fields.length} columns
                      </div>
                      <button
                        onClick={handleDownload}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Download {outputName}
                      </button>
                      <button
                        onClick={() => {
                          setCsvBlob(null);
                          setDataFileName("");
                          setDataText("");
                          setDataLineCount(0);
                          setPreview([]);
                          setStep("data");
                        }}
                        className="w-full text-xs text-muted-foreground hover:text-foreground text-center"
                      >
                        Convert another file with the same layout
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepBadge({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs font-medium ${active ? "text-primary" : done ? "text-emerald-600" : "text-muted-foreground"}`}>
      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
        active ? "bg-primary text-primary-foreground" : done ? "bg-emerald-100 text-emerald-600" : "bg-muted text-muted-foreground"
      }`}>
        {done ? <CheckCircle2 className="w-3 h-3" /> : n}
      </span>
      {label}
    </div>
  );
}

function DropZone({
  accept,
  icon,
  label,
  sublabel,
  inputRef,
  onFile,
}: {
  accept: string;
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFile: (f: File) => void;
}) {
  const [dragging, setDragging] = useState(false);
  return (
    <div
      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
        dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-accent/20"
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
      onClick={() => inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
      <div className="flex flex-col items-center gap-3">
        <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">{icon}</div>
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>
        </div>
        <span className="text-xs px-3 py-1.5 rounded-lg border border-border bg-background text-muted-foreground">
          Browse
        </span>
      </div>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
      {message}
    </div>
  );
}
