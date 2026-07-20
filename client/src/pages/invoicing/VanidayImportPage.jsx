import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload, CheckCircle2, AlertCircle, FileText, Loader2,
  ArrowRight, Download, X, Eye
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
  const fileInputRef = useRef(null);

  async function handleFileUpload(e) {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setError("");
    setParsing(true);

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

  async function handleValidate() {
    setValidating(true);
    setError("");
    try {
      const result = await validateVanidayImport(rows, "DD/MM/YYYY");
      setValidationResult(result);
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
      const result = await processVanidayImport(rows, "DD/MM/YYYY");
      setImportResult(result);
      setStep(3);
      // Notify parent to refresh invoice list
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
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Vaniday Transaction Import</h1>
        <p className="text-sm text-gray-500 mt-1">
          Import Vaniday booking data to automatically generate customer invoices
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
              i <= step ? "bg-purple-600 text-white" : "bg-gray-200 text-gray-500"
            }`}>{i + 1}</div>
            <span className={`text-sm ${i <= step ? "text-gray-900 font-medium" : "text-gray-400"}`}>{label}</span>
            {i < STEPS.length - 1 && <ArrowRight className="w-4 h-4 text-gray-300" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Step 0: Upload */}
      {step === 0 && (
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-purple-400 transition-colors">
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">Upload Vaniday CSV or Excel File</h3>
          <p className="text-sm text-gray-500 mb-6">
            Upload the booking transaction file exported from Vaniday.<br />
            Supports .csv, .xlsx, and .xls formats.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={parsing}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50"
          >
            {parsing ? <><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Parsing...</> : "Select File"}
          </button>
        </div>
      )}

      {/* Step 1: File Parsed - Show Preview */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-600" />
                <span className="font-medium">{file?.name}</span>
                <span className="text-sm text-gray-500">({rows.length} records)</span>
              </div>
              <button onClick={handleReset} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-sm text-gray-600 mb-2">
              Detected columns: <span className="font-mono text-xs">{headers.join(", ")}</span>
            </div>
            <div className="overflow-x-auto max-h-64 overflow-y-auto border rounded">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-left text-gray-600 font-medium">#</th>
                    {headers.slice(0, 8).map(h => (
                      <th key={h} className="px-2 py-1.5 text-left text-gray-600 font-medium truncate max-w-[120px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 10).map((row, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1 text-gray-400">{i + 1}</td>
                      {headers.slice(0, 8).map(h => (
                        <td key={h} className="px-2 py-1 truncate max-w-[120px]">{row[h] || "-"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 10 && <p className="text-xs text-gray-400 mt-2">Showing first 10 of {rows.length} records</p>}
          </div>
          <button
            onClick={handleValidate}
            disabled={validating}
            className="px-6 py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50"
          >
            {validating ? <><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Validating...</> : "Validate Data"}
          </button>
        </div>
      )}

      {/* Step 2: Validation Report */}
      {step === 2 && validationResult && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{validationResult.totalRecords}</div>
              <div className="text-xs text-gray-500">Total Records</div>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-emerald-600">{validationResult.readyForInvoice}</div>
              <div className="text-xs text-gray-500">Ready for Invoice</div>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-amber-600">{validationResult.duplicateRecords}</div>
              <div className="text-xs text-gray-500">Duplicates (Skipped)</div>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">{validationResult.conflictRecords}</div>
              <div className="text-xs text-gray-500">Conflicts</div>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-red-600">{validationResult.invalidRecords}</div>
              <div className="text-xs text-gray-500">Invalid</div>
            </div>
          </div>

          {/* Valid Groups (invoices to be created) */}
          {validationResult.validGroups?.length > 0 && (
            <div className="bg-white border rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Invoices to Generate ({validationResult.validGroups.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Order ID</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Customer</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Shop</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">Amount</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-600">Items</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-600">Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validationResult.validGroups.map((group, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-2 font-mono text-xs">{group.orderId}</td>
                        <td className="px-3 py-2">{group.customerName}</td>
                        <td className="px-3 py-2 text-gray-600">{group.shopTitle}</td>
                        <td className="px-3 py-2 text-right font-medium">S${group.totalAmount?.toFixed(2)}</td>
                        <td className="px-3 py-2 text-center">{group.lineItemCount}</td>
                        <td className="px-3 py-2 text-center">
                          {group.alreadyPaid
                            ? <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs font-medium">Paid</span>
                            : <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">Unpaid</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Errors */}
          {validationResult.errors?.length > 0 && (
            <div className="bg-white border border-red-200 rounded-lg p-4">
              <h3 className="font-medium text-red-700 mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Validation Errors ({validationResult.errors.length})
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {validationResult.errors.map((err, i) => (
                  <div key={i} className="text-sm bg-red-50 rounded p-2">
                    <span className="font-medium">Row {err.row_number}:</span>{" "}
                    {err.errors.join("; ")}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Duplicates */}
          {validationResult.duplicates?.length > 0 && (
            <div className="bg-white border border-amber-200 rounded-lg p-4">
              <h3 className="font-medium text-amber-700 mb-2">Duplicates Skipped ({validationResult.duplicates.length})</h3>
              <div className="text-sm text-amber-600 space-y-1">
                {validationResult.duplicates.map((d, i) => (
                  <div key={i}>Row {d.row_number} — {d.reason}</div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={handleReset} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
              Start Over
            </button>
            {validationResult.readyForInvoice > 0 && (
              <button
                onClick={handleProcess}
                disabled={processing}
                className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                {processing
                  ? <><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Generating Invoices...</>
                  : `Generate ${validationResult.readyForInvoice} Invoice(s)`
                }
              </button>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Import Complete */}
      {step === 3 && importResult && (
        <div className="bg-white border rounded-xl p-8 text-center">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Import Successful!</h2>
          <p className="text-gray-600 mb-6">{importResult.message}</p>

          <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mb-6">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-gray-900">{importResult.totalCreated}</div>
              <div className="text-xs text-gray-500">Invoices Created</div>
            </div>
            <div className="bg-emerald-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-emerald-600">{importResult.paidCount}</div>
              <div className="text-xs text-gray-500">Already Paid</div>
            </div>
            <div className="bg-amber-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-amber-600">{importResult.unpaidCount}</div>
              <div className="text-xs text-gray-500">Awaiting Payment</div>
            </div>
          </div>

          {importResult.invoices?.length > 0 && (
            <div className="text-left max-w-2xl mx-auto mb-6">
              <h3 className="font-medium text-gray-700 mb-2">Created Invoices:</h3>
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
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
                        <td className="px-3 py-2 font-mono text-xs font-medium text-purple-700">{inv.invoiceId}</td>
                        <td className="px-3 py-2">{inv.customerName}</td>
                        <td className="px-3 py-2 text-gray-500">{inv.shopTitle}</td>
                        <td className="px-3 py-2 text-right">S${inv.totalAmount?.toFixed(2)}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            inv.status === "Paid" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-700"
                          }`}>{inv.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <button onClick={handleReset} className="px-6 py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700">
            Import Another File
          </button>
          <button
            onClick={() => navigate("/dashboard/invoicing/finance/invoices")}
            className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 ml-3"
          >
            <Eye className="w-4 h-4 inline mr-2" />
            View Generated Invoices
          </button>
        </div>
      )}
    </div>
  );
}
