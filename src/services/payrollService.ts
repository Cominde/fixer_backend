const mongoose = require("mongoose");
const Worker = require("../models/Worker");
const Repairing = require("../models/repairingModel");
const PayrollSnapshot = require("../models/PayrollSnapshot");
const { cairoPeriod, cairoMonthRange } = require("../utils/cairoTime");

const periodRange = (period: string) => {
  const [year, month] = period.split("-").map(Number);
  return cairoMonthRange(year, month);
};

/** Repairs each worker completed in [period], keyed by worker id. */
const completedRepairCounts = async (workerIds, period: string) => {
  const ids = workerIds
    .map((id) => String(id))
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  if (ids.length === 0) return new Map<string, number>();
  const { start, end } = periodRange(period);
  const rows = await Repairing.aggregate([
    {
      $match: {
        complete: true,
        completedAt: { $gte: start, $lt: end },
        "technicians.workerId": { $in: ids },
      },
    },
    { $unwind: "$technicians" },
    { $match: { "technicians.workerId": { $in: ids } } },
    // A worker listed twice on one repair still counts that repair once.
    { $group: { _id: { w: "$technicians.workerId", r: "$_id" } } },
    { $group: { _id: "$_id.w", count: { $sum: 1 } } },
  ]);
  return new Map<string, number>(rows.map((r) => [String(r._id), r.count]));
};

/**
 * Sets `monthlyRepairs` to the number of repairs each worker actually
 * completed this Cairo month. Replaces the old +1/−1 bookkeeping, which
 * drifted on re-ticks, edits and deletes.
 */
export const refreshMonthlyRepairs = async (workerIds) => {
  const unique: string[] = [
    ...new Set<string>(
      (workerIds || [])
        .filter(Boolean)
        .map((id) => String(id))
        .filter((id) => mongoose.Types.ObjectId.isValid(id)),
    ),
  ];
  if (unique.length === 0) return;
  try {
    const counts = await completedRepairCounts(unique, cairoPeriod());
    await Worker.bulkWrite(
      unique.map((id) => ({
        updateOne: {
          filter: { _id: id },
          update: { $set: { monthlyRepairs: counts.get(id) || 0 } },
        },
      })),
    );
  } catch (error) {
    console.error("Failed to refresh monthly repair counts:", error);
  }
};

export const technicianIds = (repair) =>
  (repair?.technicians || [])
    .map((t) => t?.workerId)
    .filter(Boolean)
    .map((id) => String(id));

/** Adds [workers]' current pay to the snapshot of [period]. */
const snapshotPayroll = async (period: string, workers) => {
  if (workers.length === 0) return;
  const snapshot =
    (await PayrollSnapshot.findOne({ period })) ||
    new PayrollSnapshot({ period, workers: [] });
  const byId = new Map(
    snapshot.workers.map((w) => [String(w.workerId), w]),
  );
  for (const worker of workers) {
    byId.set(String(worker._id), {
      workerId: worker._id,
      name: worker.name,
      salary: worker.salary,
      salaryAfterProcces: worker.salaryAfterProcces,
      salaryAfterReword: worker.salaryAfterReword,
      monthlyRepairs: worker.monthlyRepairs,
    });
  }
  snapshot.workers = [...byId.values()];
  snapshot.totalSalaries = snapshot.workers.reduce(
    (sum, w) => sum + (Number(w.salaryAfterProcces) || 0),
    0,
  );
  await snapshot.save();
};

/**
 * Starts the current payroll month for one worker document, in memory.
 * Workers that never had a period are assumed to already be on the current
 * month (their numbers are kept). Returns true when the worker was reset.
 */
export const rollWorkerIntoCurrentPeriod = (worker) => {
  const current = cairoPeriod();
  if (!worker.salaryPeriod) {
    worker.salaryPeriod = current;
    return false;
  }
  if (worker.salaryPeriod === current) return false;
  worker.salaryAfterProcces = worker.salary;
  worker.salaryAfterReword = worker.salary;
  worker.monthlyRepairs = 0;
  worker.salaryPeriod = current;
  return true;
};

/**
 * Month close for every worker: snapshot last month's pay, then reset net
 * salary and monthly repairs. Safe to run any number of times; workers
 * already on the current month are left alone. Runs from the monthly cron
 * and on server start, so a missed cron catches up.
 */
export const rollPayrollIntoCurrentPeriod = async () => {
  const current = cairoPeriod();
  const workers = await Worker.find({ salaryPeriod: { $ne: current } });
  const toClose = new Map<string, any[]>();
  for (const worker of workers) {
    if (worker.salaryPeriod) {
      const list = toClose.get(worker.salaryPeriod) || [];
      list.push(worker);
      toClose.set(worker.salaryPeriod, list);
    }
  }
  for (const [period, list] of toClose) {
    await snapshotPayroll(period, list);
  }

  let reset = 0;
  for (const worker of workers) {
    if (rollWorkerIntoCurrentPeriod(worker)) reset++;
    await worker.save({ validateBeforeSave: false });
  }
  return { processedWorkers: workers.length, resetWorkers: reset, period: current };
};

/** Recounts `monthlyRepairs` for every worker (server start / month close). */
export const refreshAllMonthlyRepairs = async () => {
  const workers = await Worker.find({}).select("_id");
  await refreshMonthlyRepairs(workers.map((w) => w._id));
};
