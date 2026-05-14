# HR - Finance - Staff Payroll Workflow

## Complete Monthly Payroll Processing Workflow

### Overview
This document outlines the complete workflow for monthly payroll processing in PayNivo, involving HR (data entry), Finance (approval), and Staff (viewing).

---

## 📊 Step-by-Step Workflow

### **STEP 1️⃣: HR Downloads Excel Template**
**Who:** HR  
**What:** Download the monthly payroll Excel template  
**How:** 
- Navigate to HR Dashboard
- Click "📥 Download Template for This Month"
- Template includes columns: staff_id, staff_name, email, payroll_month, working_days, no_pay_leave_days, basic_salary, services_commission, product_commission, credit_commission, allowance, loan_deduction, other_deduction

**Endpoint:** `GET /api/payroll/template`

---

### **STEP 2️⃣: HR Fills & Uploads Excel File**
**Who:** HR  
**What:** Fill in staff payroll data for the current month and upload  
**How:**
- Fill the Excel template with staff data
- Drag & drop file to upload area OR click to browse
- System validates file format (XLSX, XLS, CSV)
- Backend automatically calculates:
  - Employee CPF = basic_salary × 20%
  - Employer CPF = basic_salary × 17%
  - Total Earnings = basic_salary + commissions + allowance
  - Total Deductions = loan_deduction + other_deduction + employee_cpf
  - Net Pay = total_earnings - total_deductions

**Endpoint:** `POST /api/payroll/upload`

**Response includes:**
- Validation results for each record
- Calculated payroll values (not zeros)
- Error messages for invalid records

**Validation checks:**
- Staff must exist in system
- Email required
- Basic salary required (cannot be negative)
- Working days must be 0-31

---

### **STEP 3️⃣: HR Generates Payslips**
**Who:** HR  
**What:** Create payslips from validated payroll records  
**How:**
- Navigate to "📊 Uploaded Payroll Records" section
- Review validated records
- Click "Generate" button for each record
- System creates payslip PDF and stores it
- Payslip status set to "⏳ Pending Finance Approval"

**Endpoint:** `POST /api/payroll/payslips/:payrollId/generate`

**Payslip Status Flow:**
```
pending → approved → sent
  ↓
rejected (if Finance rejects)
```

---

### **STEP 4️⃣: Finance Reviews & Approves**
**Who:** Finance  
**What:** Manually review and approve payslips  
**How:**
- Finance logs into Finance Dashboard
- Views "⏳ Pending Finance Approval" section
- Reviews each payslip
- Approves (changes status to "approved") OR Rejects (status: "rejected")
- Can add comments/reasons for rejection

**Endpoints:**
- `GET /api/finance/payslips/pending` - View pending payslips
- `POST /api/finance/payslips/:payslipId/approve` - Approve payslip
- `POST /api/finance/payslips/:payslipId/reject` - Reject payslip

**Approval Update:**
- approval_status: "pending" → "approved"
- approved_by: Finance user email
- approved_at: Timestamp of approval

---

### **STEP 5️⃣: HR Sends Approved Payslips to Staff**
**Who:** HR  
**What:** Send approved payslips to staff via email  
**How:**
- Navigate to HR Dashboard → "🎫 Payslip Management"
- View "✅ Approved - Ready to Send" section
- Click "Send Email" button for each approved payslip
- System sends email to staff with payslip details
- Payslip status changes to "📧 Sent to Staff"

**Endpoint:** `POST /api/payroll/payslips/:payslipId/email`

**Email Details:**
- To: Staff email address
- Subject: "Payslip for [Month]"
- Content: Payslip details with net pay
- PDF attachment: Payslip PDF file

**Status Update:**
- approval_status: "approved" → "sent"
- sent_at: Timestamp of sending

---

