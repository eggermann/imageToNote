import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const describeImage = async (base64Image: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image.split(',')[1] 
            }
          },
          {
            text: "Analyze this image. Describe the main shapes, objects, and lighting in 10 words. Focus on structural geometry. Example: 'Circular face shadow against grid background'."
          }
        ]
      }
    });
    return response.text || "Geometric structural void";
  } catch (error) {
    console.error("Gemini Vision Error:", error);
    return "Signal interference";
  }
};

export const generateBauhausImage = async (description: string, note: string): Promise<string | null> => {
  try {
    // "based on the {desc} cretae a fitting situation"
    const prompt = `
      Create a Bauhaus constructivist style artwork.
      Based on this description: "${description}", create a fitting abstract architectural situation or geometric composition.
      Key Musical Note: ${note}.
      Style: Oskar Schlemmer costumes, heavy grain, photogram style, beige paper texture.
      Composition: Dynamic diagonal lines, circles, triangles.
      Colors: Beige (#f4f1ea), Black (#1a1a1a), Red (#D02120).
    `;

    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: prompt,
      config: {
        numberOfImages: 1,
        aspectRatio: '4:3',
        outputMimeType: 'image/jpeg'
      }
    });

    if (response.generatedImages && response.generatedImages.length > 0) {
        const base64ImageBytes = response.generatedImages[0].image.imageBytes;
        return `data:image/jpeg;base64,${base64ImageBytes}`;
    }
    return null;

  } catch (error) {
    console.error("Gemini Image Gen Error:", error);
    // Fallback
    try {
       const fallbackResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [{ text: `Bauhaus constructivist geometric art poster: ${description}` }],
          },
          config: { responseModalities: [Modality.IMAGE] },
        });
        
        for (const part of fallbackResponse.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            return `data:image/png;base64,${part.inlineData.data}`;
          }
        }
    } catch(e) {
        console.error("Fallback failed", e);
    }
    return null;
  }
};