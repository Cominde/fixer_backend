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
    // Only fall back to Slazzer on HTTP 402 (payment required / out of credits)
    if (error.response && error.response.status === 402) {
      console.warn("⚠️ remove.bg API returned 402 (out of credits), falling back to Slazzer API");
      try {
        const form = new FormData();
        form.append("source_image_file", buffer, "image.png");

        const response = await axios.post(
          "https://api.slazzer.com/v2.0/remove_image_background",
          form,
          {
            headers: {
              ...form.getHeaders(),
              "API-KEY": process.env.SLAZZER_API_KEY,
            },
            responseType: "arraybuffer",
          }
        );

        console.log("✅ Background removed using Slazzer API");
        return Buffer.from(response.data, "binary");
      } catch (slazzerError) {
        console.error("❌ Slazzer API fallback failed:", slazzerError.message);
        // Return original buffer if Slazzer fails
        console.warn("⚠️ Returning original image without background removal");
        return buffer;
      }
    }
    
    // For any other error (network error, 5xx, timeout, etc.), do NOT fall back
    // Return a clear error message
    const errorMessage = error.response 
      ? `remove.bg API error: ${error.response.status} - ${error.response.statusText}`
      : error.message || "Unknown error occurred with remove.bg API";
    
    console.error(`❌ ${errorMessage}`);
    throw new Error(errorMessage);
  }
}

module.exports = { removeBgExternal };
