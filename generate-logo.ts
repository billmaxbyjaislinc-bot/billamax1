import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not set in the environment.");
    process.exit(1);
  }
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: {
        parts: [
          {
            text: 'A professional app logo for "Billmax". The logo features a vibrant blue background. In the center, there is a stylized white letter "B" designed to look like a folded receipt. The bottom of the receipt has a jagged edge, and there is a black barcode printed on the lower half of the "B". On the top left corner of the "B", there is a small green shield icon with a white checkmark inside. Below the icon, the word "Billmax" is written in a clean, modern, bold white sans-serif font. The overall style is flat, modern, and high-quality.',
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "1K"
        }
      }
    });

    if (!response.candidates?.[0]?.content?.parts) {
      console.error("No candidates or parts in response:", JSON.stringify(response, null, 2));
      return;
    }

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        const base64Data = part.inlineData.data;
        const buffer = Buffer.from(base64Data, 'base64');
        const publicDir = path.join(process.cwd(), 'public');
        if (!fs.existsSync(publicDir)) {
          fs.mkdirSync(publicDir, { recursive: true });
        }
        fs.writeFileSync(path.join(publicDir, 'splash.png'), buffer);
        console.log("Logo generated and saved to /public/splash.png");
        return;
      }
    }
    console.error("No image data generated in parts:", JSON.stringify(response.candidates[0].content.parts, null, 2));
  } catch (error) {
    console.error("Error generating logo:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
  }
}

main();
