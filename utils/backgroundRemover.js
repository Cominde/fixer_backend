const axios = require("axios");
const FormData = require("form-data");

async function removeBgExternal(buffer) {
  try {
    const form = new FormData();
    form.append("image_file", buffer, "image.png");
    form.append("size", "auto");

    const response = await axios.post(
      "https://api.remove.bg/v1.0/removebg",
      form,
      {
        headers: {
          ...form.getHeaders(),
          "X-Api-Key": process.env.REMOVE_BG_API_KEY,
        },
        responseType: "arraybuffer",
      }
    );

    return Buffer.from(response.data, "binary");
  } catch (error) {
    // Handle 402 Payment Required error - use Slazzer free API as fallback
    if (error.response && error.response.status === 402) {
      console.warn("⚠️ remove.bg API payment required (402), using Slazzer free API fallback");
      try {
        const form = new FormData();
        form.append("source_image_file", buffer);

        const response = await axios.post(
          "https://api.slazzer.com/v1.0/remove_background",
          form,
          {
            headers: {
              ...form.getHeaders(),
              "X-Api-Key": process.env.SLAZZER_API_KEY || "YOUR_SLAZZER_API_KEY",
            },
            responseType: "arraybuffer",
          }
        );

        return Buffer.from(response.data, "binary");
      } catch (slazzerError) {
        console.error("❌ Slazzer API fallback failed:", slazzerError.message);
        // If Slazzer also fails, return original buffer
        return buffer;
      }
    }
    // Re-throw other errors
    throw error;
  }
}

module.exports = { removeBgExternal };
