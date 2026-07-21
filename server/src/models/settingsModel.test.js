jest.mock("../config/db", () => ({
  pool: { query: jest.fn() }
}));

const { pool } = require("../config/db");
const { upsertAppearanceSettings } = require("./settingsModel");

beforeEach(() => {
  pool.query.mockReset().mockResolvedValue([{}]);
});

test("appearance partial updates preserve fields that were not submitted", async () => {
  await upsertAppearanceSettings(7, { language: "zh" });

  expect(pool.query).toHaveBeenCalledWith(
    expect.stringContaining("accent_color = COALESCE(?, accent_color)"),
    [null, null, null, null, "zh", 7]
  );
});

test("appearance updates persist compact mode being switched off", async () => {
  await upsertAppearanceSettings(9, { compact_mode: false });

  expect(pool.query.mock.calls[0][1]).toEqual([null, null, 0, null, null, 9]);
});
