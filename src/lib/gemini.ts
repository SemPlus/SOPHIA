export async function generateLesson(category: string, level: string = 'intermediate', contextHistory: string[] = [], topic?: string) {
  const res = await fetch('/api/gemini/lesson', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, level, contextHistory, topic }),
  });
  if (!res.ok) throw new Error('Failed to generate lesson');
  return res.json();
}

export async function chatWithConnoisseur(message: string, history: any[], context: string) {
  // Try On-Device AI (Gemma) if available in Chrome
  const win = window as any;
  const aiModel = win.ai?.languageModel || win.ai?.assistant;
  
  if (aiModel) {
    try {
      const capabilities = await aiModel.capabilities();
      if (capabilities.available !== 'no') {
        const session = await aiModel.create({
          systemPrompt: `You are a sophisticated, erudite cultural guide. Talk to the user about ${context}. Provide deep context, historical anecdotes, and encourage critical thinking. Keep the tone scholarly yet accessible, like a museum curator or an Oxford professor.`
        });
        
        // Construct history string
        const historyStr = history.map(h => `${h.role === 'user' ? 'User' : 'Connoisseur'}: ${h.parts[0].text}`).join('\n');
        const prompt = historyStr ? `${historyStr}\nUser: ${message}\nConnoisseur:` : message;
        
        const result = await session.prompt(prompt);
        // Sessions should be managed, but for simplicity we create/destroy
        if (session.destroy) session.destroy();
        return { text: result };
      }
    } catch (error) {
      console.warn("On-device AI (Gemma) is available but failed to respond. Falling back to server-side Flash.", error);
    }
  }

  const res = await fetch('/api/gemini/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history, context }),
  });
  if (!res.ok) throw new Error('Failed to chat');
  return res.json();
}

export async function getReadingList() {
  const res = await fetch('/api/gemini/reading-list', {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to get reading list');
  return res.json();
}

export async function analyzeMasterpiece(image?: string, text?: string) {
  const res = await fetch('/api/gemini/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image, text }),
  });
  if (!res.ok) throw new Error('Failed to analyze');
  return res.json();
}
