# Finance vs Admin Invoice Module Settings - Comparison Report

**Date:** July 26, 2026  
**Module:** Automated Invoicing System  
**Scope:** Admin Invoice Settings vs Finance Invoice Settings

---

## Executive Summary

The **Admin Invoice Settings** module is a fully-featured, editable configuration page with 4 tabs (General, Numbering, Email, Payments) plus GST Management. The **Finance module** currently has **no equivalent invoice configuration page**. Instead:

- `FinanceSettingsView.jsx` is a **personal user settings page** (profile, security, notifications, appearance, language, privacy) — completely unrelated to invoice configuration.
- Finance users can only **read** invoice settings via a read-only panel ("Admin Invoice Rules") embedded in the Finance Dashboard.
- There is no dedicated Finance Invoice Settings page where Finance users can view the full invoice configuration.

---

## 1. Settings Comparison by Category

### 1.1 Invoice Settings (Numbering & Identity)

| Setting | Admin | Finance | Status |
|---------|-------|---------|--------|
| Invoice prefix | Full edit | Read-only (dashboard panel) | **Missing dedicated view** |
| Invoice year | Full edit | Read-only (dashboard panel) | **Missing dedicated view** |
| Separator style | Full edit | Not visible | **Missing** |
| Invoice format | Full edit | Read-only (partial) | **Missing dedicated view** |
| Starting/next invoice number | Full edit | Not visible | **Missing** |
| Sequence rules (yearly reset, lock after sent, etc.) | Full edit | Not visible | **Missing** |
| Invoice status workflow | Read-only display | Not visible | **Missing** |
| Configuration status (% complete) | Visual progress circle | Not visible | **Missing** |

### 1.2 Payment Settings

| Setting | Admin | Finance | Status |
|---------|-------|---------|--------|
| Bank account holder name | Full edit | Not visible | **Missing** |
| Bank name | Full edit | Not visible | **Missing** |
| Bank account number | Full edit | Not visible | **Missing** |
| BIC/SWIFT | Full edit | Not visible | **Missing** |
| PayNow identifier | Full edit | Not visible | **Missing** |
| Payment reference instruction | Full edit | Not visible | **Missing** |
| Payout statement | Full edit | Not visible | **Missing** |
| Computer-generated statement | Full edit | Not visible | **Missing** |
| Payment terms | Full edit | Read-only (dashboard) | **Missing dedicated view** |
| Stripe configuration | Via payment links | Via payment links | Equivalent |
| Manual payment recording | Available | Available | Equivalent |

### 1.3 Subscription Billing Settings

| Setting | Admin | Finance | Status |
|---------|-------|---------|--------|
| Recurring invoices | Not implemented in settings | Not implemented | N/A |
| Billing frequency | Not in settings (handled via SubscriptionsView) | Same component shared | Equivalent |
| Auto-generated invoices | Not in settings | Not in settings | N/A |

### 1.4 Reminder Settings

| Setting | Admin | Finance | Status |
|---------|-------|---------|--------|
| Reminder rules CRUD | Full CRUD (create/edit/delete) | Read-only count on dashboard | **Missing dedicated view** |
| Before-due reminders | Configurable | Not accessible | **Missing** |
| Overdue reminders | Configurable | Not accessible | **Missing** |
| Reminder intervals | Configurable | Not accessible | **Missing** |
| Reminder templates | Configurable | Not accessible | **Missing** |
| Enable/disable reminders | Per-rule toggle | Not accessible | **Missing** |
| Test reminders | Available | Not accessible | **Missing** |
| Reminder logs | Full history | Not accessible | **Missing** |

### 1.5 Tax / GST Settings

| Setting | Admin | Finance | Status |
|---------|-------|---------|--------|
| Default tax type | Full edit (General tab) | Read-only (dashboard) | **Missing dedicated view** |
| GST rate scheduling | Full CRUD (GST Management page) | Not accessible | **Missing (read-only needed)** |
| GST rate history | Full table view | Not accessible | **Missing** |
| Tax inclusive/exclusive | Full edit | Not accessible | **Missing** |
| Multiple tax rates | Dropdown selection | Not accessible | **Missing** |
| Price display | Full edit | Not accessible | **Missing** |

