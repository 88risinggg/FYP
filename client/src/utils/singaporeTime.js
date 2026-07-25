export const APPLICATION_TIMEZONE = "Asia/Singapore";

let installed = false;

function singaporeOptions(options = {}) {
  return { ...options, timeZone: APPLICATION_TIMEZONE };
}

/**
 * Browser APIs otherwise use the viewer's device timezone whenever a screen
 * omits timeZone. Install one application-wide default while retaining native
 * Date/Intl parsing and UTC ISO transport semantics.
 */
export function installSingaporeTimeDefaults() {
  if (installed || typeof Intl === "undefined" || typeof Date === "undefined") return;
  installed = true;

  const NativeDateTimeFormat = Intl.DateTimeFormat;
  Intl.DateTimeFormat = new Proxy(NativeDateTimeFormat, {
    apply(target, thisArg, argumentsList) {
      const [locales, options] = argumentsList;
      return Reflect.apply(target, thisArg, [locales || "en-SG", singaporeOptions(options)]);
    },
    construct(target, argumentsList, newTarget) {
      const [locales, options] = argumentsList;
      return Reflect.construct(target, [locales || "en-SG", singaporeOptions(options)], newTarget);
    }
  });

  for (const method of ["toLocaleString", "toLocaleDateString", "toLocaleTimeString"]) {
    const nativeMethod = Date.prototype[method];
    Object.defineProperty(Date.prototype, method, {
      configurable: true,
      writable: true,
      value(locales, options) {
        return nativeMethod.call(this, locales || "en-SG", singaporeOptions(options));
      }
    });
  }
}

export function formatSingaporeDateTime(value, options = {}) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return new Intl.DateTimeFormat("en-SG", singaporeOptions({ dateStyle: "medium", timeStyle: "short", ...options })).format(date);
}

export function singaporeDateKey(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", singaporeOptions({ year: "numeric", month: "2-digit", day: "2-digit" })).formatToParts(value instanceof Date ? value : new Date(value));
  const read = (type) => parts.find((part) => part.type === type)?.value;
  return `${read("year")}-${read("month")}-${read("day")}`;
}
