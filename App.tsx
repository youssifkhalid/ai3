
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Message, UserProfile } from './types';
import { sendMessageQuantum, startLiveCall } from './services/geminiService';
import { 
  auth, 
  db, 
  syncSessionsToFirebase, 
  fetchSessionsFromFirebase, 
  signUpUser, 
  logInUser,
  signInWithGoogle
} from './services/firebaseService';
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import ChatBubble from './components/ChatBubble';
import UserProfileView from './components/UserProfileView';
import { 
  Send, X, Menu, Brain, GraduationCap, 
  Lightbulb, Loader2, LogOut, PlusCircle, 
  FileText, History, PhoneOutgoing, PhoneOff, 
  Trash, UserCircle, Mic, Sparkles, Paperclip, 
  Waves, MicOff, Volume2, Headphones, Globe,
  ShieldAlert, ChevronRight, Zap
} from 'lucide-react';

type ViewState = 'auth' | 'chat' | 'profile' | 'loading';
type AuthMode = 'login' | 'signup';

const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [view, setView] = useState<ViewState>('loading');
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [useThinking, setUseThinking] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [sessions, setSessions] = useState<any[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Auth Inputs
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('يا دكتور');
  const [authError, setAuthError] = useState('');

  // Attachments
  const [attachedFile, setAttachedFile] = useState<{data: string, name: string, type: string} | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  
  // Call State
  const [isCallActive, setIsCallActive] = useState(false);
  const [callSession, setCallSession] = useState<any>(null);
  const [callTranscription, setCallTranscription] = useState<{text: string, isUser: boolean}[]>([]);
  const [isMuted, setIsMuted] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentSession = sessions.find(s => s.id === currentSessionId);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const docSnap = await getDoc(doc(db, "users", u.uid));
        if (docSnap.exists()) setProfile(docSnap.data() as UserProfile);
        
        // Fetch sessions STRICTLY for THIS user
        const cloudSessions = await fetchSessionsFromFirebase(u.uid);
        if (cloudSessions?.length > 0) {
          const sorted = cloudSessions.sort((a:any, b:any)=>b.lastUpdated - a.lastUpdated);
          setSessions(sorted);
          setCurrentSessionId(sorted[0].id);
        } else {
          const id = Date.now().toString();
          const firstS = { id, title: 'أول لقاء مع الدحيح', messages: [], lastUpdated: Date.now() };
          setSessions([firstS]);
          setCurrentSessionId(id);
        }
        setView('chat');
      } else {
        // Reset local state on logout
        setUser(null);
        setSessions([]);
        setCurrentSessionId(null);
        setView('auth');
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user && sessions.length > 0) {
      syncSessionsToFirebase(user.uid, sessions);
    }
  }, [sessions, user]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [currentSession?.messages, isGenerating]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setView('loading');
    try {
      if (authMode === 'signup') {
        await signUpUser({ name, nickname, emailOrPhone: identifier, academicYear: '3ث', track: 'علمي علوم', joinedAt: Date.now() }, password);
      } else {
        await logInUser(identifier, password);
      }
    } catch (err: any) {
      setAuthError(err.message);
      setView('auth');
    }
  };

  const createNewSession = () => {
    const id = Date.now().toString();
    const newS = { id, title: 'New chat ', messages: [], lastUpdated: Date.now() };
    setSessions(prev => [newS, ...prev]);
    setCurrentSessionId(id);
    setIsSidebarOpen(false);
  };

  const clearAllHistory = async () => {
    if (window.confirm("هتمسح كل الشات  يا دحيح؟ الخطوة دي مش هينفع نرجع فيها!")) {
      const emptySessions: any[] = [];
      setSessions(emptySessions);
      if (user) await syncSessionsToFirebase(user.uid, emptySessions);
      createNewSession();
    }
  };

  const deleteOneSession = async (id: string) => {
    const updated = sessions.filter(s => s.id !== id);
    setSessions(updated);
    if (user) await syncSessionsToFirebase(user.uid, updated);
    if (currentSessionId === id) {
      if (updated.length > 0) setCurrentSessionId(updated[0].id);
      else createNewSession();
    }
  };

  const handleSend = async () => {
    if (!currentSessionId || (!inputValue.trim() && !attachedFile) || isGenerating) return;
    const prompt = inputValue.trim();
    setIsGenerating(true);
    setInputValue('');
    
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: prompt, timestamp: Date.now(), image: attachedFile?.type.startsWith('image') ? attachedFile.data : undefined };
    
    setSessions(prev => prev.map(s => 
      s.id === currentSessionId ? { 
        ...s, 
        title: s.messages.length < 1 ? prompt.substring(0, 40) : s.title, 
        messages: [...s.messages, userMsg], 
        lastUpdated: Date.now() 
      } : s
    ).sort((a,b)=>b.lastUpdated - a.lastUpdated));

    const fileToUpload = attachedFile; 
    setAttachedFile(null);
    const modelMsgId = (Date.now() + 1).toString();
    setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [...s.messages, { id: modelMsgId, role: 'model', text: '', timestamp: Date.now() }] } : s));
    
    try {
      const files = fileToUpload ? [{ data: fileToUpload.data, mime: fileToUpload.type }] : undefined;
      await sendMessageQuantum(prompt, { useThinking, userName: profile?.nickname + " " + profile?.name, files }, (text) => {
        setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: s.messages.map(m => m.id === modelMsgId ? { ...m, text } : m) } : s));
      });
    } catch(e) {} finally { setIsGenerating(false); }
  };

  const toggleCall = async () => {
    if (isCallActive) {
      if (callSession) await callSession.stop();
      setCallSession(null); setIsCallActive(false); setCallTranscription([]);
    } else {
      setIsCallActive(true);
      try {
        const session = await startLiveCall(profile?.nickname + " " + profile?.name, (text, isUser) => {
          setCallTranscription(prev => [...prev, {text, isUser}].slice(-10));
        });
        setCallSession(session);
      } catch (err) { setIsCallActive(false); }
    }
  };

  const handleDeepExplain = async (text: string) => {
    if (isGenerating) return;
    setIsGenerating(true);
    const deepPrompt = `بص يا دحيح، فصص لي الكلام ده واشرحه بملزمة منظمة جداً كأننا في سنتر وبكل الرموز العلمية: ${text}`;
    const modelMsgId = Date.now().toString();
    setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [...s.messages, { id: modelMsgId, role: 'model', text: 'جاري تحضير ملزمة الشرح التفصيلية بجميع الرموز والمعادلات...', timestamp: Date.now() }] } : s));
    try {
      await sendMessageQuantum(deepPrompt, { useThinking: true, userName: profile?.name }, (fullText) => {
        setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: s.messages.map(m => m.id === modelMsgId ? { ...m, text: fullText } : m) } : s));
      });
    } catch(e) {} finally { setIsGenerating(false); }
  };

  const exportToPDF = (text: string) => {
    const container = document.getElementById('pdf-export-content');
    if (!container) return;
    container.innerHTML = `
      <div style="direction: rtl; padding: 50px; font-family: 'Cairo', sans-serif; background: #fff;">
        <h1 style="color: #4f46e5; border-bottom: 3px solid #4f46e5; padding-bottom: 15px; font-size: 32px;">ملزمة الدحيح 2026</h1>
        <div style="margin-top: 30px; line-height: 2; font-size: 18px; color: #1e293b;">
          ${text.replace(/\n/g, '<br>')}
        </div>
      </div>
    `;
    const opt = { 
      margin: 10, 
      filename: `Malzama_Dahih_${Date.now()}.pdf`, 
      html2canvas: { scale: 3 }, 
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
    };
    (window as any).html2pdf().from(container).set(opt).save();
  };

  if (view === 'loading') return <div className="h-screen flex flex-col items-center justify-center bg-white gap-5"><Loader2 className="animate-spin text-indigo-600" size={56} /><p className="font-black text-slate-800 text-xl">بيحمل بياناتك يا بطل...</p></div>;

  if (view === 'auth') return (
    <div className="h-screen w-full flex bg-slate-50 overflow-hidden relative">
      <div className="hidden lg:flex flex-1 bg-indigo-600 items-center justify-center p-12 text-white relative">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
        <div className="relative z-10 max-w-lg space-y-8">
           <div className="size-24 bg-white rounded-[2rem] flex items-center justify-center text-indigo-600 shadow-2xl animate-bounce-slow">
              <Brain size={56} />
           </div>
           <h1 className="text-7xl font-black tracking-tighter">الدحيح 2026</h1>
           <p className="text-3xl opacity-90 font-bold leading-relaxed">أول منصة ذكاء اصطناعي تعليمي بلهجة مصرية 100%. بنلم المنهج في جيبك!</p>
        </div>
      </div>
      
      <div className="flex-1 flex items-center justify-center p-6 bg-white/60 backdrop-blur-3xl">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md space-y-8 bg-white p-12 rounded-[3.5rem] shadow-2xl border border-slate-100">
           <div className="text-center">
              <h2 className="text-4xl font-black text-slate-900 mb-2">{authMode === 'login' ? 'وحشتنا يا دحيح!' : 'انضم للرحلة!'}</h2>
              <p className="text-slate-500 font-bold text-lg">سجل دخولك وكمل مذاكرة 👋</p>
           </div>

           <form onSubmit={handleAuth} className="space-y-4">
              {authMode === 'signup' && (
                <div className="space-y-4">
                  <input required placeholder="اسمك بالكامل" value={name} onChange={e=>setName(e.target.value)} className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 rounded-3xl px-6 py-4 font-black outline-none transition-all" />
                  <input placeholder="اللقب (   الي هينديك بيه الدحيح)" value={nickname} onChange={e=>setNickname(e.target.value)} className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 rounded-3xl px-6 py-4 font-black outline-none transition-all" />
                </div>
              )}
              <input required placeholder="الإيميل أو الموبايل" value={identifier} onChange={e=>setIdentifier(e.target.value)} className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 rounded-3xl px-6 py-4 font-black outline-none transition-all" />
              <input required type="password" placeholder="كلمة السر" value={password} onChange={e=>setPassword(e.target.value)} className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 rounded-3xl px-6 py-4 font-black outline-none transition-all" />
              
              {authError && <p className="text-rose-500 text-sm font-black text-center">{authError}</p>}
              
              <button type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-xl shadow-2xl hover:bg-indigo-700 transition-all active:scale-95 shadow-indigo-200">
                {authMode === 'login' ? 'دخول' : 'تسجيل جديد'}
              </button>
           </form>

           <div className="relative py-2">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
              <div className="relative flex justify-center text-xs font-black uppercase"><span className="bg-white px-4 text-slate-400 tracking-widest">أو</span></div>
           </div>

           <button onClick={signInWithGoogle} className="w-full py-4 bg-white border-2 border-slate-100 rounded-3xl font-black flex items-center justify-center gap-3 hover:bg-slate-50 transition-all text-slate-800 shadow-sm"><Globe size={20} /> جوجل</button>
           
           <p className="text-center font-bold text-slate-500 text-base">
             {authMode === 'login' ? 'معندكش حساب؟' : 'عندك حساب فعلاً؟'} 
             <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="text-indigo-600 mr-2 hover:underline">اضغط هنا</button>
           </p>
        </motion.div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white text-slate-900 relative">
      <AnimatePresence>
        {isCallActive && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[300] bg-indigo-950 flex flex-col items-center justify-between p-12 text-white overflow-hidden">
             <div className="absolute inset-0 opacity-20 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250%] h-[250%] bg-indigo-500 rounded-full blur-[250px] animate-pulse"></div>
             </div>
             
             <header className="w-full flex justify-between items-center relative z-10">
                <div className="bg-white/10 px-8 py-3 rounded-full border border-white/10 animate-pulse font-black text-sm">مكالمة ذكية جارية...</div>
                <div className="dahih-gradient text-3xl font-black">الدحيح 2026</div>
             </header>

             <div className="flex flex-col items-center gap-12 text-center relative z-10">
                <div className="size-64 bg-white/5 rounded-full flex items-center justify-center shadow-[0_0_150px_rgba(79,70,229,0.4)] border border-white/10 relative">
                   <Brain size={120} className="text-white" />
                   <motion.div animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }} transition={{ duration: 2.5, repeat: Infinity }} className="absolute inset-0 rounded-full border-8 border-white/20" />
                </div>
                <div className="space-y-6">
                   <h3 className="text-5xl font-black tracking-tight">الدحيح بيشرح لك...</h3>
                   <p className="text-indigo-200 text-xl font-bold opacity-80">اتكلم ببراحتك وأنا معاك</p>
                </div>
             </div>

             <div className="w-full max-w-3xl h-56 overflow-y-auto no-scrollbar space-y-5 px-8 relative z-10">
                {callTranscription.map((t, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`p-5 rounded-[2.5rem] text-base font-black shadow-2xl border ${t.isUser ? 'bg-white/10 text-right self-end' : 'bg-indigo-600/50 text-right self-start border-indigo-400/50'}`}>
                    {t.text}
                  </motion.div>
                ))}
             </div>

             <div className="flex gap-10 relative z-10 pb-8">
                <button onClick={() => setIsMuted(!isMuted)} className={`size-24 rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-110 active:scale-90 ${isMuted ? 'bg-amber-500' : 'bg-white/10 hover:bg-white/20'}`}>
                  {isMuted ? <MicOff size={40} /> : <Mic size={40} />}
                </button>
                <button onClick={toggleCall} className="size-28 bg-rose-600 rounded-full flex items-center justify-center shadow-[0_0_80px_rgba(225,29,72,0.5)] hover:scale-110 active:scale-90 transition-all"><PhoneOff size={48}/></button>
                <button className="size-24 bg-white/10 rounded-full flex items-center justify-center shadow-2xl hover:bg-white/20 hover:scale-110 active:scale-90">
                  <Volume2 size={40} />
                </button>
             </div>
          </motion.div>
        )}

        {view === 'profile' && profile && (
          <UserProfileView profile={profile} onClose={() => setView('chat')} onUpdate={(p) => setProfile(p)} />
        )}
      </AnimatePresence>

      <aside className={`fixed lg:relative inset-y-0 right-0 z-[200] w-80 lg:w-96 glass-card border-l border-slate-200 transition-transform duration-500 ease-out ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'} flex flex-col p-8`}>
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-4">
            <div className="size-14 bg-indigo-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl shadow-indigo-100"><Brain size={32} /></div>
            <div>
               <div className="dahih-gradient text-3xl font-black tracking-tighter">الدحيح</div>
               <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">حسابك </div>
            </div>
          </div>
          <button className="lg:hidden p-3 bg-slate-100 rounded-2xl" onClick={() => setIsSidebarOpen(false)}><X size={28} /></button>
        </div>
        
        <button onClick={createNewSession} className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black mb-12 shadow-2xl shadow-indigo-100 flex items-center justify-center gap-3 hover:scale-[1.03] active:scale-95 transition-all text-lg"><PlusCircle size={28} /> حصة جديدة</button>
        
        <div className="flex-1 overflow-y-auto no-scrollbar space-y-4">
          <div className="flex justify-between items-center px-3 mb-4">
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><History size={18}/>  السجل</span>
            <button onClick={clearAllHistory} className="text-xs font-black text-rose-500 hover:underline">تصفير السجل</button>
          </div>
          {sessions.map(s => (
            <div key={s.id} className={`group relative p-5 rounded-[2rem] border transition-all flex items-center justify-between cursor-pointer ${currentSessionId===s.id?'bg-indigo-50 border-indigo-200 shadow-xl':'bg-white border-slate-100 hover:border-indigo-100 shadow-sm'}`} onClick={()=>{setCurrentSessionId(s.id); setIsSidebarOpen(false);}}>
              <div className="flex-1 truncate">
                <p className={`text-base font-black truncate ${currentSessionId===s.id ? 'text-indigo-800' : 'text-slate-700'}`}>{s.title}</p>
                <p className="text-[10px] text-slate-400 font-black mt-1 uppercase">{new Date(s.lastUpdated).toLocaleDateString()}</p>
              </div>
              <button onClick={(e)=>{e.stopPropagation(); deleteOneSession(s.id);}} className="p-2 text-rose-200 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"><Trash size={20}/></button>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-8 border-t border-slate-100 space-y-5">
            <button onClick={() => setView('profile')} className="w-full py-5 bg-white border border-slate-100 rounded-[2rem] font-black flex items-center gap-5 px-8 hover:bg-slate-50 transition-all text-slate-800 shadow-sm"><UserCircle className="text-indigo-600" size={28} /> ملفك الشخصي</button>
            <button onClick={()=>signOut(auth)} className="w-full py-5 text-rose-500 font-black flex items-center gap-5 px-8 hover:bg-rose-50 rounded-[2rem] transition-all text-lg"><LogOut size={28} /> خروج من الدفعة</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative h-full bg-slate-50/20 overflow-hidden">
        <header className="h-24 glass-card flex items-center justify-between px-8 md:px-14 z-50 border-b border-slate-100">
           <div className="flex items-center gap-8">
               <button className="lg:hidden p-4 bg-white rounded-[1.5rem] shadow-xl border" onClick={()=>setIsSidebarOpen(true)}><Menu size={32} /></button>
               <div className="hidden md:block">
                  <h2 className="text-3xl font-black dahih-gradient tracking-tighter">الدحيح 2026</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em]">أقوى مساعد تعليمي</p>
               </div>
           </div>
           <div className="flex items-center gap-6">
              <button onClick={toggleCall} className="h-14 px-8 rounded-[2rem] font-black flex items-center gap-4 shadow-2xl shadow-indigo-100 bg-indigo-600 text-white hover:bg-indigo-700 transition-all active:scale-95 text-base"><PhoneOutgoing size={24} /> <span className="hidden sm:inline">كلم الدحيح</span></button>
              <div className="hidden lg:flex flex-col items-end">
                 <span className="text-lg font-black text-slate-900 tracking-tight leading-none">{profile?.nickname} {profile?.name.split(' ')[0]}</span>
                 <span className="text-[10px] font-black text-emerald-500 uppercase mt-1 bg-emerald-50 px-3 py-1 rounded-full">طالب دحيح نشط</span>
              </div>
           </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 md:p-12 space-y-10 no-scrollbar scroll-smooth">
           <div className="max-w-5xl mx-auto w-full pb-72">
              {currentSession?.messages.length === 0 && (
                <div className="text-center py-32 px-12 bg-white rounded-[5rem] shadow-2xl border border-slate-100 space-y-8 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-16 opacity-5 rotate-12 scale-150"><GraduationCap size={300}/></div>
                  <div className="size-24 bg-indigo-600 rounded-[2rem] mx-auto flex items-center justify-center text-white shadow-2xl animate-pulse"><Brain size={48} /></div>
                  <h2 className="text-5xl font-black text-slate-900 leading-tight">جاهز نكسر الدنيا يا {profile?.nickname}؟ 🚀</h2>
                  <p className="text-slate-500 text-xl font-bold max-w-2xl mx-auto leading-relaxed">أنا معاك عشان أسهل عليك كل صعب في المنهج. اسأل في أي مادة، كيمياء، فيزياء، رياضة، هفهمك كأننا بنحكي حكاية!</p>
                  <div className="flex flex-wrap justify-center gap-4 relative z-10">
                    <button onClick={()=>setInputValue("اشرح لي الكيمياء العضوية بطريقة سهلة")} className="px-8 py-4 bg-indigo-50 text-indigo-700 rounded-3xl text-sm font-black shadow-sm hover:scale-105 transition-all">العضوية 🧪</button>
                    <button onClick={()=>setInputValue("حل لي مسألة فيزياء عن قوانين نيوتن")} className="px-8 py-4 bg-amber-50 text-amber-700 rounded-3xl text-sm font-black shadow-sm hover:scale-105 transition-all">فيزياء ⚡</button>
                    <button onClick={()=>setInputValue("ازاي أذاكر صح في النظام الجديد؟")} className="px-8 py-4 bg-emerald-50 text-emerald-700 rounded-3xl text-sm font-black shadow-sm hover:scale-105 transition-all">نصائح 🎓</button>
                  </div>
                </div>
              )}
              
              <AnimatePresence mode="popLayout">
                {currentSession?.messages.map(m => (
                  <ChatBubble key={m.id} message={m} onDeepExplain={handleDeepExplain} onExportPDF={exportToPDF} />
                ))}
              </AnimatePresence>
              
              {isGenerating && (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex gap-5 p-8 bg-white rounded-[3rem] w-fit border-r-8 border-indigo-600 shadow-2xl items-center">
                  <div className="size-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="font-black text-slate-900 text-lg tracking-tight">الدحيح بيجهز لك أقوى ملزمة...</span>
                </motion.div>
              )}
           </div>
        </div>

        <div className="absolute bottom-0 left-0 w-full p-8 md:p-14 bg-gradient-to-t from-white via-white/95 to-transparent z-10 pointer-events-none">
          <div className="max-w-5xl mx-auto space-y-8 pointer-events-auto">
               <div className="flex gap-4">
                 <button onClick={()=>setUseThinking(!useThinking)} className={`px-8 py-4 rounded-[1.5rem] text-xs font-black border-2 transition-all flex items-center gap-3 shadow-2xl ${useThinking?'bg-indigo-600 text-white border-indigo-400 shadow-indigo-300':'bg-white text-slate-500 border-slate-100'}`}>
                   <Lightbulb size={24} className={useThinking ? "animate-pulse" : ""} /> {useThinking ? 'تفكير الدحيح العميق نشط' : 'فعل التفكير الفائق'}
                 </button>
                 {attachedFile && (
                   <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="px-6 py-3 bg-emerald-50 text-emerald-800 border-2 border-emerald-100 rounded-2xl text-xs font-black flex items-center gap-3">
                     <FileText size={20} /> {attachedFile.name.substring(0, 15)}... 
                     <button onClick={()=>setAttachedFile(null)} className="p-1 hover:bg-emerald-200 rounded-full"><X size={18} /></button>
                   </motion.div>
                 )}
               </div>

               <div className="relative glass-card p-5 md:p-8 rounded-[3.5rem] flex items-end gap-5 border-2 border-slate-100 shadow-[0_30px_70px_rgba(0,0,0,0.06)] focus-within:border-indigo-500 focus-within:shadow-[0_30px_70px_rgba(79,70,229,0.15)] transition-all">
                  <button onClick={()=>fileInputRef.current?.click()} className="size-16 bg-slate-50 rounded-[1.5rem] text-slate-500 flex items-center justify-center shrink-0 hover:bg-slate-200 transition-colors">
                    <Paperclip size={28} />
                  </button>
                  <input type="file" ref={fileInputRef} onChange={(e)=>{
                    const f = e.target.files?.[0];
                    if(f){
                      const r = new FileReader();
                      r.onloadend=()=>setAttachedFile({data: r.result as string, name: f.name, type: f.type});
                      r.readAsDataURL(f);
                    }
                  }} className="hidden" />

                  <textarea 
                    value={inputValue} 
                    onChange={e=>setInputValue(e.target.value)} 
                    onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&(e.preventDefault(), handleSend())}
                    placeholder="اكتب أي سؤال في المنهج يا دحيح..." 
                    className="flex-1 bg-transparent border-none focus:ring-0 py-4 text-xl font-black placeholder:text-slate-300 resize-none max-h-56 text-slate-900 text-right leading-relaxed no-scrollbar" 
                    rows={1} 
                  />

                  <div className="flex gap-4">
                    <button className={`size-16 rounded-[1.5rem] flex items-center justify-center transition-all ${isRecording ? 'bg-rose-600 text-white animate-pulse' : 'bg-slate-50 text-slate-400 hover:bg-slate-200'}`}>
                      <Mic size={28} />
                    </button>
                    <button onClick={handleSend} disabled={isGenerating || (!inputValue.trim() && !attachedFile)} className={`size-16 rounded-[1.5rem] text-white shadow-2xl flex items-center justify-center shrink-0 transition-all ${inputValue.trim() || attachedFile ? 'bg-indigo-600 shadow-indigo-300 scale-110 active:scale-95' : 'bg-slate-100 text-slate-300'}`}>
                      <Send className="rotate-180" size={32} />
                    </button>
                  </div>
               </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
