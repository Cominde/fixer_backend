exports.normalizeCarNumber = (carNumber) => {
  if (!carNumber) return "";

  // 1. Strip carriage returns, newlines, and leading/trailing whitespace
  let normalized = carNumber.replace(/[\r\n]/g, "").trim();

  // 2. Convert Arabic-Indic numerals (٠١٢...) to Western (012...)
  normalized = normalized.replace(/[٠-٩]/g, (d) =>
    String("٠١٢٣٤٥٦٧٨٩".indexOf(d)),
  );

  // 3. Convert Eastern Arabic-Indic (۰۱۲...) to Western — extra safety
  normalized = normalized.replace(/[۰-۹]/g, (d) =>
    String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)),
  );

  // 4. Collapse multiple spaces into one
  normalized = normalized.replace(/\s+/g, " ");

  // 5. Normalize any dash variant surrounded by optional spaces → " - "
  normalized = normalized.replace(/\s*[-–—−]\s*/g, " - ");

  const parts = normalized.split(" - ");

  if (parts.length === 2) {
    const isNumbers = (str) => /^\d+$/.test(str.trim());

    const rawA = parts[0].trim();
    const rawB = parts[1].trim();

    // Determine which part is numbers and which is letters
    const numberPart = isNumbers(rawA) ? rawA : rawB;
    const letterPart = isNumbers(rawA) ? rawB : rawA;

    // Extract only Arabic letters, then join with single spaces between each
    const arabicLetters = letterPart
      .split("")
      .filter((c) => /[\u0600-\u06FF]/.test(c)); // drop spaces, Latin chars, symbols

    // Rebuild: always "digits - ل م د" (one space between letters)
    return `${numberPart} - ${arabicLetters.join(" ")}`;
  }

  // Fallback: return whatever we have cleaned up
  return normalized;
};
