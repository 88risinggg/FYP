const { getAdminDashboardData } = require("../models/adminDashboardModel");

async function getAdminInvoicingDashboard(req, res) {
  try {
    const dashboard = await getAdminDashboardData();
    res.json(dashboard);
  } catch (error) {
    res.status(500).json({
      message: "Unable to load Admin invoicing dashboard."
    });
  }
}

module.exports = {
  getAdminInvoicingDashboard
};
