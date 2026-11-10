export interface ExtractProgress {
  page: number;
  total: number;
  stage: 'reading' | 'ocr';
}

export interface ExtractedQuestion {
  stem: string;
  options: string[];
}

declare global {
  interface Window {
    pdfjsLib?: {
      GlobalWorkerOptions: { workerSrc: string };
      getDocument: (input: { data: Uint8Array }) => { promise: Promise<{
        numPages: number;
        getPage: (page: number) => Promise<{
          getTextContent: () => Promise<{ items: Array<{ str?: string }> }>;
          getViewport: (options: { scale: number }) => { width: number; height: number };
          render: (options: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> };
        }>;
      }> };
    };
    Tesseract?: {
      createWorker: (language: string) => Promise<{
        recognize: (image: HTMLCanvasElement) => Promise<{ data: { text: string } }>;
        terminate: () => Promise<void>;
      }>;
    };
  }
}

const PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDF_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.0.5/dist/tesseract.min.js';

function loadScript(src: string, marker: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>(`script[data-cbt-loader="${marker}"]`);
    if (script?.dataset.loaded === 'true') return resolve();
    if (script?.dataset.failed === 'true') {
      script.remove();
      script = null;
    }
    const target = script ?? document.createElement('script');
    const done = () => { target.dataset.loaded = 'true'; resolve(); };
    const fail = () => { target.dataset.failed = 'true'; reject(new Error(`Could not load ${marker}. Check your internet connection and try again.`)); };
    target.addEventListener('load', done, { once: true });
    target.addEventListener('error', fail, { once: true });
    if (!script) {
      target.src = src;
      target.async = true;
      target.dataset.cbtLoader = marker;
      document.head.appendChild(target);
    }
  });
}

/** Splits extracted PDF/OCR text into editable question drafts. It never guesses answer keys. */
export function parseQuestionText(input: string): ExtractedQuestion[] {
  const normalized = input
    .replace(/-\s*\n\s*/g, '')
    .replace(/[\t\r]+/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .trim();
  if (!normalized) return [];

  // Answer-key and solution pages often repeat numbered entries (for example, "1. B").
  // Exclude that trailing section so it cannot become a set of fake question drafts.
  const answerKeyHeading = /(?:^|\n)\s*(?:ANSWER\s*KEY|ANSWERS?|KEY\s+TO\s+ANSWERS|SOLUTIONS?|CORRECT\s+ANSWERS?)\b[^\n]*(?:\n|$)/i;
  const answerKeyMatch = answerKeyHeading.exec(normalized);
  const text = (answerKeyMatch ? normalized.slice(0, answerKeyMatch.index) : normalized).trim();
  if (!text) return [];

  const starts = [...text.matchAll(/(?:^|\n)\s*(?:Q(?:uestion)?\s*)?(\d{1,3})[.)]\s+/gim)];
  const blocks: string[] = [];
  if (starts.length > 0) {
    for (let i = 0; i < starts.length; i++) {
      const start = (starts[i].index ?? 0) + starts[i][0].length;
      const end = i + 1 < starts.length ? starts[i + 1].index ?? text.length : text.length;
      const block = text.slice(start, end).trim();
      if (block) blocks.push(block);
    }
  } else {
    blocks.push(text);
  }

  return blocks.map((block) => {
    const optionPattern = /^\s*(?:\(([A-D])\)|([A-D])[).])\s*/gim;
    const matches = [...block.matchAll(optionPattern)];
    if (matches.length < 2) return { stem: block.replace(/^(?:Q(?:uestion)?\s*)?\d{1,3}[.)]\s*/i, '').trim(), options: [] };

    const stem = block.slice(0, matches[0].index ?? 0).replace(/^(?:Q(?:uestion)?\s*)?\d{1,3}[.)]\s*/i, '').trim();
    const options = matches.map((match, index) => {
      const start = (match.index ?? 0) + match[0].length;
      const end = index + 1 < matches.length ? matches[index + 1].index ?? block.length : block.length;
      return block.slice(start, end).replace(/\s+/g, ' ').trim();
    }).filter(Boolean);
    return { stem: stem || block.slice(0, matches[0].index ?? 0).trim(), options };
  }).filter((question) => question.stem.length > 0);
}

export async function extractQuestionsFromPdf(
  file: File,
  onProgress: (progress: ExtractProgress) => void,
): Promise<ExtractedQuestion[]> {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('Please choose a PDF file.');
  }
  if (file.size > 25 * 1024 * 1024) throw new Error('PDF is larger than 25 MB. Please use a smaller file.');
  await loadScript(PDFJS_URL, 'pdfjs');
  const pdfjs = window.pdfjsLib;
  if (!pdfjs) throw new Error('PDF reader did not initialize. Refresh and try again.');
  pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
  const documentPdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  if (documentPdf.numPages > 80) throw new Error('This importer currently supports up to 80 pages per PDF.');

  let ocrWorker: Awaited<ReturnType<NonNullable<Window['Tesseract']>['createWorker']>> | null = null;
  const pages: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= documentPdf.numPages; pageNumber++) {
      onProgress({ page: pageNumber, total: documentPdf.numPages, stage: 'reading' });
      const page = await documentPdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const selectableText = content.items.map((item) => item.str ?? '').join('\n').replace(/[ \t]+/g, ' ').trim();
      const hasQuestionStructure = /(?:^|\n)\s*(?:Q(?:uestion)?\s*)?\d{1,3}[.)]\s+|(?:^|\n)\s*(?:\([A-D]\)|[A-D][).])\s+/im.test(selectableText);
      if (selectableText.length >= 60 && hasQuestionStructure) {
        pages.push(selectableText);
        continue;
      }

      if (!ocrWorker) {
        await loadScript(TESSERACT_URL, 'tesseract');
        if (!window.Tesseract) throw new Error('OCR engine did not initialize. Refresh and try again.');
        ocrWorker = await window.Tesseract.createWorker('eng');
      }
      onProgress({ page: pageNumber, total: documentPdf.numPages, stage: 'ocr' });
      const viewport = page.getViewport({ scale: 1.8 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Could not prepare a page for OCR.');
      await page.render({ canvasContext: context, viewport }).promise;
      const recognized = await ocrWorker.recognize(canvas);
      pages.push(recognized.data.text);
      canvas.width = 0;
      canvas.height = 0;
    }
  } finally {
    if (ocrWorker) await ocrWorker.terminate();
  }

  const questions = parseQuestionText(pages.join('\n'));
  if (!questions.length) throw new Error('No question text could be detected. Try a clearer PDF or a higher-quality scan.');
  return questions;
}