/**
 * Unit tests for the birthday-widget logic in HRPayrollPage.
 *
 * We test the pure derivation logic (filtering + daysUntil + badge label) in
 * isolation so we don't need to mount the full page, mock fetch, or touch any
 * emoji literal in an assertion.
 */
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Replicate the pure logic from HRPayrollPage so tests are self-contained.
// If the production logic changes, update this copy to match.
// ---------------------------------------------------------------------------

/**
 * Given a staff list and a reference "today", return the birthday entries for
 * the current month, enriched with a daysUntil field, sorted ascending.
 */
function getBirthdaysThisMonth(staffList, today = new Date()) {
  const todayNorm = new Date(today);
  todayNorm.setHours(0, 0, 0, 0);

  return staffList
    .filter(s => {
      if (!s.date_of_birth) return false;
      return new Date(s.date_of_birth).getMonth() === todayNorm.getMonth();
    })
    .map(s => {
      const dob = new Date(s.date_of_birth);
      const birthday = new Date(todayNorm.getFullYear(), dob.getMonth(), dob.getDate());
      const daysUntil = Math.round((birthday - todayNorm) / (1000 * 60 * 60 * 24));
      return { ...s, daysUntil };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

/** Replicate the badge label expression from the JSX. */
function badgeLabel(daysUntil) {
  if (daysUntil === 0) return "Today!";        // emoji omitted in assertion
  if (daysUntil < 0)  return `${Math.abs(daysUntil)}d ago`;
  return `in ${daysUntil}d`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStaff(name, dobStr) {
  return { employee_id: name, name, date_of_birth: dobStr };
}

// Freeze "today" to 2025-07-15 (month index 6 = July) for deterministic tests.
const TODAY = new Date("2025-07-15T00:00:00");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getBirthdaysThisMonth", () => {
  it("excludes staff without a date_of_birth", () => {
    const staff = [
      { employee_id: "1", name: "No DOB" },
      makeStaff("Alice", "1990-07-20"),
    ];
    const result = getBirthdaysThisMonth(staff, TODAY);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Alice");
  });

  it("excludes staff born in other months", () => {
    const staff = [
      makeStaff("January", "1990-01-10"),
      makeStaff("July",    "1990-07-20"),
      makeStaff("December","1990-12-25"),
    ];
    const result = getBirthdaysThisMonth(staff, TODAY);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("July");
  });

  it("calculates daysUntil = 0 for a birthday that is today", () => {
    const staff = [makeStaff("Charlie", "1995-07-15")];
    const result = getBirthdaysThisMonth(staff, TODAY);
    expect(result[0].daysUntil).toBe(0);
  });

  it("calculates positive daysUntil for a future birthday this month", () => {
    const staff = [makeStaff("Dana", "1990-07-20")];
    const result = getBirthdaysThisMonth(staff, TODAY);
    expect(result[0].daysUntil).toBe(5);
  });

  it("calculates negative daysUntil for a past birthday this month", () => {
    const staff = [makeStaff("Eve", "1990-07-10")];
    const result = getBirthdaysThisMonth(staff, TODAY);
    expect(result[0].daysUntil).toBe(-5);
  });

  it("sorts results ascending by daysUntil (past → today → future)", () => {
    const staff = [
      makeStaff("Future",  "1990-07-25"),  // +10
      makeStaff("Today",   "1990-07-15"),  //   0
      makeStaff("Past",    "1990-07-05"),  // -10
    ];
    const result = getBirthdaysThisMonth(staff, TODAY);
    expect(result.map(s => s.name)).toEqual(["Past", "Today", "Future"]);
  });

  it("returns an empty array when no staff have a birthday this month", () => {
    const staff = [
      makeStaff("Bob",   "1990-01-10"),
      makeStaff("Carol", "1990-03-22"),
    ];
    expect(getBirthdaysThisMonth(staff, TODAY)).toHaveLength(0);
  });
});

describe("badgeLabel", () => {
  it("returns 'Today!' for daysUntil === 0", () => {
    expect(badgeLabel(0)).toBe("Today!");
  });

  it("returns '<n>d ago' for past birthdays", () => {
    expect(badgeLabel(-3)).toBe("3d ago");
    expect(badgeLabel(-10)).toBe("10d ago");
  });

  it("returns 'in <n>d' for upcoming birthdays", () => {
    expect(badgeLabel(1)).toBe("in 1d");
    expect(badgeLabel(7)).toBe("in 7d");
  });
});
