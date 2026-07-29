/**
 * EVALUATION HEADER
 * FEATURE: INVOICE - FINANCE
 * PURPOSE: Handles vaniday Import Controller API requests, validation, status codes, and responses.
 * LAYER: Backend controller - validates HTTP input and returns the API response.
 * FIND RELATED CODE: Follow service/model calls to find business rules and database work.
 */
/**
 * Vaniday Import Controller
 *
 * Two-step workflow:
 * 1. POST /validate — Parse CSV/Excel, map fields, validate, return report
 * 2. POST /process — Generate invoices from validated data
 *
 * Also provides:
 * - GET /mapping — Get current Vaniday field mapping configuration
 * - PUT /mapping — Update the field mapping
 */

const { pool } = require("../config/db");
const {
  validateVanidayImport,
  processVanidayImport,
  DEFAULT_VANIDAY_MAPPING
} = require("../services/vanidayImportService");
const { getInvoiceSettings, saveInvoiceSettings } = require("../models/invoiceSettingsModel");
const { getCompanyId } = require("../utils/companyScope");

/**
 * POST /api/vaniday-import/validate
 * Validates uploaded Vaniday rows and returns a detailed report.
 */
async function validateImport(req, res) {
  try {
    const { rows, dateFormat, allowReimport } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No data rows provided. Upload a Vaniday CSV/Excel file."
      });
    }

    const result = await validateVanidayImport(rows, { dateFormat, allowReimport: !!allowReimport, companyId: getCompanyId(req) });

    // Convert validGroups Map to serializable format
    const validGroupsArray = [];
    if (result.validGroups) {
      for (const [orderId, records] of result.validGroups) {
        validGroupsArray.push({
          orderId,
          customerName: records[0].customerName,
          email: records[0].email,
          shopTitle: records[0].shopTitle,
          lineItemCount: records.length,
          totalAmount: records.reduce((sum, r) => {
            const cleaned = String(r.totalRevenue || "0").replace(/[^0-9.\-]/g, "");
            return sum + (Number(cleaned) || 0);
          }, 0),
          paymentMethod: records[0].paymentMethod,
          alreadyPaid: records[0].creditCard && 
            Math.abs(Number(String(records[0].creditCard).replace(/[^0-9.\-]/g, "")) - 
            Number(String(records[0].totalRevenue).replace(/[^0-9.\-]/g, ""))) < 0.01
        });
      }
    }

    res.json({
      ...result,
      validGroups: validGroupsArray,
      // Include per-row validation detail so the UI can show exactly what failed
      validationErrors: result.errors || [],
      detectedHeaders: rows.length > 0 ? Object.keys(rows[0]) : []
    });
  } catch (error) {
    console.error("[VanidayImport] Validation error:", error);
    res.status(500).json({
      success: false,
      message: "Validation failed: " + error.message
    });
  }
}

/**
 * POST /api/vaniday-import/process
 * Generates invoices from previously validated Vaniday data.
 */
async function processImport(req, res) {
  try {
    const { rows, dateFormat, allowReimport } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No data rows provided."
      });
    }

    // Re-validate to ensure data integrity
    const validationResult = await validateVanidayImport(rows, { dateFormat, allowReimport: !!allowReimport, companyId: getCompanyId(req) });

    if (!validationResult.success) {
      return res.status(400).json(validationResult);
    }

    if (validationResult.readyForInvoice === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid records to generate invoices from.",
        ...validationResult,
        validGroups: []
      });
    }

    const result = await processVanidayImport(validationResult, req.user?.userId, getCompanyId(req));

    if (!result.success) {
      return res.status(500).json(result);
    }

    // Audit log for the batch
    try {
      await pool.query(
        `INSERT INTO audit_logs (user_id, company_id, module, activity_type, action_description, affected_record, status, created_at, new_value)
         VALUES (?, ?, 'Invoice', 'vaniday_import', ?, ?, 'Success', NOW(), ?)`,
        [
          req.user?.userId,
          getCompanyId(req),
          `Vaniday batch import: ${result.totalCreated} invoices created`,
          `batch_${Date.now()}`,
          JSON.stringify({ totalCreated: result.totalCreated, paidCount: result.paidCount, unpaidCount: result.unpaidCount })
        ]
      );
    } catch { /* non-blocking */ }

    res.status(201).json(result);
  } catch (error) {
    console.error("[VanidayImport] Process error:", error);
    res.status(500).json({
      success: false,
      message: "Import processing failed: " + error.message
    });
  }
}

/**
 * GET /api/vaniday-import/mapping
 * Returns the current Vaniday field mapping configuration.
 */
async function getMapping(req, res) {
  try {
    const settings = await getInvoiceSettings(getCompanyId(req));
    const mapping = settings?.vanidayFieldMapping || DEFAULT_VANIDAY_MAPPING;
    res.json({ mapping, defaults: DEFAULT_VANIDAY_MAPPING });
  } catch (error) {
    res.status(500).json({ message: "Failed to load mapping.", detail: error.message });
  }
}

/**
 * PUT /api/vaniday-import/mapping
 * Updates the Vaniday field mapping configuration.
 */
async function updateMapping(req, res) {
  try {
    const { mapping } = req.body;
    if (!mapping || typeof mapping !== "object") {
      return res.status(400).json({ message: "Mapping object is required." });
    }

    const companyId = getCompanyId(req);
    const settings = await getInvoiceSettings(companyId);
    await saveInvoiceSettings({
      ...settings,
      vanidayFieldMapping: mapping
    }, companyId);

    res.json({ message: "Mapping updated successfully.", mapping });
  } catch (error) {
    res.status(500).json({ message: "Failed to update mapping.", detail: error.message });
  }
}

module.exports = {
  getMapping,
  processImport,
  updateMapping,
  validateImport
};
