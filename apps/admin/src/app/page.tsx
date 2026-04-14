'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Edit2, CheckCircle2, Circle, Clock, X, Search, Filter, Users, Heart, MessageSquare } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  category: string;
}

export default function PremiumDashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showHighPriorityOnly, setShowHighPriorityOnly] = useState(false);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedBrideId, setSelectedBrideId] = useState<string>('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);
  const [isOtpSent, setIsOtpSent] = useState<boolean>(false);
  const [adminEmail, setAdminEmail] = useState<string>('');
  const [otpCode, setOtpCode] = useState<string>('');
  
  // AI Suggestions State
  const [weddingStyle, setWeddingStyle] = useState<string>('Traditional');
  const [guestCount, setGuestCount] = useState<number>(100);
  const [suggestedTasks, setSuggestedTasks] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  useEffect(() => {
    checkAuth();
    fetchTasks();
    fetchProfiles();
    fetchMessages();

    const taskChannel = supabase
      .channel('tasks-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchTasks())
      .subscribe();

    const profileChannel = supabase
      .channel('profiles-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchProfiles())
      .subscribe();

    const messageChannel = supabase
      .channel('admin-messages-channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_messages' }, (payload) => {
        setMessages(prev => [payload.new, ...prev].slice(0, 5));
      })
      .subscribe();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAdminAuthenticated(!!session);
    });

    return () => {
      supabase.removeChannel(taskChannel);
      supabase.removeChannel(profileChannel);
      supabase.removeChannel(messageChannel);
      subscription.unsubscribe();
    };
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setIsAdminAuthenticated(!!user);
  };

  const generateAITasks = async () => {
    if (!selectedBrideId) {
      alert('Please select a bride first!');
      return;
    }
    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weddingType: weddingStyle, guestCount })
      });
      const data = await response.json();
      setSuggestedTasks(data.tasks || []);
    } catch (err) {
      console.error('AI Generation Error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAssignAllTasks = async () => {
    if (suggestedTasks.length === 0 || !selectedBrideId) {
      alert('Error: Please select a bride and generate a plan first!');
      return;
    }

    setIsGenerating(true);
    try {
      console.log('DEBUG: Offloading Bulk Assignment to Server (RLS Bypass)');
      
      const response = await fetch('/api/generate-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          weddingType: weddingStyle, 
          guestCount,
          selectedBrideId,
          shouldAssign: true
        })
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.success) {
        setSuggestedTasks([]); // Clear the list on success
        fetchTasks(); // Refresh the grid
        alert(`Success! ${data.count} Tasks Assigned via Master Bypass.`);
      }
    } catch (err: any) {
      console.error('SERVER-SIDE ERROR:', err);
      alert(`Bypass Assignment failed: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const fetchTasks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) console.error('Supabase Error:', error);
    else setTasks(data || []);
    setLoading(false);
  };

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    setProfiles(data || []);
  };

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('community_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    setMessages(data || []);
  };

  const getBrideColor = (email: string) => {
    const colors = ['#E11D48', '#D4AF37', '#8E44AD', '#EC4899', '#3B82F6', '#10B981'];
    let hash = 0;
    const cleanEmail = email || 'bride@brideguide.com';
    for (let i = 0; i < cleanEmail.length; i++) {
      hash = cleanEmail.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const handleUpdateTask = async (id: string, updates: Partial<Task>) => {
    try {
      console.log('DEBUG: Master Bypass Update (API Call):', id, updates);
      
      const response = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, updates })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setTasks(tasks.map(t => t.id === id ? { ...t, ...updates } : t));
    } catch (err: any) {
      console.error('Master Update Error:', err.message);
      alert(`Update failed: ${err.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    try {
      console.log('DEBUG: Master Bypass Delete (API Call):', id);
      
      const response = await fetch('/api/tasks', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setTasks(tasks.filter((t) => t.id !== id));
    } catch (err: any) {
      console.error('Master Delete Error:', err.message);
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleAddTask = async () => {
    if (!newTaskTitle || !selectedBrideId) return;

    try {
      console.log('DEBUG: Attempting to assign task...', {
        title: newTaskTitle,
        user_id: selectedBrideId,
        status: 'TODO',
        priority: 'MEDIUM',
        category: 'General'
      });

      const { data, error } = await supabase.from('tasks').insert([{
        title: newTaskTitle,
        user_id: selectedBrideId,
        status: 'TODO',
        priority: 'MEDIUM',
        category: 'General'
      }]).select();

      if (error) {
        console.error('SUPABASE ERROR (Assign Task):', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        alert(`Assignment failed: ${error.message} (Check Console for details)`);
        return;
      }

      console.log('DEBUG: Task assigned successfully:', data);
      setNewTaskTitle('');
      setSelectedBrideId('');
      fetchTasks();
    } catch (err: any) {
      console.error('RUNTIME ERROR (Assign Task):', err);
      alert(`An unexpected error occurred: ${err.message}`);
    }
  };

  const handleAdminSignIn = async () => {
    const email = prompt('Enter Admin Email (e.g., demo@brideguide.com):');
    if (!email) return;

    const { error } = await supabase.auth.signInWithOtp({ email });

    if (error) alert(`Login failed: ${error.message}`);
    else {
      setAdminEmail(email);
      setIsOtpSent(true);
      alert('Success: A 6-digit code has been sent to your email!');
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length !== 6) return;

    const { error } = await supabase.auth.verifyOtp({
      email: adminEmail,
      token: otpCode,
      type: 'signup'
    });

    if (error) {
      // Try magiclink as fallback
      const { error: error2 } = await supabase.auth.verifyOtp({
        email: adminEmail,
        token: otpCode,
        type: 'magiclink'
      });
      if (error2) alert(`Verification failed: ${error2.message}`);
      else {
        setIsAdminAuthenticated(true);
        setIsOtpSent(false);
      }
    } else {
      setIsAdminAuthenticated(true);
      setIsOtpSent(false);
    }
  };

  const getPriorityStyles = (p: string) => {
    switch (p) {
      case 'HIGH': return 'text-rose-600 bg-rose-50 border-rose-100';
      case 'MEDIUM': return 'text-orange-600 bg-orange-50 border-orange-100';
      default: return 'text-emerald-600 bg-emerald-50 border-emerald-100';
    }
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPriority = showHighPriorityOnly ? task.priority === 'HIGH' : true;
    const matchesBride = selectedBrideId ? (task as any).user_id === selectedBrideId : true;
    return matchesSearch && matchesPriority && matchesBride;
  });

  const filteredMessages = messages.filter(msg => {
    return selectedBrideId ? msg.user_id === selectedBrideId : true;
  });

  const getStats = () => {
    const today = new Date().toISOString().split('T')[0];
    const todaysMessages = messages.filter(m => m.created_at?.startsWith(today)).length;
    const openTasks = tasks.filter(t => t.status === 'TODO').length;
    
    return {
      brides: profiles.length,
      openTasks,
      engagement: todaysMessages
    };
  };

  const getBrideProgress = (brideId: string) => {
    const brideTasks = tasks.filter(t => (t as any).user_id === brideId);
    if (brideTasks.length === 0) return 0;
    const completed = brideTasks.filter(t => t.status === 'DONE').length;
    return Math.round((completed / brideTasks.length) * 100);
  };

  const stats = getStats();

  return (
    <div className="flex h-screen bg-[#FDF2F2] overflow-hidden selection:bg-rose-200 font-sans">
      {/* Permanent Bride Sidebar on the Left */}
      <motion.aside
        initial={{ x: -300 }}
        animate={{ x: 0 }}
        className="w-80 bg-white shadow-xl h-full flex flex-col p-8 border-r border-rose-50 overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-2xl font-serif text-[#E11D48] flex items-center gap-2">
            <Users size={24} />
            Brides
          </h2>
        </div>

        <div className="space-y-4">
          {profiles.map(profile => {
            const progress = getBrideProgress(profile.id);
            const isSelected = selectedBrideId === profile.id;

            return (
              <button 
                key={profile.id} 
                onClick={() => setSelectedBrideId(isSelected ? '' : profile.id)}
                className={`w-full p-4 rounded-2xl border transition-all flex flex-col gap-3 text-left ${
                  isSelected ? 'bg-rose-100 border-rose-300 shadow-md ring-2 ring-rose-200' : 'bg-rose-50/50 border-rose-100 hover:bg-rose-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    isSelected ? 'bg-rose-500 text-white' : 'bg-rose-200 text-rose-600'
                  }`}>
                    {profile.email[0].toUpperCase()}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className={`block truncate text-[13px] font-semibold ${isSelected ? 'text-rose-900' : 'text-[#1E293B]'}`}>
                      {profile.email.split('@')[0]}
                    </p>
                    <p className="block text-[10px] uppercase font-bold tracking-tighter text-[#FDA4AF]">
                      Bride Registry
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] font-black text-rose-400 uppercase tracking-widest">
                    <span>Progress</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-rose-200/50 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      className="h-full bg-rose-500 rounded-full"
                    />
                  </div>
                </div>
              </button>
            );
          })}
          {profiles.length === 0 && <div className="text-center py-10 text-gray-300 font-serif">No brides registered yet.</div>}
        </div>
      </motion.aside>

      {/* Main Content (Task Grid on the Right) */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto p-6 lg:p-12 transition-all">
        {/* Header */}
        <div className="pt-8 pb-12 flex flex-col items-center">
          {!isAdminAuthenticated && !isOtpSent && (
            <button 
              onClick={handleAdminSignIn}
              className="mb-8 px-6 py-2 bg-rose-500 text-white rounded-full font-bold shadow-lg hover:bg-rose-600 transition-all flex items-center gap-2"
            >
              <Users size={16} />
              Admin Login Required
            </button>
          )}

          {!isAdminAuthenticated && isOtpSent && (
            <div className="mb-10 flex gap-3 max-w-sm w-full mx-auto">
              <input
                type="text"
                placeholder="6-Digit Code"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className="flex-1 bg-white border border-rose-200 rounded-2xl py-3 px-6 shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-200 text-gray-700 font-bold tracking-[0.5em] text-center"
              />
              <button 
                onClick={handleVerifyOtp}
                className="bg--rose-500 bg-[#E11D48] text-white px-6 py-3 rounded-2xl font-bold shadow-lg hover:bg-rose-600 transition-all active:scale-95"
              >
                Verify
              </button>
            </div>
          )}
          
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative px-20 py-4"
          >
            <div className="absolute top-0 left-0 text-rose-500/10">
              <Heart size={60} fill="currentColor" />
            </div>
            <h1 className="text-5xl font-serif text-[#E11D48] tracking-widest mb-1">BrideGuide</h1>
            <p className="text-gray-400 uppercase tracking-[0.4em] text-[10px] text-center font-bold">Admin Console</p>
          </motion.div>
        </div>

        {/* Power Stats Section */}
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {[
            { label: 'Brides Registered', value: stats.brides, icon: Users, color: 'text-rose-600' },
            { label: 'Open Tasks', value: stats.openTasks, icon: Circle, color: 'text-blue-600' },
            { label: 'Engagement Today', value: stats.engagement, icon: MessageSquare, color: 'text-emerald-600' }
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-rose-100 shadow-sm flex items-center justify-between"
            >
              <div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-gray-400 mb-1">{stat.label}</p>
                <h4 className={`text-3xl font-serif ${stat.color}`}>{stat.value}</h4>
              </div>
              <div className={`${stat.color} bg-current/5 p-3 rounded-2xl`}>
                <stat.icon size={24} />
              </div>
            </motion.div>
          ))}
        </div>

        <div className="max-w-5xl mx-auto px-6">
          {/* Add Input */}
          <div className="flex flex-col md:flex-row gap-3 mb-6 max-w-2xl mx-auto">
            <input
              type="text"
              className="flex-1 bg-white border border-rose-100 rounded-2xl py-4 px-6 shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-200 text-gray-700 font-medium"
              placeholder="Assign a task (e.g., Book Venue)..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
            />
            
            <Select value={selectedBrideId} onValueChange={setSelectedBrideId}>
              <SelectTrigger className="w-full md:w-[200px] h-14 bg-white border-rose-100 rounded-2xl shadow-sm text-gray-600 font-semibold focus:ring-rose-200">
                <SelectValue placeholder="Select Bride" />
              </SelectTrigger>
              <SelectContent className="bg-white border-rose-50">
                {profiles.map(profile => (
                  <SelectItem key={profile.id} value={profile.id} className="focus:bg-rose-50">
                    {profile.email.split('@')[0]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <button
              onClick={handleAddTask}
              disabled={!newTaskTitle || !selectedBrideId}
              className="bg-[#E11D48] text-white px-8 py-4 rounded-2xl shadow-lg font-bold hover:bg-[#BE123C] transition-all active:scale-95 disabled:bg-rose-200"
            >
              Assign
            </button>
          </div>

          {/* AI Suggestion Section */}
          <div className="max-w-2xl mx-auto mb-10 bg-rose-50/30 backdrop-blur-sm p-6 rounded-3xl border border-rose-100/50">
            <div className="flex items-center gap-2 mb-4">
              <div className="bg-rose-500 p-1.5 rounded-lg text-white">
                <Search size={14} />
              </div>
              <h3 className="text-sm font-serif text-rose-600 font-bold uppercase tracking-widest">AI Consultant</h3>
            </div>
            
            <div className="flex flex-wrap gap-3 items-center">
              <Select value={weddingStyle} onValueChange={setWeddingStyle}>
                <SelectTrigger className="w-[140px] h-10 bg-white/80 border-rose-100 rounded-xl text-[11px] font-bold text-rose-500">
                  <SelectValue placeholder="Style" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Beach">Beach Wedding</SelectItem>
                  <SelectItem value="Traditional">Traditional Wedding</SelectItem>
                  <SelectItem value="Modern">Modern Loft</SelectItem>
                  <SelectItem value="Rustic">Rustic Barn</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2 bg-white/80 px-3 py-1.5 rounded-xl border border-rose-100">
                <span className="text-[10px] font-bold text-rose-300 uppercase">Guests:</span>
                <input 
                  type="number"
                  value={guestCount}
                  onChange={(e) => setGuestCount(Number(e.target.value))}
                  className="w-12 bg-transparent text-[11px] font-bold text-rose-500 outline-none"
                />
              </div>

              <button 
                onClick={generateAITasks}
                disabled={isGenerating || !selectedBrideId}
                className="bg-white text-rose-500 px-4 py-2 rounded-xl text-[11px] font-bold border border-rose-100 shadow-sm hover:bg-rose-50 active:scale-95 transition-all disabled:opacity-50"
              >
                {isGenerating ? 'Analyzing...' : 'Generate Plan'}
              </button>
            </div>

            {suggestedTasks.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-6 pt-6 border-t border-rose-100/50"
              >
                <div className="space-y-2 mb-6">
                  {suggestedTasks.map((t, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white/50 p-2 rounded-lg border border-white">
                      <span className="text-[12px] text-gray-700 font-medium">{t.title}</span>
                      <span className={`text-[8px] px-2 py-0.5 rounded-full font-bold ${getPriorityStyles(t.priority)}`}>
                        {t.priority}
                      </span>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={handleAssignAllTasks}
                  className="w-full bg-[#E11D48] text-white py-3 rounded-xl text-[12px] font-bold shadow-md hover:bg-[#BE123C] transition-all"
                >
                  Confirm & Assign All {suggestedTasks.length} Tasks
                </button>
              </motion.div>
            )}
          </div>

          {/* Search & Filter Bar */}
          <div className="max-w-2xl mx-auto mb-16 flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                type="text"
                placeholder="Search your wedding tasks..."
                className="w-full bg-white/50 backdrop-blur-sm border border-rose-50 rounded-full py-3 pl-12 pr-6 text-sm text-gray-600 focus:outline-none focus:ring-1 focus:ring-rose-200 transition-all font-medium"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <button
              onClick={() => setShowHighPriorityOnly(!showHighPriorityOnly)}
              className={`flex items-center gap-2 px-6 py-3 rounded-full border transition-all text-sm font-bold whitespace-nowrap ${showHighPriorityOnly
                  ? 'bg-rose-100 border-rose-200 text-rose-600 shadow-sm'
                  : 'bg-white/50 border-rose-50 text-gray-400 hover:bg-white'
                }`}
            >
              <Filter size={14} />
              {showHighPriorityOnly ? 'Showing High Priority' : 'Filter by Priority'}
            </button>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <AnimatePresence mode='popLayout'>
              {loading ? (
                <div className="col-span-full py-20 text-center font-serif text-gray-400">Loading plan...</div>
              ) : filteredTasks.length === 0 ? (
                <div className="col-span-full py-20 text-center font-serif text-2xl text-gray-300">Nothing matched.</div>
              ) : (
                filteredTasks.map((task) => (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="bg-white p-6 rounded-3xl border border-rose-50 shadow-sm relative flex flex-col"
                  >
                    <div className="flex justify-between items-center mb-6">
                      <select
                        value={task.priority}
                        onChange={(e) => handleUpdateTask(task.id, { priority: e.target.value as any })}
                        className={`appearance-none text-[9px] uppercase tracking-widest font-black px-3 py-1.5 rounded-full border cursor-pointer outline-none transition-all ${getPriorityStyles(task.priority)}`}
                      >
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                      </select>

                      <button onClick={() => handleDelete(task.id)} className="text-gray-200 hover:text-rose-600 transition">
                        <X size={16} />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center text-[8px] font-bold text-rose-500">
                        {profiles.find(p => p.id === (task as any).user_id)?.email?.[0].toUpperCase() || 'B'}
                      </div>
                      <span className="text-[10px] font-bold text-rose-300 uppercase tracking-tighter">
                        Assignee: {profiles.find(p => p.id === (task as any).user_id)?.email?.split('@')[0] || 'Unknown'}
                      </span>
                    </div>

                    <h3 className="text-lg font-serif text-gray-800 mb-6 flex-grow">
                      {task.title}
                    </h3>

                    <div className="mt-auto pt-5 border-t border-rose-50 flex items-center justify-between">
                      <Select
                        value={task.status}
                        onValueChange={(val) => handleUpdateTask(task.id, { status: val as any })}
                      >
                        <SelectTrigger className="w-[120px] bg-[#FDF2F2] text-[#E11D48] border-[#E11D48]/20 rounded-full h-8 text-[10px] font-bold uppercase transition-all hover:bg-rose-100">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#FDF2F2] border-rose-100">
                          <SelectItem value="TODO" className="text-[#E11D48] focus:bg-rose-100 focus:text-[#E11D48]">To Do</SelectItem>
                          <SelectItem value="IN_PROGRESS" className="text-[#E11D48] focus:bg-rose-100 focus:text-[#E11D48]">In Progress</SelectItem>
                          <SelectItem value="DONE" className="text-[#E11D48] focus:bg-rose-100 focus:text-[#E11D48]">Done</SelectItem>
                        </SelectContent>
                      </Select>

                      <span className="text-[9px] font-black tracking-widest text-rose-300 uppercase">
                        {task.category || 'General'}
                      </span>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Community Feed Sidebar (Right Side) */}
      <aside className="hidden xl:flex w-80 flex-col bg-white/60 backdrop-blur-xl border-l border-rose-100 p-6 overflow-y-auto">
        <div className="flex items-center gap-2 mb-8 mt-4">
          <div className="bg-rose-100 p-2 rounded-xl text-rose-600">
            <MessageSquare size={18} />
          </div>
          <h2 className="text-xl font-serif text-[#E11D48]">Live Lounge</h2>
          <div className="flex-1 flex justify-end">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] uppercase font-bold text-emerald-600 tracking-tighter">Live</span>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <AnimatePresence mode='popLayout'>
            {filteredMessages.length === 0 ? (
              <div className="text-center py-12 text-rose-200 font-serif italic text-sm">No messages for this bride...</div>
            ) : (
              filteredMessages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="relative pl-4 border-l-2 border-rose-100"
                >
                  <div className="relative pl-10">
                    <div 
                      className="absolute left-0 top-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-sm"
                      style={{ backgroundColor: getBrideColor(msg.user_email) }}
                    >
                      {msg.user_email?.[0]?.toUpperCase() || 'B'}
                    </div>
                    <p className="text-[10px] font-bold text-[#FDA4AF] uppercase tracking-tighter mb-1 truncate">
                      {msg.user_email?.split('@')[0] || 'Anonymous'}
                    </p>
                    <div className="bg-white p-3 rounded-2xl shadow-sm border border-rose-50/50">
                      <p className="text-[13px] text-gray-600 leading-relaxed font-medium">
                        {msg.content}
                      </p>
                    </div>
                    <p className="text-[9px] text-gray-300 mt-2 flex items-center gap-1">
                      <Clock size={10} />
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        <div className="mt-auto p-4 bg-rose-50/50 rounded-2xl border border-rose-100/50">
          <p className="text-[11px] text-rose-400 font-serif text-center italic">
            "Your community is thriving!"
          </p>
        </div>
      </aside>
    </div>
  );
}
