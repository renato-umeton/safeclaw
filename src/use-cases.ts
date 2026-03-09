// ---------------------------------------------------------------------------
// SafeClaw — Curated use-case catalog
// ---------------------------------------------------------------------------

import type { UseCase, Difficulty } from './types.js';

export const USE_CASES: UseCase[] = [
  // --- Automation ---
  {
    id: 'auto-email-drafts',
    title: 'Automated Email Draft Generation',
    description: 'Generate polished email drafts from bullet points. SafeClaw runs locally so sensitive email content never leaves your browser.',
    category: 'Automation',
    tags: ['email', 'writing', 'productivity', 'communication'],
    difficulty: 'beginner',
  },
  {
    id: 'auto-file-organizer',
    title: 'Workspace File Organizer',
    description: 'Automatically sort, rename, and organize files in your browser workspace using shell commands and file operations.',
    category: 'Automation',
    tags: ['files', 'organization', 'bash', 'productivity'],
    difficulty: 'intermediate',
  },
  {
    id: 'auto-scheduled-reports',
    title: 'Scheduled Report Generation',
    description: 'Use cron-based task scheduling to generate recurring reports. SafeClaw keeps running as a PWA even when the tab is backgrounded.',
    category: 'Automation',
    tags: ['scheduling', 'cron', 'reports', 'tasks'],
    difficulty: 'advanced',
  },

  // --- Research ---
  {
    id: 'research-web-summary',
    title: 'Web Research & Summarization',
    description: 'Fetch web pages, extract key information, and produce concise summaries — all within your browser with no server proxy.',
    category: 'Research',
    tags: ['web', 'summarization', 'fetch', 'reading'],
    difficulty: 'beginner',
  },
  {
    id: 'research-competitive-analysis',
    title: 'Competitive Analysis',
    description: 'Gather and compare product features, pricing, and reviews from multiple sources. Data stays local for confidential analyses.',
    category: 'Research',
    tags: ['analysis', 'comparison', 'business', 'strategy'],
    difficulty: 'intermediate',
  },
  {
    id: 'research-paper-review',
    title: 'Academic Paper Review',
    description: 'Upload and analyze academic papers, extracting methodology, findings, and limitations with multi-provider LLM support for deeper analysis.',
    category: 'Research',
    tags: ['academic', 'papers', 'analysis', 'science'],
    difficulty: 'advanced',
  },

  // --- Content Creation ---
  {
    id: 'content-social-posts',
    title: 'Social Media Content Calendar',
    description: 'Plan and draft social media posts for LinkedIn, Instagram, Twitter, and Reddit. Generate platform-specific copy with appropriate tone.',
    category: 'Content Creation',
    tags: ['social-media', 'writing', 'marketing', 'instagram', 'linkedin', 'twitter'],
    difficulty: 'beginner',
  },
  {
    id: 'content-blog-writing',
    title: 'Blog Post Drafting',
    description: 'Create structured blog posts with outlines, drafts, and SEO-friendly formatting. Memory feature retains your writing style preferences.',
    category: 'Content Creation',
    tags: ['blog', 'writing', 'seo', 'content-marketing'],
    difficulty: 'intermediate',
  },
  {
    id: 'content-newsletter',
    title: 'Newsletter Curation & Writing',
    description: 'Fetch trending articles, curate relevant content, and draft newsletter editions. Schedule recurring curation tasks with cron.',
    category: 'Content Creation',
    tags: ['newsletter', 'curation', 'email', 'writing', 'scheduling'],
    difficulty: 'advanced',
  },

  // --- Data Analysis ---
  {
    id: 'data-csv-analysis',
    title: 'CSV Data Exploration',
    description: 'Upload CSV files to the browser workspace and analyze them with JavaScript execution. No data leaves your device.',
    category: 'Data Analysis',
    tags: ['csv', 'data', 'javascript', 'analysis', 'privacy'],
    difficulty: 'beginner',
  },
  {
    id: 'data-json-transform',
    title: 'JSON Data Transformation',
    description: 'Parse, filter, reshape, and aggregate JSON datasets using the built-in JavaScript tool with full ES2022 support.',
    category: 'Data Analysis',
    tags: ['json', 'data', 'javascript', 'transformation'],
    difficulty: 'intermediate',
  },
  {
    id: 'data-api-dashboard',
    title: 'API Data Aggregation',
    description: 'Fetch data from multiple APIs, combine results, and generate summary dashboards — all running in the browser with fetch_url.',
    category: 'Data Analysis',
    tags: ['api', 'fetch', 'aggregation', 'dashboard', 'data'],
    difficulty: 'advanced',
  },

  // --- Development ---
  {
    id: 'dev-code-review',
    title: 'Code Review Assistant',
    description: 'Paste code snippets for review. SafeClaw identifies bugs, suggests improvements, and explains complex patterns using cloud or local models.',
    category: 'Development',
    tags: ['code-review', 'programming', 'debugging', 'best-practices', 'github'],
    difficulty: 'beginner',
  },
  {
    id: 'dev-script-generator',
    title: 'Shell Script Generator',
    description: 'Describe what you need and get working shell scripts. Test them immediately with the built-in bash emulator.',
    category: 'Development',
    tags: ['bash', 'scripting', 'automation', 'shell', 'programming'],
    difficulty: 'intermediate',
  },
  {
    id: 'dev-api-prototyping',
    title: 'API Prototyping & Testing',
    description: 'Design API contracts, generate mock responses, and test endpoints with fetch_url — a complete API development workflow in the browser.',
    category: 'Development',
    tags: ['api', 'prototyping', 'testing', 'fetch', 'programming', 'github'],
    difficulty: 'advanced',
  },

  // --- Communication ---
  {
    id: 'comm-meeting-prep',
    title: 'Meeting Preparation',
    description: 'Generate agendas, talking points, and follow-up templates. Memory feature retains context across meetings for ongoing projects.',
    category: 'Communication',
    tags: ['meetings', 'agendas', 'productivity', 'communication'],
    difficulty: 'beginner',
  },
  {
    id: 'comm-telegram-bot',
    title: 'Telegram Team Assistant',
    description: 'Connect SafeClaw to Telegram group chats for team Q&A, reminders, and knowledge sharing — with quality-first routing for reliable responses.',
    category: 'Communication',
    tags: ['telegram', 'bot', 'team', 'messaging', 'communication'],
    difficulty: 'intermediate',
  },
  {
    id: 'comm-multilingual',
    title: 'Multilingual Communication',
    description: 'Draft and translate messages across languages. Switch between cloud models for quality or local models for privacy when handling sensitive translations.',
    category: 'Communication',
    tags: ['translation', 'languages', 'communication', 'privacy'],
    difficulty: 'advanced',
  },
];

export function getUseCasesByCategory(category: string): UseCase[] {
  return USE_CASES.filter((uc) => uc.category === category);
}

export function getUseCasesByDifficulty(difficulty: Difficulty): UseCase[] {
  return USE_CASES.filter((uc) => uc.difficulty === difficulty);
}

export function getAllCategories(): string[] {
  return [...new Set(USE_CASES.map((uc) => uc.category))];
}

export function getAllTags(): string[] {
  return [...new Set(USE_CASES.flatMap((uc) => uc.tags))];
}
