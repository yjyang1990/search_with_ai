import { BaseChat } from './base';
import { IChatInputMessage, IStreamHandler } from '../interface';
import { GoogleModels } from '../constant';
import { httpRequest } from '../utils';
import { fetchEventData } from 'fetch-sse';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

const URLS = {
  geminiPro: '/models/gemini-pro:generateContent',
  geminiProStream: '/models/gemini-pro:streamGenerateContent?alt=sse',
};

export class GoogleChat implements BaseChat {
  private key?: string;
  private baseUrl?: string;
  constructor() {
    this.key = process.env.GOOGLE_KEY;
    this.baseUrl = process.env.GOOGLE_PROXY_URL || BASE_URL;
    console.log('GoogleAI BaseURL: ', this.baseUrl);
  }

  public async chat(
    messages: IChatInputMessage[],
    model = GoogleModels.GEMINI_PRO
  ) {
    console.log('Chat with GoogleAI: ', model);
    const msgs = this.transformMessage(messages);
    const url = `${this.baseUrl}/${URLS.geminiProStream}`;
    const res = await httpRequest({
      endpoint: url,
      method: 'POST',
      data: JSON.stringify({
        contents: msgs
      }),
      query: {
        key: this.key,
      },
    });
    const data = await res.json();
    const resMsg = data.candidates?.[0];
    if (res.status !== 200 || !resMsg) {
      throw new Error(data.message ?? 'Google AI request error.');
    }
    return resMsg.content?.parts[0]?.text;
  }

  public async chatStream(
    messages: IChatInputMessage[],
    onMessage: IStreamHandler,
    model = GoogleModels.GEMINI_PRO
  ) {
    console.log('Chat with GoogleAI: ', model);
    const msgs = this.transformMessage(messages);
    const url = `${this.baseUrl}${URLS.geminiProStream}&key=${this.key}`;
    const data = {
      contents: msgs
    };
    const abort = new AbortController();
    await fetchEventData(url, {
      method: 'POST',
      data,
      signal: abort.signal,
      headers: {
        'Content-Type': 'application/json'
      },
      onMessage: (eventData) => {
        const data = eventData?.data;
        const result = JSON.parse(data || '{}');
        const msg = result.candidates[0]?.content?.parts[0]?.text ?? '';
        onMessage(msg, false);
      },
      onClose: () => {
        onMessage(null, true);
      }
    });
  }

  private transformMessage(messages: IChatInputMessage[]) {
    return messages.map(msg => {
      const role = msg.role === 'assistant' ? 'model' : 'user';
      return {
        role,
        parts: [
          {
            text: msg.content,
          },
        ],
      };
    });
  }
}
