import express from 'express';
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createServer() {
  const app = express();
  app.use(express.json());

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || '',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  console.log("Initializing SOPHIA server...");

  // Context-Aware Daily Guided Lesson Generator
  app.post('/api/gemini/lesson', async (req, res) => {
    const { category, topic, level, contextHistory } = req.body;
    try {
      console.log(`Generating context-aware lesson for ${topic || category}...`);
      
      const contextPrompt = contextHistory && contextHistory.length > 0 
        ? `The user has recently studied: ${contextHistory.join(', ')}. Reference these previous concepts where appropriate to build a cohesive narrative of their cultural journey.`
        : '';

      const target = topic ? `the specific topic "${topic}" within the cultural context` : `the category "${category}"`;

      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: `Generate a MASSIVE, sophisticated, interactive daily lesson for a person seeking deep cultural enrichment.
        Target: ${target}
        Level: ${level}
        ${contextPrompt}
        
        The lesson MUST be substantial (at least 800 words of content) and include:
        1. A deep, scholarly title.
        2. 5-6 paragraphs of rich, high-context historical and cultural background.
        3. A detailed "Connoisseur's Guide" for a specific masterpiece or primary source.
        4. 5 interactive quiz questions with sophisticated explanations.
        5. 5 "Retention Points" (concise facts) for flashcard creation.
        6. A "Connoisseur's Note" providing a provocative or rare insight for high-level conversation.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              content: { type: Type.STRING },
              guide: { type: Type.STRING },
              quiz: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                    answerIndex: { type: Type.INTEGER },
                    explanation: { type: Type.STRING }
                  }
                }
              },
              retentionPoints: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    front: { type: Type.STRING },
                    back: { type: Type.STRING }
                  }
                }
              },
              note: { type: Type.STRING }
            }
          }
        }
      });

      let text = response.text || '{}';
      console.log("AI Response received, length:", text.length);
      
      // Clean markdown if present
      if (text.includes('```')) {
        text = text.replace(/```json\n?/, '').replace(/\n?```/g, '');
      }

      try {
        const json = JSON.parse(text);
        if (!json.title || !json.content) {
          throw new Error("Missing required fields in AI response");
        }
        res.json(json);
      } catch (parseError) {
        console.error("Failed to parse Gemini response. Raw text:", text.slice(0, 500), "...");
        res.status(500).json({ error: 'The archives are temporarily illegible. Please try again.' });
      }
    } catch (error) {
      console.error("Lesson generation error:", error);
      res.status(500).json({ error: 'Failed to generate lesson' });
    }
  });

  // Interactive Connoisseur Chat
  app.post('/api/gemini/chat', async (req, res) => {
    const { message, history, context } = req.body;
    try {
      const response = await ai.models.generateContent({
        model: "gemini-flash-latest", 
        contents: [
          { role: 'user', parts: [{ text: `You are a sophisticated, erudite cultural guide. Talk to the user about ${context}. Provide deep context, historical anecdotes, and encourage critical thinking. Keep the tone scholarly yet accessible, like a museum curator or an Oxford professor.` }] },
          ...history,
          { role: 'user', parts: [{ text: message }] }
        ]
      });
      res.json({ text: response.text });
    } catch (error) {
      console.error("Chat error:", error);
      res.status(500).json({ error: 'Failed to chat' });
    }
  });

  // Weekly Reading List Generator
  app.post('/api/gemini/reading-list', async (req, res) => {
    const fallbackList = [
      {
        title: "The Odyssey",
        author: "Homer",
        description: "An epic poem that follows the Greek hero Odysseus's ten-year journey home after the Trojan War.",
        significance: "The foundation of Western literature and the archetype for the 'hero's journey'."
      },
      {
        title: "Meditations",
        author: "Marcus Aurelius",
        description: "A series of personal writings by the Roman Emperor, recording his private notes to himself and ideas on Stoic philosophy.",
        significance: "One of the greatest works of spiritual and ethical reflection ever written."
      },
      {
        title: "Divine Comedy",
        author: "Dante Alighieri",
        description: "An epic poem that describes Dante's journey through Hell, Purgatory, and Paradise.",
        significance: "A masterpiece of world literature that helped establish the Italian language."
      }
    ];

    try {
      if (!process.env.GEMINI_API_KEY) {
        console.warn("GEMINI_API_KEY is missing, returning fallback reading list.");
        return res.json(fallbackList);
      }

      console.log("Generating reading list with Gemini...");
      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: "Generate a weekly curated reading list for cultural enrichment. Provide exactly 3 books. Each book must have a title, author, a sophisticated description, and its historical or cultural significance. Return ONLY the JSON array. Do not include markdown formatting or backticks.",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                author: { type: Type.STRING },
                description: { type: Type.STRING },
                significance: { type: Type.STRING }
              },
              required: ["title", "author", "description", "significance"]
            }
          }
        }
      });
      
      let text = response.text || '[]';
      // Clean up markdown if the model ignored the instruction
      if (text.trim().startsWith('```')) {
        text = text.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      }
      
      try {
        const json = JSON.parse(text);
        if (Array.isArray(json) && json.length > 0) {
          res.json(json);
        } else {
          throw new Error("Parsed JSON is not a valid reading list array");
        }
      } catch (parseError) {
        console.error("Failed to parse reading list JSON. Raw text:", text);
        res.json(fallbackList);
      }
    } catch (error) {
      console.error("Reading list generation error:", error);
      res.json(fallbackList);
    }
  });

  // Analysis of Art/Music/History (Multimodal)
  app.post('/api/gemini/analyze', async (req, res) => {
    const { image, text } = req.body;
    try {
      const parts: any[] = [{ text: text || "Identify this cultural masterpiece and provide deep, sophisticated context." }];
      if (image) {
        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: image.split(',')[1] // remove data:image/jpeg;base64,
          }
        });
      }

      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: { parts }
      });
      res.json({ text: response.text });
    } catch (error) {
      console.error("Analysis error:", error);
      res.status(500).json({ error: 'Failed to analyze' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    
    // Explicitly serve index.html via Vite transform
    app.get('*', async (req, res, next) => {
      const url = req.originalUrl;
      if (url.startsWith('/api')) return next(); // Don't handle API routes here

      try {
        const templatePath = path.resolve(__dirname, 'index.html');
        console.log(`Serving template from: ${templatePath}`);
        let template = fs.readFileSync(templatePath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, () => {
    console.log(`SOPHIA server running on port ${PORT}`);
  });
}

createServer().catch(err => {
  console.error("Failed to start server:", err);
});
