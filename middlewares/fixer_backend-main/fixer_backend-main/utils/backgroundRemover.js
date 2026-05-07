const axios = require("axios");
const FormData = require("form-data");

async function removeBgExternal(buffer) {
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
}

module.exports = { removeBgExternal };
