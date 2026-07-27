const { createBackgroundJobRegistry } = require("./backgroundJobRegistry");

describe("backgroundJobRegistry", () => {
  test("reserves one job per key and exposes the original start time", () => {
    const registry = createBackgroundJobRegistry();
    const first = registry.reserve("company:run", "2026-07-27T06:00:00.000Z");
    const duplicate = registry.reserve("company:run", "2026-07-27T06:01:00.000Z");

    expect(first.acquired).toBe(true);
    expect(duplicate).toEqual({ acquired: false, job: first.job });
    expect(duplicate.job.startedAt).toBe("2026-07-27T06:00:00.000Z");
  });

  test("runs a reserved task once and releases it after completion", async () => {
    const registry = createBackgroundJobRegistry();
    const task = jest.fn().mockResolvedValue("done");
    registry.reserve("company:run");

    const firstPromise = registry.run("company:run", task);
    const duplicatePromise = registry.run("company:run", task);

    expect(duplicatePromise).toBe(firstPromise);
    await expect(firstPromise).resolves.toBe("done");
    expect(task).toHaveBeenCalledTimes(1);
    expect(registry.get("company:run")).toBeNull();
  });

  test("reports task failure and still permits a safe retry", async () => {
    const registry = createBackgroundJobRegistry();
    const onError = jest.fn();
    registry.reserve("company:run");

    await registry.run("company:run", async () => {
      throw new Error("delivery failed");
    }, onError);

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "delivery failed" }));
    expect(registry.get("company:run")).toBeNull();
    expect(registry.reserve("company:run").acquired).toBe(true);
  });

  test("can release a reservation when preflight validation fails", () => {
    const registry = createBackgroundJobRegistry();
    registry.reserve("company:run");
    registry.release("company:run");

    expect(registry.get("company:run")).toBeNull();
  });
});
