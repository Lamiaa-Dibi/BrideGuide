'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Edit2, CheckCircle2, Circle, Clock, X, Search, Filter } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showHighPriorityOnly, setShowHighPriorityOnly] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, []);

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

  const handleUpdateTask = async (id: string, updates: Partial<Task>) => {
    const { error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id);

    if (!error) {
      setTasks(tasks.map(t => t.id === id ? { ...t, ...updates } : t));
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (!error) setTasks(tasks.filter((t) => t.id !== id));
  };

  const handleAddTask = async () => {
    if (!newTaskTitle) return;
    const { data: { user } } = await supabase.auth.getUser();
    const activeUserId = user?.id || '7c9c72e2-9d32-474d-91b4-a212373c09b2';

    const { error } = await supabase.from('tasks').insert([{
      title: newTaskTitle,
      user_id: activeUserId,
      status: 'TODO',
      priority: 'MEDIUM',
      category: 'General'
    }]);

    if (!error) {
      setNewTaskTitle('');
      fetchTasks();
    }
  };

  const getPriorityStyles = (p: string) => {
    switch(p) {
      case 'HIGH': return 'text-rose-600 bg-rose-50 border-rose-100';
      case 'MEDIUM': return 'text-orange-600 bg-orange-50 border-orange-100';
      default: return 'text-emerald-600 bg-emerald-50 border-emerald-100';
    }
  };

  const getStatusStyles = (s: string) => {
    switch(s) {
      case 'DONE': return 'text-emerald-500 bg-emerald-50';
      case 'IN_PROGRESS': return 'text-blue-500 bg-blue-50';
      default: return 'text-gray-400 bg-gray-50';
    }
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPriority = showHighPriorityOnly ? task.priority === 'HIGH' : true;
    return matchesSearch && matchesPriority;
  });

  return (
    <div className="min-h-screen bg-[#FDF2F2] pb-20 selection:bg-rose-200 font-sans">
      {/* Header */}
      <div className="pt-12 pb-8 flex flex-col items-center">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative px-20 py-4"
        >
          <div className="absolute top-0 left-0 text-rose-500/10">
             <svg width="60" height="60" viewBox="0 0 100 100" fill="currentColor"><path d="M10 20Q40 10 50 40Q60 10 90 20Q80 50 50 90Q20 50 10 20Z" /></svg>
          </div>
          <h1 className="text-5xl font-serif text-[#E11D48] tracking-widest mb-1">BrideGuide</h1>
          <p className="text-gray-400 uppercase tracking-[0.4em] text-[10px] text-center font-bold">Admin Console</p>
        </motion.div>
      </div>

      <div className="max-w-5xl mx-auto px-6">
        {/* Add Input */}
        <div className="flex gap-3 mb-10 max-w-2xl mx-auto">
          <input
            type="text"
            className="flex-1 bg-white border border-rose-100 rounded-2xl py-4 px-6 shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-200 text-gray-700"
            placeholder="Add to the wedding plan..."
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
          />
          <button
            onClick={handleAddTask}
            className="bg-[#E11D48] text-white px-8 py-4 rounded-2xl shadow-lg font-bold hover:bg-[#BE123C] transition-all active:scale-95"
          >
            Add
          </button>
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
              className={`flex items-center gap-2 px-6 py-3 rounded-full border transition-all text-sm font-bold whitespace-nowrap ${
                 showHighPriorityOnly 
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

                  <h3 className="text-lg font-serif text-gray-800 mb-6 flex-grow">
                    {task.title}
                  </h3>

                  <div className="mt-auto pt-5 border-t border-rose-50 flex items-center justify-between">
                     {/* Shadcn Select for Status */}
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
    </div>
  );
}
