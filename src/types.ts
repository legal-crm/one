export interface Client {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
  consentFlag: boolean;
}

export interface FinancialProfile {
  clientId: string;
  income: number;      // Monthly income in ten thousand KRW (만 원)
  debtTotal: number;   // Total debt in ten thousand KRW (만 원)
  assetsTotal: number; // Total assets in ten thousand KRW (만 원)
  dependents: number;  // Number of dependents (명)
  maritalStatus: 'SINGLE' | 'MARRIED' | 'DIVORCED';
  debtTypes: {
    banks: number;
    cards: number;
    personals: number;
    recentLoans: number; // Recent high-risk loans (최근 대출)
    coinCrypto: number;  // Cod/Coin/Stock losses (코인/주식 손실)
  };
  riskFlags: string[]; // ['최근 1년 이내 대출 과다', '사행성 채무(코인/토토)', '소득 대비 과다 채무']
}

export type RequestType = 'direct' | 'open';
export type ConsultStatus = 'requested' | 'responding' | 'counseling' | 'closed';

export interface ConsultRequest {
  id: string;
  clientId: string;
  clientName: string;
  phone: string;
  requestType: RequestType;
  maxParticipants: number;
  status: ConsultStatus;
  selectedLawyerId?: string; // If 'direct'
  createdAt: string;
  title: string;
  content: string;
  financialProfile: FinancialProfile;
}

export interface ConsultParticipant {
  id: string;
  consultRequestId: string;
  lawyerId: string;
  joinedAt: string;
}

export interface ConsultMessage {
  id: string;
  consultRequestId: string;
  senderType: 'client' | 'lawyer';
  senderId: string;
  senderName: string;
  message: string;
  createdAt: string;
}

export interface LawFirm {
  id: string;
  name: string;
  region: string;
}

export interface Team {
  id: string;
  lawFirmId: string;
  name: string;
}

export type UserRole = 'LAWYER' | 'STAFF' | 'ADMIN';

export interface User {
  id: string;
  lawFirmId: string;
  teamId: string;
  name: string;
  role: UserRole;
  fields: string[];
  region: string;
  avatar: string;
  bio: string;
  recentActivity: string;
  matchedCount: number;
  password?: string; // Optional password for authentication
}

export type CaseStatus = 'document' | 'filing' | 'commencement' | 'approval' | 'discharge';

export interface Case {
  id: string;
  clientId: string;
  clientName: string;
  phone: string;
  status: CaseStatus;
  assignedLawyerId: string;
  assignedLawyerName: string;
  debtTotal: number;
  income: number;
  createdAt: string;
  updatedAt: string;
  notes: string[];
}
