
import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../types';
import { motion } from 'framer-motion';
import { 
  Volume2, Sparkles, Copy, Check, Loader2, Zap, 
  User, Bot, AlertTriangle, Square, Bookmark
} from 'lucide-react';
import { fetchAudioBuffer, getAudioCtx } from '../services/geminiService';

const ScientificContent: React.FC<{ text: string }> = ({ text }) => {
  useEffect(() => {
    if ((window as any).MathJax) {
      (window as any).MathJax.typesetPromise();
    }
  }, [text]);

  const lines = text.split('\n');
  return (
    <div className="space-y-4 text-right font-medium text-[15px] sm:text-lg leading-relaxed">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-1" />;
        
        if (trimmed.startsWith('##')) {
          return (
            <div key={i} className="mt-8 mb-4 flex items-center gap-3">
              <div className="w-1.5 h-6 bg-amber-500 rounded-full shadow-[0_0_15px_rgba(252,211,77,0.5)]" />
              <h2 className="text-xl sm:text-2xl font-black text-white dahih-gold-text">
                {trimmed.replace('##', '').trim()}
              </h2>
            </div>
          );
        }
        
        if (trimmed.includes('🎯')) {
          return (
            <div key={i} className="p-5 rounded-2xl bg-indigo-500/10 border-r-4 border-indigo-500 backdrop-blur-md shadow-xl my-6">
              <div className="flex gap-3 items-start">
                <Zap size={22} className="text-amber-400 shrink-0" />
                <p className="text-indigo-100 font-bold leading-relaxed">{trimmed}</p>
              </div>
            </div>
          );
        }

        if (trimmed.includes('🎓')) {
          return (
            <div key={i} className="bg-white/5 p-5 rounded-2xl border border-white/10 flex items-center gap-4 my-6 group hover:bg-white/10 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center text-indigo-400">
                <Sparkles size={20}/>
              </div>
              <p className="text-slate-100 font-bold">{trimmed}</p>
            </div>
          );
        }

        if (trimmed.includes('⚠️')) {
          return (
            <div key={i} className="bg-rose-500/5 p-5 rounded-2xl border border-rose-500/20 text-rose-100 flex items-start gap-3">
              <AlertTriangle size={22} className="shrink-0 text-rose-500" />
              <p className="font-bold">{trimmed}</p>
            </div>
          );
        }

        return (
          <p key={i} className="text-slate-200/95 tracking-wide selection:bg-indigo-500/40">
            {trimmed}
          </p>
        );
      })}
    </div>
  );
};

const ChatBubble: React.FC<{ message: Message }> = ({ message }) => {
  const isModel = message.role === 'model';
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [copied, setCopied] = useState(false);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const handleSpeak = async () => {
    if (isPlaying) {
      if (audioSourceRef.current) audioSourceRef.current.stop();
      setIsPlaying(false);
      return;
    }
    setLoadingAudio(true);
    const buffer = await fetchAudioBuffer(message.text);
    setLoadingAudio(false);
    if (buffer) {
      const ctx = getAudioCtx();
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => setIsPlaying(false);
      audioSourceRef.current = source;
      setIsPlaying(true);
      source.start(0);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`flex w-full mb-8 sm:mb-12 ${isModel ? 'justify-start' : 'justify-end'}`}
    >
      <div className={`flex flex-col gap-3 max-w-[95%] sm:max-w-[80%] ${isModel ? 'items-start' : 'items-end'}`}>
        <div className="flex items-center gap-3 px-4">
          {isModel ? (
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white shadow-lg border border-white/10"><Bot size={20}/></div>
              <span className="text-[11px] font-black uppercase tracking-[3px] text-indigo-400">Quantum Mentor</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-[3px] text-slate-500">Scholar Student</span>
              <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-white border border-white/10"><User size={20}/></div>
            </div>
          )}
        </div>

        <div className={`relative p-6 sm:p-10 rounded-[2.5rem] transition-all shadow-2xl overflow-hidden ${
          isModel 
            ? 'glass-platinum rounded-tr-none border-r-4 border-indigo-500 shadow-indigo-500/10' 
            : 'bg-indigo-600 text-white rounded-tl-none border border-white/10 shadow-indigo-600/20'
        }`}>
          <div className="relative z-10">
            {isModel ? <ScientificContent text={message.text} /> : <p className="text-lg sm:text-2xl font-bold leading-relaxed">{message.text}</p>}
          </div>

          {isModel && (
            <div className="flex flex-wrap gap-3 mt-8 pt-6 border-t border-white/5">
              <motion.button 
                whileTap={{ scale: 0.95 }}
                onClick={handleSpeak} 
                className={`flex items-center gap-2.5 px-6 py-3 rounded-2xl text-[13px] font-black transition-all ${
                  isPlaying ? 'bg-rose-500 text-white shadow-rose-500/40' : 'bg-white/5 hover:bg-white/10 text-indigo-300 border border-indigo-500/20 shadow-xl'
                }`}
              >
                {loadingAudio ? <Loader2 size={16} className="animate-spin" /> : isPlaying ? <Square size={16} fill="currentColor" /> : <Volume2 size={16} />}
                <span>{isPlaying ? 'إيقاف الشرح' : 'استماع للمعلم'}</span>
              </motion.button>
              
              <motion.button 
                whileTap={{ scale: 0.95 }}
                onClick={() => { navigator.clipboard.writeText(message.text); setCopied(true); setTimeout(()=>setCopied(false), 2000); }} 
                className="flex items-center gap-2.5 px-6 py-3 rounded-2xl text-[13px] font-black bg-white/5 hover:bg-white/10 text-slate-400 border border-white/10 transition-all shadow-xl"
              >
                {copied ? <Check size={16} className="text-emerald-400" /> : <Bookmark size={16} />}
                <span>{copied ? 'تم النسخ' : 'نسخ المحتوى'}</span>
              </motion.button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ChatBubble;
