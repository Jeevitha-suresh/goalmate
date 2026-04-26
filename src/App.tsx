/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Plus, Check, Trash2, Milestone, LogOut, User, Lock, 
  LogIn, UserPlus, Calendar, History as HistoryIcon, 
  Settings, Moon, Sun, TrendingUp, Droplets, BookOpen, 
  ChevronLeft, ChevronRight, Edit3, X, CheckCircle2,
  Clock, Tag, BarChart3, PieChart, ArrowRight, Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---

type Category = 'Study' | 'Health' | 'Personal' | 'Work';
type Priority = 'High' | 'Medium' | 'Low';

interface Goal {
  id: string;
  title: string;
  category: Category;
  priority: Priority;
  time?: string;
  notes?: string;
  completed: boolean;
  createdAt: number;
}

interface DailyHabit {
  id: string;
  title: string;
  val: number;
  max: number;
  unit: string;
  isCustom?: boolean;
}

interface DailyStats {
  date: string;
  total: number;
  completed: number;
  habits: DailyHabit[];
}

interface UserProfile {
  id: string;
  username: string;
  password?: string;
}

interface AppData {
  goals: Goal[];
  habits: DailyHabit[];
  lastOpened: string; // YYYY-MM-DD
}

// --- Helpers ---

const getTodayStr = () => new Date().toISOString().split('T')[0];

const CATEGORY_COLORS: Record<Category, string> = {
  Study: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20',
  Health: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20',
  Personal: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20',
  Work: 'text-orange-500 bg-orange-50 dark:bg-orange-900/20',
};

const PRIORITY_COLORS: Record<Priority, string> = {
  High: 'text-rose-500 bg-rose-50 dark:bg-rose-900/20',
  Medium: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20',
  Low: 'text-slate-500 bg-slate-50 dark:bg-slate-900/20',
};

