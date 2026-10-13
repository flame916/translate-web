const entries = [
  { phrase: 'hello', translation: '你好', usage: '日常问候' },
  { phrase: 'hello there', translation: '你好；嗨', usage: '日常问候' },
  { phrase: 'hi', translation: '嗨；你好', usage: '日常问候' },
  { phrase: 'hey', translation: '嗨；嘿', usage: '非正式问候' },
  { phrase: 'good morning', translation: '早上好', usage: '问候' },
  { phrase: 'good afternoon', translation: '下午好', usage: '问候' },
  { phrase: 'good evening', translation: '晚上好', usage: '问候' },
  { phrase: 'good night', translation: '晚安', usage: '临别或睡前用语' },
  { phrase: 'goodbye', translation: '再见', usage: '告别' },
  { phrase: 'good bye', translation: '再见', usage: '告别' },
  { phrase: 'bye', translation: '再见；拜拜', usage: '非正式告别' },
  { phrase: 'thank you', translation: '谢谢你；感谢', usage: '表达感谢' },
  { phrase: 'thanks', translation: '谢谢', usage: '表达感谢' },
  { phrase: 'how are you', translation: '你好吗？', usage: '问候' },
  { phrase: 'nice to meet you', translation: '很高兴认识你', usage: '初次见面' }
];

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/^[\s.,!?;:"'()[\]{}]+|[\s.,!?;:"'()[\]{}]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function lookupBasicTranslations(text) {
  const query = normalize(text);
  return query ? entries.filter(entry => entry.phrase === query) : [];
}

