
import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../types';
import { motion } from 'framer-motion';
import { 
  Volume2, Loader2, Zap, 
  User, Bot, Square, FlaskConical, FileText, Download, Sparkles
} from 'lucide-react';
import { fetchAudioBuffer, getAudioCtx } from '../services/geminiService';

const ScientificContent: React.FC<{ text: string }> = ({ text }) => {
  useEffect(() => {
    if ((window as any).MathJax) {
      (window as any).MathJax.typesetPromise();
    }
  }, [text]);

  const renderFormattedLine = (line: string, index: number) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={index} className="h-2" />;

    // Headers
    if (trimmed.startsWith('##')) {
      return (
        <h2 key={index} className="text-xl md:text-2xl font-black text-indigo-700 mt-6 mb-3 border-r-8 border-indigo-600 pr-3 leading-tight">
          {trimmed.replace('##', '').trim()}
        </h2>
      );
    }

    // High-impact tips
    if (trimmed.includes('🎯') || trimmed.includes('تريكة')) {
      return (
        <div key={index} className="p-4 bg-emerald-50 border-r-4 border-emerald-500 rounded-l-2xl my-3 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-700 font-black text-sm mb-1 uppercase">
            <Sparkles size={16} /> تريكة امتحان
          </div>
          <p className="text-slate-800 font-bold leading-relaxed">{trimmed}</p>
        </div>
      );
    }

    // Rules
    if (trimmed.includes('🎓') || trimmed.includes('قاعدة')) {
      return (
        <div key={index} className="p-5 bg-amber-50 border-2 border-amber-200 rounded-[2rem] my-4 relative overflow-hidden group">
          <div className="absolute top-0 left-0 p-2 text-amber-200 group-hover:text-amber-300 transition-colors">
            <FlaskConical size={60} strokeWidth={1} />
          </div>
          <p className="text-slate-900 font-black text-lg relative z-10 leading-snug">{trimmed}</p>
        </div>
      );
    }

    // Bullet points or standard text
    return (
      <p key={index} className="text-slate-700 font-bold text-base md:text-lg leading-relaxed mb-1">
        {trimmed}
      </p>
    );
  };

  return <div className="scientific-renderer text-right">{text.split('\n').map((line, i) => renderFormattedLine(line, i))}</div>;
};

const ChatBubble: React.FC<{ 
  message: Message, 
  onDeepExplain: (text: string) => void,
  onExportPDF: (text: string) => void
}> = ({ message, onDeepExplain, onExportPDF }) => {
  const isModel = message.role === 'model';
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const handleSpeak = async () => {
    if (isPlaying) {
      if (audioSourceRef.current) audioSourceRef.current.stop();
      setIsPlaying(false);
      return;
    }
    setLoadingAudio(true);
    const buffer = await fetchAudioBuffer(message.text);
    if (buffer) {
      const ctx = getAudioCtx();
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => setIsPlaying(false);
      audioSourceRef.current = source;
      setIsPlaying(true);
      setLoadingAudio(false);
      source.start(0);
    } else {
      setLoadingAudio(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: isModel ? -30 : 30 }} 
      animate={{ opacity: 1, x: 0 }} 
      className={`flex w-full mb-10 ${isModel ? 'justify-start' : 'justify-end'}`}
    >
      <div className={`flex flex-col gap-3 max-w-[95%] sm:max-w-[85%] md:max-w-[75%] ${isModel ? 'items-start' : 'items-end'}`}>
        <div className={`flex items-center gap-3 px-3 ${isModel ? 'flex-row' : 'flex-row-reverse'}`}>
          <div className={`size-10 rounded-2xl flex items-center justify-center shadow-lg transition-transform hover:scale-110 ${isModel ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
            {isModel ? <Bot size={24}/> : <User size={24}/>}
          </div>
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{isModel ? 'الدحيح 2026' : 'أنت'}</span>
        </div>

        <div className={`relative p-6 rounded-[2.5rem] shadow-xl border transition-all ${
          isModel 
          ? 'bg-white border-slate-100 rounded-tr-none hover:shadow-indigo-50' 
          : 'bg-indigo-600 text-white border-indigo-500 rounded-tl-none shadow-indigo-100'
        }`}>
          {isModel ? <ScientificContent text={message.text} /> : <p className="text-lg font-black leading-snug">{message.text}</p>}
          
          {message.image && (
            <div className="mt-4 rounded-3xl overflow-hidden border-2 border-slate-100">
               <img src={message.image} className="w-full h-auto object-cover max-h-96" alt="Attached" />
            </div>
          )}

          {isModel && (
            <div className="mt-8 pt-4 border-t border-slate-50 flex flex-wrap gap-3">
              <button onClick={handleSpeak} disabled={loadingAudio} className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black transition-all ${isPlaying ? 'bg-rose-500 text-white' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}>
                {loadingAudio ? <Loader2 size={16} className="animate-spin" /> : isPlaying ? <Square size={16} /> : <Volume2 size={16} />} 
                <span>{isPlaying ? 'إيقاف' : 'اسمع الشرح'}</span>
              </button>
              <button onClick={() => onDeepExplain(message.text)} className="flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all">
                <FileText size={16} /> <span>تعمق</span>
              </button>
              <button onClick={() => onExportPDF(message.text)} className="flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black bg-slate-50 text-slate-500 hover:bg-slate-900 hover:text-white transition-all">
                <Download size={16} /> <span>PDF</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ChatBubble;
