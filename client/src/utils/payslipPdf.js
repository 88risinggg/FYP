import { getStoredSession } from "../services/sessionService.js";

function payslipId(payslip) {
  return payslip?.payslip_id || payslip?.payroll_id || payslip?.id;
}

export async function fetchConfiguredPayslipPdf(payslip) {
  const id = payslipId(payslip);
  if (!id) throw new Error("Payslip ID is missing.");

  const token = getStoredSession()?.token;
  const response = await fetch(
    `${import.meta.env.VITE_API_BASE_URL || ""}/api/payslips/${id}/pdf`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || "Unable to generate the configured payslip.");
  }
  return response.blob();
}

export async function printConfiguredPayslip(payslip) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) throw new Error("Allow pop-ups to print the payslip.");
  printWindow.document.write("<title>Preparing payslip...</title><p style='font-family:sans-serif;padding:24px'>Preparing the configured payslip...</p>");

  try {
    const blob = await fetchConfiguredPayslipPdf(payslip);
    const url = URL.createObjectURL(blob);
    printWindow.location.replace(url);
    // The browser PDF viewer owns printing. Keep the object URL alive while it loads.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    printWindow.close();
    throw error;
  }
}