### 1.6 Email Settings

| Setting | Admin | Finance | Status |
|---------|-------|---------|--------|
| Sender name | Full edit | Not visible | **Missing** |
| Reply-to email | Full edit | Not visible | **Missing** |
| Email subject template | Full edit with placeholders | Not visible | **Missing** |
| Email body template | Full edit with placeholders | Not visible | **Missing** |
| Attach PDF invoice toggle | Full edit | Not visible | **Missing** |
| Test email functionality | Available (send test) | Not available | **Missing** |
| Finance email | Full edit | Not visible | **Missing** |
| Support email | Full edit | Not visible | **Missing** |

### 1.7 PDF / Export Settings

| Setting | Admin | Finance | Status |
|---------|-------|---------|--------|
| PDF export enabled | Toggle | Not visible | **Missing** |
| Excel export enabled | Toggle | Not visible | **Missing** |
| PDF paper size | Dropdown (locked to A4) | Not visible | **Missing** |
| Excel format | Dropdown | Not visible | **Missing** |
| Invoice logo upload | Available | Not visible | **Missing** |
| Invoice preview | Available | Not available | **Missing** |
| Brand color | Configurable | Not visible | **Missing** |

### 1.8 Notification Settings

| Setting | Admin | Finance | Status |
|---------|-------|---------|--------|
| WhatsApp notifications | Locked ON | Not visible in invoice settings | **Missing** |
| Online view link | Locked ON | Not visible in invoice settings | **Missing** |
| Invoice notifications | N/A (in general settings) | FinanceNotificationsSection (personal) | Different scope |

### 1.9 Company / Branding Settings

| Setting | Admin | Finance | Status |
|---------|-------|---------|--------|
| Company name | Full edit | Read-only (dashboard) | **Missing dedicated view** |
| Company registration number | Full edit | Not visible | **Missing** |
| Company address | Full edit | Not visible | **Missing** |
| Registered office address | Full edit | Not visible | **Missing** |
| Company logo | Upload available | Not visible | **Missing** |

---

## 2. RBAC / Permission Analysis

| Aspect | Admin | Finance | Assessment |
|--------|-------|---------|------------|
| Invoice settings read | `GET /api/admin/invoicing/invoice-settings` | `GET /api/invoices/settings` | **Correct** - Both can read |
| Invoice settings write | `PUT /api/admin/invoicing/invoice-settings` | No write endpoint | **Correct** - Only Admin writes |
| GST rate management | Full CRUD via admin routes | No access | **Correct** - Admin-only |
| Logo upload | `POST /api/admin/invoicing/invoice-settings/logo` | No access | **Correct** - Admin-only |
| Test email | `POST /api/admin/invoicing/invoice-settings/test-email` | No access | **Correct** - Admin-only |
| Reminder settings CRUD | Full via admin routes | No access | **Needs read-only view for Finance** |
| Invoice preview | `POST /api/admin/invoicing/invoice-settings/preview` | No access | **Could be shared read-only** |

### Permission Inconsistencies

1. **Finance can read settings** via `/api/invoices/settings` but has no UI to display the full configuration.
2. **Reminder rules** are visible to Finance only as a count — Finance should see the rules (read-only) to understand reminder behavior.
3. **GST rates** should be visible to Finance users (read-only) since they create invoices that include GST.

---

## 3. UI Comparison

| Aspect | Admin | Finance | Issue |
|--------|-------|---------|-------|
| Settings page exists | Yes (AdminInvoiceSettingsPage.jsx) | No (FinanceSettingsView is personal settings) | **Critical gap** |
| Tab navigation | 4 tabs (General/Numbering/Email/Payments) | No equivalent | **Missing** |
| Card design | Consistent SettingsCard component | N/A | **Missing** |
| Form validation | Client-side + server-side | N/A (no forms) | **Missing** |
| Configuration progress | Visual % circle | N/A | **Missing** |
| Save/reset buttons | Present | N/A | N/A (Finance is read-only) |
| Responsive design | Tailwind responsive grid | N/A | **Missing** |
| Color scheme | #F38978 brand, cream backgrounds | Same when visible | Consistent |
| GST Management | Separate sub-page with full table | Not accessible | **Missing** |

