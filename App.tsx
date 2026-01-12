
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Message, UserProfile, Grade, Branch } from './types';
import { sendMessageQuantum, startLiveCall } from './services/geminiService';
import { auth, db, syncSessionsToFirebase, fetchSessionsFromFirebase, signInWithGoogle } from './services/firebaseService';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, setPersistence, browserLocalPersistence } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import ChatBubble from './components/ChatBubble';
import { 
  Send, X, Menu, Brain, PhoneOff, GraduationCap, 
  Lightbulb, Loader2, LogOut, User, Mail, Lock, 
  Star, Phone, Paperclip, CloudCheck,
  CheckCircle2, BookOpen, Download,
  Trash2, Eye, EyeOff, Save, Settings, 
  PlusCircle, LayoutDashboard, Command, Activity, Zap, 
  Cpu, MicOff, Waves, ShieldCheck, FileText, FileImage, FileAudio, FileVideo, File
} from 'lucide-react';

type ViewState = 'auth' | 'chat' | 'profile' | 'loading';
type AuthMode = 'login' | 'signup';

const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [view, setView] = useState<ViewState>('loading');
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  
  const [editName, setEditName] = useState('');
  const [editGrade, setEditGrade] = useState<Grade>('3sec');
  const [editBranch, setEditBranch] = useState<Branch>('general');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [useThinking, setUseThinking] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [sessions, setSessions] = useState<any[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  
  const [attachedFiles, setAttachedFiles] = useState<{name: string, data: string, mime: string, type: string}[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isCallActive, setIsCallActive] = useState(false);
  const [callSession, setCallSession] = useState<any>(null);
  const [transcriptions, setTranscriptions] = useState<{text: string, isUser: boolean}[]>([]);

  const isInitialLoad = useRef(true);
  const currentSession = sessions.find(s => s.id === currentSessionId);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence);
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        try {
          const docSnap = await getDoc(doc(db, "users", u.uid));
          const p = docSnap.exists() ? docSnap.data() as UserProfile : { uid: u.uid, name: u.displayName || 'طالب دحيح', email: u.email || '', points: 100, grade: '3sec', branch: 'general' } as UserProfile;
          setProfile(p);
          setEditName(p.name);
          setEditGrade(p.grade || '3sec');
          setEditBranch(p.branch || 'general');
          
          const cloudSessions = await fetchSessionsFromFirebase(u.uid);
          if (cloudSessions.length > 0) {
            setSessions(cloudSessions);
            setCurrentSessionId(cloudSessions[0].id);
          } else {
            const firstId = Date.now().toString();
            setSessions([{ id: firstId, title: 'مذاكرة جديدة', messages: [], lastUpdated: Date.now() }]);
            setCurrentSessionId(firstId);
          }
          isInitialLoad.current = false;
          setView('chat');
        } catch (e) { setView('chat'); }
      } else {
        setView('auth');
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || isInitialLoad.current || sessions.length === 0) return;
    const syncTimer = setTimeout(async () => {
      setIsSyncing(true);
      try { await syncSessionsToFirebase(user.uid, sessions); } finally { setIsSyncing(false); }
    }, 10000);
    return () => clearTimeout(syncTimer);
  }, [sessions, user]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [currentSession?.messages, isGenerating, attachedFiles]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setLoading(true);
    try {
      if (authMode === 'signup') {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        const p: UserProfile = { uid: res.user.uid, name: fullName, email, points: 100, grade: editGrade, branch: editBranch };
        await setDoc(doc(db, "users", res.user.uid), p);
        setProfile(p);
      } else { await signInWithEmailAndPassword(auth, email, password); }
    } catch (err: any) { setAuthError('تأكد من البيانات والاتصال بالإنترنت.'); } finally { setLoading(false); }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file: any) => {
      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        const base64 = readerEvent.target?.result as string;
        let fileType = 'file';
        if (file.type.startsWith('image/')) fileType = 'image';
        else if (file.type.startsWith('audio/')) fileType = 'audio';
        else if (file.type.startsWith('video/')) fileType = 'video';
        else if (file.type === 'application/pdf') fileType = 'pdf';
        setAttachedFiles(prev => [...prev, { name: file.name, data: base64, mime: file.type, type: fileType }]);
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async () => {
    if (!currentSessionId || (!inputValue.trim() && attachedFiles.length === 0) || isGenerating) return;
    const prompt = inputValue.trim();
    const filesToSend = [...attachedFiles];
    setIsGenerating(true);
    setInputValue('');
    setAttachedFiles([]);
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: prompt || `[ملفات: ${filesToSend.length}]`, timestamp: Date.now() };
    setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [...s.messages, userMsg], lastUpdated: Date.now() } : s));
    const modelMsgId = (Date.now() + 1).toString();
    setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [...s.messages, { id: modelMsgId, role: 'model', text: '', timestamp: Date.now() }] } : s));
    try {
      await sendMessageQuantum(prompt || "قم بتحليل المرفقات الموضحة.", { useThinking, files: filesToSend }, (text) => {
        setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: s.messages.map(m => m.id === modelMsgId ? { ...m, text } : m) } : s));
      });
    } finally { setIsGenerating(false); }
  };

  const toggleCall = async () => {
    if(isCallActive) { await callSession?.stop(); setIsCallActive(false); return; }
    setIsCallActive(true);
    try {
      const s = await startLiveCall((text, isUser) => setTranscriptions(prev => [...prev, {text, isUser}].slice(-3)));
      setCallSession(s);
    } catch(e) { setIsCallActive(false); alert("تأكد من إعطاء صلاحية الميكروفون."); }
  };

  const handleSaveProfile = async () => {
    if (!user || !profile) return;
    setIsSavingProfile(true);
    try {
      const updated = { ...profile, name: editName, grade: editGrade, branch: editBranch };
      await setDoc(doc(db, "users", user.uid), updated, { merge: true });
      setProfile(updated);
      setView('chat');
    } finally { setIsSavingProfile(false); }
  };

  if (view === 'loading') return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-[#020617] p-6 text-center">
      <motion.div animate={{ scale: [1, 1.1, 1], rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 4 }} className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center text-white shadow-2xl mb-8">
        <Brain size={40} />
      </motion.div>
      <h1 className="dahih-gold-text text-4xl mb-2">الدحيح</h1>
      <Loader2 className="animate-spin text-indigo-500 opacity-50" />
    </div>
  );

  if (view === 'auth') return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#020617] overflow-y-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md glass-platinum p-8 sm:p-12 rounded-[2.5rem] text-center border border-white/5 my-8">
        <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-amber-500 rounded-3xl flex items-center justify-center mx-auto mb-8 text-white shadow-2xl"><GraduationCap size={40} /></div>
        <h1 className="dahih-gold-text text-4xl mb-8">الدحيح</h1>
        <div className="flex bg-slate-900/50 p-1.5 rounded-2xl mb-8 border border-white/5">
           <button onClick={()=>setAuthMode('login')} className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all ${authMode==='login'?'bg-indigo-600 text-white shadow-lg':'text-slate-500'}`}>دخول</button>
           <button onClick={()=>setAuthMode('signup')} className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all ${authMode==='signup'?'bg-indigo-600 text-white shadow-lg':'text-slate-500'}`}>تسجيل</button>
        </div>
        <button className="btn-google-legendary mb-8 w-full" onClick={signInWithGoogle} disabled={loading}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="white" viewBox="0 0 24 24"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.908 3.152-1.928 4.172-1.272 1.272-3.264 2.688-6.912 2.688-6.144 0-10.8-4.968-10.8-11.112s4.656-11.112 10.8-11.112c3.48 0 6.024 1.368 7.824 3.12l2.304-2.304c-2.328-2.232-5.4-3.528-10.128-3.528-9.048 0-16.512 7.344-16.512 16.5s7.464 16.5 16.512 16.5c4.896 0 8.592-1.608 11.544-4.68 3.048-3.048 4.008-7.296 4.008-10.656 0-.912-.072-1.872-.216-2.736h-12.72v-.048z"/></svg>
          <span className="font-bold text-sm">متابعة عبر جوجل</span>
        </button>
        <form onSubmit={handleAuth} className="space-y-4">
           {authMode==='signup' && <input type="text" placeholder="الاسم" value={fullName} onChange={e=>setFullName(e.target.value)} required className="w-full bg-slate-950/60 p-4 rounded-xl text-white border border-white/10 outline-none" />}
           <input type="email" placeholder="البريد" value={email} onChange={e=>setEmail(e.target.value)} required className="w-full bg-slate-950/60 p-4 rounded-xl text-white border border-white/10 outline-none" />
           <div className="relative">
             <input type={showPassword?'text':'password'} placeholder="كلمة السر" value={password} onChange={e=>setPassword(e.target.value)} required className="w-full bg-slate-950/60 p-4 pr-4 pl-12 rounded-xl text-white border border-white/10 outline-none" />
             <button type="button" onClick={()=>setShowPassword(!showPassword)} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
           </div>
           <button type="submit" disabled={loading} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-lg transition-all">{loading ? <Loader2 className="animate-spin mx-auto" /> : 'دخول المنصة'}</button>
        </form>
        {authError && <p className="mt-4 text-rose-400 text-xs">{authError}</p>}
      </motion.div>
    </div>
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-transparent text-white relative">
      <AnimatePresence>
        {isSidebarOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={()=>setIsSidebarOpen(false)} className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[90] lg:hidden" />}
      </AnimatePresence>
      <aside className={`fixed lg:relative inset-y-0 right-0 z-[100] w-[85vw] sm:w-80 glass-platinum border-l border-white/10 transition-transform duration-500 ${isSidebarOpen?'translate-x-0':'-translate-x-full lg:translate-x-0'} flex flex-col p-6 safe-pt safe-pb`}>
        <div className="flex items-center gap-4 mb-10">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl"><Brain size={28}/></div>
          <div className="dahih-gold-text text-2xl">الدحيح</div>
        </div>
        <button onClick={()=>{const id=Date.now().toString(); setSessions([{id, title:'مذاكرة جديدة', messages:[], lastUpdated:Date.now()}, ...sessions]); setCurrentSessionId(id); setIsSidebarOpen(false);}} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold mb-8 shadow-lg flex items-center justify-center gap-2"><PlusCircle size={20}/> مذاكرة جديدة</button>
        <div className="flex-1 overflow-y-auto no-scrollbar space-y-3">
          {sessions.map(s => (
            <div key={s.id} onClick={()=>{setCurrentSessionId(s.id); setIsSidebarOpen(false);}} className={`p-4 rounded-xl cursor-pointer border transition-all flex items-center justify-between ${currentSessionId===s.id?'bg-indigo-600/30 border-indigo-500/50 shadow-md':'bg-white/5 border-transparent opacity-60'}`}>
              <p className="text-sm font-bold truncate max-w-[150px]">{s.title || 'مذاكرة فارغة'}</p>
              <button onClick={(e)=>{e.stopPropagation(); if(confirm('حذف؟')) setSessions(prev=>prev.filter(x=>x.id!==s.id));}} className="p-1 text-rose-500"><Trash2 size={16}/></button>
            </div>
          ))}
        </div>
        <div className="mt-6 pt-6 border-t border-white/5 space-y-3">
            <button onClick={()=>setView('profile')} className="w-full py-3 glass-platinum rounded-xl font-bold flex items-center justify-center gap-2 text-xs border border-white/5"><Settings size={18}/> الإعدادات</button>
            <button onClick={()=>signOut(auth)} className="w-full py-3 text-rose-400 font-bold flex items-center justify-center gap-2 text-xs"><LogOut size={18}/> خروج</button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col relative h-full">
        <header className="h-16 glass-platinum flex items-center justify-between px-4 sm:px-8 z-50 border-b border-white/5 safe-pt">
           <div className="flex items-center gap-4">
               <button className="lg:hidden p-2 bg-white/5 rounded-lg border border-white/10" onClick={()=>setIsSidebarOpen(true)}><Menu size={24}/></button>
               <div className="dahih-gold-text text-xl sm:text-2xl">الدحيح</div>
           </div>
           <div className="flex items-center gap-2">
              <button onClick={toggleCall} className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 text-[10px] sm:text-xs shadow-xl ${isCallActive?'bg-rose-500 animate-pulse':'bg-indigo-600'}`}>{isCallActive ? <PhoneOff size={16}/> : <Phone size={16}/>} <span>{isCallActive ? 'إنهاء' : 'مكالمة'}</span></button>
           </div>
        </header>
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 no-scrollbar chat-container">
           <div className="max-w-4xl mx-auto w-full pb-40">
              {!currentSessionId && !isCallActive && <div className="h-[50vh] flex flex-col items-center justify-center text-center opacity-10"><Cpu size={120} className="mb-6 animate-pulse" /><h2 className="text-3xl font-black">الدحيح في انتظارك</h2></div>}
              <AnimatePresence mode="popLayout">{currentSession?.messages.map(m => <ChatBubble key={m.id} message={m} />)}</AnimatePresence>
              {isGenerating && <div className="flex gap-4 p-5 glass-platinum rounded-2xl w-fit border-r-4 border-indigo-500 animate-pulse"><Loader2 className="animate-spin text-indigo-500" size={20}/><span className="text-sm font-bold">يكتب الآن...</span></div>}
           </div>
        </div>
        {currentSessionId && !isCallActive && (
          <div className="absolute bottom-0 left-0 w-full p-4 sm:p-8 bg-gradient-to-t from-[#020617] via-[#020617]/90 to-transparent z-10 safe-pb">
            <div className="max-w-4xl mx-auto space-y-4">
               <AnimatePresence>
                {attachedFiles.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="flex flex-wrap gap-2 p-3 glass-platinum rounded-2xl border border-white/5 overflow-x-auto max-h-24 no-scrollbar">
                    {attachedFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600/20 rounded-lg text-[10px] font-bold border border-indigo-500/30 whitespace-nowrap">
                        {f.type==='image'?<FileImage size={14}/>:f.type==='pdf'?<FileText size={14}/>:<File size={14}/>}
                        <span className="max-w-[80px] truncate">{f.name}</span>
                        <button onClick={()=>setAttachedFiles(prev=>prev.filter((_,idx)=>idx!==i))} className="text-rose-400"><X size={12}/></button>
                      </div>
                    ))}
                  </motion.div>
                )}
               </AnimatePresence>
               <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                 <button onClick={()=>setUseThinking(!useThinking)} className={`px-4 py-2 rounded-xl text-[10px] font-bold border transition-all whitespace-nowrap flex items-center gap-2 ${useThinking?'bg-indigo-600 border-indigo-400 shadow-md':'bg-white/5 border-white/5 opacity-40'}`}><Lightbulb size={14}/> {useThinking ? 'التفكير نشط' : 'تفعيل التفكير'}</button>
                 {isSyncing && <div className="px-4 py-2 bg-emerald-500/10 rounded-xl text-[10px] font-bold border border-emerald-500/20 text-emerald-400 flex items-center gap-2 whitespace-nowrap"><CloudCheck size={14}/> يتم الحفظ..</div>}
               </div>
               <div className="relative glass-platinum p-3 rounded-[2rem] flex items-end gap-3 border border-white/10 shadow-2xl focus-within:border-indigo-500/50">
                  <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileSelect} accept="image/*, application/pdf, audio/*, video/*" />
                  <button onClick={()=>fileInputRef.current?.click()} className="w-10 h-10 sm:w-12 sm:h-12 bg-white/5 rounded-full text-slate-400 flex items-center justify-center shrink-0 border border-white/5"><Paperclip size={20}/></button>
                  <textarea value={inputValue} onChange={e=>setInputValue(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&(e.preventDefault(), handleSend())} placeholder="اسأل الدحيح..." className="flex-1 bg-transparent border-none focus:ring-0 py-3 text-base sm:text-lg font-bold placeholder:text-slate-700 resize-none max-h-32 min-h-[40px] no-scrollbar text-white" rows={1} />
                  <button onClick={handleSend} disabled={isGenerating || (!inputValue.trim() && attachedFiles.length===0)} className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full text-white shadow-xl flex items-center justify-center shrink-0 transition-all ${inputValue.trim()||attachedFiles.length>0 ? 'bg-indigo-600' : 'bg-slate-800 opacity-30'}`}><Send size={20} className="rotate-180 translate-x-0.5"/></button>
               </div>
            </div>
          </div>
        )}
        <AnimatePresence>
          {isCallActive && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[150] bg-[#020617]/98 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center">
              <div className="relative mb-12">
                <div className="absolute inset-0 bg-indigo-500 blur-[80px] rounded-full opacity-20 animate-pulse" />
                <div className="w-40 h-40 sm:w-56 sm:h-56 rounded-[3rem] bg-indigo-600 flex items-center justify-center text-white relative z-10 shadow-2xl border-2 border-white/10"><Brain size={80} className="animate-pulse" /></div>
              </div>
              <h2 className="text-2xl sm:text-4xl font-black text-white dahih-gold-text mb-8">الدحيح في مكالمة معك</h2>
              <div className="max-w-md w-full h-24 overflow-hidden mb-12 bg-white/5 rounded-2xl p-6 flex flex-col justify-center border border-white/5 shadow-inner">
                {transcriptions.length > 0 ? <p className="text-lg font-bold text-slate-100 italic">"{transcriptions[transcriptions.length-1].text}"</p> : <p className="text-slate-500 animate-pulse font-bold text-sm uppercase tracking-widest">انتظار السؤال...</p>}
              </div>
              <div className="flex gap-6">
                <button className="w-14 h-14 rounded-2xl glass-platinum flex items-center justify-center text-slate-500 border border-white/5"><MicOff size={24}/></button>
                <button onClick={toggleCall} className="w-20 h-20 rounded-[2rem] bg-rose-500 text-white flex items-center justify-center shadow-xl border-4 border-white/10 transition-transform active:scale-90"><PhoneOff size={32}/></button>
                <button className="w-14 h-14 rounded-2xl glass-platinum flex items-center justify-center text-indigo-400 border border-white/5"><Waves size={24}/></button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <AnimatePresence>
        {view === 'profile' && profile && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} className="w-full max-w-2xl bg-[#0f172a] p-8 rounded-[3rem] border border-white/10 shadow-3xl relative overflow-y-auto max-h-[90vh] no-scrollbar">
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-4"><Settings className="text-indigo-400" size={28}/><h2 className="dahih-gold-text text-2xl">الملف الشخصي</h2></div>
                <button onClick={()=>setView('chat')} className="p-3 bg-white/5 rounded-xl border border-white/10"><X size={20}/></button>
              </div>
              <div className="grid grid-cols-1 gap-6">
                <div className="flex flex-col items-center gap-4 p-6 glass-platinum rounded-3xl border border-white/5">
                  <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white text-3xl font-black">{editName.charAt(0)}</div>
                  <div className="w-full space-y-2 text-right">
                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest px-2">الاسم</label>
                    <input type="text" value={editName} onChange={e=>setEditName(e.target.value)} className="w-full bg-slate-950/60 p-4 rounded-xl border border-white/10 outline-none font-bold" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                   <div className="glass-platinum p-6 rounded-3xl flex flex-col items-center justify-center gap-2 border border-white/5 shadow-inner">
                      <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">رصيد النبوغ</label>
                      <div className="text-4xl font-black text-indigo-400 flex items-center gap-3"><Zap className="text-amber-400" size={24}/>{profile.points}</div>
                   </div>
                   <div className="glass-platinum p-6 rounded-3xl space-y-4 border border-white/5">
                      <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest text-right block">الصف</label>
                      <select value={editGrade} onChange={e=>setEditGrade(e.target.value as Grade)} className="w-full bg-slate-950 p-3 rounded-xl border border-white/10 font-bold outline-none text-sm cursor-pointer">
                        <option value="1sec">الأول الثانوي</option><option value="2sec">الثاني الثانوي</option><option value="3sec">الثالث الثانوي</option>
                      </select>
                   </div>
                </div>
                <div className="glass-platinum p-6 rounded-3xl space-y-4 border border-white/5">
                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest text-right block">الشعبة</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {['science', 'math', 'literary', 'general'].map((b) => (
                        <button key={b} onClick={() => setEditBranch(b as Branch)} className={`py-3 rounded-xl font-bold border text-xs transition-all ${editBranch === b ? 'bg-indigo-600 border-indigo-400 text-white shadow-md' : 'bg-slate-950 border-white/5 text-slate-500'}`}>
                          {b === 'science' ? 'علوم' : b === 'math' ? 'رياضة' : b === 'literary' ? 'أدبي' : 'عامة'}
                        </button>
                      ))}
                    </div>
                </div>
                <button onClick={handleSaveProfile} disabled={isSavingProfile} className="py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[2rem] font-black text-xl shadow-xl transition-all flex items-center justify-center gap-4 mt-4">
                  {isSavingProfile ? <Loader2 className="animate-spin" size={24}/> : <><Save size={20}/> حفظ البيانات</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
