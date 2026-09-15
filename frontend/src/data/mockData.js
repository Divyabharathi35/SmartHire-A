// ============================================================
// SMARTHIRE — MOCK DATA
// ============================================================

export const candidateProfile = {
  name: 'Aisha Patel',
  initials: 'AP',
  role: 'Senior Frontend Developer',
  email: 'aisha.patel@email.com',
  score: 87,
  level: 'Senior',
};

export const recruiterProfile = {
  name: 'Marcus Chen',
  initials: 'MC',
  role: 'Technical Recruiter',
  company: 'TechCorp Solutions',
};

export const adminProfile = {
  name: 'Sofia Rodriguez',
  initials: 'SR',
  role: 'Platform Administrator',
};

// Resume Skills
export const extractedSkills = [
  { name: 'React', score: 94 },
  { name: 'TypeScript', score: 88 },
  { name: 'Node.js', score: 76 },
  { name: 'Python', score: 71 },
  { name: 'AWS', score: 65 },
  { name: 'GraphQL', score: 82 },
  { name: 'Docker', score: 58 },
  { name: 'System Design', score: 79 },
];

// Interview Questions
export const interviewQuestions = [
  { id: 1, text: 'Can you explain the concept of closures in JavaScript and give a practical example?', category: 'Technical', difficulty: 'Medium', duration: 120 },
  { id: 2, text: 'Walk me through how you would architect a scalable React application for a million users.', category: 'System Design', difficulty: 'Hard', duration: 180 },
  { id: 3, text: 'Describe a time when you had to make a difficult technical decision under pressure. What was your approach?', category: 'Behavioral', difficulty: 'Easy', duration: 90 },
  { id: 4, text: 'How does the React reconciliation algorithm work, and how can you optimize renders?', category: 'Technical', difficulty: 'Hard', duration: 150 },
  { id: 5, text: 'Explain the difference between REST and GraphQL and when you would choose one over the other.', category: 'Technical', difficulty: 'Medium', duration: 120 },
];

// Performance Analytics
export const competencyData = [
  { subject: 'Technical', A: 88, fullMark: 100 },
  { subject: 'Communication', A: 79, fullMark: 100 },
  { subject: 'Problem Solving', A: 92, fullMark: 100 },
  { subject: 'Body Language', A: 71, fullMark: 100 },
  { subject: 'Aptitude', A: 85, fullMark: 100 },
  { subject: 'Leadership', A: 68, fullMark: 100 },
];

export const categoryScores = [
  { name: 'React', score: 94, fill: 'hsl(252, 100%, 68%)' },
  { name: 'Algorithms', score: 82, fill: 'hsl(280, 90%, 65%)' },
  { name: 'System Design', score: 76, fill: 'hsl(174, 80%, 55%)' },
  { name: 'Behavioral', score: 88, fill: 'hsl(38, 95%, 60%)' },
  { name: 'Communication', score: 79, fill: 'hsl(142, 70%, 55%)' },
];

export const timeDistribution = [
  { name: 'Thinking', value: 35, color: 'hsl(252, 100%, 68%)' },
  { name: 'Answering', value: 45, color: 'hsl(280, 90%, 65%)' },
  { name: 'Clarifying', value: 12, color: 'hsl(174, 80%, 55%)' },
  { name: 'Pausing', value: 8, color: 'hsl(38, 95%, 60%)' },
];

// Improvement Tracker — 6 sessions
export const improvementData = [
  { session: 'Session 1', overall: 54, technical: 48, communication: 60, bodyLanguage: 55 },
  { session: 'Session 2', overall: 61, technical: 57, communication: 65, bodyLanguage: 58 },
  { session: 'Session 3', overall: 69, technical: 68, communication: 71, bodyLanguage: 63 },
  { session: 'Session 4', overall: 74, technical: 75, communication: 73, bodyLanguage: 68 },
  { session: 'Session 5', overall: 80, technical: 83, communication: 77, bodyLanguage: 72 },
  { session: 'Session 6', overall: 87, technical: 88, communication: 79, bodyLanguage: 71 },
];

