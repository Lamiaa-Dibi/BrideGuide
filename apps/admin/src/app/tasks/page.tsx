'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Edit2, CheckCircle2, Circle, Clock, AlertCircle } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  category: string;
}

export default function ElegantTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) console.error(error);
    else setTasks(data || []);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (!error) setTasks(tasks.filter((t) => t.id !== id));
  };

  const handleAddTask = async () => {
    if (!newTaskTitle) return;
    const demoUserId = '7c9c72e2-9d32-474d-91b4-a212373c09b2';
    const { error } = await supabase.from('tasks').insert([{
      title: newTaskTitle,
      user_id: demoUserId,
      status: 'TODO',
      priority: 'MEDIUM'
    }]);
    if (!error) {
      setNewTaskTitle('');
      fetchTasks();
    }
  };

  const getPriorityColor = (p: string) => {
    switch(p) {
      case 'HIGH': return 'text-rose-600 bg-rose-50';
      case 'MEDIUM': return 'text-orange-600 bg-orange-50';
      default: return 'text-emerald-600 bg-emerald-50';
    }
  };

  return (
    <div className="min-h-screen bg-[#FDF2F2] pb-20 selection:bg-rose-200">
      {/* Header / Logo */}
      <div className="pt-12 pb-8 flex flex-col items-center">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative px-20 py-6"
        >
          {/* Floral SVG Borders (Simplified Decoration) */}
          <div className="absolute top-0 left-0 text-[#E11D48]/20">
            <svg width="60" height="60" viewBox="0 0 100 100" fill="currentColor">
              <path d="M10 20Q40 10 50 40Q60 10 90 20Q80 50 50 90Q20 50 10 20Z" />
            </svg>
          </div>
          <div className="absolute bottom-0 right-0 text-[#E11D48]/20 rotate-180">
            <svg width="60" height="60" viewBox="0 0 100 100" fill="currentColor">
              <path d="M10 20Q40 10 50 40Q60 10 90 20Q80 50 50 90Q20 50 10 20Z" />
            </svg>
          </div>
          
          <h1 className="text-5xl font-serif text-[#E11D48] tracking-wider mb-2">BrideGuide</h1>
          <p className="font-sans text-gray-500 uppercase tracking-[0.3em] text-xs text-center font-semibold">Admin Dashboard</p>
        </motion.div>
      </div>

      <div className="max-w-5xl mx-auto px-6">
        {/* Elegant Input Section */}
        <div className="flex flex-col md:flex-row gap-4 mb-16 justify-center">
          <input
            type="text"
            className="flex-1 bg-white border border-rose-100 rounded-full py-4 px-8 shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-200 transition-all font-sans text-gray-700 placeholder:text-gray-300"
            placeholder="Add a new wedding task (e.g. Find florist...)"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleAddTask}
            className="bg-[#E11D48] text-white px-10 py-4 rounded-full shadow-lg shadow-rose-200 font-bold tracking-wide hover:bg-[#BE123C] transition"
          >
            Add To Plan
          </motion.button>
        </div>

        {/* Task Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 p-4">
          <AnimatePresence>
            {loading ? (
              <div className="col-span-full py-20 text-center font-serif text-2xl text-gray-400">Loading your beautiful plan...</div>
            ) : tasks.length === 0 ? (
              <div className="col-span-full py-20 text-center font-serif text-2xl text-gray-400 italic">No tasks yet. Start planning!</div>
            ) : (
              tasks.map((task, idx) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: idx * 0.05 }}
                  whileHover={{ y: -8, boxShadow: "0 10px 25px rgba(225, 29, 72, 0.08)" }}
                  className="bg-white p-8 rounded-2xl border border-rose-50 shadow-sm relative group overflow-hidden"
                >
                  {/* Card Background Decoration */}
                  <div className="absolute top-0 right-0 -mr-6 -mt-6 size-24 bg-rose-50 opacity-50 rounded-full blur-2xl group-hover:bg-rose-100 transition-colors" />
                  
                  <div className="flex flex-col h-full relative z-10">
                    <div className="flex justify-between items-start mb-6">
                      <div className={`text-[10px] uppercase tracking-widest font-bold px-3 py-1 rounded-full ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </div>
                      <div className="flex gap-2">
                         <button className="text-gray-300 hover:text-rose-500 transition"><Edit2 size={16} /></button>
                         <button onClick={() => handleDelete(task.id)} className="text-gray-300 hover:text-rose-600 transition"><Trash2 size={16} /></button>
                      </div>
                    </div>

                    <h3 className="text-xl font-serif text-gray-800 mb-2 leading-tight">
                      {task.title}
                    </h3>

                    <div className="mt-auto pt-6 flex items-center justify-between border-t border-rose-50 text-[10px] font-bold text-gray-400 tracking-widest uppercase">
                       <span className="flex items-center gap-1.5 ">
                          {task.status === 'DONE' ? <CheckCircle2 size={12} className="text-emerald-500" /> : task.status === 'IN_PROGRESS' ? <Clock size={12} className="text-blue-500" /> : <Circle size={12} />}
                          {task.status}
                       </span>
                       <span className="text-rose-300">
                          {task.category || 'General'}
                       </span>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Decorative Champagne Gold Accents */}
      <div className="fixed bottom-10 right-10 pointer-events-none opacity-10">
         <svg width="200" height="200" viewBox="0 0 100 100" fill="#D4AF37">
           <path d="M50 0 L55 45 L100 50 L55 55 L50 100 L45 55 L0 50 L45 45 Z" />
         </svg>
      </div>
    </div>
  );
}
