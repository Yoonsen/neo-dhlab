/**
 * Leser .xlsx, .csv, .tsv eller .txt i nettleseren uten eksterne pakker.
 * Gjenkjenner kolonner med 'dhlabid' eller 'urn' (eller skanner etter URN:NBN:... og 9-sifrede dhlabid).
 */

export interface ExtractedCorpusIds {
  dhlabids: number[];
  urns: string[];
  detectedColumn: string;
  rowCount: number;
}

async function inflateRaw(compressed: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  void writer.write(new Uint8Array(compressed));
  void writer.close();
  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

async function readZipEntries(buffer: ArrayBuffer): Promise<Map<string, string>> {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // Finn End of Central Directory (0x06054b50)
  let eocdOffset = -1;
  const minOffset = Math.max(0, bytes.length - 65557);
  for (let i = bytes.length - 22; i >= minOffset; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new Error('Ugyldig .xlsx-fil (fant ikke ZIP central directory).');
  }

  const cdCount = view.getUint16(eocdOffset + 10, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);

  const decoder = new TextDecoder('utf-8');
  const files = new Map<string, string>();
  let ptr = cdOffset;

  for (let i = 0; i < cdCount; i++) {
    if (view.getUint32(ptr, true) !== 0x02014b50) break;
    const method = view.getUint16(ptr + 10, true);
    const compSize = view.getUint32(ptr + 20, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localHeaderOffset = view.getUint32(ptr + 42, true);

    const name = decoder.decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen));
    ptr += 46 + nameLen + extraLen + commentLen;

    if (
      name === 'xl/sharedStrings.xml' ||
      name.startsWith('xl/worksheets/sheet')
    ) {
      const localNameLen = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
      const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
      const compressedSlice = bytes.subarray(dataStart, dataStart + compSize);

      let rawBytes: Uint8Array;
      if (method === 0) {
        rawBytes = compressedSlice;
      } else if (method === 8) {
        rawBytes = await inflateRaw(compressedSlice);
      } else {
        continue;
      }
      files.set(name, decoder.decode(rawBytes));
    }
  }

  return files;
}

function colLettersToIndex(cellRef: string): number {
  let col = 0;
  for (let i = 0; i < cellRef.length; i++) {
    const code = cellRef.charCodeAt(i);
    if (code >= 65 && code <= 90) {
      col = col * 26 + (code - 64);
    } else {
      break;
    }
  }
  return Math.max(0, col - 1);
}

async function parseXlsxRows(buffer: ArrayBuffer): Promise<string[][]> {
  const files = await readZipEntries(buffer);
  const parser = new DOMParser();

  const sharedStrings: string[] = [];
  const sstXml = files.get('xl/sharedStrings.xml');
  if (sstXml) {
    const doc = parser.parseFromString(sstXml, 'application/xml');
    const siNodes = Array.from(doc.getElementsByTagName('si'));
    for (const si of siNodes) {
      const tNodes = Array.from(si.getElementsByTagName('t'));
      sharedStrings.push(tNodes.map((t) => t.textContent ?? '').join(''));
    }
  }

  const sheetName =
    Array.from(files.keys())
      .filter((k) => k.startsWith('xl/worksheets/sheet'))
      .sort()[0] ?? '';
  const sheetXml = files.get(sheetName);
  if (!sheetXml) {
    throw new Error('Fant ingen regneark (sheet1.xml) i .xlsx-filen.');
  }

  const doc = parser.parseFromString(sheetXml, 'application/xml');
  const rowNodes = Array.from(doc.getElementsByTagName('row'));
  const table: string[][] = [];

  for (const rowNode of rowNodes) {
    const cells = Array.from(rowNode.getElementsByTagName('c'));
    const rowValues: string[] = [];
    for (const c of cells) {
      const ref = c.getAttribute('r') ?? '';
      const colIdx = ref ? colLettersToIndex(ref) : rowValues.length;
      const type = c.getAttribute('t');
      let val = '';
      if (type === 's') {
        const vText = c.getElementsByTagName('v')[0]?.textContent ?? '';
        const idx = parseInt(vText, 10);
        val = !Number.isNaN(idx) ? sharedStrings[idx] ?? '' : '';
      } else if (type === 'inlineStr') {
        val = c.getElementsByTagName('t')[0]?.textContent ?? '';
      } else {
        val = c.getElementsByTagName('v')[0]?.textContent ?? '';
      }
      rowValues[colIdx] = val.trim();
    }
    if (rowValues.some((v) => v && v.length > 0)) {
      table.push(rowValues);
    }
  }

  return table;
}