// Interview History
export const interviewHistory = [
  {
    id: 1,
    title: 'Senior Frontend Developer — Technical Round',
    date: 'Jul 24, 2026',
    duration: '47 min',
    score: 87,
    status: 'completed',
    tags: ['React', 'TypeScript', 'System Design'],
    feedback: 'Excellent problem-solving skills demonstrated. Strong understanding of React internals. Needs minor improvement in articulating trade-offs during system design.',
    questions: 5,
  },
  {
    id: 2,
    title: 'Full Stack Engineer — HR Screening',
    date: 'Jul 20, 2026',
    duration: '32 min',
    score: 80,
    status: 'completed',
    tags: ['Behavioral', 'HR', 'Culture Fit'],
    feedback: 'Very good communication. Clear and structured answers. Could elaborate more on leadership examples.',
    questions: 4,
  },
  {
    id: 3,
    title: 'React Developer — Algorithm Round',
    date: 'Jul 15, 2026',
    duration: '52 min',
    score: 74,
    status: 'completed',
    tags: ['Algorithms', 'Data Structures', 'LeetCode'],
    feedback: 'Good approach to problem solving. Time complexity analysis needs strengthening.',
    questions: 6,
  },
];

// --- RECRUITER DATA ---

export const recruiterStats = [
  { label: 'Total Applicants', value: '1,247', change: '+18%', up: true, icon: 'users' },
  { label: 'Avg Interview Score', value: '76.4', change: '+4.2', up: true, icon: 'bar-chart' },
  { label: 'Positions Open', value: '23', change: '-2', up: false, icon: 'briefcase' },
  { label: 'Interviews Today', value: '41', change: '+12', up: true, icon: 'video' },
];

export const candidates = [
  { id: 1, name: 'Aisha Patel', initials: 'AP', role: 'Senior Frontend Dev', score: 87, status: 'shortlisted', date: 'Jul 24', skills: ['React', 'TypeScript'], confidence: 92, communication: 79, technical: 88 },
  { id: 2, name: 'Rohan Mehta', initials: 'RM', role: 'Full Stack Engineer', score: 82, status: 'shortlisted', date: 'Jul 23', skills: ['Node.js', 'Vue'], confidence: 85, communication: 88, technical: 80 },
  { id: 3, name: 'Clara Novak', initials: 'CN', role: 'Backend Developer', score: 78, status: 'under review', date: 'Jul 22', skills: ['Python', 'Django'], confidence: 74, communication: 82, technical: 79 },
  { id: 4, name: 'James Okonkwo', initials: 'JO', role: 'DevOps Engineer', score: 91, status: 'shortlisted', date: 'Jul 22', skills: ['Docker', 'AWS'], confidence: 88, communication: 76, technical: 94 },
  { id: 5, name: 'Priya Singh', initials: 'PS', role: 'React Developer', score: 71, status: 'pending', date: 'Jul 21', skills: ['React', 'Redux'], confidence: 68, communication: 74, technical: 70 },
  { id: 6, name: 'Luca Ferrari', initials: 'LF', role: 'ML Engineer', score: 89, status: 'shortlisted', date: 'Jul 20', skills: ['Python', 'PyTorch'], confidence: 90, communication: 82, technical: 92 },
];

export const comparisonRadarData = [
  { subject: 'Technical', candidate1: 88, candidate2: 80 },
  { subject: 'Communication', candidate1: 79, candidate2: 88 },
  { subject: 'Confidence', candidate1: 92, candidate2: 85 },
  { subject: 'Problem Solving', candidate1: 85, candidate2: 78 },
  { subject: 'Leadership', candidate1: 68, candidate2: 82 },
  { subject: 'Aptitude', candidate1: 83, candidate2: 76 },
];

// Active Sessions
export const activeSessions = [
  { id: 1, name: 'Daniel Park', initials: 'DP', role: 'React Developer', question: 3, totalQuestions: 5, confidence: 81, status: 'In Progress', elapsed: '14:32' },
  { id: 2, name: 'Amara Diallo', initials: 'AD', role: 'ML Engineer', question: 1, totalQuestions: 6, confidence: 74, status: 'Starting', elapsed: '02:15' },
  { id: 3, name: 'Yuki Tanaka', initials: 'YT', role: 'Backend Dev', question: 5, totalQuestions: 5, confidence: 92, status: 'Finishing', elapsed: '43:07' },
  { id: 4, name: 'Carlos Vega', initials: 'CV', role: 'DevOps', question: 2, totalQuestions: 4, confidence: 67, status: 'In Progress', elapsed: '08:44' },
];

