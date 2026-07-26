export class ProtocolError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = "ProtocolError";
    this.code = code;
    this.details = details;
  }
}

export function fail(code, message, details = null) {
  throw new ProtocolError(code, message, details);
}

export function invariant(condition, code, message, details = null) {
  if (!condition) {
    fail(code, message, details);
  }
}

export function reasonOf(error) {
  if (error instanceof ProtocolError) {
    return error.code;
  }
  return "ERR_INTERNAL";
}
