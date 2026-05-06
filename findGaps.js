const mongoose = require("mongoose");
require("dotenv").config({ path: "./config.env" });

mongoose.connect(process.env.DB_URL).then(() => {
  console.log("✅ Connected to MongoDB");
  run();
});

// ─── Helper: جيب تاريخ بدون وقت (YYYY-MM-DD) ─────────────────────────────
function toDateOnly(date) {
  return new Date(date).toISOString().split("T")[0];
}

async function run() {
  const db = mongoose.connection.db;
  const collection = db.collection("repairings");

  // ── Step 1: جيب الـ 6 فواتير اللي genId بتاعها أكبر من 20211741 ──────────
  const bigDocs = await collection
    .aggregate([
      { $match: { $expr: { $gt: [{ $toInt: "$genId" }, 20211741] } } },
      { $sort: { updatedAt: 1 } }, // رتبهم من الأقدم للأحدث
    ])
    .toArray();

  if (bigDocs.length === 0) {
    console.log("✅ No documents to process");
    process.exit(0);
  }

  console.log(`📋 Found ${bigDocs.length} invoices to reposition:`);
  bigDocs.forEach((d) =>
    console.log(`   genId: ${d.genId} | updatedAt: ${toDateOnly(d.updatedAt)}`),
  );
  console.log("");

  // ── Step 2: جيب كل الفواتير العادية (أصغر من 20211741) مرتبة ─────────────
  const normalDocs = await collection
    .find(
      { $expr: { $lte: [{ $toInt: "$genId" }, 20211741] } },
      { projection: { genId: 1, updatedAt: 1 } },
    )
    .sort({ genId: 1 })
    .toArray();

  // ── Step 3: عمل Set من الأرقام الموجودة ──────────────────────────────────
  const usedIds = new Set(normalDocs.map((d) => parseInt(d.genId.slice(4))));

  // ── Step 4: عمل Map من التاريخ → الأرقام الموجودة في اليوم ده ─────────────
  // { "2024-01-10": [1001, 1002, 1005, 1010], ... }
  const dateToIds = {};
  for (const doc of normalDocs) {
    const dateKey = toDateOnly(doc.updatedAt);
    if (!dateToIds[dateKey]) dateToIds[dateKey] = [];
    dateToIds[dateKey].push(parseInt(doc.genId.slice(4)));
  }

  // ── Step 5: عمل قائمة بكل التواريخ مرتبة ────────────────────────────────
  const allDates = Object.keys(dateToIds).sort();

  // ── Step 6: دالة تلاقي أول gap في يوم معين ───────────────────────────────
  function findGapInDay(dateKey, alreadyUsed) {
    const idsInDay = (dateToIds[dateKey] || []).slice().sort((a, b) => a - b);
    if (idsInDay.length === 0) return null;

    // دور على gap بين أرقام اليوم ده
    for (let i = 0; i < idsInDay.length - 1; i++) {
      for (let gap = idsInDay[i] + 1; gap < idsInDay[i + 1]; gap++) {
        if (!usedIds.has(gap) && !alreadyUsed.has(gap)) {
          return gap;
        }
      }
    }
    return null;
  }

  // ── Step 7: لكل فاتورة من الـ 6 دور على أقرب gap ────────────────────────
  const alreadyAssigned = new Set(); // عشان ما نديش نفس الـ gap لاتنين
  const assignments = []; // النتايج

  for (const doc of bigDocs) {
    const docDate = toDateOnly(doc.updatedAt);
    let foundGap = null;
    let foundDate = null;

    // ابدأ من نفس اليوم وامشي للأمام
    const startIndex = allDates.indexOf(docDate);
    const searchDates =
      startIndex === -1 ? allDates : allDates.slice(startIndex);

    for (const dateKey of searchDates) {
      const gap = findGapInDay(dateKey, alreadyAssigned);
      if (gap !== null) {
        foundGap = gap;
        foundDate = dateKey;
        break;
      }
    }

    if (foundGap === null) {
      console.log(`⚠️  No gap found for genId: ${doc.genId} — skipping`);
      continue;
    }

    alreadyAssigned.add(foundGap);
    assignments.push({
      doc,
      newGenId: `2021${String(foundGap).padStart(4, "0")}`,
      foundDate,
    });

    console.log(
      `✅ ${doc.genId} (${toDateOnly(doc.updatedAt)}) → 2021${String(foundGap).padStart(4, "0")} (gap in ${foundDate})`,
    );
  }

  // ── Step 8: طبّق التغييرات في الـ DB ─────────────────────────────────────
  console.log("\n💾 Saving to database...");

  for (const { doc, newGenId } of assignments) {
    await collection.updateOne(
      { _id: doc._id },
      {
        $set: {
          genId: newGenId,
          oldGenId: doc.genId, // احفظ القديم
        },
      },
    );
    console.log(`   Saved: ${doc.genId} → ${newGenId}`);
  }

  console.log("\n🎉 Done!");
  process.exit(0);
}
