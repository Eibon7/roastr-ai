#!/usr/bin/env node
require("dotenv").config();
const axios = require("axios");

const comment = process.argv.slice(2).join(" ");
if (!comment) {
  console.log("❌ Por favor, introduce un comentario para roast.");
  process.exit(1);
}

(async () => {
  try {
    const res = await axios.post(
      "https://roastr-lhcp7seuh-eibon7s-projects.vercel.app/roast",
      { message: comment },
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ROASTR_API_KEY,
        },
      }
    );
    console.log("[Roastr.ai] 🤖", res.data.roast);
  } catch (err) {
    if (err.response) {
      console.error("Error:", err.response.data);
    } else {
      console.error("Error:", err.message);
    }
  }
})();
