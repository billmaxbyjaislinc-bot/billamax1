import { GoogleGenAI } from "@google/genai";

export async function generateLogo() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          text: 'A professional app logo for "Billmax". The logo features a vibrant blue background. In the center, there is a stylized white letter "B" designed to look like a folded receipt. The bottom of the receipt has a jagged edge, and there is a black barcode printed on the lower half of the "B". On the top left corner of the "B", there is a small green shield icon with a white checkmark inside. Below the icon, the word "Billmax" is written in a clean, modern, bold white sans-serif font. The overall style is flat, modern, and high-quality.',
        },
      ],
    },
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return part.inlineData.data;
    }
  }
  throw new Error("No image data generated");
}
