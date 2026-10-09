const mongoose = require("mongoose");
const Inventory = require("../models/Inventory");
const ApiError = require("../utils/apiError");
const { sendLowQuantityNotification } = require("./notificationFire");

/** qty > 0 takes from stock, qty < 0 puts back. */
export type StockChange = { id: string; qty: number };

const mergeChanges = (changes: StockChange[]) => {
  const byId = new Map<string, number>();
  for (const { id, qty } of changes) {
    const key = String(id);
    byId.set(key, (byId.get(key) || 0) + Number(qty));
  }
  return [...byId.entries()]
    .filter(([, qty]) => qty !== 0)
    .map(([id, qty]) => ({ id, qty }));
};

/** Undo for [applyStockChanges]: puts back what was taken and takes back what was returned. */
export const revertStockChanges = async (applied: StockChange[]) => {
  for (const { id, qty } of applied) {
    try {
      await Inventory.updateOne({ _id: id }, { $inc: { quantity: qty } });
    } catch (error) {
      console.error(`Failed to revert stock for ${id} (${qty}):`, error);
    }
  }
};

/**
 * Applies every change or none. Stock is only taken when enough is left,
 * checked and written in one atomic update, so two invoices can't sell the
 * same last unit. Returns the changes that were applied, for reverting.
 */
export const applyStockChanges = async (changes: StockChange[]) => {
  const merged = mergeChanges(changes);
  const applied: StockChange[] = [];
  const takenDocs = [];
  try {
    for (const { id, qty } of merged) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(`Component with ID ${id} not found in inventory`, 404);
      }
      if (qty > 0) {
        const doc = await Inventory.findOneAndUpdate(
          { _id: id, quantity: { $gte: qty } },
          { $inc: { quantity: -qty } },
          { new: true },
        );
        if (!doc) {
          const exists = await Inventory.exists({ _id: id });
          throw exists
            ? new ApiError(`Not enough quantity for component with id ${id}`, 400)
            : new ApiError(`Component with ID ${id} not found in inventory`, 404);
        }
        takenDocs.push(doc);
      } else {
        const doc = await Inventory.findByIdAndUpdate(
          id,
          { $inc: { quantity: -qty } },
          { new: true },
        );
        if (!doc) {
          throw new ApiError(`Component with ID ${id} not found in inventory`, 404);
        }
      }
      applied.push({ id, qty });
    }
  } catch (error) {
    await revertStockChanges(applied);
    throw error;
  }

  for (const doc of takenDocs) {
    if (doc.quantity < doc.alertQuantity) {
      try {
        await sendLowQuantityNotification(doc.name, doc.quantity);
      } catch (error) {
        console.error("Failed to send low quantity notification:", error);
      }
    }
  }
  return applied;
};

/**
 * The inventory item behind a repair/quote line. Lines store the inventory
 * id as their `_id`; older walk-in lines have a random id, so fall back to
 * the item name.
 */
export const findInventoryForLine = async (line) => {
  if (line?._id && mongoose.Types.ObjectId.isValid(line._id)) {
    const byId = await Inventory.findById(line._id);
    if (byId) return byId;
  }
  if (line?.name) return Inventory.findOne({ name: line.name });
  return null;
};
