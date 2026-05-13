import { payrollRateConfig, payrollRecords } from "../data.js";
import { calculatePayroll } from "./payroll.js";

export function withCalculations(records = payrollRecords) {
  return records.map((record) => calculatePayroll(record, payrollRateConfig));
}
