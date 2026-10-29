import Tesseract from 'tesseract.js';
import type { Worker } from 'tesseract.js';
import type { Settings } from '../types';

type OcrStatus = {
  status: string;
  progress: number;
};

let worker: Worker | null = null;
let workerLang = '';
let workerPromise: Promise<Worker> | null = null;

const STATUS_TEXT: Record<string, string> = {
  'loading tesseract core': '加载识别引擎…',
  'initializing tesseract': '初始化识别引擎…',
  'loading language traineddata': '加载中文语言包…',
  'initializing api': '准备识别…',
  'recognizing text': '正在识别文字…',
};

export function ocrStatusText(status: string): string {
  return STATUS_TEXT[status] ?? status;
}

async function createOcrWorker(lang: Settings['ocrLang'], onStatus?: (s: OcrStatus) => void): Promise<Worker> {
  const base = import.meta.env.BASE_URL || '/';
  const langs = lang.split('+');
  const instance = await Tesseract.createWorker(
    langs,
    1,
    {
      workerPath: `${base}tesseract/worker.min.js`,
      corePath: `${base}tesseract-core`,
      langPath: `${base}tessdata`,
      workerBlobURL: false,
      logger: (m: { status: string; progress: number }) => {
        onStatus?.({ status: m.status, progress: m.progress });
      },
    },
  );
  await instance.setParameters({
    preserve_interword_spaces: '1',
    tessedit_pageseg_mode: '3' as never,
  });
  return instance;
}

export async function getOcrWorker(
  lang: Settings['ocrLang'],
  onStatus?: (s: OcrStatus) => void,
): Promise<Worker> {
  if (worker && workerLang === lang) return worker;
  if (workerPromise) {
    const old = await workerPromise.catch(() => null);
    if (old && workerLang !== lang) {
      await old.terminate().catch(() => undefined);
      worker = null;
      workerPromise = null;
    }
  }
  if (!workerPromise) {
    workerLang = lang;
    workerPromise = createOcrWorker(lang, onStatus).then((w) => {
      worker = w;
      return w;
    });
  }
  return workerPromise;
}

export async function terminateOcr(): Promise<void> {
  if (worker) {
    await worker.terminate().catch(() => undefined);
    worker = null;
    workerPromise = null;
    workerLang = '';
  }
}

/** 预处理：放大、灰度、自动反色，显著提升截图识别率 */
export async function preprocessImage(file: File | Blob): Promise<{ dataUrl: string; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const maxSide = Math.max(bitmap.width, bitmap.height);
  const scale = maxSide < 1100 ? Math.min(3, 1400 / Math.max(1, maxSide)) : 1;
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('无法创建画布');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = data[i + 1] = data[i + 2] = gray;
    sum += gray;
  }
  const mean = sum / (data.length / 4);
  const invert = mean < 110;
  if (invert) {
    for (let i = 0; i < data.length; i += 4) {
      const v = 255 - data[i];
      data[i] = data[i + 1] = data[i + 2] = v;
    }
  }
  ctx.putImageData(image, 0, 0);
  return { dataUrl: canvas.toDataURL('image/png'), width, height };
}

export async function recognizeImage(
  file: File | Blob,
  lang: Settings['ocrLang'],
  onStatus?: (s: OcrStatus) => void,
): Promise<string> {
  const prepared = await preprocessImage(file);
  onStatus?.({ status: 'initializing tesseract', progress: 0 });
  const instance = await getOcrWorker(lang, onStatus);
  const result = await instance.recognize(prepared.dataUrl);
  return result.data.text.replace(/\n{3,}/g, '\n\n').trim();
}
