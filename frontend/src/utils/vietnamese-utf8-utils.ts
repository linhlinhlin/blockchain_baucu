/**
 * UTF-8 helpers for ballot metadata.
 *
 * Older ballot payloads can contain mojibake such as "\u00c4\u0090ang" or
 * double-encoded strings such as "Lo\u00c3\u00a1\u00c2\u00ba\u00c2\u00a1i".
 * Keep the repair logic generic instead of maintaining an incomplete
 * Vietnamese character lookup table.
 */

const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

const WINDOWS_1252_REVERSE: Record<string, number> = {
  '\u20ac': 0x80,
  '\u201a': 0x82,
  '\u0192': 0x83,
  '\u201e': 0x84,
  '\u2026': 0x85,
  '\u2020': 0x86,
  '\u2021': 0x87,
  '\u02c6': 0x88,
  '\u2030': 0x89,
  '\u0160': 0x8a,
  '\u2039': 0x8b,
  '\u0152': 0x8c,
  '\u017d': 0x8e,
  '\u2018': 0x91,
  '\u2019': 0x92,
  '\u201c': 0x93,
  '\u201d': 0x94,
  '\u2022': 0x95,
  '\u2013': 0x96,
  '\u2014': 0x97,
  '\u02dc': 0x98,
  '\u2122': 0x99,
  '\u0161': 0x9a,
  '\u203a': 0x9b,
  '\u0153': 0x9c,
  '\u017e': 0x9e,
  '\u0178': 0x9f,
};

export const vietnameseCharacterMap: Record<string, string> = {
  '\u00c3\u00a1': '\u00e1',
  '\u00c3\u00a0': '\u00e0',
  '\u00c3\u00a9': '\u00e9',
  '\u00c3\u00aa': '\u00ea',
  '\u00c4\u0090': '\u0110',
  '\u00c4\u0091': '\u0111',
  '\u00e2\u20ac\u00a6': '\u2026',
  '\u00e2\u20ac\u201d': '\u2014',
};

const mojibakePattern =
  /(?:[\u00c2-\u00c4][\u0080-\u00bf]|\u00e1[\u00ba-\u00bb][\u0080-\u00bf]?|\u00e2[\u0080-\u00bf\u20ac])/g;

function mojibakeScore(value: string): number {
  return value.match(mojibakePattern)?.length ?? 0;
}

function toSingleByteBuffer(value: string): Uint8Array | null {
  const bytes: number[] = [];

  for (const char of value) {
    const codePoint = char.codePointAt(0);
    if (codePoint === undefined) {
      return null;
    }

    if (codePoint <= 0xff) {
      bytes.push(codePoint);
      continue;
    }

    const windows1252Byte = WINDOWS_1252_REVERSE[char];
    if (windows1252Byte === undefined) {
      return null;
    }

    bytes.push(windows1252Byte);
  }

  return new Uint8Array(bytes);
}

function decodeMojibakeOnce(value: string): string {
  const bytes = toSingleByteBuffer(value);
  if (!bytes) {
    return value;
  }

  try {
    return utf8Decoder.decode(bytes);
  } catch {
    return value;
  }
}

export const decodeBase64UTF8 = (base64String: string): string => {
  try {
    const binaryString = atob(base64String);
    const bytes = new Uint8Array(binaryString.length);

    for (let index = 0; index < binaryString.length; index += 1) {
      bytes[index] = binaryString.charCodeAt(index);
    }

    return new TextDecoder('utf-8').decode(bytes);
  } catch (error) {
    console.error('Failed to decode Base64 as UTF-8:', error);
    return base64String;
  }
};

export const encodeUTF8Base64 = (utf8String: string): string => {
  try {
    const bytes = new TextEncoder().encode(utf8String);
    let binaryString = '';

    bytes.forEach((byte) => {
      binaryString += String.fromCharCode(byte);
    });

    return btoa(binaryString);
  } catch (error) {
    console.error('Failed to encode UTF-8 as Base64:', error);
    return btoa(utf8String);
  }
};

export const fixVietnameseEncoding = (text: string): string => {
  if (typeof text !== 'string') {
    return String(text);
  }

  let result = text;

  for (const [encoded, decoded] of Object.entries(vietnameseCharacterMap)) {
    result = result.replaceAll(encoded, decoded);
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const currentScore = mojibakeScore(result);
    if (currentScore === 0) {
      break;
    }

    const decoded = decodeMojibakeOnce(result);
    if (decoded === result || mojibakeScore(decoded) >= currentScore) {
      break;
    }

    result = decoded;
  }

  return result;
};

export const cleanVietnameseJsonObject = (jsonObj: unknown): unknown => {
  if (jsonObj === null || jsonObj === undefined) {
    return jsonObj;
  }

  if (typeof jsonObj === 'string') {
    return fixVietnameseEncoding(jsonObj);
  }

  if (Array.isArray(jsonObj)) {
    return jsonObj.map((item) => cleanVietnameseJsonObject(item));
  }

  if (typeof jsonObj === 'object') {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(jsonObj)) {
      result[fixVietnameseEncoding(key)] = cleanVietnameseJsonObject(value);
    }

    return result;
  }

  return jsonObj;
};

export const parseBase64JsonWithUTF8 = (base64JSON: string): unknown => {
  try {
    const jsonString = decodeBase64UTF8(base64JSON);
    return cleanVietnameseJsonObject(JSON.parse(jsonString));
  } catch (error) {
    console.error('Failed to parse Base64 JSON with UTF-8:', error);
    return null;
  }
};
