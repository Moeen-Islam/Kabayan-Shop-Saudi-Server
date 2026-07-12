import dotenv from "dotenv";
dotenv.config();

const pixelId = "802803573462056";
const fbAccessToken = process.env.FB_ACCESS_TOKEN;

console.log("Pixel ID:", pixelId);
console.log("Token length:", fbAccessToken ? fbAccessToken.length : 0);

async function testCapi() {
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${fbAccessToken}`);
    const resData = await res.json();
    console.log("Response Status:", res.status);
    console.log("Response Data:", JSON.stringify(resData, null, 2));
  } catch (err: any) {
    console.error("Fetch error:", err);
  }
}

testCapi();
