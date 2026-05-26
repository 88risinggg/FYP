const cors = require("cors");
const express = require("express");
require("dotenv").config();

const healthRoutes = require("./routes/healthRoutes");
const authRoutes = require("./routes/authRoutes");
const hrRoutes = require("./routes/hrRoutes");
const staffRoutes = require("./routes/staffRoutes");
const payrollRoutes = require("./routes/payrollRoutes");

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173"
}));
app.use(express.json());

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/hr", hrRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/payroll", payrollRoutes);

app.use((req, res) => {
  res.status(404).json({
    message: "Route not found"
  });
});

module.exports = app;
