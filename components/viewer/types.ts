// Plain module: what every file renderer gets from the viewer shell (prompt 38).

export type ViewProps = {
  /** Same-origin route that redirects to a 5-minute signed URL for the file. */
  url: string;
  /** 1 = fit the width; the shell widens the box for other zooms. */
  zoom: number;
  /** Number of pages / slides once known. */
  onTotal: (n: number) => void;
  /** Pages are in the DOM (marked `data-vpage="N"`), so the shell can jump. */
  onReady: () => void;
  onError: () => void;
};
