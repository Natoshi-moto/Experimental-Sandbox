import { assertCanonicalValue } from "../core/canonical.mjs";
import { invariant } from "../core/errors.mjs";
import {
  deriveDataRouteDecision,
  resolveAcceptedRouteContext,
} from "../core/resolver.mjs";

const ROUTE_EXECUTION_PLAN_REFERENCE_KEYS = Object.freeze([
  "route_execution_plan_id",
  "route_execution_plan_root",
]);
const RESOLVER_OPTION_KEYS = Object.freeze(["resolver"]);

function exactKeys(value, expected, label) {
  invariant(
    value !== null && typeof value === "object" && !Array.isArray(value),
    "ERR_SCHEMA",
    `${label} must be an object`,
  );
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  invariant(
    actual.length === wanted.length &&
      actual.every((key, index) => key === wanted[index]),
    "ERR_SCHEMA",
    `${label} has unexpected or missing fields`,
  );
}

export function decideDataRoute(reference, options) {
  exactKeys(
    reference,
    ROUTE_EXECUTION_PLAN_REFERENCE_KEYS,
    "route execution plan reference",
  );
  assertCanonicalValue(reference);
  exactKeys(options, RESOLVER_OPTION_KEYS, "route resolver options");
  const acceptedContext = resolveAcceptedRouteContext(
    options.resolver,
    reference,
  );
  return deriveDataRouteDecision(acceptedContext);
}
