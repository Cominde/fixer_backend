exports.normalizeCarNumber = (carNumber) => {
  if (!carNumber) return "";

  let normalized = carNumber.replace(/\r/g, "").replace(/\n/g, "").trim();

  // Convert Arabic-Indic numerals (٠١٢...) to Western (012...)
  normalized = normalized.replace(/[٠-٩]/g, (d) =>
    "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString(),
  );

  // Collapse multiple spaces into one
  normalized = normalized.replace(/\s+/g, " ");

  // Normalize dash area → " - "
  normalized = normalized.replace(/\s*[-–—]\s*/g, " - ");

  const parts = normalized.split(" - ");
  if (parts.length === 2) {
    const isNumbers = (str) => /^\d+$/.test(str.trim());

    const rawA = parts[0].trim();
    const rawB = parts[1].trim();

    const numberPart = isNumbers(rawA) ? rawA : rawB;
    const letterPart = isNumbers(rawA) ? rawB : rawA;

    const normalizedLetters = letterPart
      .replace(/\s+/g, "")
      .split("")
      .filter((c) => /[\u0600-\u06FF]/.test(c))
      .join(" ");

    return `${numberPart} - ${normalizedLetters}`;
  }

  return normalized;
};
