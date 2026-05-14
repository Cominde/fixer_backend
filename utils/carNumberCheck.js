exports.normalizeCarNumber = (carNumber) => {
  if (!carNumber) return "";

  // 1. Strip carriage returns, newlines, trim
  let normalized = carNumber.replace(/[\r\n]/g, "").trim();

  // 2. Convert Arabic-Indic numerals (٠١٢...) to Western
  normalized = normalized.replace(/[٠-٩]/g, (d) =>
    String("٠١٢٣٤٥٦٧٨٩".indexOf(d)),
  );

  // 3. Convert Persian-Indic numerals (۰۱۲...) to Western
  normalized = normalized.replace(/[۰-۹]/g, (d) =>
    String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)),
  );

  // 4. Collapse spaces
  normalized = normalized.replace(/\s+/g, " ");

  // 5. Normalize any dash variant → " - "
  normalized = normalized.replace(/\s*[-–—−]\s*/g, " - ");

  const parts = normalized.split(" - ");

  if (parts.length === 2) {
    const isNumbers = (str) => /^\d+$/.test(str.trim());

    const rawA = parts[0].trim();
    const rawB = parts[1].trim();

    // ✅ Always put numbers first regardless of input order
    const numberPart = isNumbers(rawA) ? rawA : rawB;
    const letterPart = isNumbers(rawA) ? rawB : rawA;

    // Extract only Arabic letters, single space between each
    const arabicLetters = letterPart
      .split("")
      .filter((c) => /[\u0600-\u06FF]/.test(c));

    // Always returns: "719 - م ب ق"
    return `${numberPart} - ${arabicLetters.join(" ")}`;
  }

  return normalized;
};
