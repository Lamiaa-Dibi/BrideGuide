import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Lazy initializer for the Admin Client to bypass RLS and perform database operations
let supabaseAdmin: any = null;

function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error('Supabase URL and Key are required.');
    }
    supabaseAdmin = createClient(url, key);
  }
  return supabaseAdmin;
}

// Definition of the tool schema for task creation
const createTaskToolDeclaration = {
  name: 'create_task',
  description: 'Create or add a new task item to the wedding task list in the database.',
  parameters: {
    type: 'OBJECT',
    properties: {
      title: { type: 'STRING', description: 'The title or name of the task to add' },
      category: { type: 'STRING', description: 'The category of the task (e.g. Venue, Decor, Music, Food, Planning, General)' },
      priority: { type: 'STRING', description: 'Priority level: LOW, MEDIUM, or HIGH' },
      user_id: { type: 'STRING', description: 'The user ID of the bride/user' },
      due_date: { type: 'STRING', description: 'Optional due date in YYYY-MM-DD format' },
      description: { type: 'STRING', description: 'Optional detailed description of the task' }
    },
    required: ['title']
  }
};

function extractTaskDetails(userMsg: string) {
  let taskTitle = userMsg
    .replace(/^(please|can you|could you|i want to|i need to)\s+/i, '')
    .replace(/^(add|create|put|remind me to|set up|book)\s+/i, '')
    .replace(/^(a task|a new task|to my list|to checklist|task|for me)\s+/i, '')
    .trim();

  taskTitle = taskTitle.replace(/\s+for me$/i, '').trim();

  const defaultTasks = [
    { title: 'Book Wedding Venue', category: 'Venue' },
    { title: 'Schedule Bridal Dress Fitting', category: 'Attire' },
    { title: 'Hire Wedding Photographer', category: 'Photo' },
    { title: 'Finalize Catering Menu & Tasting', category: 'Food' },
    { title: 'Send Wedding Invitations', category: 'Planning' },
  ];

  if (!taskTitle || taskTitle.length < 3 || /^(for me|task|a task|something|item|checklist)$/i.test(taskTitle)) {
    const randomPick = defaultTasks[Math.floor(Math.random() * defaultTasks.length)];
    return randomPick;
  }

  taskTitle = taskTitle.charAt(0).toUpperCase() + taskTitle.slice(1);

  let category = 'General';
  if (/venue|location|hall|church|barn|beach/i.test(taskTitle)) category = 'Venue';
  else if (/decor|flower|rose|candle|neon|balloon/i.test(taskTitle)) category = 'Decor';
  else if (/music|dj|band|song|playlist|quartet/i.test(taskTitle)) category = 'Music';
  else if (/food|catering|cake|drink|menu|tasting|wine/i.test(taskTitle)) category = 'Food';
  else if (/dress|suit|tux|attire|fitting|shoe/i.test(taskTitle)) category = 'Attire';
  else if (/photo|photographer|video|camera|album/i.test(taskTitle)) category = 'Photo';

  return { title: taskTitle, category };
}

// Helper function to execute task insertion in Supabase database
async function executeCreateTaskInsert(taskData: {
  title: string;
  category?: string;
  priority?: string;
  user_id?: string;
  due_date?: string;
  description?: string;
}) {
  const adminClient = getSupabaseAdmin();

  // If no user_id is passed, get the first available user/profile from the database as fallback
  let targetUserId = taskData.user_id;
  if (!targetUserId) {
    const { data: firstProfile } = await adminClient.from('profiles').select('id').limit(1).single();
    targetUserId = firstProfile?.id || '00000000-0000-0000-0000-000000000000';
  }

  const taskPayload = {
    title: taskData.title,
    category: taskData.category || 'General',
    priority: taskData.priority || 'MEDIUM',
    user_id: targetUserId,
    status: 'TODO',
    due_date: taskData.due_date || null,
    description: taskData.description || null
  };

  console.log('DEBUG: AI Tool Executing Database Insert:', taskPayload);

  const { data, error } = await adminClient
    .from('tasks')
    .insert([taskPayload])
    .select();

  if (error) {
    console.error('SERVER-SIDE AI INSERT ERROR:', error.message);
    throw new Error(`Database Insert Error: ${error.message}`);
  }

  return data?.[0] || data;
}

export async function POST(req: Request) {
  try {
    const { message, user_id } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message parameter is required.' }, { status: 400 });
    }

    console.log('DEBUG: AI Chat Request received:', { message, user_id });

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.OPENAI_API_KEY;

    let aiReply = '';
    let toolCallExecuted = false;
    let createdTaskResult: any = null;

    if (apiKey && (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)) {
      // ── Path A: Using Gemini API with Tool Calling enabled ──
      const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      
      const payload = {
        systemInstruction: {
          parts: [{
            text: `You are an AI Wedding Assistant for BrideGuide. 
STRICT RULE: When the user asks to create, add, or put a task or item on their list, perform the insert immediately using the create_task tool call and output a clear confirmation message.`
          }]
        },
        contents: [{
          role: 'user',
          parts: [{ text: message }]
        }],
        tools: [{
          functionDeclarations: [createTaskToolDeclaration]
        }],
        toolConfig: {
          functionCallingConfig: {
            mode: 'AUTO'
          }
        }
      };

      const response = await fetch(geminiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const json = await response.json();
      console.log('DEBUG: Gemini Model API Response:', JSON.stringify(json));

      const candidate = json?.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      for (const part of parts) {
        if (part.functionCall) {
          const { name, args } = part.functionCall;
          console.log(`DEBUG: Parsed Model Tool Call "${name}" with args:`, args);
          
          if (name === 'create_task' && args?.title) {
            createdTaskResult = await executeCreateTaskInsert({
              title: args.title,
              category: args.category,
              priority: args.priority,
              user_id: args.user_id || user_id,
              due_date: args.due_date,
              description: args.description
            });
            toolCallExecuted = true;
            aiReply = `I've added "${args.title}" to your wedding checklist! 💕`;
          }
        } else if (part.text) {
          aiReply += part.text;
        }
      }
    }

    // ── Path B: Fallback Intent Detection & Tool Execution (if API key is missing or model returns text) ──
    if (!toolCallExecuted) {
      const lowerMsg = message.toLowerCase();
      const isCreateCommand = lowerMsg.includes('create') || 
                              lowerMsg.includes('add') || 
                              lowerMsg.includes('remind me') || 
                              lowerMsg.includes('put') ||
                              lowerMsg.includes('new task');

      if (isCreateCommand) {
        const { title, category } = extractTaskDetails(message);

        createdTaskResult = await executeCreateTaskInsert({
          title,
          category,
          priority: 'MEDIUM',
          user_id
        });
        toolCallExecuted = true;
        aiReply = `I've added "${title}" to your wedding checklist! 💕`;
      }
    }

    if (!aiReply) {
      aiReply = `Based on your request "${message}", I'm here to help manage your wedding tasks. Let me know if you want me to add specific items to your checklist!`;
    }

    return NextResponse.json({
      success: true,
      reply: aiReply,
      toolCallExecuted,
      data: createdTaskResult
    });

  } catch (error: any) {
    console.error('CHAT API ERROR:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
