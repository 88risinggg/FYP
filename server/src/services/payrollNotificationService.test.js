const mockExecute = jest.fn();
const mockSendMail = jest.fn();

jest.mock("../config/db", () => ({ pool: { execute: mockExecute } }));
jest.mock("nodemailer", () => ({
  createTransport: jest.fn(() => ({ sendMail: mockSendMail }))
}));

const { notifyUser, payrollEmailHtml } = require("./payrollNotificationService");

beforeEach(() => {
  jest.clearAllMocks();
  process.env.SMTP_HOST = "smtp.example.com";
  process.env.SMTP_USER = "mailer@example.com";
  process.env.SMTP_PASS = "secret";
});

afterAll(() => {
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
});

test("records email failure without rejecting the completed notification", async () => {
  mockExecute
    .mockResolvedValueOnce([[{ user_id: 8, name: "Recipient", email: "staff@example.com", status: 1 }]])
    .mockResolvedValueOnce([[{ name: "HR User" }]])
    .mockResolvedValueOnce([{ insertId: 55 }])
    .mockResolvedValueOnce([{ affectedRows: 1 }]);
  mockSendMail.mockRejectedValueOnce(new Error("SMTP unavailable"));

  await expect(notifyUser(8, {
    title: "Action required", message: "Review this item", actorUserId: 3,
    actionPath: "/dashboard/payroll/hr", entityType: "claim", entityId: 12
  })).resolves.toBe(55);

  expect(mockExecute).toHaveBeenLastCalledWith(
    expect.stringContaining("delivery_status = 'Failed'"),
    ["SMTP unavailable", 55]
  );
});

test("escapes user-controlled values in transactional email HTML", () => {
  const html = payrollEmailHtml({
    recipientName: "<Employee>", title: "Review <claim>", message: "A & B",
    actorName: "HR \"Lead\"", actionPath: "/dashboard/payroll/hr"
  });
  expect(html).toContain("&lt;Employee&gt;");
  expect(html).toContain("Review &lt;claim&gt;");
  expect(html).toContain("A &amp; B");
  expect(html).not.toContain("<Employee>");
});
