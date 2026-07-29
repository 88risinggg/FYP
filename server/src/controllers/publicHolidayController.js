/**
 * EVALUATION HEADER
 * FEATURE: PAYROLL - HR
 * PURPOSE: Handles public Holiday Controller API requests, validation, status codes, and responses.
 * LAYER: Backend controller - validates HTTP input and returns the API response.
 * FIND RELATED CODE: Follow service/model calls to find business rules and database work.
 */
/**
 * Public Holiday Controller
 *
 * Handles CRUD operations for public holidays.
 * Only HR users have access to manage public holidays.
 */

const {
  getAllHolidays,
  getHolidayById,
  holidayDateExists,
  createHoliday,
  updateHoliday,
  deleteHoliday,
} = require("../models/publicHolidayModel");

/**
 * GET /api/hr/public-holidays
 * Retrieve all public holidays.
 */
async function getAll(req, res) {
  try {
    const holidays = await getAllHolidays();
    res.json(holidays);
  } catch (err) {
    console.error("[PUBLIC_HOLIDAYS] getAll error:", err.message);
    res.status(500).json({ message: "Failed to retrieve public holidays" });
  }
}

/**
 * GET /api/hr/public-holidays/:id
 * Retrieve a single public holiday by ID.
 */
async function getById(req, res) {
  try {
    const { id } = req.params;
    const holiday = await getHolidayById(id);

    if (!holiday) {
      return res.status(404).json({ message: "Public holiday not found" });
    }

    res.json(holiday);
  } catch (err) {
    console.error("[PUBLIC_HOLIDAYS] getById error:", err.message);
    res.status(500).json({ message: "Failed to retrieve public holiday" });
  }
}

/**
 * POST /api/hr/public-holidays
 * Create a new public holiday.
 */
async function create(req, res) {
  try {
    const { holiday_name, holiday_date, description, status } = req.body;

    // Validate required fields
    if (!holiday_name || !holiday_date) {
      return res.status(400).json({ message: "holiday_name and holiday_date are required" });
    }

    // Validate holiday_name is not empty after trimming
    if (!holiday_name.trim()) {
      return res.status(400).json({ message: "Holiday name cannot be empty" });
    }

    // Validate date format
    const dateObj = new Date(holiday_date);
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    // Check for duplicate date
    const exists = await holidayDateExists(holiday_date);
    if (exists) {
      return res.status(409).json({ message: "A public holiday already exists on this date" });
    }

    const holidayId = await createHoliday({
      holiday_name: holiday_name.trim(),
      holiday_date,
      description: description?.trim() || null,
      status: status || "Active",
    });

    res.status(201).json({
      message: "Public holiday created successfully",
      holiday_id: holidayId,
    });
  } catch (err) {
    console.error("[PUBLIC_HOLIDAYS] create error:", err.message);
    res.status(500).json({ message: "Failed to create public holiday" });
  }
}

/**
 * PUT /api/hr/public-holidays/:id
 * Update an existing public holiday.
 */
async function update(req, res) {
  try {
    const { id } = req.params;
    const { holiday_name, holiday_date, description, status } = req.body;

    // Validate required fields
    if (!holiday_name || !holiday_date) {
      return res.status(400).json({ message: "holiday_name and holiday_date are required" });
    }

    // Validate holiday_name is not empty after trimming
    if (!holiday_name.trim()) {
      return res.status(400).json({ message: "Holiday name cannot be empty" });
    }

    // Validate date format
    const dateObj = new Date(holiday_date);
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    // Check holiday exists
    const existing = await getHolidayById(id);
    if (!existing) {
      return res.status(404).json({ message: "Public holiday not found" });
    }

    // Check for duplicate date (exclude current record)
    const duplicateDate = await holidayDateExists(holiday_date, id);
    if (duplicateDate) {
      return res.status(409).json({ message: "A public holiday already exists on this date" });
    }

    const updated = await updateHoliday(id, {
      holiday_name: holiday_name.trim(),
      holiday_date,
      description: description?.trim() || null,
      status: status || existing.status,
    });

    if (!updated) {
      return res.status(500).json({ message: "Failed to update public holiday" });
    }

    res.json({ message: "Public holiday updated successfully" });
  } catch (err) {
    console.error("[PUBLIC_HOLIDAYS] update error:", err.message);
    res.status(500).json({ message: "Failed to update public holiday" });
  }
}

/**
 * DELETE /api/hr/public-holidays/:id
 * Delete a public holiday.
 */
async function remove(req, res) {
  try {
    const { id } = req.params;

    const existing = await getHolidayById(id);
    if (!existing) {
      return res.status(404).json({ message: "Public holiday not found" });
    }

    const deleted = await deleteHoliday(id);
    if (!deleted) {
      return res.status(500).json({ message: "Failed to delete public holiday" });
    }

    res.json({ message: "Public holiday deleted successfully" });
  } catch (err) {
    console.error("[PUBLIC_HOLIDAYS] remove error:", err.message);
    res.status(500).json({ message: "Failed to delete public holiday" });
  }
}

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove,
};
