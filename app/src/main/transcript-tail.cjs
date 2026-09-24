// Follows a Claude Code session transcript (JSONL) for the two things no hook
// reports: the user interrupting a turn (Esc) and the user rejecting a
// permission prompt. Only newly appended lines are read, and nothing from the
// conversation is kept or logged: each line is checked for a marker and dropped.
const fs = require('node:fs');

/** More than this appended between two reads (a huge tool result): skip ahead. */
const MAX_READ_BYTES = 8 * 1024 * 1024;

const INTERRUPT_PREFIX = '[Request interrupted by user';
const REJECTED_PREFIX = "The user doesn't want to proceed with this tool use";

function textOf(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((c) => (typeof c?.text === 'string' ? c.text : '')).join('');
  return '';
}

/** 'interrupted' | 'rejected' | null for one transcript record. */
function classify(rec) {
  if (rec?.type !== 'user') return null;
  const content = rec.message?.content;
  if (typeof content === 'string') return content.startsWith(INTERRUPT_PREFIX) ? 'interrupted' : null;
  if (!Array.isArray(content)) return null;
  let found = null;
  for (const block of content) {
    if (block?.type === 'text' && typeof block.text === 'string' && block.text.startsWith(INTERRUPT_PREFIX)) return 'interrupted';
    if (block?.type === 'tool_result' && block.is_error && textOf(block.content).startsWith(REJECTED_PREFIX)) found = 'rejected';
  }
  return found;
}

class TranscriptTail {
  /** Starts at the current end of the file: only what happens from now on counts. */
  constructor(path) {
    this.path = path;
    this.offset = TranscriptTail.size(path);
    this.partial = '';
  }

  static size(path) {
    try {
      return fs.statSync(path).size;
    } catch {
      return 0;
    }
  }

  /** Markers found in lines appended since the last call, in order. */
  poll() {
    const size = TranscriptTail.size(this.path);
    if (size < this.offset) {
      // Rewritten or truncated: start over from its end.
      this.offset = size;
      this.partial = '';
    }
    if (size === this.offset) return [];
    let start = this.offset;
    if (size - start > MAX_READ_BYTES) {
      start = size - MAX_READ_BYTES;
      this.partial = '';
    }
    let chunk = '';
    try {
      const fd = fs.openSync(this.path, 'r');
      try {
        const buf = Buffer.alloc(size - start);
        fs.readSync(fd, buf, 0, buf.length, start);
        chunk = buf.toString('utf8');
      } finally {
        fs.closeSync(fd);
      }
    } catch {
      return [];
    }
    this.offset = size;
    const lines = (this.partial + chunk).split('\n');
    this.partial = lines.pop() ?? '';
    const found = [];
    for (const line of lines) {
      // Cheap pre-filter: most lines are assistant text and tool output.
      if (!line.includes('interrupted by user') && !line.includes('want to proceed')) continue;
      try {
        const kind = classify(JSON.parse(line));
        if (kind) found.push(kind);
      } catch {
        // A line we can't parse is never a marker.
      }
    }
    return found;
  }
}

module.exports = { TranscriptTail, classify };
