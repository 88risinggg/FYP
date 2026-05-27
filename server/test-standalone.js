const express = require('express');
const jwt = require('jsonwebtoken');
const app = express();

app.use(express.json());

const SECRET = '5781d89097f5edbfd8dc858337e95b8fd852c695045d5f1dd610b8d239c52b30';

// Mock auth middleware
const mockAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch (e) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Mock role middleware
const mockRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
};

// In-memory data
const staffProfiles = [];

// Routes
app.get("/staff/:id", mockAuth, mockRoles("Admin", "HR"), (req, res) => {
  const { id } = req.params;
  const staff = staffProfiles.find(s => s.staff_id === id);
  if (!staff) return res.status(404).json({ message: "Staff record not found" });
  res.json(staff);
});

app.put("/staff/:id", mockAuth, mockRoles("Admin", "HR"), (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const staff = staffProfiles.find(s => s.staff_id === id);
  if (!staff) return res.status(404).json({ message: "Staff record not found" });
  Object.assign(staff, updates);
  res.json({ message: "Updated", staff });
});

app.delete("/staff/:id", mockAuth, mockRoles("Admin", "HR"), (req, res) => {
  const { id } = req.params;
  const index = staffProfiles.findIndex(s => s.staff_id === id);
  if (index === -1) return res.status(404).json({ message: "Not found" });
  const deleted = staffProfiles.splice(index, 1)[0];
  res.json({ message: "Deleted", deleted });
});

app.get("/staff", mockAuth, mockRoles("Admin", "HR"), (req, res) => {
  res.json(staffProfiles);
});

app.post("/staff", mockAuth, mockRoles("Admin", "HR"), (req, res) => {
  const id = `STF${(staffProfiles.length + 1).toString().padStart(3, '0')}`;
  const profile = { staff_id: id, ...req.body };
  staffProfiles.push(profile);
  res.status(201).json(profile);
});

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

const server = app.listen(6001, () => {
  console.log('Test server running on port 6001');
});

module.exports = { app, server, staffProfiles };
