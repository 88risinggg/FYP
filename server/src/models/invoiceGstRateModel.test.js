jest.mock("../config/db", () => ({
  pool: {
    query: jest.fn(),
    getConnection: jest.fn()
  }
}));

const { pool } = require("../config/db");
const {
  createGstRate,
  getEffectiveGstRate,
  toDateOnly,
  updateGstRate
} = require("./invoiceGstRateModel");

beforeEach(() => {
  jest.clearAllMocks();
});

test("keeps Singapore database dates on their exact calendar day", () => {
  expect(toDateOnly(new Date("2023-12-31T16:00:00.000Z"))).toBe("2024-01-01");
  expect(toDateOnly("2027-01-01")).toBe("2027-01-01");
});

test.each([
  ["2026-12-31", 9],
  ["2027-01-01", 10],
  ["2027-01-02", 10]
])("resolves the effective GST for invoice date %s", async (invoiceDate, expectedRate) => {
  pool.query
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([[{ Field: "created_by_user_id" }]])
    .mockResolvedValueOnce([[{ count: 1 }]])
    .mockResolvedValueOnce([[
      {
        gst_rate_id: expectedRate,
        company_id: 7,
        tax_code: `GST_${expectedRate}`,
        tax_name: "GST",
        rate_percentage: String(expectedRate),
        effective_from: expectedRate === 10 ? "2027-01-01" : "2024-01-01",
        effective_to: expectedRate === 9 ? "2026-12-31" : null,
        is_active: 1
      }
    ]]);

  const rate = await getEffectiveGstRate(7, invoiceDate);

  expect(rate.ratePercentage).toBe(expectedRate);
  expect(pool.query.mock.calls[3][1]).toEqual([7, invoiceDate, invoiceDate]);
});

test("schedules GST transactionally and returns the authenticated admin name", async () => {
  const connection = {
    beginTransaction: jest.fn().mockResolvedValue(),
    query: jest.fn()
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 42 }]),
    commit: jest.fn().mockResolvedValue(),
    rollback: jest.fn().mockResolvedValue(),
    release: jest.fn()
  };

  pool.getConnection.mockResolvedValue(connection);
  pool.query
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([[]])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([[{ count: 1 }]])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([[]])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([[{ count: 1 }]])
    .mockResolvedValueOnce([[
      {
        gst_rate_id: 42,
        company_id: 7,
        tax_code: "GST_8_5",
        tax_name: "GST",
        rate_percentage: "8.50",
        effective_from: "2026-08-01",
        effective_to: null,
        is_active: 1,
        created_by_user_id: 12,
        created_by: "admin@example.com",
        created_by_name: "Admin User"
      }
    ]]);

  const rates = await createGstRate({
    ratePercentage: "8.50",
    effectiveFrom: "2026-08-01"
  }, 7, {
    userId: 12,
    email: "admin@example.com"
  });

  expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
  expect(connection.commit).toHaveBeenCalledTimes(1);
  expect(connection.rollback).not.toHaveBeenCalled();
  expect(connection.release).toHaveBeenCalledTimes(1);
  expect(connection.query.mock.calls[2][1]).toEqual([
    7,
    "GST_8_5",
    "GST",
    8.5,
    "2026-08-01",
    null,
    12,
    "admin@example.com"
  ]);
  expect(rates[0]).toMatchObject({
    ratePercentage: 8.5,
    effectiveFrom: "2026-08-01",
    createdByUserId: 12,
    createdBy: "Admin User"
  });
});

test("rejects GST schedules for today or earlier", async () => {
  pool.query
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([[{ Field: "created_by_user_id" }]])
    .mockResolvedValueOnce([[{ count: 1 }]]);

  await expect(createGstRate({
    ratePercentage: "9.50",
    effectiveFrom: toDateOnly(new Date())
  }, 7, {
    userId: 12,
    email: "admin@example.com"
  })).rejects.toMatchObject({
    message: "GST effective date must be at least one day after today. Schedule tomorrow or a later date only.",
    statusCode: 400
  });

  expect(pool.getConnection).not.toHaveBeenCalled();
});

