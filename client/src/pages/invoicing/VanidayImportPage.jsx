import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload, CheckCircle2, AlertCircle, FileText, Loader2,
  ArrowRight, X, Eye, Info, RefreshCw
} from "lucide-react";
import {
  parseVanidayFile,
  validateVanidayImport,
  processVanidayImport
} from "../../services/invoiceService.js";

const STEPS = ["Upload", "Validate", "Review", "Import"];

export default function VanidayImportPage({ onImportComplete }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [validating, setValidating] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState("");
  const [allowReimport, setAllowReimport] = useState(false);
  const fileInputRef = useRef(null);

  async function handleFileUpload(e) {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setError("");
    setParsing(true);
    setAllowReimport(false);

    try {
      const result = await parseVanidayFile(selectedFile);
      setRows(result.rows || []);
      setHeaders(result.headers || []);
      setStep(1);
    } catch (err) {
      setError(err.message || "Failed to parse file");
    } finally {
      setParsing(false);
    }
  }

  async function handleValidate(reimport = false) {
    setValidating(true);
    setError("");
    try {
      const result = await validateVanidayImport(rows, "DD/MM/YYYY", reimport);
      setValidationResult(result);
      setAllowReimport(reimport);
      setStep(2);
    } catch (err) {
      setError(err.message || "Validation failed");
    } finally {
      setValidating(false);
    }
  }

  async function handleProcess() {
    setProcessing(true);
    setError("");
    try {
      const result = await processVanidayImport(rows, "DD/MM/YYYY", allowReimport);
      if (!result.success) {
        setError(result.message || "Import failed");
        return;
      }
      setImportResult(result);
      setStep(3);
      if (onImportComplete) onImportComplete(result);
    } catch (err) {
      setError(err.message || "Import failed");
    } finally {
      setProcessing(false);
    }
  }

  function handleReset() {
    setStep(0);
    setFile(null);
    setRows([]);
    setHeaders([]);
    setValidationResult(null);
    setImportResult(null);
    setError("");
    setAllowReimport(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const alreadyImportedCount = validationResult?.alreadyImportedCount || 0;
  const readyCount = validationResult?.readyForInvoice || 0;
  const allAlreadyImported = alreadyImportedCount > 0 && readyCount === 0 &&
    (validationResult?.invalidRecords || 0) === 0;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#251E1F]">Vaniday Transaction Import</h1>
        <p className="text-sm text-[#7B6660] mt-1">
          Import Vaniday booking data to automatically generate customer invoices
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-colors ${
              i < step ? "bg-emerald-500 text-white" :
              i === step ? "bg-[#2D7C83] text-white" :
              "bg-[#FFF6F2] text-[#7B6660]"
            }`}>
              {i < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`text-sm ${i <= step ? "text-[#251E1F] font-medium" : "text-[#7B6660]"}`}>{label}</span>
            {i < STEPS.length - 1 && <ArrowRight className="w-4 h-4 text-[#7B6660]" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-[#FDD9CD] border border-[#FDD9CD] rounded-lg flex items-start gap-2 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Step 0: Upload ── */}
      {step === 0 && (
        <div
          className="border-2 border-dashed border-[#F0D2CA] rounded-xl p-12 text-center hover:border-[#2D7C83] transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) handleFileUpload({ target: { files: e.dataTransfer.files } });
          }}
        >
          <Upload className="w-12 h-12 text-[#7B6660] mx-auto mb-4" />
          <h3 className="text-lg font-medium text-[#251E1F] mb-2">Upload Vaniday CSV or Excel File</h3>
          <p className="text-sm text-[#7B6660] mb-6">
            Upload the booking transaction file exported from Vaniday.<br />
            Supports <strong>.csv</strong>, <strong>.xlsx</strong>, and <strong>.xls</strong> formats.
          </p>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} className="hidden" />
          <button type="button" disabled={parsing}
            className="px-6 py-3 bg-[#2D7C83] text-white rounded-lg font-medium hover:bg-[#2D7C83] disabled:opacity-50 pointer-events-none">
            {parsing ? <><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Parsing...</> : "Select File"}
          </button>
        </div>
      )}

      {/* ── Step 1: Preview ── */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#2D7C83]" />
                <span className="font-medium">{file?.name}</span>
                <span className="text-sm text-[#7B6660]">({rows.length} records)</span>
              </div>
              <button type="button" onClick={handleReset} className="text-[#7B6660] hover:text-[#7B6660]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mb-3 p-2 bg-[#FFF6F2] rounded text-xs text-[#7B6660]">
              <span className="font-semibold">Detected columns ({headers.length}):</span>{" "}
              <span className="font-mono">{headers.join(", ")}</span>
            </div>
            <div className="overflow-x-auto max-h-64 overflow-y-auto border rounded">
              <table className="w-full text-xs">
                <thead className="bg-[#FFF6F2] sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-left text-[#7B6660]">#</th>
                    {headers.slice(0, 8).map(h => (
                      <th key={h} className="px-2 py-1.5 text-left text-[#7B6660] truncate max-w-[100px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 10).map((row, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1 text-[#7B6660]">{i + 1}</td>
                      {headers.slice(0, 8).map(h => (
                        <td key={h} className="px-2 py-1 truncate max-w-[100px]">{row[h] || "—"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 10 && <p className="text-xs text-[#7B6660] mt-2">Showing first 10 of {rows.length} records</p>}
          </div>
          <button type="button" onClick={() => handleValidate(false)} disabled={validating || rows.length === 0}
            className="px-6 py-2.5 bg-[#2D7C83] text-white rounded-lg font-medium hover:bg-[#2D7C83] disabled:opacity-50">
            {validating ? <><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Validating...</> : `Validate ${rows.length} Records`}
          </button>
        </div>
      )}

      {/* ── Step 2: Validation Report ── */}
      {step === 2 && validationResult && (
        <div className="space-y-4">

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-[#251E1F]">{validationResult.totalRecords}</div>
              <div className="text-xs text-[#7B6660]">Total Records</div>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className={`text-2xl font-bold ${readyCount > 0 ? "text-emerald-600" : "text-[#7B6660]"}`}>{readyCount}</div>
              <div className="text-xs text-[#7B6660]">Ready for Invoice</div>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className={`text-2xl font-bold ${alreadyImportedCount > 0 ? "text-[#2D7C83]" : "text-[#7B6660]"}`}>{alreadyImportedCount}</div>
              <div className="text-xs text-[#7B6660]">Already Imported</div>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-amber-600">{validationResult.duplicateRecords || 0}</div>
              <div className="text-xs text-[#7B6660]">Duplicates</div>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-[#E87562]">{validationResult.conflictRecords || 0}</div>
              <div className="text-xs text-[#7B6660]">Conflicts</div>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className={`text-2xl font-bold ${(validationResult.invalidRecords || 0) > 0 ? "text-red-600" : "text-[#7B6660]"}`}>
                {validationResult.invalidRecords || 0}
              </div>
              <div className="text-xs text-[#7B6660]">Invalid</div>
            </div>
          </div>

          {/* ── Already Imported Banner ── */}
          {allAlreadyImported && (
            <div className="bg-[#FFF6F2] border border-[#F0D2CA] rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-[#2D7C83] shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-[#2D7C83]">
                    All {alreadyImportedCount} record{alreadyImportedCount > 1 ? "s" : ""} already imported
                  </h3>
                  <p className="text-sm text-[#2D7C83] mt-1">
                    These order IDs already exist in the database from a previous import.
                    You can re-import them to create new invoices, or start over with a different file.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleValidate(true)}
                    disabled={validating}
                    className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-[#2D7C83] text-white rounded-lg text-sm font-medium hover:bg-[#2D7C83] disabled:opacity-50"
                  >
                    {validating
                      ? <><Loader2 className="w-4 h-4 animate-spin" />Re-validating...</>
                      : <><RefreshCw className="w-4 h-4" />Re-import Anyway</>
                    }
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Already imported list */}
          {alreadyImportedCount > 0 && !allAlreadyImported && (
            <div className="bg-[#FFF6F2] border border-[#F0D2CA] rounded-lg p-4">
              <h3 className="font-medium text-[#2D7C83] mb-2 flex items-center gap-2">
                <Info className="w-4 h-4" />
                Already Imported ({alreadyImportedCount} skipped)
              </h3>
              <div className="text-sm text-[#2D7C83] space-y-1 max-h-24 overflow-y-auto">
                {(validationResult.alreadyImportedList || []).map((d, i) => (
                  <div key={i}>Order {String(d.orderId || "")} — {String(d.reason || "")}</div>
                ))}
              </div>
            </div>
          )}

          {/* Valid Groups table */}
          {validationResult.validGroups?.length > 0 && (
            <div className="bg-white border rounded-lg p-4">
              <h3 className="font-medium text-[#251E1F] mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Invoices to Generate ({validationResult.validGroups.length})
                {allowReimport && (
                  <span className="ml-2 px-2 py-0.5 bg-[#FDD9CD] text-[#E87562] rounded text-xs font-medium">Re-import mode</span>
                )}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#FFF6F2]">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-[#7B6660]">Order ID</th>
                      <th className="px-3 py-2 text-left font-medium text-[#7B6660]">Customer</th>
                      <th className="px-3 py-2 text-left font-medium text-[#7B6660]">Shop</th>
                      <th className="px-3 py-2 text-right font-medium text-[#7B6660]">Amount</th>
                      <th className="px-3 py-2 text-center font-medium text-[#7B6660]">Items</th>
                      <th className="px-3 py-2 text-center font-medium text-[#7B6660]">Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validationResult.validGroups.map((group, i) => (
                      <tr key={i} className="border-t hover:bg-[#FFF6F2]">
                        <td className="px-3 py-2 font-mono text-xs">{group.orderId}</td>
                        <td className="px-3 py-2">{group.customerName}</td>
                        <td className="px-3 py-2 text-[#7B6660]">{group.shopTitle || "—"}</td>
                        <td className="px-3 py-2 text-right font-medium">S${Number(group.totalAmount || 0).toFixed(2)}</td>
                        <td className="px-3 py-2 text-center">{group.lineItemCount}</td>
                        <td className="px-3 py-2 text-center">
                          {group.alreadyPaid
                            ? <span className="px-2 py-0.5 bg-[#FFF6F2] text-emerald-700 rounded text-xs font-medium">Paid</span>
                            : <span className="px-2 py-0.5 bg-[#FDD9CD] text-amber-700 rounded text-xs font-medium">Unpaid</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Validation Errors */}
          {validationResult.errors?.length > 0 && (
            <div className="bg-white border border-[#FDD9CD] rounded-lg p-4">
              <h3 className="font-medium text-red-700 mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Validation Errors ({validationResult.errors.length} rows)
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {validationResult.errors.map((err, i) => (
                  <div key={i} className="text-sm bg-[#FDD9CD] rounded p-2">
                    <span className="font-medium text-red-800">Row {err.row_number}:</span>{" "}
                    <span className="text-red-700">
                      {Array.isArray(err.errors)
                        ? err.errors.map(e => typeof e === "string" ? e : JSON.stringify(e)).join("; ")
                        : typeof err.errors === "string"
                          ? err.errors
                          : JSON.stringify(err.errors)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={handleReset}
              className="px-4 py-2 border border-[#F0D2CA] rounded-lg text-[#251E1F] hover:bg-[#FFF6F2] text-sm font-medium">
              Start Over
            </button>
            {readyCount > 0 && (
              <button type="button" onClick={handleProcess} disabled={processing}
                className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-600 disabled:opacity-50 text-sm inline-flex items-center gap-2">
                {processing
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Generating Invoices...</>
                  : <><CheckCircle2 className="w-4 h-4" />Generate {readyCount} Invoice{readyCount > 1 ? "s" : ""}</>
                }
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Step 3: Import Complete ── */}
      {step === 3 && importResult && (
        <div className="bg-white border rounded-xl p-8 text-center">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[#251E1F] mb-2">Import Successful!</h2>
          <p className="text-[#7B6660] mb-6">{importResult.message}</p>

          <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mb-6">
            <div className="bg-[#FFF6F2] rounded-lg p-3">
              <div className="text-2xl font-bold text-[#251E1F]">{importResult.totalCreated}</div>
              <div className="text-xs text-[#7B6660]">Invoices Created</div>
            </div>
            <div className="bg-[#FFF6F2] rounded-lg p-3">
              <div className="text-2xl font-bold text-emerald-600">{importResult.paidCount}</div>
              <div className="text-xs text-[#7B6660]">Already Paid</div>
            </div>
            <div className="bg-[#FDD9CD] rounded-lg p-3">
              <div className="text-2xl font-bold text-amber-600">{importResult.unpaidCount}</div>
              <div className="text-xs text-[#7B6660]">Awaiting Payment</div>
            </div>
          </div>

          {importResult.invoices?.length > 0 && (
            <div className="text-left max-w-2xl mx-auto mb-6">
              <h3 className="font-medium text-[#251E1F] mb-2">Created Invoices:</h3>
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-[#FFF6F2]">
                    <tr>
                      <th className="px-3 py-2 text-left">Invoice #</th>
                      <th className="px-3 py-2 text-left">Customer</th>
                      <th className="px-3 py-2 text-left">Shop</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResult.invoices.map((inv, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-2 font-mono text-xs font-medium text-[#2D7C83]">{inv.invoiceId}</td>
                        <td className="px-3 py-2">{inv.customerName}</td>
                        <td className="px-3 py-2 text-[#7B6660]">{inv.shopTitle || "—"}</td>
                        <td className="px-3 py-2 text-right">S${Number(inv.totalAmount || 0).toFixed(2)}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            inv.status === "Paid" ? "bg-[#FFF6F2] text-emerald-700" : "bg-[#FFF6F2] text-[#251E1F]"
                          }`}>{inv.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-3">
            <button type="button" onClick={handleReset}
              className="px-6 py-2.5 border border-[#F0D2CA] text-[#251E1F] rounded-lg font-medium hover:bg-[#FFF6F2]">
              Import Another File
            </button>
            <button type="button" onClick={() => navigate("/dashboard/invoicing/finance/invoices")}
              className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-600 inline-flex items-center gap-2">
              <Eye className="w-4 h-4" />
              View Generated Invoices
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
