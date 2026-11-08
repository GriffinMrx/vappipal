-- Chat sends and regenerates are counted as usage events, so clearing a chat
-- never resets the hourly limits.
ALTER TYPE "UsageKind" ADD VALUE 'CHAT';
ALTER TYPE "UsageKind" ADD VALUE 'REGENERATE';