// Template Builder — preset questions
export const templateQuestions = {
  Technical: [
    { id: 1, text: 'Explain virtual DOM and reconciliation in React.', difficulty: 'Medium' },
    { id: 2, text: 'Design a URL shortening service with high availability.', difficulty: 'Hard' },
    { id: 3, text: 'What is the time complexity of quicksort?', difficulty: 'Easy' },
    { id: 4, text: 'How would you implement a rate limiter?', difficulty: 'Hard' },
  ],
  HR: [
    { id: 5, text: 'Tell me about yourself and your career journey.', difficulty: 'Easy' },
    { id: 6, text: 'Where do you see yourself in 5 years?', difficulty: 'Easy' },
    { id: 7, text: 'Why do you want to work for our company?', difficulty: 'Easy' },
  ],
  Behavioral: [
    { id: 8, text: 'Describe a conflict with a team member and how you resolved it.', difficulty: 'Medium' },
    { id: 9, text: 'Tell me about a time you failed. What did you learn?', difficulty: 'Medium' },
    { id: 10, text: 'Describe your most impactful project and your role.', difficulty: 'Medium' },
  ],
};

// --- ADMIN DATA ---

export const adminStats = [
  { label: 'Total Users', value: '8,432', change: '+234', up: true },
  { label: 'Interviews Today', value: '1,082', change: '+156', up: true },
  { label: 'AI API Costs', value: '$2,814', change: '+$342', up: false },
  { label: 'Avg Response Time', value: '142ms', change: '-18ms', up: true },
];

export const users = [
  { id: 1, name: 'Aisha Patel', email: 'aisha@email.com', role: 'Candidate', status: 'active', joined: 'Mar 12, 2026', interviews: 6 },
  { id: 2, name: 'Marcus Chen', email: 'marcus@techcorp.com', role: 'Recruiter', status: 'active', joined: 'Jan 05, 2026', interviews: 0 },
  { id: 3, name: 'Clara Novak', email: 'clara@email.com', role: 'Candidate', status: 'active', joined: 'Jun 20, 2026', interviews: 3 },
  { id: 4, name: 'Sofia Rodriguez', email: 'sofia@admin.com', role: 'Admin', status: 'active', joined: 'Dec 01, 2025', interviews: 0 },
  { id: 5, name: 'James Okonkwo', email: 'james@email.com', role: 'Candidate', status: 'inactive', joined: 'May 08, 2026', interviews: 4 },
  { id: 6, name: 'Priya Singh', email: 'priya@techcorp.com', role: 'Recruiter', status: 'active', joined: 'Apr 15, 2026', interviews: 0 },
  { id: 7, name: 'Luca Ferrari', email: 'luca@email.com', role: 'Candidate', status: 'active', joined: 'Jul 01, 2026', interviews: 2 },
];

// System Monitor Data
export const systemData = Array.from({ length: 20 }, (_, i) => ({
  time: `${i}s`,
  cpu: Math.floor(30 + Math.random() * 45),
  memory: Math.floor(55 + Math.random() * 20),
  apiRequests: Math.floor(120 + Math.random() * 80),
  latency: Math.floor(110 + Math.random() * 60),
}));

// Global Platform Stats
export const platformTrend = [
  { month: 'Feb', interviews: 3200, users: 5100, cost: 1800 },
  { month: 'Mar', interviews: 4100, users: 5800, cost: 2100 },
  { month: 'Apr', interviews: 5200, users: 6400, cost: 2500 },
  { month: 'May', interviews: 5800, users: 7100, cost: 2700 },
  { month: 'Jun', interviews: 7200, users: 7800, cost: 3100 },
  { month: 'Jul', interviews: 8100, users: 8432, cost: 2814 },
];

// AI Config
export const aiPersonalities = [
  { id: 'supportive', label: 'Supportive', desc: 'Encouraging, patient, builds confidence' },
  { id: 'balanced', label: 'Balanced', desc: 'Professional, fair, constructive' },
  { id: 'strict', label: 'Strict', desc: 'Demanding, precise, simulates real pressure' },
];

export const aiProviders = [
  { id: 'gemini', label: 'Google Gemini 3.6 Flash', badge: 'Recommended', icon: '✦' },
  { id: 'gpt4', label: 'OpenAI GPT-4o', badge: 'Stable', icon: '◆' },
  { id: 'claude', label: 'Anthropic Claude 3.5', badge: 'Creative', icon: '◈' },
];