test("updates only upcoming GST schedules", async () => {
  const connection = {
    beginTransaction: jest.fn().mockResolvedValue(),
    query: jest.fn()
      .mockResolvedValueOnce([[{
        gst_rate_id: 42,
        company_id: 7,
        effective_from: "2027-01-01",
        effective_to: null,
        is_active: 1
      }]])
      .mockResolvedValueOnce([[{ gst_rate_id: 9 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]),
    commit: jest.fn().mockResolvedValue(),
    rollback: jest.fn().mockResolvedValue(),
    release: jest.fn()
  };

  pool.getConnection.mockResolvedValue(connection);
  pool.query
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([[{ Field: "created_by_user_id" }]])
    .mockResolvedValueOnce([[{ count: 1 }]])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([[{ Field: "created_by_user_id" }]])
    .mockResolvedValueOnce([[{ count: 1 }]])
    .mockResolvedValueOnce([[{
      gst_rate_id: 42,
      company_id: 7,
      tax_code: "GST_8_5",
      tax_name: "GST",
      rate_percentage: "8.50",
      effective_from: "2027-02-01",
      effective_to: null,
      is_active: 1
    }]]);

  const rates = await updateGstRate(42, {
    ratePercentage: "8.50",
    effectiveFrom: "2027-02-01"
  }, 7);

  expect(connection.commit).toHaveBeenCalledTimes(1);
  expect(connection.rollback).not.toHaveBeenCalled();
  expect(connection.query.mock.calls[2][1]).toEqual(["2027-01-31", 9]);
  expect(connection.query.mock.calls[4][1]).toEqual([
    "GST_8_5",
    "GST",
    8.5,
    "2027-02-01",
    null,
    42
  ]);
  expect(rates[0]).toMatchObject({
    id: 42,
    ratePercentage: 8.5,
    effectiveFrom: "2027-02-01"
  });
});

test("rejects edits to current GST schedules", async () => {
  const connection = {
    beginTransaction: jest.fn().mockResolvedValue(),
    query: jest.fn().mockResolvedValueOnce([[{
      gst_rate_id: 9,
      company_id: 7,
      effective_from: "2024-01-01",
      effective_to: null,
      is_active: 1
    }]]),
    commit: jest.fn().mockResolvedValue(),
    rollback: jest.fn().mockResolvedValue(),
    release: jest.fn()
  };

  pool.getConnection.mockResolvedValue(connection);
  pool.query
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([[{ Field: "created_by_user_id" }]])
    .mockResolvedValueOnce([[{ count: 1 }]]);

  await expect(updateGstRate(9, {
    ratePercentage: "8.50",
    effectiveFrom: "2027-02-01"
  }, 7)).rejects.toMatchObject({
    message: "Only upcoming GST schedules can be edited.",
    statusCode: 400
  });

  expect(connection.commit).not.toHaveBeenCalled();
  expect(connection.rollback).toHaveBeenCalledTimes(1);
  expect(connection.release).toHaveBeenCalledTimes(1);
});

test("rolls back all GST date changes when a schedule overlaps", async () => {
  const connection = {
    beginTransaction: jest.fn().mockResolvedValue(),
    query: jest.fn()
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[{ gst_rate_id: 9 }]]),
    commit: jest.fn().mockResolvedValue(),
    rollback: jest.fn().mockResolvedValue(),
    release: jest.fn()
  };

  pool.getConnection.mockResolvedValue(connection);
  pool.query
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([[]])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([[{ count: 1 }]]);

  await expect(createGstRate({
    ratePercentage: "9.25",
    effectiveFrom: "2026-08-01"
  }, 7, {
    userId: 12,
    email: "admin@example.com"
  })).rejects.toMatchObject({
    message: "GST effective dates cannot overlap an existing GST rate.",
    statusCode: 400
  });

  expect(connection.commit).not.toHaveBeenCalled();
  expect(connection.rollback).toHaveBeenCalledTimes(1);
  expect(connection.release).toHaveBeenCalledTimes(1);
});
