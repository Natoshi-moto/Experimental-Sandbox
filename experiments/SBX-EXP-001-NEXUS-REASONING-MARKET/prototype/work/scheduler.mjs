import { assertCanonicalValue } from "../core/canonical.mjs";
import { invariant } from "../core/errors.mjs";

const READY_STATUSES = new Set(["WAITING", "READY"]);

const BLOCKER_ORDER = Object.freeze([
  "JOB_NOT_ACTIVE",
  "TASK_NOT_SCHEDULABLE",
  "DEPENDENCY_MISSING",
  "DEPENDENCY_NOT_ACCEPTED",
  "BEFORE_EARLIEST_TICK",
  "DEADLINE_REACHED",
  "ATTEMPTS_EXHAUSTED",
  "COMPUTE_BUDGET_EXHAUSTED",
  "ROUTE_UNSUPPORTED",
  "ACTIVE_LEASE_CONFLICT",
  "NO_ELIGIBLE_WORKER",
]);

const BLOCKER_RANK = new Map(
  BLOCKER_ORDER.map((reason, index) => [reason, index]),
);

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertSafeInteger(value, label) {
  invariant(
    Number.isSafeInteger(value),
    "ERR_UNSAFE_INTEGER",
    `${label} must be a safe integer`,
  );
}

function assertNonNegativeInteger(value, label) {
  assertSafeInteger(value, label);
  invariant(value >= 0, "ERR_UNSAFE_INTEGER", `${label} must be non-negative`);
}

function canonicalStringSet(values, label) {
  invariant(Array.isArray(values), "ERR_SCHEMA", `${label} must be an array`);
  const copy = values.map((value, index) => {
    invariant(
      typeof value === "string" && value.length > 0,
      "ERR_SCHEMA",
      `${label}[${index}] must be a non-empty string`,
    );
    return value;
  });
  return [...new Set(copy)].sort();
}

function orderedBlockers(blockers) {
  return [...new Set(blockers)].sort((left, right) => {
    const leftRank = BLOCKER_RANK.get(left) ?? BLOCKER_ORDER.length;
    const rightRank = BLOCKER_RANK.get(right) ?? BLOCKER_ORDER.length;
    return leftRank - rightRank || compareStrings(left, right);
  });
}

function normalizeTaskIndex(tasksById) {
  if (Array.isArray(tasksById)) {
    const index = new Map();
    for (const task of tasksById) {
      invariant(
        task && typeof task.task_id === "string",
        "ERR_SCHEMA",
        "tasksById entries require task_id",
      );
      invariant(
        !index.has(task.task_id),
        "ERR_SCHEMA",
        `duplicate task ${task.task_id}`,
      );
      index.set(task.task_id, task);
    }
    return index;
  }

  invariant(
    tasksById && typeof tasksById === "object",
    "ERR_SCHEMA",
    "tasksById must be an array or plain object",
  );
  const index = new Map();
  for (const taskId of Object.keys(tasksById).sort()) {
    const task = tasksById[taskId];
    invariant(
      task && task.task_id === taskId,
      "ERR_SCHEMA",
      `task index key ${taskId} does not match task_id`,
    );
    index.set(taskId, task);
  }
  return index;
}

