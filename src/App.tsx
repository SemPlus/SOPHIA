import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useOnlineStatus, usePWAInstall } from './lib/pwa';
import { generateLesson, chatWithConnoisseur, getReadingList, analyzeMasterpiece } from './lib/gemini';
import { db } from './lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Music, 
  BookOpen, 
  Palette, 
  Trophy, 
  ChevronRight, 
  MessageSquare, 
  Download, 
  WifiOff, 
  Menu,
  X,
  History,
  Lightbulb,
  CheckCircle2,
  BookMarked,
  Camera,
  Compass,
  Atom,
  Quote,
  LayoutDashboard,
  BrainCircuit,
  User as UserIcon,
  Search,
  MoreVertical,
  Zap,
  ArrowRight
} from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const Navbar = () => {
  const { user, login, logout } = useAuth();
  const isOnline = useOnlineStatus();

  return (
    <nav className="sticky top-0 z-40 bg-[#FBF9F5]/80 backdrop-blur-md border-b border-stone-200 lg:hidden">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl font-serif font-bold tracking-tight text-stone-900">SOPHIA</span>
          {!isOnline && (
            <WifiOff className="w-3 h-3 text-stone-400" />
          )}
        </div>

        <div className="flex items-center gap-4">
          {!user && (
            <button 
              onClick={login}
              className="bg-stone-900 text-white px-4 py-1.5 text-xs font-bold rounded-lg hover:bg-stone-800 transition-colors"
            >
              Sign In
            </button>
          )}
          {user && (
            <button onClick={logout} className="text-stone-400">
              <UserIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

const CategoryCard = ({ 
  title, 
  icon: Icon, 
  image, 
  onClick,
  description 
}: { 
  title: string; 
  icon: any; 
  image: string; 
  onClick: () => void;
  description: string;
}) => (
  <button 
    onClick={onClick}
    className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-stone-100 border border-stone-200 transition-all hover:shadow-xl hover:-translate-y-1"
  >
    <img src={image} alt={title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
    <div className="absolute inset-0 bg-gradient-to-t from-stone-900/90 via-stone-900/40 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
    <div className="absolute inset-0 p-8 flex flex-col justify-end text-left">
      <Icon className="w-8 h-8 text-white/80 mb-4 transition-transform group-hover:scale-110" />
      <h3 className="text-2xl font-serif font-bold text-white mb-2">{title}</h3>
      <p className="text-white/70 text-sm max-w-xs line-clamp-2 transform translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
        {description}
      </p>
    </div>
  </button>
);

const LessonView = ({ lesson, onComplete }: { lesson: any, onComplete: (retentionPoints?: any[]) => void }) => {
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);

  const handleAnswer = (qIdx: number, aIdx: number) => {
    const newAnswers = [...selectedAnswers];
    newAnswers[qIdx] = aIdx;
    setSelectedAnswers(newAnswers);
  };

  const isQuizDone = selectedAnswers.length === lesson.quiz.length && selectedAnswers.every(a => a !== undefined);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto py-12 px-6 pb-32"
    >
      <header className="mb-12">
        <div className="text-xs tracking-widest uppercase text-stone-400 font-bold mb-4">DAILY GUIDED JOURNEY</div>
        <h1 className="text-5xl lg:text-6xl font-serif font-bold text-stone-900 mb-6 leading-tight">
          {lesson.title}
        </h1>
        <div className="h-px w-full bg-stone-200" />
      </header>

      <div className="prose prose-stone max-w-none mb-16">
        <div className="columns-1 md:columns-2 gap-12 first-letter:text-7xl first-letter:font-serif first-letter:font-bold first-letter:float-left first-letter:mr-4 first-letter:mt-2 text-lg leading-relaxed text-stone-700 whitespace-pre-wrap">
          {lesson.content}
        </div>
      </div>

      {lesson.guide && (
        <section className="bg-white border-2 border-stone-100 rounded-2xl p-10 mb-16 shadow-sm">
          <h2 className="text-xs tracking-widest uppercase text-stone-500 font-bold mb-6 flex items-center gap-2">
            <Lightbulb className="w-4 h-4" />
            Connoisseur's Guide
          </h2>
          <div className="text-stone-700 leading-relaxed italic whitespace-pre-wrap">
            {lesson.guide}
          </div>
        </section>
      )}

      <section className="bg-stone-100 rounded-2xl p-10 mb-16 border border-stone-200">
        <h2 className="text-xs tracking-widest uppercase text-stone-500 font-bold mb-6 flex items-center gap-2">
          <History className="w-4 h-4" />
          Connoisseur's Note
        </h2>
        <p className="text-xl font-serif italic text-stone-800 leading-relaxed">
          "{lesson.note}"
        </p>
      </section>

      <section className="mb-16">
        <h2 className="text-3xl font-serif font-bold text-stone-900 mb-8">Refining Your Insight</h2>
        <div className="space-y-12">
          {lesson.quiz.map((q: any, qIdx: number) => (
            <div key={qIdx} className="space-y-4">
              <h3 className="text-lg font-semibold text-stone-800">{q.question}</h3>
              <div className="grid gap-3">
                {q.options.map((opt: string, aIdx: number) => (
                  <button
                    key={aIdx}
                    onClick={() => handleAnswer(qIdx, aIdx)}
                    className={cn(
                      "text-left p-4 rounded-xl border transition-all",
                      selectedAnswers[qIdx] === aIdx 
                        ? (aIdx === q.answerIndex ? "bg-emerald-50 border-emerald-500 text-emerald-900" : "bg-rose-50 border-rose-500 text-rose-900")
                        : "bg-white border-stone-200 hover:border-stone-400 text-stone-700"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span>{opt}</span>
                      {selectedAnswers[qIdx] === aIdx && (
                        aIdx === q.answerIndex ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <X className="w-5 h-5 text-rose-500" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
              {selectedAnswers[qIdx] !== undefined && (
                <p className="text-sm text-stone-500 animate-in fade-in slide-in-from-top-2">
                  {q.explanation}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {isQuizDone && (
        <motion.button
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => onComplete(lesson.retentionPoints)}
          className="w-full bg-stone-900 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-stone-800 transition-colors shadow-lg shadow-stone-900/10"
        >
          <Trophy className="w-6 h-6" />
          Conclude Journey
        </motion.button>
      )}
    </motion.div>
  );
};

const ChatPanel = ({ isOpen, onClose, context }: { isOpen: boolean, onClose: () => void, context: string }) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user', parts: [{ text: input }] };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const history = messages.slice(-6); // Last 3 exchanges
      const data = await chatWithConnoisseur(input, history, context);
      setMessages(prev => [...prev, { role: 'model', parts: [{ text: data.text }] }]);
    } catch (error) {
      toast.error('The Connoisseur is currently indisposed.');
    } finally {
      setIsTyping(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setMessages(prev => [...prev, { role: 'user', parts: [{ text: "[Analyzing Image...]" }] }]);
      setIsTyping(true);
      try {
        const data = await analyzeMasterpiece(base64);
        setMessages(prev => [...prev, { role: 'model', parts: [{ text: data.text }] }]);
      } catch (error) {
        toast.error('Failed to recognize the masterpiece.');
      } finally {
        setIsTyping(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-50"
          />
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-[#FBF9F5] shadow-2xl z-50 flex flex-col border-l border-stone-200"
          >
            <div className="p-6 border-b border-stone-200 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-serif font-bold text-stone-900">The Connoisseur</h3>
                <p className="text-xs text-stone-500 uppercase tracking-widest font-bold mt-1">Sophisticated Dialogue</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-stone-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {messages.length === 0 && (
                <div className="text-center py-12">
                  <Lightbulb className="w-12 h-12 text-stone-200 mx-auto mb-4" />
                  <p className="text-stone-500 italic font-serif">
                    "Deepening one's understanding is the highest form of leisure. What shall we discuss today?"
                  </p>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={cn(
                  "flex flex-col",
                  m.role === 'user' ? "items-end" : "items-start"
                )}>
                  <div className={cn(
                    "max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed",
                    m.role === 'user' 
                      ? "bg-stone-900 text-white rounded-tr-none" 
                      : "bg-white border border-stone-200 text-stone-800 rounded-tl-none font-serif text-base"
                  )}>
                    {m.parts[0].text}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex gap-1 p-2">
                  <div className="w-1.5 h-1.5 bg-stone-300 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-stone-300 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 bg-stone-300 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              )}
            </div>

            <div className="p-6 border-t border-stone-200 bg-white">
              <div className="flex gap-2">
                <label className="p-3 bg-stone-100 text-stone-600 rounded-xl hover:bg-stone-200 cursor-pointer transition-all">
                  <Camera className="w-5 h-5" />
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
                <input 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Share your insights..."
                  className="flex-1 px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-900 transition-all text-sm"
                />
                <button 
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="p-3 bg-stone-900 text-white rounded-xl hover:bg-stone-800 disabled:opacity-50 transition-all"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

const LibrarySection = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) loadHistory();
  }, [user]);

  const loadHistory = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'users', user.uid, 'progress'),
        where('itemType', '==', 'lesson')
      );
      const snap = await getDocs(q);
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort by completedAt manually if index is not ready
      docs.sort((a: any, b: any) => b.completedAt?.seconds - a.completedAt?.seconds);
      setHistory(docs);
    } catch (error) {
      console.error("Failed to load library:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="animate-pulse flex flex-col gap-4"><div className="h-20 bg-stone-100 rounded-xl"></div></div>;

  if (history.length === 0) {
    return (
      <div className="text-center py-20 border-2 border-dashed border-stone-200 rounded-3xl">
        <BookMarked className="w-12 h-12 text-stone-300 mx-auto mb-4" />
        <p className="text-stone-500 font-serif italic">Your personal archive is currently empty.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {history.map((item, i) => (
        <div key={i} className="flex items-center justify-between p-6 bg-white rounded-2xl border border-stone-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-6">
            <div className="w-12 h-12 bg-stone-900 rounded-xl flex items-center justify-center text-white">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-lg font-serif font-bold text-stone-900">{item.itemId}</h4>
              <p className="text-xs text-stone-500 uppercase tracking-widest font-bold">
                Completed on {item.completedAt?.toDate().toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-stone-400 text-xs font-bold uppercase tracking-widest">
            <Trophy className="w-4 h-4 text-amber-500" />
            50 XP
          </div>
        </div>
      ))}
    </div>
  );
};

const TrainingDeck = () => {
  const { user } = useAuth();
  const [cards, setCards] = useState<any[]>([]);
  const [activeCardIdx, setActiveCardIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadDeck();
  }, [user]);

  const loadDeck = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'users', user.uid, 'flashcards'),
        where('nextReview', '<=', new Date().toISOString())
      );
      const snap = await getDocs(q);
      setCards(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (quality: number) => {
    if (!user || !cards[activeCardIdx]) return;
    
    // Spaced repetition logic (simplified)
    const card = cards[activeCardIdx];
    const newInterval = quality >= 3 ? (card.interval || 1) * 2 : 1;
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + newInterval);

    try {
      await updateDoc(doc(db, 'users', user.uid, 'flashcards', card.id), {
        interval: newInterval,
        nextReview: nextDate.toISOString()
      });
      
      if (activeCardIdx < cards.length - 1) {
        setActiveCardIdx(prev => prev + 1);
        setIsFlipped(false);
      } else {
        setCards([]); // Finished session
        toast.success('Training session complete.', { icon: '🧠' });
      }
    } catch (error) {
      toast.error('Failed to record training.');
    }
  };

  if (loading) return <div className="p-12 text-center text-stone-400">Preparing retention deck...</div>;

  if (cards.length === 0) {
    return (
      <div className="text-center py-20 bg-stone-50 rounded-3xl border-2 border-dashed border-stone-200">
        <Zap className="w-12 h-12 text-stone-300 mx-auto mb-4" />
        <p className="text-stone-500 font-serif italic">Your mental archives are fully charged.</p>
        <p className="text-xs text-stone-400 mt-2 uppercase tracking-widest">Complete more lessons to generate training cards.</p>
      </div>
    );
  }

  const activeCard = cards[activeCardIdx];

  return (
    <div className="max-w-md mx-auto py-12">
      <div className="mb-8 flex justify-between items-center text-[10px] uppercase tracking-widest font-bold text-stone-400">
        <span>Session Progress</span>
        <span>{activeCardIdx + 1} / {cards.length}</span>
      </div>
      
      <motion.div 
        layout
        className="relative aspect-[3/4] cursor-pointer perspective-1000"
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <motion.div
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.6, type: 'spring', stiffness: 260, damping: 20 }}
          style={{ transformStyle: 'preserve-3d' }}
          className="w-full h-full relative"
        >
          {/* Front */}
          <div className="absolute inset-0 bg-white rounded-3xl border-2 border-stone-100 shadow-xl p-12 flex flex-col items-center justify-center text-center backface-hidden">
            <div className="text-xs text-stone-400 font-bold uppercase tracking-widest mb-6">{activeCard.discipline}</div>
            <p className="text-2xl font-serif text-stone-900 leading-relaxed">{activeCard.front}</p>
            <p className="mt-auto text-[10px] text-stone-300 uppercase tracking-[0.2em]">Tap to reveal insight</p>
          </div>
          
          {/* Back */}
          <div className="absolute inset-0 bg-stone-900 rounded-3xl shadow-xl p-12 flex flex-col items-center justify-center text-center backface-hidden [transform:rotateY(180deg)]">
            <div className="text-xs text-white/40 font-bold uppercase tracking-widest mb-6">Discovery</div>
            <p className="text-xl font-serif text-white leading-relaxed">{activeCard.back}</p>
            <div className="mt-auto grid grid-cols-2 gap-4 w-full">
              <button onClick={(e) => { e.stopPropagation(); handleReview(1); }} className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold uppercase tracking-widest">Hard</button>
              <button onClick={(e) => { e.stopPropagation(); handleReview(4); }} className="px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest">Easy</button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

const MuseumCatalog = ({ onStartTopic }: { onStartTopic: (topic: string) => void }) => {
  const items = [
    { title: "The Silk Road", category: "History", image: "/src/assets/images/platform_hero_mastery_1791217594972.jpg" },
    { title: "Bach's Cello Suites", category: "Classical Music", image: "/src/assets/images/classical_music_thumb_1791102533048.jpg" },
    { title: "The Parthenon", category: "Art History", image: "/src/assets/images/art_history_thumb_1791102544990.jpg" },
    { title: "Zen Buddhism", category: "World Religions", image: "/src/assets/images/world_religions_thumb_1791102580000_1791102820738.jpg" },
    { title: "Quantum Mechanics", category: "History of Science", image: "/src/assets/images/science_history_thumb_1791102590000_1791102831969.jpg" },
    { title: "The Divine Comedy", category: "Global Literature", image: "/src/assets/images/global_lit_thumb_1791102561913.jpg" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {items.map((item, i) => (
        <button 
          key={i} 
          onClick={() => onStartTopic(item.title)}
          className="group relative aspect-square rounded-xl overflow-hidden bg-stone-100 border border-stone-200"
        >
          <img src={item.image} alt={item.title} className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-110 opacity-60 group-hover:opacity-100" />
          <div className="absolute inset-0 bg-stone-900/40 group-hover:bg-stone-900/20 transition-colors" />
          <div className="absolute inset-0 p-4 flex flex-col justify-end text-left">
            <span className="text-[8px] uppercase tracking-widest font-bold text-white/60 mb-1">{item.category}</span>
            <h4 className="text-xs font-serif font-bold text-white line-clamp-2">{item.title}</h4>
          </div>
        </button>
      ))}
    </div>
  );
};

const ReadingListSection = () => {
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadList();
  }, []);

  const loadList = async () => {
    setLoading(true);
    try {
      const data = await getReadingList();
      setBooks(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="animate-pulse flex space-x-4"><div className="flex-1 space-y-4 py-1"><div className="h-4 bg-stone-200 rounded w-3/4"></div></div></div>;

  return (
    <div className="grid sm:grid-cols-3 gap-8">
      {Array.isArray(books) && books.map((book, i) => (
        <div key={i} className="group border-b border-stone-100 pb-8 sm:border-b-0">
          <div className="aspect-[3/4] bg-stone-200 rounded-lg mb-6 overflow-hidden relative">
             <div className="absolute inset-0 flex items-center justify-center text-stone-400 font-serif italic text-center p-4">
               {book.title}
             </div>
          </div>
          <h4 className="text-xl font-serif font-bold text-stone-900 mb-1">{book.title}</h4>
          <p className="text-xs uppercase tracking-widest text-stone-400 font-bold mb-4">{book.author}</p>
          <p className="text-sm text-stone-600 mb-4 line-clamp-3 leading-relaxed">{book.description}</p>
          <div className="text-xs italic text-stone-500 border-l-2 border-stone-200 pl-3">
            {book.significance}
          </div>
        </div>
      ))}
    </div>
  );
};

// --- Main App Content ---

const PlansSection = ({ onStartLesson }: { onStartLesson: (cat: string) => void }) => {
  const plans = [
    { title: "The Renaissance Cycle", duration: "14 Days", discipline: "Art History", level: "Beginner" },
    { title: "Classical Symphonist", duration: "21 Days", discipline: "Classical Music", level: "Intermediate" },
    { title: "Western Philosophy 101", duration: "30 Days", discipline: "Philosophy", level: "Beginner" },
  ];

  return (
    <div className="grid gap-6">
      {plans.map((plan, i) => (
        <div key={i} className="bg-white p-8 rounded-3xl border border-stone-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] uppercase tracking-widest font-bold text-stone-400">{plan.discipline}</span>
              <span className="w-1 h-1 bg-stone-200 rounded-full" />
              <span className="text-[10px] uppercase tracking-widest font-bold text-stone-400">{plan.level}</span>
            </div>
            <h4 className="text-xl font-serif font-bold text-stone-900">{plan.title}</h4>
            <p className="text-sm text-stone-500 mt-1">Structured curriculum over {plan.duration}.</p>
          </div>
          <button 
            onClick={() => onStartLesson(plan.discipline)}
            className="px-6 py-3 bg-stone-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-stone-800 transition-all shadow-lg shadow-stone-900/10"
          >
            Enroll in Plan
          </button>
        </div>
      ))}
    </div>
  );
};

const disciplines = [
  { id: 'classical_music', title: "Classical Music", icon: Music, image: "/src/assets/images/classical_music_thumb_1791102533048.jpg", description: "Master the symphonic structures and historical context of the world's greatest compositions." },
  { id: 'art_history', title: "Art History", icon: Palette, image: "/src/assets/images/art_history_thumb_1791102544990.jpg", description: "Decode the hidden languages of Renaissance, Baroque, and Modern masterpieces." },
  { id: 'global_lit', title: "Global Literature", icon: BookOpen, image: "/src/assets/images/global_lit_thumb_1791102561913.jpg", description: "Journey through the epics and novels that have defined human thought across civilizations." },
  { id: 'philosophy', title: "Philosophy", icon: Quote, image: "/src/assets/images/philosophy_thumb_1791102570000_1791102808933.jpg", description: "Explore the fundamental questions of existence, ethics, and reason from antiquity to the present." },
  { id: 'world_religions', title: "World Religions", icon: Compass, image: "/src/assets/images/world_religions_thumb_1791102580000_1791102820738.jpg", description: "Understand the sacred traditions, rituals, and philosophical foundations of global faiths." },
  { id: 'history_science', title: "History of Science", icon: Atom, image: "/src/assets/images/science_history_thumb_1791102590000_1791102831969.jpg", description: "Trace the evolution of human discovery, from ancient astronomy to modern quantum mechanics." },
];

const CuriosityFeed = ({ onStartTopic }: { onStartTopic: (topic: string) => void }) => {
  const seeds = [
    { title: "The Library of Alexandria", type: "Epoch", color: "bg-amber-50" },
    { title: "Beethoven's 9th Symphony", type: "Masterpiece", color: "bg-blue-50" },
    { title: "The Stoic Philosophy", type: "Concept", color: "bg-stone-50" },
    { title: "The Rosetta Stone", type: "Artifact", color: "bg-emerald-50" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {seeds.map((seed, i) => (
        <button 
          key={i} 
          onClick={() => onStartTopic(seed.title)}
          className={cn("p-8 rounded-3xl text-left transition-all hover:shadow-lg border border-transparent hover:border-stone-200", seed.color)}
        >
          <span className="text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-2 block">{seed.type}</span>
          <h4 className="text-xl font-serif font-bold text-stone-900 leading-tight">{seed.title}</h4>
          <div className="mt-6 flex items-center gap-2 text-stone-400 text-xs font-bold uppercase tracking-widest">
            Dive In <ArrowRight className="w-3 h-3" />
          </div>
        </button>
      ))}
    </div>
  );
};

const Dashboard = ({ onStartLesson }: { onStartLesson: (cat: string, topic?: string) => void }) => {
  const { user } = useAuth();
  const [mastery, setMastery] = useState<any>({});
  const [recentProgress, setRecentProgress] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    if (!user) return;
    try {
      const masterySnap = await getDocs(collection(db, 'users', user.uid, 'mastery'));
      const masteryData: any = {};
      masterySnap.docs.forEach(doc => { masteryData[doc.id] = doc.data(); });
      setMastery(masteryData);

      const progressSnap = await getDocs(query(collection(db, 'users', user.uid, 'progress'), where('itemType', '==', 'lesson')));
      setRecentProgress(progressSnap.docs.slice(0, 3).map(doc => doc.data()));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-16 py-8">
      {/* Header */}
      <section className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-serif font-bold text-stone-900">Welcome, {user?.displayName?.split(' ')[0]}</h2>
          <p className="text-stone-500 font-serif italic mt-1">Your intellectual sanctuary is thriving.</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-stone-900 text-white p-4 rounded-2xl flex items-center gap-4">
            <Trophy className="w-5 h-5 text-amber-400" />
            <div>
              <div className="text-[10px] uppercase tracking-widest font-bold text-white/40">Scholar Level</div>
              <div className="text-lg font-bold tabular-nums">Level {user?.level || 1}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Curiosity Feed */}
      <section>
        <div className="flex justify-between items-end mb-8">
          <div>
            <h3 className="text-xs uppercase tracking-widest font-bold text-stone-400 mb-2">Curiosity Feed</h3>
            <h4 className="text-2xl font-serif font-bold text-stone-900">Random Archives</h4>
          </div>
          <p className="text-stone-500 text-xs italic">Updated for your discovery</p>
        </div>
        <CuriosityFeed onStartTopic={(topic) => onStartLesson('Curiosity', topic)} />
      </section>

      {/* Mastery Bars */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-3xl border border-stone-100 shadow-sm">
          <h3 className="text-xs uppercase tracking-widest font-bold text-stone-400 mb-8">Discipline Mastery</h3>
          <div className="space-y-6">
            {disciplines.map(d => {
              const level = mastery[d.id]?.level || 0;
              const points = mastery[d.id]?.points || 0;
              const progress = (points % 100);
              return (
                <div key={d.id} className="space-y-2">
                  <div className="flex justify-between items-end">
                    <span className="text-sm font-bold text-stone-900">{d.title}</span>
                    <span className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Lv.{level}</span>
                  </div>
                  <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      className="h-full bg-stone-900"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="bg-stone-900 p-8 rounded-3xl text-white relative overflow-hidden flex-1">
            <div className="relative z-10">
              <h3 className="text-xs uppercase tracking-widest font-bold text-white/40 mb-2">Current Focus</h3>
              <p className="text-2xl font-serif font-bold mb-6 italic">The Renaissance Masters</p>
              <button 
                onClick={() => onStartLesson('Art History')}
                className="inline-flex items-center gap-2 bg-white text-stone-900 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-stone-100 transition-colors"
              >
                Continue Journey
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="absolute right-[-20px] bottom-[-20px] opacity-10">
              <BrainCircuit className="w-48 h-48" />
            </div>
          </div>
          
          <div className="bg-[#FBF9F5] border-2 border-stone-100 p-8 rounded-3xl flex-1">
            <h3 className="text-xs uppercase tracking-widest font-bold text-stone-400 mb-4">Daily Reading</h3>
            <ReadingListSection />
          </div>
        </div>
      </section>
    </div>
  );
};

const MainContent = () => {
  const { user, login, loading: authLoading } = useAuth();
  const [activeLesson, setActiveLesson] = useState<any>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'learn' | 'plans' | 'library' | 'train'>('dashboard');
  const [libraryRefreshKey, setLibraryRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      startJourney('General', searchQuery);
    }
  };

  useEffect(() => {
    console.log("MainContent rendered, authLoading:", authLoading, "user:", user?.email);
  }, [authLoading, user]);

  const startJourney = async (cat: string, topic?: string) => {
    if (!user) {
      toast('Please enter the sanctuary first.', { icon: '🏛️' });
      try {
        await login();
      } catch (e) {
        console.error("Login attempt failed:", e);
        toast.error("The sanctuary doors are momentarily barred. Please try again.");
      }
      return;
    }
    setLoading(true);
    try {
      // Get context history from Firestore
      const progressSnap = await getDocs(query(
        collection(db, 'users', user.uid, 'progress'), 
        where('itemType', '==', 'lesson'),
        where('category', '==', cat)
      ));
      const contextHistory = progressSnap.docs.slice(0, 3).map(d => d.data().itemId);

      const lesson = await generateLesson(cat, 'intermediate', contextHistory, topic);
      setActiveLesson(lesson);
      setCategory(cat);
    } catch (error) {
      console.error(error);
      toast.error('Failed to prepare your study materials.');
    } finally {
      setLoading(false);
    }
  };

  const completeLesson = async (retentionPoints?: any[]) => {
    if (!user || !activeLesson || !category) return;
    
    try {
      const disc = disciplines.find(d => d.title === category);
      const discId = disc?.id || 'general';

      console.log("Recording progress...");
      await addDoc(collection(db, 'users', user.uid, 'progress'), {
        userId: user.uid,
        itemId: activeLesson.title,
        itemType: 'lesson',
        category: category,
        score: 100,
        completedAt: serverTimestamp()
      });
      
      // Update Mastery
      console.log("Updating mastery for:", discId);
      const masteryRef = doc(db, 'users', user.uid, 'mastery', discId);
      const masterySnap = await getDoc(masteryRef);
      let currentPoints = 0;
      let currentLevel = 1;
      if (masterySnap.exists()) {
        currentPoints = masterySnap.data().points || 0;
        currentLevel = masterySnap.data().level || 1;
      }
      
      const newPoints = currentPoints + 25;
      const newLevel = Math.floor(newPoints / 100) + 1;
      
      await setDoc(masteryRef, {
        userId: user.uid,
        discipline: category,
        level: newLevel,
        points: newPoints,
        lastUpdated: serverTimestamp()
      });

      // Update user XP
      console.log("Updating user profile...");
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const currentXp = userSnap.data().xp || 0;
        await updateDoc(userRef, {
          xp: currentXp + 50,
          level: Math.floor((currentXp + 50) / 1000) + 1,
          lastActive: serverTimestamp()
        });
      }

      // Add Flashcards
      if (retentionPoints && retentionPoints.length > 0) {
        console.log("Adding flashcards...");
        for (const point of retentionPoints) {
          await addDoc(collection(db, 'users', user.uid, 'flashcards'), {
            userId: user.uid,
            discipline: category,
            front: point.front,
            back: point.back,
            nextReview: new Date().toISOString(),
            interval: 1,
            createdAt: serverTimestamp()
          });
        }
      }

      toast.success('Your cultural insight has grown.', { icon: '✨' });
      setLibraryRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error("Failed to record progress journey:", error);
      toast.error('Progress could not be recorded in the archives.');
    } finally {
      setActiveLesson(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FBF9F5] flex flex-col items-center justify-center gap-6 text-center px-6">
        <div className="w-12 h-12 border-4 border-stone-200 border-t-stone-900 rounded-full animate-spin" />
        <div>
          <p className="font-serif italic text-stone-500 tracking-wide text-lg">Consulting the archives...</p>
          <p className="text-xs text-stone-400 mt-2 uppercase tracking-widest font-sans">Connecting to SOPHIA</p>
        </div>
      </div>
    );
  }

  if (activeLesson) {
    return (
      <div className="min-h-screen bg-[#FBF9F5] lg:pl-64">
        <Navbar />
        {/* Simple lesson sidebar for desktop */}
        <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 bg-stone-900 flex-col p-6 text-white z-50">
          <button onClick={() => setActiveLesson(null)} className="mb-12 flex items-center gap-3 hover:text-stone-300 transition-colors">
            <X className="w-5 h-5" />
            <span className="text-sm font-bold uppercase tracking-widest">Exit Journey</span>
          </button>
          <div className="mt-auto">
            <button 
              onClick={() => setIsChatOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-4 bg-white text-stone-900 rounded-2xl font-bold hover:bg-stone-100 transition-colors"
            >
              <MessageSquare className="w-5 h-5" />
              Ask Connoisseur
            </button>
          </div>
        </aside>
        <LessonView lesson={activeLesson} onComplete={completeLesson} />
        <ChatPanel isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} context={activeLesson.title} />
      </div>
    );
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard onStartLesson={startJourney} />;
      case 'learn': return (
        <div className="py-12 space-y-16">
          <header className="relative py-24 rounded-3xl overflow-hidden border border-stone-200">
            <img 
              src="/src/assets/images/platform_hero_mastery_1791217594972.jpg" 
              className="absolute inset-0 w-full h-full object-cover opacity-10 mix-blend-multiply" 
              alt="Archives"
            />
            <div className="relative z-10 text-center px-6">
              <h2 className="text-5xl font-serif font-bold text-stone-900 mb-4">The Great Archives</h2>
              <p className="text-stone-600 font-serif italic max-w-xl mx-auto">Explore thousands of years of human expression, discovery, and wisdom.</p>
            </div>
          </header>

          {/* Search Section */}
          <section className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-6">Search the Great Archives</h2>
            <form onSubmit={handleSearch} className="relative">
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for any cultural masterpiece, era, or concept..."
                className="w-full px-6 py-4 rounded-2xl bg-white border border-stone-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-stone-900 transition-all text-stone-800"
              />
              <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-stone-900 text-white rounded-xl">
                <Search className="w-5 h-5" />
              </button>
            </form>
          </section>

          {/* Museum Catalog */}
          <section>
            <h3 className="text-xs uppercase tracking-widest font-bold text-stone-400 mb-6">Featured Archives</h3>
            <MuseumCatalog onStartTopic={(topic) => startJourney('Featured', topic)} />
          </section>

          {/* Disciplines Grid */}
          <section>
            <h3 className="text-xs uppercase tracking-widest font-bold text-stone-400 mb-6">Cultural Disciplines</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {disciplines.map(d => (
                <CategoryCard key={d.id} {...d} onClick={() => startJourney(d.title)} />
              ))}
            </div>
          </section>
        </div>
      );
      case 'plans': return <div className="py-12"><PlansSection onStartLesson={startJourney} /></div>;
      case 'library': return <div className="py-12"><LibrarySection key={libraryRefreshKey} /></div>;
      case 'train': return <TrainingDeck />;
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF9F5] pb-24 lg:pb-0 lg:pl-64">
      <Navbar />
      
      {/* Sidebar for Desktop */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 bg-stone-900 flex-col p-6 text-white z-50">
        <div className="mb-12 flex items-center gap-3">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-stone-900">
            <BookMarked className="w-5 h-5" />
          </div>
          <span className="text-xl font-serif font-bold tracking-tight">SOPHIA</span>
        </div>

        <nav className="space-y-2">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'learn', icon: Compass, label: 'Disciplines' },
            { id: 'plans', icon: Zap, label: 'Plans' },
            { id: 'library', icon: BookMarked, label: 'Library' },
            { id: 'train', icon: BrainCircuit, label: 'Training' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "w-full flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-bold transition-all",
                activeTab === tab.id ? "bg-white text-stone-900" : "text-white/60 hover:bg-white/5 hover:text-white"
              )}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto space-y-4">
          <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
            <div className="flex justify-between items-end mb-2">
              <span className="text-[10px] uppercase tracking-widest font-bold text-white/40">Global Progress</span>
              <span className="text-xs font-bold">{Math.round((user?.xp || 0) / 10)}%</span>
            </div>
            <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-white w-1/4" />
            </div>
          </div>
          <button 
            onClick={() => setIsChatOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-4 bg-white text-stone-900 rounded-2xl font-bold hover:bg-stone-100 transition-colors"
          >
            <MessageSquare className="w-5 h-5" />
            The Connoisseur
          </button>
        </div>
      </aside>

      {/* Bottom Nav for Mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 px-4 py-3 flex justify-around items-center z-50">
        {[
          { id: 'dashboard', icon: LayoutDashboard },
          { id: 'learn', icon: Compass },
          { id: 'plans', icon: Zap },
          { id: 'library', icon: BookMarked },
          { id: 'train', icon: BrainCircuit },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "p-3 rounded-2xl transition-all",
              activeTab === tab.id ? "bg-stone-900 text-white shadow-lg shadow-stone-900/20" : "text-stone-400"
            )}
          >
            <tab.icon className="w-6 h-6" />
          </button>
        ))}
      </nav>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-6 pt-8 pb-32">
        {loading ? (
          <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6">
            <div className="w-10 h-10 border-3 border-stone-200 border-t-stone-900 rounded-full animate-spin" />
            <p className="font-serif italic text-stone-500">Preparing materials...</p>
          </div>
        ) : renderTab()}
      </main>

      <ChatPanel isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} context="General Culture" />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="bottom-right" toastOptions={{
        style: {
          background: '#1C1917',
          color: '#FBF9F5',
          borderRadius: '12px',
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontSize: '14px',
        }
      }} />
      <MainContent />
    </AuthProvider>
  );
}
