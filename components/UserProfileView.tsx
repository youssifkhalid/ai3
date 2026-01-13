
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { UserProfile, AcademicYear, Track } from '../types';
import { 
  User, Award, Calendar, BookOpen, 
  Star, ShieldCheck, ChevronLeft, LogOut, Edit3, Save, X, Globe, Trophy, Sparkles
} from 'lucide-react';
import { auth, updateUserProfile } from '../services/firebaseService';
import { signOut } from 'firebase/auth';

const UserProfileView: React.FC<{ profile: UserProfile, onClose: () => void, onUpdate: (p: UserProfile) => void }> = ({ profile, onClose, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editedData, setEditedData] = useState({
    name: profile.name,
    nickname: profile.nickname,
    academicYear: profile.academicYear,
    track: profile.track
  });

  const safeLocale = 'ar-EG';

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateUserProfile(profile.uid, editedData);
      onUpdate({ ...profile, ...editedData });
      setIsEditing(false);
    } catch (e) {
      alert("حصل مشكلة في حفظ الداتا يا دحيح!");
    } finally {
      setLoading(false);
    }
  };

  const tracks = editedData.academicYear === '1ث' ? ['عام'] : 
                 editedData.academicYear === '2ث' ? ['علمي', 'أدبي'] : 
                 ['علمي علوم', 'علمي رياضة', 'أدبي'];

  return (
    <motion.div 
      initial={{ opacity: 0, x: 100 }} 
      animate={{ opacity: 1, x: 0 }} 
      exit={{ opacity: 0, x: 100 }}
      className="fixed inset-0 z-[200] bg-slate-50 flex flex-col"
    >
      <header className="h-20 glass-premium flex items-center justify-between px-6 border-b border-slate-200 z-10">
        <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-2xl transition-all">
          <ChevronLeft size={24} className="rotate-180" />
        </button>
        <div className="text-center">
           <h2 className="font-black text-xl text-slate-800">حساب الدحيح</h2>
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">المعلومات الشخصية</p>
        </div>
        <button 
          onClick={() => isEditing ? handleSave() : setIsEditing(true)}
          disabled={loading}
          className={`px-5 py-2.5 rounded-2xl flex items-center gap-2 font-black text-sm transition-all shadow-lg ${isEditing ? 'bg-emerald-600 text-white shadow-emerald-200' : 'bg-white text-indigo-600 shadow-indigo-100 border border-indigo-50'}`}
        >
          {loading ? 'بيحفظ...' : isEditing ? <><Save size={18}/> حفظ</> : <><Edit3 size={18}/> تعديل</>}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar relative">
        {/* Background Decor */}
        <div className="absolute top-0 left-0 w-full h-40 bg-indigo-600 -z-10 rounded-b-[3rem]"></div>

        {/* Profile Card */}
        <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl shadow-indigo-100 border border-white mt-10 text-center relative overflow-hidden">
          <div className="absolute -top-10 -right-10 opacity-5 rotate-12"><Trophy size={200}/></div>
          <div className="relative z-10 flex flex-col items-center">
            <div className="size-28 bg-indigo-50 rounded-[2.5rem] flex items-center justify-center mb-6 border-4 border-white shadow-xl relative">
              <User size={60} className="text-indigo-600" />
              <div className="absolute -bottom-2 -right-2 size-10 bg-emerald-500 rounded-2xl border-4 border-white flex items-center justify-center text-white">
                <ShieldCheck size={20} />
              </div>
            </div>
            {isEditing ? (
              <div className="w-full max-w-xs space-y-3">
                <input 
                  value={editedData.nickname} 
                  onChange={e => setEditedData({...editedData, nickname: e.target.value})}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-center font-bold outline-none focus:border-indigo-500 transition-all"
                  placeholder="اللقب (مثلاً: دكتور، مهندس)"
                />
                <input 
                  value={editedData.name} 
                  onChange={e => setEditedData({...editedData, name: e.target.value})}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-center text-xl font-black outline-none focus:border-indigo-500 transition-all"
                  placeholder="اسمك بالكامل"
                />
              </div>
            ) : (
              <>
                <h3 className="text-3xl font-black text-slate-800 mb-2">{profile.nickname} {profile.name}</h3>
                <div className="flex gap-2">
                   <span className="px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-black">{profile.academicYear}</span>
                   <span className="px-4 py-1.5 bg-amber-50 text-amber-600 rounded-full text-xs font-black">{profile.track}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <motion.div whileHover={{ y: -5 }} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col items-center gap-3">
            <div className="size-14 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center shadow-inner"><Star size={28} /></div>
            <div className="text-center">
               <div className="text-2xl font-black text-slate-800">{profile.points}</div>
               <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">نقاط التفوق</div>
            </div>
          </motion.div>
          <motion.div whileHover={{ y: -5 }} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col items-center gap-3">
            <div className="size-14 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center shadow-inner"><Trophy size={28} /></div>
            <div className="text-center">
               <div className="text-2xl font-black text-slate-800">نشط</div>
               <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">حالة الحساب</div>
            </div>
          </motion.div>
        </div>

        {/* Settings / Academic Info */}
        <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 space-y-8 shadow-sm">
          <h4 className="font-black text-slate-800 flex items-center gap-3"><BookOpen className="text-indigo-600" /> المعلومات الأكاديمية</h4>
          
          <div className="space-y-6">
            <div className="flex items-center gap-5">
              <div className="size-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0"><Sparkles size={20}/></div>
              <div className="flex-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">السنة الدراسية والتخصص</p>
                {isEditing ? (
                  <div className="flex gap-3 mt-3">
                    <select 
                      value={editedData.academicYear} 
                      onChange={e => {
                        const val = e.target.value as AcademicYear;
                        setEditedData({...editedData, academicYear: val, track: val === '1ث' ? 'عام' : val === '2ث' ? 'علمي' : 'علمي علوم'});
                      }}
                      className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 font-bold outline-none focus:border-indigo-500 transition-all"
                    >
                      <option value="1ث">الصف الأول الثانوي</option>
                      <option value="2ث">الصف الثاني الثانوي</option>
                      <option value="3ث">الصف الثالث الثانوي</option>
                    </select>
                    <select 
                      value={editedData.track} 
                      onChange={e => setEditedData({...editedData, track: e.target.value as Track})}
                      className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 font-bold outline-none focus:border-indigo-500 transition-all"
                    >
                      {tracks.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                ) : (
                  <p className="text-base font-black text-slate-800">{profile.academicYear} - {profile.track}</p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-5">
              <div className="size-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-500 shrink-0"><Calendar size={20}/></div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">تاريخ انضمامك للرحلة</p>
                <p className="text-base font-black text-slate-800">{new Date(profile.joinedAt).toLocaleDateString(safeLocale, { dateStyle: 'long' })}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Logout Section */}
        <div className="pt-4 flex flex-col gap-4">
            {isEditing && (
              <button 
                onClick={() => setIsEditing(false)}
                className="w-full py-5 bg-white border-2 border-slate-100 text-slate-500 rounded-[2rem] font-black flex items-center justify-center gap-3 transition-all hover:bg-slate-50"
              >
                <X size={20} /> إلغاء التعديلات
              </button>
            )}

            <button 
              onClick={() => signOut(auth)}
              className="w-full py-5 bg-rose-50 text-rose-600 rounded-[2rem] font-black flex items-center justify-center gap-3 border-2 border-rose-100 transition-all hover:bg-rose-600 hover:text-white hover:shadow-2xl hover:shadow-rose-100"
            >
              <LogOut size={20} /> تسجيل الخروج من الدفعة
            </button>
        </div>
        
        <p className="text-center text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] py-6">الدحيح 2026 • الإصدار الفائق</p>
      </div>
    </motion.div>
  );
};

export default UserProfileView;
