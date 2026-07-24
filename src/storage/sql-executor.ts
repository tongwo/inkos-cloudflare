/**
 * InkOS Cloudflare — SQL Executor type
 * Compatible with Agents SDK's `this.sql` template tag.
 * 
 * The Agents SDK's `this.sql` is a template tag that handles all SQL operations
 * including SELECT, INSERT, UPDATE, DELETE, and DDL.
 */

export interface SqlExecutor {
  /** Template tag for SQL queries */
  <T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]): T[];
}