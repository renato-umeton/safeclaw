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

  // --- Productivity ---
  {
    id: 'prod-daily-news-digest',
    title: 'Daily News Digest',
    description: 'Aggregate and summarize tech news from multiple sources into a curated daily briefing. Schedule recurring fetches with cron and keep your reading list private.',
    category: 'Productivity',
    tags: ['news', 'summarization', 'cron', 'scheduling', 'reading', 'productivity'],
    difficulty: 'intermediate',
  },
  {
    id: 'prod-inbox-declutter',
    title: 'Inbox De-clutter',
    description: 'Summarize newsletters and long email threads into condensed digests. Paste email content and get actionable summaries without forwarding to external services.',
    category: 'Productivity',
    tags: ['email', 'summarization', 'productivity', 'organization'],
    difficulty: 'beginner',
  },
  {
    id: 'prod-personal-crm',
    title: 'Personal CRM',
    description: 'Track contacts, interactions, and follow-ups in your browser workspace. Store relationship notes in OPFS files so contact data never leaves your device.',
    category: 'Productivity',
    tags: ['contacts', 'organization', 'files', 'productivity', 'communication'],
    difficulty: 'intermediate',
  },
  {
    id: 'prod-meeting-notes',
    title: 'Meeting Notes & Action Items',
    description: 'Convert meeting transcripts into structured summaries with automatic task creation using the create_task tool for follow-up reminders.',
    category: 'Productivity',
    tags: ['meetings', 'notes', 'tasks', 'scheduling', 'productivity'],
    difficulty: 'beginner',
  },

  // --- Creative ---
  {
    id: 'creative-content-pipeline',
    title: 'Content Pipeline',
    description: 'Automate idea scouting, research, and content tracking for video or blog production workflows. Combine web fetching with local file organization.',
    category: 'Creative',
    tags: ['content', 'video', 'blog', 'research', 'writing', 'productivity'],
    difficulty: 'intermediate',
  },
  {
    id: 'creative-podcast-production',
    title: 'Podcast Production',
    description: 'Automate guest research, episode outlines, show notes, and promotional assets. Use fetch_url for research and the file system for organizing production materials.',
    category: 'Creative',
    tags: ['podcast', 'audio', 'writing', 'research', 'content'],
    difficulty: 'advanced',
  },

  // --- Social ---
  {
    id: 'social-reddit-youtube-digest',
    title: 'Reddit/YouTube Digest',
    description: 'Summarize curated digests from favorite subreddits or YouTube channels. Fetch public feeds and produce condensed summaries of trending discussions.',
    category: 'Social',
    tags: ['reddit', 'youtube', 'summarization', 'social-media', 'curation'],
    difficulty: 'beginner',
  },
  {
    id: 'social-community-monitor',
    title: 'Community Monitoring',
    description: 'Track mentions, sentiment, and trending topics across social platforms. Schedule recurring checks and store analysis results locally for privacy.',
    category: 'Social',
    tags: ['social-media', 'monitoring', 'analysis', 'cron', 'scheduling'],
    difficulty: 'advanced',
  },

  // --- DevOps ---
  {
    id: 'devops-self-healing-server',
    title: 'Self-Healing Home Server',
    description: 'An always-on infrastructure agent that monitors services, runs health checks via cron, and generates recovery scripts using the shell emulator.',
    category: 'DevOps',
    tags: ['infrastructure', 'monitoring', 'bash', 'cron', 'automation', 'scripting'],
    difficulty: 'advanced',
  },
  {
    id: 'devops-log-analyzer',
    title: 'Log File Analyzer',
    description: 'Upload application logs to the browser workspace and analyze error patterns, frequency, and root causes. All log data stays local for security compliance.',
    category: 'DevOps',
    tags: ['logs', 'analysis', 'debugging', 'files', 'privacy'],
    difficulty: 'intermediate',
  },

  // --- Education ---
  {
    id: 'edu-idea-validator',
    title: 'Pre-Build Idea Validator',
    description: 'Scan GitHub, Hacker News, npm, PyPI, and Product Hunt before building a new project. Validate your idea against existing solutions with web research.',
    category: 'Education',
    tags: ['research', 'validation', 'web', 'fetch', 'github', 'programming'],
    difficulty: 'intermediate',
  },
  {
    id: 'edu-knowledge-base',
    title: 'Personal Knowledge Base',
    description: 'Build a searchable knowledge base from URLs, articles, and notes. Store everything in OPFS and use the LLM to retrieve and synthesize information on demand.',
    category: 'Education',
    tags: ['knowledge', 'notes', 'files', 'research', 'reading', 'organization'],
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
