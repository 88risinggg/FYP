const { getCompanyId } = require("../utils/companyScope");
const {
  getSubscriptionSettings,
  saveSubscriptionSettings
} = require("../models/subscriptionSettingsModel");

async function getAdminSubscriptionSettings(req, res) {
  try {
    const settings = await getSubscriptionSettings(getCompanyId(req));
    res.json(settings);
  } catch (error) {
    console.error("[Subscription settings] Failed to load:", error);
    res.status(500).json({ message: "Unable to load subscription settings." });
  }
}

async function putAdminSubscriptionSettings(req, res) {
  try {
    const settings = await saveSubscriptionSettings(
      getCompanyId(req),
      req.body,
      req.user?.userId
    );
    res.json({ message: "Subscription settings saved.", ...settings });
  } catch (error) {
    console.error("[Subscription settings] Failed to save:", error);
    res.status(error.status || 500).json({
      message: error.status === 400 ? error.message : "Unable to save subscription settings."
    });
  }
}

module.exports = {
  getAdminSubscriptionSettings,
  putAdminSubscriptionSettings
};
