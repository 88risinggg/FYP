const { allowRoles } = require("./rolesMiddleware");

function responseRecorder() {
  return {
    body: null,
    statusCode: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

describe("allowRoles", () => {
  test("allows a configured payroll role", () => {
    const next = jest.fn();
    allowRoles("Admin", "Finance")({ user: { role: "Finance" } }, responseRecorder(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("returns ACCESS_DENIED without ending the authenticated session", () => {
    const response = responseRecorder();
    allowRoles("Admin")({ user: { role: "Finance" } }, response, jest.fn());
    expect(response.statusCode).toBe(403);
    expect(response.body.code).toBe("ACCESS_DENIED");
  });

  test("returns AUTH_REQUIRED when no user is authenticated", () => {
    const response = responseRecorder();
    allowRoles("Admin")({}, response, jest.fn());
    expect(response.statusCode).toBe(401);
    expect(response.body.code).toBe("AUTH_REQUIRED");
  });
});
