/**
 * InkOS Cloudflare — Entry Point
 * 
 * Exports the InkOS Agent and Workers handlers.
 * 
 * Architecture:
 * ┌─────────────────────────────────────────────────┐
 * │  InkOS Agent (Durable Object + Agents SDK)      │
 * │  ├─ SQLite Storage (books, chapters, docs)       │
 * │  ├─ Schedule (writeCycle every 15 min)           │
 * │  ├─ Pipeline (plan → write → audit → revise)     │
 * │  └─ RPC Methods (createBook, writeChapter, ...)  │
 * └─────────────────────────────────────────────────┘
 */

export { InkosAgent } from './agent/inkos-agent.js';
export { default } from './agent/inkos-agent.js';