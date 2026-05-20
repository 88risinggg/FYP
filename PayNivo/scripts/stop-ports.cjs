const { execFileSync } = require("node:child_process");

const ports = process.argv.slice(2).map(Number).filter(Number.isInteger);

if (ports.length === 0) {
  process.exit(0);
}

function run(command, args) {
  try {
    return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return "";
  }
}

function killWindowsPorts() {
  const output = run("netstat.exe", ["-ano", "-p", "tcp"]);
  const pids = new Set();

  for (const line of output.split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5 || parts[0] !== "TCP") continue;

    const localAddress = parts[1];
    const state = parts[3];
    const pid = parts[4];
    const port = Number(localAddress.slice(localAddress.lastIndexOf(":") + 1));

    if (ports.includes(port) && state === "LISTENING") {
      pids.add(pid);
    }
  }

  for (const pid of pids) {
    run("taskkill.exe", ["/PID", pid, "/F"]);
  }
}

function killUnixPorts() {
  for (const port of ports) {
    const output = run("lsof", ["-ti", `tcp:${port}`]);
    for (const pid of output.split(/\s+/).filter(Boolean)) {
      run("kill", ["-9", pid]);
    }
  }
}

if (process.platform === "win32") {
  killWindowsPorts();
} else {
  killUnixPorts();
}
