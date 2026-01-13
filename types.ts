
export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  image?: string;
  video?: string;
  timestamp: number;
  groundingLinks?: Array<{ title: string; uri: string }>;
  isThinking?: boolean;
}

export type AcademicYear = '1ث' | '2ث' | '3ث';
export type Track = 'عام' | 'علمي' | 'أدبي' | 'علمي علوم' | 'علمي رياضة';

// Define SavedLesson to represent lessons stored in the user library
export interface SavedLesson {
  id: string;
  title: string;
  content: string;
  timestamp: number;
}

export interface UserProfile {
  uid: string;
  name: string;        
  nickname: string;    
  emailOrPhone: string;
  academicYear: AcademicYear;
  track: Track;
  points: number;
  joinedAt: number;
  // Add savedLessons to fix App.tsx errors
  savedLessons?: SavedLesson[];
  // Add memory to fix firebaseService.ts errors
  memory?: string;
}