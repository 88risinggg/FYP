# Payroll XLSX Upload Flow - Test & Verification

## Overview
HR users can now upload and validate XLSX files containing payroll data. The system validates records and returns calculated payroll values with actual amounts (not zeros).

---

## Flow Summary

### 1. Frontend: HRDashboard
- **New Components Added:**
  - File upload with drag & drop interface
  - Template download button
  - Validation results display table
  - Calculated values display (employee CPF, net pay, etc.)

### 2. Backend: Payroll Routes
- **Endpoint:** `POST /api/payroll/upload`
- **Input:** XLSX/XLS/CSV file
- **Processing:**
  - Parses file and normalizes data
  - Maps all required fields (including allowance)
  - Calculates payroll values
  - Validates records
  - Returns results with actual values

---

## Fixed Issues

### Issue #1: Missing Allowance Field ✅
**Problem:** Allowance field was not included in upload normalization, causing it to be undefined and calculating to 0.

**Solution:** Added allowance mapping in payrollRoutes.js upload endpoint:
```javascript
allowance: Number(record.allowance || payrollRateConfig.defaultAllowanceRate || 0),
```

### Issue #2: Missing Frontend Upload UI ✅
**Problem:** HRDashboard had text saying "Upload an XLSX file first" but no actual upload component.

**Solution:** Added complete upload UI with:
- File input and drag & drop
- Template download
- Results table with all calculated fields
- Validation error display

---

## Calculation Example

### Input Data:
```
staff_id: STF001
staff_name: Siti Staff
payroll_month: May 2026
basic_salary: 3200
services_commission: 300
product_commission: 180
credit_commission: 120
allowance: 100
loan_deduction: 100
other_deduction: 50
working_days: 22
```

### Calculated Output:
```
employee_cpf: 640 (3200 × 20%)
employer_cpf: 544 (3200 × 17%)
total_earnings: 3900 (3200 + 300 + 180 + 120 + 100)
total_deductions: 790 (100 + 50 + 640)
net_pay: 3110 (3900 - 790)
```

**Key Point:** All values are actual amounts, NOT zeros!

---

## Validation Results Display

The upload results table shows:
- ✅ Staff ID, Name, Month
- ✅ Basic Salary (actual value)
- ✅ Total Earnings (sum of all income)
- ✅ Employee CPF (calculated)
- ✅ Employee CPF Rate (%) 
- ✅ Total Deductions (calculated)
- ✅ Net Pay (final amount in bold green)
- ✅ Validation status (errors or ✓ Valid)

---

## Template Format

Download template at: `GET /api/payroll/template`

Required Columns:
- staff_id
- staff_name
- email
- payroll_month
- working_days
- no_pay_leave_days (optional)
- basic_salary
- services_commission (optional)
- product_commission (optional)
- credit_commission (optional)
- allowance (optional - uses default if not provided)
- loan_deduction (optional)
- other_deduction (optional - uses default if not provided)

---

## Testing Checklist

- [ ] HR user can access HRDashboard
- [ ] Download Template button works
- [ ] Can upload XLSX file (drag & drop or click)
- [ ] Upload shows validation results with calculated values
- [ ] Employee CPF shows actual value (not 0)
- [ ] Net Pay shows actual value (not 0)
- [ ] Total Earnings shows actual value (not 0)
- [ ] Validation errors are displayed for invalid records
- [ ] Valid records are saved to payrollRecords
- [ ] Payroll records list updates after upload

---

## Files Modified

### Frontend
- **File:** `PayNivo/frontend/src/pages/HRDashboard.jsx`
- **Changes:**
  - Added state for file upload and results
  - Added `handleFileUpload()` function
  - Added `downloadTemplate()` function
  - Added upload UI section with file input
  - Added validation results display table

### Backend
- **File:** `backend/src/routes/payrollRoutes.js`
- **Changes:**
  - Fixed upload endpoint to include `allowance` field
  - Added `other_deduction` with default fallback
  - Ensures all calculated fields are returned

---

## Configuration

**CPF Rates (from payrollRateConfig):**
- Employee CPF Rate: 20%
- Employer CPF Rate: 17%
- Default Allowance: 100
- Default Deduction: 50

These can be configured via `PUT /api/payroll/rates` endpoint.

---

## Notes

1. **Staff Validation:** All staff must exist in the system before uploading payroll
2. **Calculation Accuracy:** Uses `toMoney()` function to round to 2 decimal places
3. **Allowance Handling:** If not provided in XLSX, uses `defaultAllowanceRate` from config
4. **Other Deduction Handling:** If not provided in XLSX, uses `defaultDeductionRate` from config