function hasLeaseConflict(task, taskIndex, activeLeases) {
  const directConflicts = new Set(
    canonicalStringSet(task.conflict_set ?? [], "task.conflict_set"),
  );

  for (const lease of activeLeases) {
    if (
      !lease ||
      lease.status !== "ACTIVE" ||
      lease.job_id !== task.job_id
    ) {
      continue;
    }
    if (lease.task_id === task.task_id || directConflicts.has(lease.task_id)) {
      return true;
    }

    const leasedTask = taskIndex.get(lease.task_id);
    if (!leasedTask) {
      continue;
    }
    const reverseConflicts = new Set(leasedTask.conflict_set ?? []);
    if (reverseConflicts.has(task.task_id)) {
      return true;
    }
    if (
      typeof task.concurrency_group === "string" &&
      task.concurrency_group.length > 0 &&
      leasedTask.concurrency_group === task.concurrency_group
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Evaluate one task without changing the task, job, leases, or indexes.
 *
 * Eligibility is deliberately supplied as already-validated seat IDs. This
 * keeps the scheduler independent from probing and makes the scheduling
 * decision replayable from canonical facts.
 */
export function evaluateTaskReadiness({
  task,
  job,
  tick,
  tasksById,
  activeLeases = [],
  eligibleWorkerSeatIds = [],
  maxAttempts,
  remainingComputeUnits,
  routeSupported,
}) {
  assertCanonicalValue(task);
  invariant(job && typeof job === "object", "ERR_SCHEMA", "job is required");
  assertCanonicalValue(job);
  assertNonNegativeInteger(tick, "tick");
  invariant(
    task.job_id === job.job_id,
    "ERR_TASK_STALE",
    "task and job IDs do not match",
  );
  invariant(
    Array.isArray(activeLeases),
    "ERR_SCHEMA",
    "activeLeases must be an array",
  );
  const workerSeatIds = canonicalStringSet(
    eligibleWorkerSeatIds,
    "eligibleWorkerSeatIds",
  );
  assertNonNegativeInteger(maxAttempts, "maxAttempts");
  assertNonNegativeInteger(remainingComputeUnits, "remainingComputeUnits");
  invariant(
    typeof routeSupported === "boolean",
    "ERR_SCHEMA",
    "routeSupported must be boolean",
  );

  for (const field of [
    "attempt",
    "earliest_tick",
    "deadline_tick",
    "phase_rank",
    "priority",
    "max_compute_units",
  ]) {
    assertNonNegativeInteger(task[field], `task.${field}`);
  }
  invariant(
    task.earliest_tick < task.deadline_tick,
    "ERR_TICK",
    "task tick window must be non-empty",
  );

  const taskIndex = normalizeTaskIndex(tasksById);
  const dependencies = canonicalStringSet(
    task.dependencies ?? [],
    "task.dependencies",
  );
  const blockers = [];

  if (job.state !== "ACTIVE") blockers.push("JOB_NOT_ACTIVE");
  if (!READY_STATUSES.has(task.status)) blockers.push("TASK_NOT_SCHEDULABLE");

  for (const dependencyId of dependencies) {
    const dependency = taskIndex.get(dependencyId);
    if (!dependency) {
      blockers.push("DEPENDENCY_MISSING");
    } else if (dependency.status !== "ACCEPTED") {
      blockers.push("DEPENDENCY_NOT_ACCEPTED");
    }
  }

  if (tick < task.earliest_tick) blockers.push("BEFORE_EARLIEST_TICK");
  if (tick >= task.deadline_tick) blockers.push("DEADLINE_REACHED");
  if (task.attempt > maxAttempts) blockers.push("ATTEMPTS_EXHAUSTED");
  if (task.max_compute_units > remainingComputeUnits) {
    blockers.push("COMPUTE_BUDGET_EXHAUSTED");
  }
  if (!routeSupported) blockers.push("ROUTE_UNSUPPORTED");
  if (hasLeaseConflict(task, taskIndex, activeLeases)) {
    blockers.push("ACTIVE_LEASE_CONFLICT");
  }
  if (workerSeatIds.length === 0) blockers.push("NO_ELIGIBLE_WORKER");

  const reasonCodes = orderedBlockers(blockers);
  return Object.freeze({
    task_id: task.task_id,
    ready: reasonCodes.length === 0,
    reason_codes: Object.freeze(reasonCodes),
    eligible_worker_seat_ids: Object.freeze(workerSeatIds),
    order_key: Object.freeze(taskOrderKey(task)),
  });
}

export function taskOrderKey(task) {
  assertCanonicalValue(task);
  for (const field of [
    "phase_rank",
    "priority",
    "deadline_tick",
    "max_compute_units",
    "attempt",
  ]) {
    assertNonNegativeInteger(task[field], `task.${field}`);
  }
  invariant(
    typeof task.task_id === "string" && task.task_id.length > 0,
    "ERR_SCHEMA",
    "task.task_id is required",
  );
  return [
    task.phase_rank,
    task.priority,
    task.deadline_tick,
    task.max_compute_units,
    task.task_id,
    task.attempt,
  ];
}

export function compareTaskOrder(leftTask, rightTask) {
  const left = taskOrderKey(leftTask);
  const right = taskOrderKey(rightTask);
  for (const index of [0, 1, 2, 3]) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  const taskIdOrder = compareStrings(left[4], right[4]);
  if (taskIdOrder !== 0) return taskIdOrder;
  return left[5] - right[5];
}

export function orderReadyTasks(tasks) {
  invariant(Array.isArray(tasks), "ERR_SCHEMA", "tasks must be an array");
  return Object.freeze([...tasks].sort(compareTaskOrder));
}

/**
 * Evaluate independently prepared task contexts and return a stable plan.
 * Context insertion order cannot change either output list.
 */
export function scheduleReadyTasks(contexts) {
  invariant(Array.isArray(contexts), "ERR_SCHEMA", "contexts must be an array");
  const evaluated = contexts.map((context) => ({
    task: context.task,
    readiness: evaluateTaskReadiness(context),
  }));

  const ready = evaluated
    .filter((entry) => entry.readiness.ready)
    .sort((left, right) => compareTaskOrder(left.task, right.task))
    .map((entry) => entry.readiness);
  const blocked = evaluated
    .filter((entry) => !entry.readiness.ready)
    .sort((left, right) =>
      compareStrings(left.task.task_id, right.task.task_id),
    )
    .map((entry) => entry.readiness);

  return Object.freeze({
    ready: Object.freeze(ready),
    blocked: Object.freeze(blocked),
  });
}
