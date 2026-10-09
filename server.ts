import express from 'express';
import cors from 'cors';
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'online', 
    timestamp: new Date().toISOString(),
    apiKeySet: !!process.env.GEMINI_API_KEY
  });
});

// Context-Aware Daily Guided Lesson Generator
app.post('/api/gemini/lesson', async (req, res) => {
  const { category, topic, level, contextHistory } = req.body;
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is missing in server environment' });
    }

    const contextPrompt = contextHistory && contextHistory.length > 0 
      ? `The user has recently studied: ${contextHistory.join(', ')}. Reference these previous concepts where appropriate.`
      : '';

    const target = topic ? `the specific topic "${topic}"` : `the category "${category}"`;

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: `Generate a MASSIVE cultural lesson for: ${target}. Level: ${level}. ${contextPrompt}
      Include: title, content (800 words), guide, quiz (5 questions), retentionPoints (5), note.`,
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
    if (text.includes('```')) {
      text = text.replace(/```json\n?/, '').replace(/\n?```/g, '');
    }

    try {
      const json = JSON.parse(text);
      res.json(json);
    } catch (parseError) {
      res.status(500).json({ error: 'Failed to parse AI response' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate lesson' });
  }
});

// Interactive Connoisseur Chat
app.post('/api/gemini/chat', async (req, res) => {
  const { message, history, context } = req.body;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash", 
      contents: [
        { role: 'user', parts: [{ text: `You are a sophisticated cultural guide for ${context}.` }] },
        ...history,
        { role: 'user', parts: [{ text: message }] }
      ]
    });
    res.json({ text: response.text });
  } catch (error) {
    res.status(500).json({ error: 'Failed to chat' });
  }
});

// Weekly Reading List Generator
app.post('/api/gemini/reading-list', async (req, res) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: "Generate a curated reading list of 3 books for cultural enrichment. Return ONLY JSON.",
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
    if (text.includes('```')) {
      text = text.replace(/```json\n?/, '').replace(/\n?```/g, '');
    }
    res.json(JSON.parse(text));
  } catch (error) {
    res.json([
      { title: "The Odyssey", author: "Homer", description: "Epic journey.", significance: "Foundation of literature." },
      { title: "Meditations", author: "Marcus Aurelius", description: "Stoic thoughts.", significance: "Ethical classic." },
      { title: "Divine Comedy", author: "Dante", description: "Afterlife vision.", significance: "Italian masterpiece." }
    ]);
  }
});

// Analysis of Art/Music/History (Multimodal)
app.post('/api/gemini/analyze', async (req, res) => {
  const { image, text } = req.body;
  try {
    const parts: any[] = [{ text: text || "Identify this cultural masterpiece." }];
    if (image) {
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: image.split(',')[1]
        }
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: { parts }
    });
    res.json({ text: response.text });
  } catch (error) {
    res.status(500).json({ error: 'Failed to analyze' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    
    app.get('*', async (req, res, next) => {
      const url = req.originalUrl;
      if (url.startsWith('/api')) return next();
      try {
        const templatePath = path.resolve(__dirname, 'index.html');
        let template = fs.readFileSync(templatePath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
    }
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      const indexFile = path.join(__dirname, 'dist', 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Not Found');
      }
    });
  }

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`SOPHIA server running on port ${PORT}`);
  });
}

export default app;

// Only start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}` || process.env.RUN_STANDALONE) {
  startServer().catch(err => console.error("Server start error:", err));
}
