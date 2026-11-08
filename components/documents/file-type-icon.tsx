import { Icon, type IconName } from "@/components/icons/icon";
import type { FileType } from "@/lib/generated/prisma/enums";

// TODO: switch PPTX to a PowerPoint icon once one is supplied.
const icons: Record<FileType, IconName> = {
  PDF: "file-pdf",
  PPTX: "document",
  DOCX: "file-word",
  IMAGE: "file-image",
};

export const fileTypeLabel: Record<FileType, string> = {
  PDF: "PDF",
  PPTX: "PowerPoint",
  DOCX: "Word",
  IMAGE: "Photo",
};

export function FileTypeIcon({ type, size = 22 }: { type: FileType; size?: number }) {
  return <Icon name={icons[type]} size={size} />;
}

/** Guess a FileType from a file name, for the upload queue (before the server decides). */
export function fileTypeFromName(name: string): FileType {
  const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  if (ext === "pdf") return "PDF";
  if (ext === "pptx" || ext === "ppt") return "PPTX";
  if (ext === "docx" || ext === "doc") return "DOCX";
  return "IMAGE";
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
