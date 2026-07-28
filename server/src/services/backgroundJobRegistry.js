function createBackgroundJobRegistry() {
  const jobs = new Map();

  function reserve(key, startedAt = new Date().toISOString()) {
    const existing = jobs.get(key);
    if (existing) return { acquired: false, job: existing };

    const job = { startedAt, promise: null };
    jobs.set(key, job);
    return { acquired: true, job };
  }

  function run(key, task, onError = () => {}) {
    const job = jobs.get(key);
    if (!job) throw new Error(`Background job ${key} was not reserved.`);
    if (job.promise) return job.promise;

    job.promise = Promise.resolve()
      .then(task)
      .catch(onError)
      .finally(() => {
        if (jobs.get(key) === job) jobs.delete(key);
      });
    return job.promise;
  }

  function release(key) {
    jobs.delete(key);
  }

  function get(key) {
    return jobs.get(key) || null;
  }

  return { reserve, run, release, get };
}

module.exports = { createBackgroundJobRegistry };
