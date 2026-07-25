jest.mock("../models/authChallengeModel", () => ({
  blockChallenge: jest.fn(),
  consumeChallenge: jest.fn(),
  createChallenge: jest.fn(),
  findChallenge: jest.fn(),
  incrementAttempts: jest.fn(),
  replaceOtp: jest.fn()
}));

const challengeModel = require("../models/authChallengeModel");
const service = require("./authChallengeService");

beforeAll(() => {
  process.env.OTP_HASH_SECRET = "test-only-otp-secret";
});

beforeEach(() => {
  jest.clearAllMocks();
});

test("stores a hash instead of the generated OTP", async () => {
  const result = await service.createChallenge({
    email: "admin@example.com",
    purpose: "registration",
    pendingRegistrationId: "pending-1"
  });

  const saved = challengeModel.createChallenge.mock.calls[0][0];
  expect(saved.otpHash).toMatch(/^[a-f0-9]{64}$/);
  expect(saved.otpHash).not.toBe(result.otp);
  expect(saved).not.toHaveProperty("otp");
});

test("blocks the challenge after the resend limit", async () => {
  challengeModel.findChallenge.mockResolvedValue({
    challengeId: "challenge-1",
    purpose: "login",
    resendCount: 2,
    consumedAt: null,
    blockedUntil: null
  });

  const result = await service.resendChallenge("challenge-1", "login");

  expect(result.error).toBe("BLOCKED");
  expect(challengeModel.blockChallenge).toHaveBeenCalledTimes(1);
  expect(challengeModel.replaceOtp).not.toHaveBeenCalled();
});