### **STEP 6️⃣: Staff Views Their Payslip**
**Who:** Staff  
**What:** View own payslip (read-only)  
**How:**
- Staff logs into Staff Dashboard
- Views payslips in "My Payslips" section
- Can see:
  - Payroll month
  - Net pay amount
  - Payslip approval status ("Sent")
  - Download PDF if available
- **Cannot:** Modify, approve, or delete payslips
- **Can only see:** Their own payslips (filtered by staff_id)

**Endpoint:** `GET /api/payroll/payslips` (filtered by req.user.staffId)

---

## 🎯 Role Permissions Matrix

| Action | Admin | HR | Finance | Staff |
|--------|-------|----|---------|----|
| Download Template | ✅ | ✅ | ❌ | ❌ |
| Upload Excel | ✅ | ✅ | ❌ | ❌ |
| Generate Payslip | ✅ | ✅ | ❌ | ❌ |
| Approve Payslip | ✅ | ❌ | ✅ | ❌ |
| Reject Payslip | ✅ | ❌ | ✅ | ❌ |
| Send Payslip Email | ✅ | ✅ | ❌ | ❌ |
| View All Payslips | ✅ | ✅ | ✅ | ❌ |
| View Own Payslip | ✅ | ❌ | ❌ | ✅ |

---

## 💰 Payroll Calculation Example

### Input (from Excel)
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
```

### Calculated Output
```
employee_cpf: 640 (3200 × 0.20)
employer_cpf: 544 (3200 × 0.17)
total_earnings: 3900 (3200 + 300 + 180 + 120 + 100)
total_deductions: 790 (100 + 50 + 640)
net_pay: 3110 (3900 - 790)
```

### Display on Upload Results
✅ All values shown as **actual amounts** (NOT zeros)
- Basic Salary: **$3,200.00**
- Total Earnings: **$3,900.00**
- Employee CPF: **$640.00**
- Total Deductions: **$790.00**
- Net Pay: **$3,110.00**

---

## 🔐 Data Security & Workflow Rules

1. **Staff Isolation:** Staff can only view their own payslips
2. **Approval Required:** Payslips cannot be sent without Finance approval
3. **Audit Trail:** All actions logged (who, what, when)
4. **Status Immutability:** 
   - Can't approve rejected payslips
   - Can't edit sent payslips
   - Can't modify payroll after upload (requires re-upload)

---

## 📅 Monthly Workflow Timeline

```
Day 1-25:  HR downloads template and fills with data
Day 26:    HR uploads Excel file
Day 26-27: HR reviews validation results and generates payslips
Day 28:    Finance reviews and approves payslips (manually)
Day 29:    HR sends approved payslips to staff
Day 30:    Staff receives payslip email and can view in system
```

---

## 🔧 Configuration

### Payroll Rates (Configurable by Admin)
- Employee CPF Rate: 20%
- Employer CPF Rate: 17%
- SDL Rate: 0.25%
- Default Allowance: $100
- Default Deduction: $50

**Update Endpoint:** `PUT /api/payroll/rates` (Admin only)

---

## 📊 Frontend Components

### HRDashboard
- Workflow guide with 4-step process
- Template download button
- File upload with drag & drop
- Upload validation results table
- Payroll records list
- Payslips grouped by approval status:
  - ⏳ Pending Finance Approval
  - ✅ Approved - Ready to Send
  - 📧 Sent to Staff

### DashboardShell
- Role badge (color-coded):
  - Admin: Red
  - Finance: Green
  - HR: Blue
  - Staff: Gray

---

## ✅ Testing Checklist

- [ ] HR can download template
- [ ] HR can upload XLSX file with valid data
- [ ] Validation shows actual calculated values (no zeros)
- [ ] Invalid records show error messages
- [ ] Valid records can generate payslips
- [ ] Payslips appear in pending approval section
- [ ] Finance can approve payslips
- [ ] HR can send approved payslips
- [ ] Email sent updates payslip status to "sent"
- [ ] Staff can view only their own payslips
- [ ] Audit logs record all actions