const getIconForText = (text: string) => {
  const t = text.toLowerCase();
  if (t.includes('water') || t.includes('drink')) return <Droplets size={20} />;
  if (t.includes('study') || t.includes('learn') || t.includes('read') || t.includes('book')) return <BookOpen size={20} />;
  if (t.includes('code') || t.includes('program') || t.includes('dev')) return <Edit3 size={20} />;
  if (t.includes('gym') || t.includes('workout') || t.includes('fitness') || t.includes('exercise')) return <TrendingUp size={20} />;
  if (t.includes('meditate') || t.includes('breath') || t.includes('mental')) return <Moon size={20} />;
  if (t.includes('work') || t.includes('office') || t.includes('meeting')) return <Tag size={20} />;
  return <Milestone size={20} />;
};

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('goalmate_theme') === 'dark';
  });
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  
  // App Data
  const [goals, setGoals] = useState<Goal[]>([]);
  const [habits, setHabits] = useState<DailyHabit[]>([
    { id: 'water', title: 'Water Intake', val: 0, max: 8, unit: 'Glasses' },
    { id: 'study', title: 'Study Hours', val: 0, max: 12, unit: 'Hours' }
  ]);
  const [history, setHistory] = useState<DailyStats[]>([]);
  
  // Auth Form State
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  // UI State
  const [view, setView] = useState<'today' | 'history' | 'settings'>('today');
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [isAddingHabit, setIsAddingHabit] = useState(false);
  const [activeGoalId, setActiveGoalId] = useState<string | null>(null);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalCategory, setNewGoalCategory] = useState<Category>('Personal');
  const [newGoalPriority, setNewGoalPriority] = useState<Priority>('Medium');
  const [newGoalTime, setNewGoalTime] = useState('');
  const [newGoalNotes, setNewGoalNotes] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<Category | 'All'>('All');

  const [newHabitTitle, setNewHabitTitle] = useState('');
  const [newHabitMax, setNewHabitMax] = useState('10');
  const [newHabitUnit, setNewHabitUnit] = useState('Times');

  // --- Effects ---

  // Dark Mode Toggle
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('goalmate_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('goalmate_theme', 'light');
    }
  }, [isDarkMode]);

  // Auth Session Check
  useEffect(() => {
    const session = localStorage.getItem('goalmate_session');
    if (session) {
      try {
        setCurrentUser(JSON.parse(session));
      } catch (e) {
        localStorage.removeItem('goalmate_session');
      }
    }
    setIsAuthLoading(false);
  }, []);

  // Load User Data
  useEffect(() => {
    if (currentUser) {
      const storedData = localStorage.getItem(`goalmate_data_${currentUser.id}`);
      const storedHistory = localStorage.getItem(`goalmate_history_${currentUser.id}`);
      
      const today = getTodayStr();
      
      if (storedHistory) {
        setHistory(JSON.parse(storedHistory));
      }

      if (storedData) {
        const parsed: AppData = JSON.parse(storedData);
        
        // Daily Reset Logic
        if (parsed.lastOpened !== today) {
          // Archive previous day to history
          const prevGoalsTotal = parsed.goals.length;
          const prevGoalsCompleted = parsed.goals.filter(g => g.completed).length;
          const prevHabitsTotal = parsed.habits.length;
          const prevHabitsCompleted = parsed.habits.filter(h => h.val >= h.max).length;

          const stats: DailyStats = {
            date: parsed.lastOpened,
            total: prevGoalsTotal + prevHabitsTotal,
            completed: prevGoalsCompleted + prevHabitsCompleted,
            habits: parsed.habits
          };
          
          setHistory(prev => {
            const updated = [stats, ...prev.filter(h => h.date !== stats.date)].slice(0, 30);
            localStorage.setItem(`goalmate_history_${currentUser.id}`, JSON.stringify(updated));
            return updated;
          });

          // Reset habits for new day
          setGoals(parsed.goals.filter(g => !g.completed));
          setHabits(parsed.habits.map(h => ({ ...h, val: 0 })));
        } else {
          setGoals(parsed.goals);
          setHabits(parsed.habits);
        }
      }
    }
  }, [currentUser]);

  // Save User Data
  useEffect(() => {
    if (currentUser) {
      const data: AppData = {
        goals,
        habits,
        lastOpened: getTodayStr()
      };
      localStorage.setItem(`goalmate_data_${currentUser.id}`, JSON.stringify(data));
      localStorage.setItem(`goalmate_history_${currentUser.id}`, JSON.stringify(history));
    }
  }, [goals, habits, history, currentUser]);

  // --- Actions ---

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!usernameInput.trim() || !passwordInput.trim()) return setAuthError('Fields missing');

    const usersRaw = localStorage.getItem('goalmate_users');
    const users: UserProfile[] = usersRaw ? JSON.parse(usersRaw) : [];

    if (authMode === 'signup') {
      if (users.find(u => u.username === usernameInput)) return setAuthError('User exists');
      const newUser = { id: crypto.randomUUID(), username: usernameInput, password: passwordInput };
      users.push(newUser);
      localStorage.setItem('goalmate_users', JSON.stringify(users));
      setCurrentUser({ id: newUser.id, username: newUser.username });
      localStorage.setItem('goalmate_session', JSON.stringify({ id: newUser.id, username: newUser.username }));
    } else {
      const user = users.find(u => u.username === usernameInput && u.password === passwordInput);
      if (!user) return setAuthError('Failed login');
      setCurrentUser({ id: user.id, username: user.username });
      localStorage.setItem('goalmate_session', JSON.stringify({ id: user.id, username: user.username }));
    }
    setUsernameInput(''); setPasswordInput('');
  };

  const addGoal = () => {
    if (!newGoalTitle.trim()) return;
    const goal: Goal = {
      id: Math.random().toString(36).substring(2, 11),
      title: newGoalTitle.trim(),
      category: newGoalCategory,
      priority: newGoalPriority,
      time: newGoalTime,
      notes: newGoalNotes.trim(),
      completed: false,
      createdAt: Date.now()
    };
    setGoals(prev => [goal, ...prev]);
    setNewGoalTitle('');
    setNewGoalNotes('');
    setNewGoalPriority('Medium');
    setIsAddingGoal(false);
  };

  const updateGoal = (updated: Goal) => {
    setGoals(prev => prev.map(g => g.id === updated.id ? updated : g));
    setEditingGoal(null);
  };

  const toggleGoal = (id: string) => {
    setGoals(prev => prev.map(g => g.id === id ? { ...g, completed: !g.completed } : g));
  };

  const deleteGoal = (id: string) => {
    setGoals(prev => prev.filter(g => g.id !== id));
  };

  const addHabit = () => {
    if (!newHabitTitle.trim()) return;
    const habit: DailyHabit = {
      id: Math.random().toString(36).substring(2, 11),
      title: newHabitTitle.trim(),
      val: 0,
      max: parseInt(newHabitMax) || 1,
      unit: newHabitUnit || 'Times',
      isCustom: true
    };
    setHabits(prev => [...prev, habit]);
    setNewHabitTitle('');
    setIsAddingHabit(false);
  };

  const deleteHabit = (id: string) => {
    setHabits(prev => prev.filter(h => h.id !== id));
  };

  const updateHabit = (id: string, delta: number) => {
    setHabits(prev => prev.map(h => 
      h.id === id ? { ...h, val: Math.min(h.max, Math.max(0, h.val + delta)) } : h
    ));
  };

  // --- Computed ---

  const stats = useMemo(() => {
    const goalsCount = goals.length;
    const goalsCompleted = goals.filter(g => g.completed).length;
    
    const habitsCount = habits.length;
    const habitsCompleted = habits.filter(h => h.val >= h.max).length;

    const total = goalsCount + habitsCount;
    const completed = goalsCompleted + habitsCompleted;
    const pending = total - completed;
    const progress = total === 0 ? 0 : Math.round((completed / total) * 100);
    
    // Streak Calculation
    let streak = 0;
    const today = getTodayStr();
    let checkDate = new Date();
    
    // Check if user has data for today or if they completed goals today
    const completedToday = progress >= 50; // Arbitrary 50% threshold for "successful day"
    if (completedToday) streak = 1;

    // Check history backwards
    for (const day of history) {
      const dayProgress = day.total === 0 ? 0 : (day.completed / day.total) * 100;
      if (dayProgress >= 50) {
        streak++;
      } else {
        break;
      }
    }

    let insight = "Keep going! You're improving!";
    if (progress >= 100) insight = "Absolute perfection! Every landmark achieved 🏆";
    else if (progress >= 80) insight = `You completed ${progress}% of your goals today 🎉`;
    else if (progress >= 50) insight = "More than halfway there! Great job.";
    else if (total > 0 && progress === 0) insight = "A small start is still a start.";
    
    if (streak >= 3) insight = `${insight} | 🔥 ${streak} Day Streak`;
    
    return { total, completed, pending, progress, insight, streak };
  }, [goals, habits, history]);

  const filteredGoals = useMemo(() => {
    return goals.filter(g => {
      const matchSearch = g.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCategory = filterCategory === 'All' || g.category === filterCategory;
      return matchSearch && matchCategory;
    });
  }, [goals, searchQuery, filterCategory]);

  if (isAuthLoading) return <div className="h-screen grid place-items-center">Loading...</div>;

  return (
    <div className="min-h-screen flex flex-col transition-colors duration-500">
      <AnimatePresence mode="wait">
        {!currentUser ? (
          <AuthView 
            mode={authMode} 
            setMode={setAuthMode} 
            username={usernameInput} 
            setUsername={setUsernameInput}
            password={passwordInput} 
            setPassword={setPasswordInput}
            onAuth={handleAuth}
            error={authError}
          />
        ) : (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="flex-grow flex flex-col max-w-5xl mx-auto w-full p-4 md:p-8"
          >
            {/* Header */}
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none shrink-0">
                  <Milestone size={24} className="sm:size-24 scale-75 sm:scale-100" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">GoalMate</h1>
                  <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-400">Welcome, {currentUser.username}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2.5 sm:p-3 glass rounded-2xl text-slate-500 hover:text-indigo-600 transition-all">
                  {isDarkMode ? <Sun size={18} className="sm:size-20" /> : <Moon size={18} className="sm:size-20" />}
                </button>
                <button onClick={() => setCurrentUser(null)} className="p-2.5 sm:p-3 glass rounded-2xl text-slate-500 hover:text-rose-500 transition-all">
                  <LogOut size={18} className="sm:size-20" />
                </button>
              </div>
            </header>

            {/* Navigation Tabs */}
            <div className="flex w-full overflow-x-auto scrollbar-none gap-1 sm:gap-2 mb-8 bg-slate-200/50 dark:bg-slate-800/50 p-1 rounded-2xl md:self-start">
              {(['today', 'history', 'settings'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setView(t)}
                  className={`flex-grow md:flex-grow-0 px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
                    view === t ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {view === 'today' && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
                  {/* Dashboard */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
                    <StatCard label="Total" val={stats.total} color="text-slate-700" />
                    <StatCard label="Completed" val={stats.completed} color="text-emerald-500" />
                    <StatCard label="Pending" val={stats.pending} color="text-rose-500" />
                    <div className="glass p-4 sm:p-6 rounded-3xl col-span-2 lg:col-span-1 flex flex-col justify-center">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Progress</span>
                        <span className="text-xs font-bold text-indigo-600">{stats.progress}%</span>
                      </div>
                      <div className="h-2.5 sm:h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-indigo-500 shadow-sm"
                          initial={{ width: 0 }}
                          animate={{ width: `${stats.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Insights & Actions */}
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-3 px-6 py-4 glass rounded-[2rem] border-l-4 border-indigo-500 flex-grow">
                        <TrendingUp size={20} className="text-indigo-500" />
                        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                          {stats.insight}
                        </p>
                      </div>
                      <button 
                        onClick={() => setIsAddingGoal(true)}
                        className="px-8 py-4 bg-indigo-600 text-white rounded-[2rem] font-bold shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                      >
                        <Plus size={20} /> Add Landmark
                      </button>
                    </div>

                    {/* Filter Bar */}
                    <div className="flex flex-col md:flex-row gap-4 items-center glass p-4 rounded-3xl bg-white/50 dark:bg-slate-900/40 backdrop-blur-md border border-white/20 dark:border-slate-800/50">
                      <div className="relative flex-grow w-full">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
                          <Search size={18} />
                        </div>
                        <input 
                          placeholder="Search your landmarks..."
                          className="w-full pl-12 pr-6 py-3 bg-slate-50 dark:bg-slate-950/50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500/30 outline-none text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-all"
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 scrollbar-none">
                        {(['All', 'Personal', 'Study', 'Health', 'Work'] as const).map(cat => (
                          <button
                            key={cat}
                            onClick={() => setFilterCategory(cat)}
                            className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] whitespace-nowrap transition-all duration-300 transform active:scale-95 ${
                              filterCategory === cat 
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 ring-2 ring-indigo-500/20' 
                                : 'bg-white dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-indigo-500 dark:hover:text-indigo-400'
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Main Grid: Goals & Habits */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Goals Column */}
                    <div className="lg:col-span-2 space-y-10">
                      <GoalSection 
                        title="Pending Landmarks" 
                        goals={filteredGoals.filter(g => !g.completed)} 
                        onToggle={toggleGoal} 
                        onDelete={deleteGoal}
                        onEdit={setEditingGoal}
                        activeGoalId={activeGoalId}
                        setActiveGoalId={setActiveGoalId}
                        emptyMsg="No pending landmarks match your current filter."
                      />
                      <GoalSection 
                        title="Achieved" 
                        goals={filteredGoals.filter(g => g.completed)} 
                        onToggle={toggleGoal} 
                        onDelete={deleteGoal}
                        onEdit={setEditingGoal}
                        activeGoalId={activeGoalId}
                        setActiveGoalId={setActiveGoalId}
                        isCompleted
                        emptyMsg="No achieved landmarks match your current filter."
                      />
                    </div>

                    {/* Side Column: Habits */}
                    <div className="space-y-6">
                      <div className="glass p-8 rounded-[2.5rem]">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                          <BarChart3 size={14} /> Today's Habits
                        </h3>
                        <div className="space-y-10">
                          {habits.map(habit => (
                            <HabitTracker 
                              key={habit.id}
                              icon={getIconForText(habit.title)}
                              title={habit.title}
                              unit={habit.unit}
                              val={habit.val}
                              max={habit.max}
                              onUpdate={(d: number) => updateHabit(habit.id, d)}
                              onDelete={() => deleteHabit(habit.id)}
                            />
                          ))}
                          <button 
                            onClick={() => setIsAddingHabit(true)}
                            className="w-full py-3 border-2 border-dashed border-slate-200 text-slate-400 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:border-indigo-300 hover:text-indigo-500 transition-all"
                          >
                            Add Custom Habit
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {view === 'history' && (
                <HistoryView history={history} />
              )}
              
              {view === 'settings' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass p-10 rounded-[3rem] max-w-2xl">
                  <h2 className="text-2xl font-bold mb-8">Settings</h2>
                  <div className="space-y-8">
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                      <div>
                        <p className="font-bold">Dark Mode</p>
                        <p className="text-xs text-slate-400">Switch between light and dark themes</p>
                      </div>
                      <button 
                        onClick={() => setIsDarkMode(!isDarkMode)}
                        className={`w-14 h-8 rounded-full transition-all relative ${isDarkMode ? 'bg-indigo-600' : 'bg-slate-300'}`}
                      >
                        <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${isDarkMode ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                      <div>
                        <p className="font-bold">Notifications</p>
                        <p className="text-xs text-slate-400">Get daily reminders for your goals</p>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded-md">Coming Soon</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Goal Modal */}
      <AnimatePresence>
        {isAddingGoal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setIsAddingGoal(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2.5rem] sm:rounded-[3rem] p-6 sm:p-10 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 sm:p-8">
                <button onClick={() => setIsAddingGoal(false)} className="text-slate-400 hover:text-rose-500"><X size={20} sm:size={24} /></button>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mb-6 sm:mb-8">New Landmark</h3>
              
              <div className="space-y-4 sm:space-y-6">
                <div>
                  <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2 block mx-1">Title</label>
                  <input 
                    autoFocus
                    placeholder="E.g. Daily morning jog"
                    className="w-full px-5 sm:px-6 py-3 sm:py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-indigo-100 outline-none text-sm sm:text-base"
                    value={newGoalTitle}
                    onChange={e => setNewGoalTitle(e.target.value)}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2 block mx-1">Category</label>
                    <select 
                      className="w-full px-5 sm:px-6 py-3 sm:py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-indigo-100 outline-none appearance-none text-sm sm:text-base"
                      value={newGoalCategory}
                      onChange={e => setNewGoalCategory(e.target.value as Category)}
                    >
                      <option value="Personal">Personal</option>
                      <option value="Study">Study</option>
                      <option value="Health">Health</option>
                      <option value="Work">Work</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2 block mx-1">Priority</label>
                    <select 
                      className="w-full px-5 sm:px-6 py-3 sm:py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-indigo-100 outline-none appearance-none font-bold text-sm sm:text-base"
                      value={newGoalPriority}
                      onChange={e => setNewGoalPriority(e.target.value as Priority)}
                    >
                      <option value="Low">Low Priority</option>
                      <option value="Medium">Medium Priority</option>
                      <option value="High">High Priority</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2 block mx-1">Time</label>
                  <input 
                    type="time"
                    className="w-full px-5 sm:px-6 py-3 sm:py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-indigo-100 outline-none text-sm sm:text-base"
                    value={newGoalTime}
                    onChange={e => setNewGoalTime(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2 block mx-1">Notes (Optional)</label>
                  <textarea 
                    placeholder="Add details about this goal..."
                    className="w-full px-5 sm:px-6 py-3 sm:py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-indigo-100 outline-none resize-none h-20 sm:h-24 text-sm sm:text-base"
                    value={newGoalNotes}
                    onChange={e => setNewGoalNotes(e.target.value)}
                  />
                </div>

                <div className="pt-2 sm:pt-4">
                  <button 
                    onClick={addGoal}
                    disabled={!newGoalTitle.trim()}
                    className="w-full py-4 sm:py-5 bg-indigo-600 text-white rounded-[1.5rem] sm:rounded-[2rem] font-bold text-base sm:text-lg hover:bg-indigo-700 transition-all disabled:opacity-50"
                  >
                    Set Landmark
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Habit Modal */}
      <AnimatePresence>
        {isAddingHabit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setIsAddingHabit(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2.5rem] sm:rounded-[3rem] p-6 sm:p-10 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 sm:p-8">
                <button onClick={() => setIsAddingHabit(false)} className="text-slate-400 hover:text-rose-500"><X size={20} sm:size={24} /></button>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mb-6 sm:mb-8">New Custom Habit</h3>
              
              <div className="space-y-4 sm:space-y-6">
                <div>
                  <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2 block mx-1">Habit Name</label>
                  <input 
                    autoFocus
                    placeholder="E.g. Meditation"
                    className="w-full px-5 sm:px-6 py-3 sm:py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-indigo-100 outline-none text-sm sm:text-base"
                    value={newHabitTitle}
                    onChange={e => setNewHabitTitle(e.target.value)}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2 block mx-1">Daily Target</label>
                    <input 
                      type="number"
                      className="w-full px-5 sm:px-6 py-3 sm:py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-indigo-100 outline-none text-sm sm:text-base"
                      value={newHabitMax}
                      onChange={e => setNewHabitMax(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2 block mx-1">Unit</label>
                    <input 
                      placeholder="Times/Hrs/Mins"
                      className="w-full px-5 sm:px-6 py-3 sm:py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-indigo-100 outline-none text-sm sm:text-base"
                      value={newHabitUnit}
                      onChange={e => setNewHabitUnit(e.target.value)}
                    />
                  </div>
                </div>

                <div className="pt-2 sm:pt-4">
                  <button 
                    onClick={addHabit}
                    disabled={!newHabitTitle.trim()}
                    className="w-full py-4 sm:py-5 bg-indigo-600 text-white rounded-[1.5rem] sm:rounded-[2rem] font-bold text-base sm:text-lg hover:bg-indigo-700 transition-all disabled:opacity-50"
                  >
                    Add Habit
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Goal Modal */}
      <AnimatePresence>
        {editingGoal && (
          <EditGoalModal 
            goal={editingGoal} 
            onClose={() => setEditingGoal(null)} 
            onSave={updateGoal} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Sub-Components ---

function StatCard({ label, val, color }: { label: string, val: number, color: string }) {
  return (
    <div className="glass p-4 sm:p-6 rounded-3xl">
      <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">{label}</p>
      <p className={`text-xl sm:text-3xl font-black ${color}`}>{val.toString().padStart(2, '0')}</p>
    </div>
  );
}

function GoalSection({ title, goals, onToggle, onDelete, onEdit, activeGoalId, setActiveGoalId, isCompleted, emptyMsg }: any) {
  return (
    <section>
      <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
        <h2 className={`text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] ${isCompleted ? 'opacity-40' : 'text-slate-400'}`}>
          {title}
        </h2>
        <div className="h-[1px] sm:h-[2px] flex-grow bg-slate-200/50 dark:bg-slate-800/50" />
        <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 sm:py-1 rounded-md">{goals.length}</span>
      </div>
      <div className="space-y-4">
        <AnimatePresence mode="popLayout" initial={false}>
          {goals.length > 0 ? goals.map((g: Goal) => (
            <GoalItem 
              key={g.id}
              goal={g}
              isExpanded={activeGoalId === g.id}
              onToggleExpand={() => setActiveGoalId(activeGoalId === g.id ? null : g.id)}
              onToggleStatus={() => onToggle(g.id)}
              onDelete={() => onDelete(g.id)}
              onEdit={() => onEdit(g)}
            />
          )) : (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm font-medium text-slate-400 italic py-4">
              {emptyMsg}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

function GoalItem({ goal, isExpanded, onToggleExpand, onToggleStatus, onDelete, onEdit }: any) {
  return (
    <motion.div 
      layout
      initial={{ opacity: 0, x: -10 }} 
      animate={{ opacity: 1, x: 0 }} 
      exit={{ opacity: 0, x: 10 }}
      className={`group flex flex-col glass rounded-2xl sm:rounded-3xl transition-all duration-300 overflow-hidden ${
        isExpanded 
          ? 'ring-1 sm:ring-2 ring-indigo-500 shadow-2xl scale-[1.01] sm:scale-[1.03] bg-white dark:bg-slate-900 border-none z-10' 
          : 'hover:shadow-md hover:-translate-y-1 hover:border-indigo-100 dark:hover:border-indigo-900/30'
      } ${goal.completed && !isExpanded ? 'opacity-50' : 'opacity-100'}`}
    >
      <div className="flex items-center gap-3 sm:gap-5 p-3.5 sm:p-5">
        <button 
          onClick={onToggleStatus}
          className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl border-2 flex items-center justify-center transition-all shrink-0 ${
            goal.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-200 dark:border-slate-700'
          }`}
        >
          {goal.completed && <Check size={14} className="sm:size-16" strokeWidth={4} />}
        </button>
        
        <div 
          onClick={onToggleExpand}
          className="p-2 sm:p-3 bg-slate-50 dark:bg-slate-800 rounded-xl sm:rounded-2xl text-indigo-500 transition-colors group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/20 cursor-pointer shrink-0"
        >
          <div className="scale-90 sm:scale-100">
            {getIconForText(goal.title)}
          </div>
        </div>

        <div className="flex-grow cursor-pointer min-w-0" onClick={onToggleExpand}>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-3 mb-1">
            <span className={`text-[7px] sm:text-[9px] font-bold uppercase tracking-wider px-1.5 sm:px-2 py-0.5 rounded-full ${CATEGORY_COLORS[goal.category]}`}>
              {goal.category}
            </span>
            <span className={`text-[7px] sm:text-[9px] font-bold uppercase tracking-wider px-1.5 sm:px-2 py-0.5 rounded-full ${PRIORITY_COLORS[goal.priority]}`}>
              {goal.priority}
            </span>
            {goal.time && <span className="flex items-center gap-1 text-[8px] sm:text-[10px] font-bold text-slate-400"><Clock size={10} /> {goal.time}</span>}
          </div>
          <h3 className={`text-xs sm:text-base font-bold tracking-tight truncate ${goal.completed && !isExpanded ? 'line-through text-slate-400 italic' : 'text-slate-700 dark:text-slate-200'}`}>
            {goal.title}
          </h3>
        </div>

        <button 
          onClick={onToggleExpand}
          className={`p-1.5 sm:p-2 rounded-xl transition-all ${isExpanded ? 'bg-indigo-100 text-indigo-600' : 'text-slate-300 hover:text-indigo-500 hover:bg-indigo-50'}`}
        >
          <motion.div animate={{ rotate: isExpanded ? 90 : 0 }}>
            <ChevronRight size={18} className="sm:size-20" />
          </motion.div>
        </button>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-100 dark:border-slate-800 px-4 sm:px-6 py-4 sm:py-6 bg-slate-50/30 dark:bg-slate-800/20"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
              <div className="space-y-4">
                <div>
                  <h4 className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 mx-1">Full Path</h4>
                  <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                    {goal.title}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-grow">
                    <h4 className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 mx-1">Section</h4>
                    <p className={`text-[10px] sm:text-xs font-bold p-3 rounded-xl inline-block ${CATEGORY_COLORS[goal.category]}`}>{goal.category}</p>
                  </div>
                  {goal.time && (
                    <div className="flex-grow">
                      <h4 className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 mx-1">Scheduled Time</h4>
                      <p className="text-[10px] sm:text-xs font-bold text-slate-600 dark:text-slate-300 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center gap-2">
                        <Clock size={12} /> {goal.time}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <h4 className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 mx-1">Execution Notes</h4>
                <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 italic bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 h-full min-h-[80px]">
                  {goal.notes || 'No tactical notes recorded for this landmark.'}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
              <button 
                onClick={onEdit}
                className="w-full sm:w-auto justify-center px-4 sm:px-6 py-2.5 sm:py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[10px] sm:text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-100 dark:hover:bg-indigo-900/20 transition-all flex items-center gap-2"
              >
                <Edit3 size={14} /> Edit
              </button>
              <button 
                onClick={onDelete}
                className="w-full sm:w-auto justify-center px-4 sm:px-6 py-2.5 sm:py-3 bg-rose-50 text-rose-500 text-[10px] sm:text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-rose-500 hover:text-white transition-all flex items-center gap-2"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function EditGoalModal({ goal, onClose, onSave }: { goal: Goal, onClose: () => void, onSave: (g: Goal) => void }) {
  const [title, setTitle] = useState(goal.title);
  const [category, setCategory] = useState<Category>(goal.category);
  const [priority, setPriority] = useState<Priority>(goal.priority);
  const [time, setTime] = useState(goal.time || '');
  const [notes, setNotes] = useState(goal.notes || '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }} 
        animate={{ scale: 1, opacity: 1, y: 0 }} 
        exit={{ scale: 0.9, opacity: 0, y: 20 }} 
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2.5rem] sm:rounded-[3rem] p-6 sm:p-10 shadow-2xl overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-4 sm:p-8">
          <button onClick={onClose} className="text-slate-400 hover:text-rose-500"><X size={20} sm:size={24} /></button>
        </div>
        <h3 className="text-xl sm:text-2xl font-bold mb-6 sm:mb-8">Edit Landmark</h3>
        <div className="space-y-4 sm:space-y-6">
          <div>
            <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2 block mx-1">Title</label>
            <input className="w-full px-5 sm:px-6 py-3 sm:py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-indigo-100 outline-none text-sm sm:text-base" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2 block mx-1">Category</label>
              <select className="w-full px-5 sm:px-6 py-3 sm:py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-indigo-100 outline-none appearance-none text-sm sm:text-base" value={category} onChange={e => setCategory(e.target.value as Category)}>
                <option value="Personal">Personal</option>
                <option value="Study">Study</option>
                <option value="Health">Health</option>
                <option value="Work">Work</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2 block mx-1">Priority</label>
              <select className="w-full px-5 sm:px-6 py-3 sm:py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-indigo-100 outline-none appearance-none font-bold text-sm sm:text-base" value={priority} onChange={e => setPriority(e.target.value as Priority)}>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2 block mx-1">Time</label>
            <input type="time" className="w-full px-5 sm:px-6 py-3 sm:py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-indigo-100 outline-none text-sm sm:text-base" value={time} onChange={e => setTime(e.target.value)} />
          </div>
          <div>
            <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2 block mx-1">Notes</label>
            <textarea className="w-full px-5 sm:px-6 py-3 sm:py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-indigo-100 outline-none resize-none h-20 sm:h-24 text-sm sm:text-base" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <div className="pt-2 sm:pt-4">
            <button onClick={() => onSave({ ...goal, title, category, priority, time, notes })} disabled={!title.trim()} className="w-full py-4 sm:py-5 bg-indigo-600 text-white rounded-[1.5rem] sm:rounded-[2rem] font-bold text-base sm:text-lg hover:bg-indigo-700 transition-all disabled:opacity-50">Save Changes</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function HabitTracker({ icon, title, val, max, unit, onUpdate, onDelete }: any) {
  const percent = Math.min(100, (val / max) * 100);
  return (
    <div className="group/habit">
      <div className="flex justify-between items-end mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl group-hover/habit:text-indigo-500 transition-colors">
            {icon}
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              {title}
              {onDelete && (
                <button 
                  onClick={onDelete}
                  className="p-1 text-slate-200 hover:text-rose-500 opacity-0 group-hover/habit:opacity-100 transition-all"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </h4>
            <p className="text-[10px] font-bold text-slate-400">{val} / {max} {unit}</p>
          </div>
        </div>
        <div className="flex gap-1">
          <button 
            onClick={() => onUpdate(-1)} 
            disabled={val <= 0}
            className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            -
          </button>
          <button 
            onClick={() => onUpdate(1)} 
            disabled={val >= max}
            className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            +
          </button>
        </div>
      </div>
      <div className="h-2 bg-slate-50 dark:bg-slate-800 rounded-full overflow-hidden">
        <motion.div 
          className="h-full bg-indigo-400" 
          initial={{ width: 0 }} 
          animate={{ width: `${percent}%` }} 
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function HistoryView({ history }: { history: DailyStats[] }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 sm:space-y-8">
      <h2 className="text-xl sm:text-2xl font-black tracking-tight">Performance History</h2>
      {history.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {history.map(day => {
            const progress = day.total === 0 ? 0 : Math.round((day.completed / day.total) * 100);
            return (
              <div key={day.date} className="glass p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 sm:p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                  <BarChart3 size={60} className="sm:size-80" />
                </div>
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-4 sm:mb-6">
                    <p className="text-base sm:text-lg font-black text-slate-700 dark:text-slate-200">
                      {new Date(day.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                    <span className="text-[9px] sm:text-[10px] font-black bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 px-2 sm:px-3 py-1 rounded-full uppercase tracking-widest">
                      {progress}%
                    </span>
                  </div>
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex justify-between text-[10px] sm:text-xs font-bold text-slate-500">
                      <span>Goals Completed</span>
                      <span className="text-slate-800 dark:text-slate-200">{day.completed} / {day.total}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 sm:gap-6 mt-4">
                      {day.habits.map(h => (
                        <div key={h.id} className="flex items-center gap-1.5 min-w-[50px] sm:min-w-[60px]">
                          <span className="text-indigo-400 scale-90 sm:scale-100">{getIconForText(h.title)}</span>
                          <span className="text-[10px] sm:text-xs font-bold text-slate-400">{h.val} {h.unit.slice(0, 3)}.</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass p-12 sm:p-20 rounded-[2.5rem] sm:rounded-[3rem] text-center">
          <HistoryIcon size={36} className="sm:size-48 mx-auto text-slate-200 mb-6" />
          <p className="text-sm sm:text-base text-slate-400 font-medium italic">History records will appear after your first day completion.</p>
        </div>
      )}
    </motion.div>
  );
}

function AuthView({ mode, setMode, username, setUsername, password, setPassword, onAuth, error }: any) {
  return (
    <div className="flex-grow flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md glass rounded-[2.5rem] sm:rounded-[3rem] p-8 sm:p-14 relative overflow-hidden border-none shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-1.5 sm:h-2 bg-gradient-to-r from-indigo-500 to-emerald-500 opacity-80" />
        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-[1.5rem] sm:rounded-[2rem] bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 mb-4 sm:mb-6">
            <Milestone size={28} className="sm:size-36" strokeWidth={2} />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-2">GoalMate</h2>
          <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] sm:tracking-[0.3em]">Design your progress, daily.</p>
        </div>
        <form onSubmit={onAuth} className="space-y-4 sm:space-y-6">
          <div className="space-y-1.5">
            <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mx-1">Username</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
              <input value={username} onChange={e => setUsername(e.target.value)} placeholder="your_name" className="w-full pl-12 pr-5 py-3.5 sm:py-4.5 glass border-none rounded-[1.2rem] sm:rounded-[1.5rem] focus:ring-2 focus:ring-indigo-100 outline-none text-sm font-medium" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mx-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="w-full pl-12 pr-5 py-3.5 sm:py-4.5 glass border-none rounded-[1.2rem] sm:rounded-[1.5rem] focus:ring-2 focus:ring-indigo-100 outline-none text-sm font-medium" />
            </div>
          </div>
          {error && <p className="text-[9px] sm:text-[10px] font-bold text-rose-500 text-center uppercase tracking-widest">{error}</p>}
          <button type="submit" className="w-full py-4 sm:py-5 bg-[#1A1A1A] dark:bg-indigo-600 text-white rounded-[1.2rem] sm:rounded-[1.5rem] font-black text-base sm:text-lg shadow-xl shadow-slate-200 dark:shadow-none hover:translate-y-[-2px] transition-all flex items-center justify-center gap-2 active:scale-95">
            {mode === 'login' ? 'Sign In' : 'Join System'} <ArrowRight size={18} className="sm:size-20" />
          </button>
        </form>
        <button onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} className="w-full mt-6 sm:mt-8 text-[10px] sm:text-[11px] font-black text-indigo-500 uppercase tracking-[0.2em] hover:text-indigo-600 transition-colors">
          {mode === 'login' ? "Don't have an account? Create one" : "Already registered? Login"}
        </button>
      </motion.div>
    </div>
  );
}