### Layout Issues
- The Finance Dashboard has an "Admin Invoice Rules" panel that shows a limited subset of settings — this is the ONLY way Finance users see invoice configuration.
- No navigation item for "Invoice Settings" in the Finance sidebar.

---

## 4. Validation Comparison

| Validation Rule | Admin (Server) | Admin (Client) | Finance | Status |
|-----------------|----------------|----------------|---------|--------|
| Required currency | Yes | Yes | N/A | Finance doesn't write |
| Required language | Yes | Yes | N/A | Finance doesn't write |
| Required tax | Yes | Yes | N/A | Finance doesn't write |
| Payment terms format | Yes (regex) | Yes | N/A | Finance doesn't write |
| Late fee >= 0 | Yes | Yes | N/A | Finance doesn't write |
| Invoice prefix required | Yes | Yes | N/A | Finance doesn't write |
| 4-digit year | Yes | Yes | N/A | Finance doesn't write |
| Email format | Yes (pattern) | Yes | N/A | Finance doesn't write |
| Template placeholders | Yes (allowlist) | Yes | N/A | Finance doesn't write |
| Next number >= 1 | Yes | Yes | N/A | Finance doesn't write |

**Assessment:** Validation is only relevant for Admin since Finance has no write access. No validation inconsistencies exist because Finance simply cannot modify settings.

---

## 5. Identified Issues

### Critical

1. **No Finance Invoice Settings page** — Finance users have no dedicated page to view the complete invoice configuration that governs their work.

### High Priority

2. **Missing "Invoice Settings" in Finance sidebar** — No navigation entry for settings viewing.
3. **GST rates not visible to Finance** — Finance creates invoices with GST but cannot see scheduled rate changes.
4. **Reminder rules not visible to Finance** — Finance receives reminders but cannot view the configuration.
5. **Payment details not visible to Finance** — Finance handles payments but cannot see bank details configured by Admin.

### Medium Priority

6. **FinanceSettingsView naming confusion** — Named "Settings" but contains only personal user preferences, creating confusion about where invoice settings are.
7. **Inconsistent settings endpoint** — Finance uses `/api/invoices/settings` (returns `{settings}`) while Admin uses `/api/admin/invoicing/invoice-settings` (returns `{settings, options, configurationStatus, ...}`).
8. **No email template preview for Finance** — Finance sends invoices but cannot preview the email template.

### Low Priority

9. **No numbering activity log for Finance** — Only Admin can see the history of numbering changes.
10. **Brand color not exposed** — Finance-generated PDFs use the brand color but Finance cannot see what it is.

---

## 6. Recommendations

### Implement: Finance Invoice Settings View (Read-Only)

Create a dedicated **read-only** Finance Invoice Settings page that displays:
- General settings (currency, language, tax, payment terms)
- Numbering configuration (prefix, format, next number)
- Email templates (subject, body — read-only)
- Payment details (bank info — read-only)
- GST rates (current + scheduled — read-only)
- Reminder rules (active rules — read-only)
- Configuration status indicator

This page should:
- Use the existing `/api/invoices/settings` endpoint (enhanced to return full payload)
- Display all settings in read-only cards (no edit forms)
- Clearly indicate "Managed by Admin" with lock icons
- Be accessible from the Finance sidebar under "INVOICING" section

### Do NOT Implement:
- Write access for Finance users (violates RBAC)
- GST rate scheduling for Finance (Admin-only)
- Logo upload for Finance (Admin-only)
- Reminder CRUD for Finance (Admin-only)

---

## 7. Implementation Plan

1. Add "Invoice Settings" nav item to Finance sidebar
2. Create `FinanceInvoiceSettingsPage.jsx` — read-only view of Admin configuration
3. Enhance `/api/invoices/settings` endpoint to return options, GST rates, and reminder rules
4. Display configuration in a consistent card layout matching Admin's visual style
5. Add lock indicators showing Admin-controlled fields
6. Include "Last updated" timestamp and "Contact Admin to modify" guidance

---

*Report generated by automated audit comparing Admin and Finance invoice settings modules.*
