
export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  image?: string;
  timestamp: number;
}

export type Grade = '1sec' | '2sec' | '3sec';
export type Branch = 'general' | 'science' | 'math' | 'literary';
export type SchoolType = 'gov' | 'private' | 'inter';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  points: number;
  grade?: Grade;
  branch?: Branch;
  schoolType?: SchoolType;
}