function parseDelimitedRows(text: string): string[][] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  const sep = lines[0].includes('\t')
    ? '\t'
    : lines[0].includes(';')
    ? ';'
    : ',';
  return lines.map((line) =>
    line
      .split(sep)
      .map((cell) => cell.trim().replace(/^["']|["']$/g, ''))
  );
}

function extractIdsFromTable(rows: string[][]): ExtractedCorpusIds {
  if (rows.length === 0) {
    return { dhlabids: [], urns: [], detectedColumn: 'ingen', rowCount: 0 };
  }

  const header = rows[0].map((h) => (h ?? '').trim().toLowerCase());
  const dhlabidCol = header.findIndex(
    (h) => h === 'dhlabid' || h === 'book_id' || h === 'id'
  );
  const urnCol = header.findIndex((h) => h === 'urn' || h.startsWith('urn'));

  const dhlabidsSet = new Set<number>();
  const urnsSet = new Set<string>();

  if (dhlabidCol !== -1) {
    for (let r = 1; r < rows.length; r++) {
      const raw = (rows[r][dhlabidCol] ?? '').trim();
      const cleaned = raw.replace(/\.0+$/, '');
      if (/^\d+$/.test(cleaned)) {
        const num = parseInt(cleaned, 10);
        if (num > 0) dhlabidsSet.add(num);
      }
    }
    return {
      dhlabids: Array.from(dhlabidsSet),
      urns: [],
      detectedColumn: rows[0][dhlabidCol] || 'dhlabid',
      rowCount: rows.length - 1,
    };
  }

  if (urnCol !== -1) {
    for (let r = 1; r < rows.length; r++) {
      const raw = (rows[r][urnCol] ?? '').trim();
      if (!raw) continue;
      if (raw.toUpperCase().startsWith('URN:')) {
        urnsSet.add(raw);
      } else if (raw.startsWith('digibok_')) {
        urnsSet.add(`URN:NBN:no-nb_${raw}`);
      } else if (/^\d{9,10}$/.test(raw)) {
        dhlabidsSet.add(parseInt(raw, 10));
      }
    }
    return {
      dhlabids: Array.from(dhlabidsSet),
      urns: Array.from(urnsSet),
      detectedColumn: rows[0][urnCol] || 'urn',
      rowCount: rows.length - 1,
    };
  }

  // Ingen eksplisitt kolonneoverskrift: skann alle celler etter URN:NBN:... eller dhlabid-heltall
  for (const row of rows) {
    for (const cell of row) {
      if (!cell) continue;
      const trimmed = cell.trim();
      const urnMatch = trimmed.match(/URN:NBN:[^\s,;"]+/i);
      if (urnMatch) {
        urnsSet.add(urnMatch[0]);
        continue;
      }
      const cleaned = trimmed.replace(/\.0+$/, '');
      if (/^\d{8,10}$/.test(cleaned)) {
        dhlabidsSet.add(parseInt(cleaned, 10));
      }
    }
  }

  // Hvis det bare er én kolonne med tall (uten overskrift), godta alle positive heltall
  if (dhlabidsSet.size === 0 && urnsSet.size === 0) {
    for (const row of rows) {
      for (const cell of row) {
        if (!cell) continue;
        const cleaned = cell.trim().replace(/\.0+$/, '');
        if (/^\d+$/.test(cleaned)) {
          const n = parseInt(cleaned, 10);
          if (n > 0) dhlabidsSet.add(n);
        }
      }
    }
  }

  return {
    dhlabids: Array.from(dhlabidsSet),
    urns: Array.from(urnsSet),
    detectedColumn: 'automatisk gjenkjent',
    rowCount: rows.length,
  };
}

export async function parseCorpusFile(file: File): Promise<ExtractedCorpusIds> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx')) {
    const buffer = await file.arrayBuffer();
    const rows = await parseXlsxRows(buffer);
    return extractIdsFromTable(rows);
  }
  const text = await file.text();
  const rows = parseDelimitedRows(text);
  return extractIdsFromTable(rows);
}
