
import { GoogleGenAI, Modality, LiveServerMessage, GenerateContentResponse } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";
import { getUserMemoryFromCloud, saveUserMemoryToCloud, getUserId } from "./firebaseService";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

let currentAudioCtx: AudioContext | null = null;

export const getAudioCtx = () => {
  if (!currentAudioCtx) {
    currentAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  }
  return currentAudioCtx;
};

function decode(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const fetchAudioBuffer = async (text: string): Promise<AudioBuffer | null> => {
  const ctx = getAudioCtx();
  try {
    const ai = getAI();
    const cleanedText = text.replace(/[#*`_⚠️🎯🎓]/g, '').substring(0, 1500); 

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `بصوت معلم خبير، قل: ${cleanedText}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
      },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) return await decodeAudioData(decode(base64Audio), ctx);
  } catch (e) { console.error("TTS engine error:", e); }
  return null;
};

export const sendMessageQuantum = async (
  prompt: string, 
  options: { files?: {data: string, mime: string}[], useThinking?: boolean }, 
  onChunk: (text: string) => void
) => {
  const ai = getAI();
  const uid = getUserId();
  const memory = await getUserMemoryFromCloud(uid);

  // Construct parts: Text + all attached files
  const parts: any[] = [];
  
  // Add text prompt
  if (prompt) {
    parts.push({ text: prompt });
  }

  // Add files as inlineData parts
  if (options.files && options.files.length > 0) {
    options.files.forEach(f => {
      // Data format is typically "data:mime/type;base64,DATA"
      const base64Data = f.data.includes('base64,') ? f.data.split('base64,')[1] : f.data;
      parts.push({ 
        inlineData: { 
          data: base64Data, 
          mimeType: f.mime 
        } 
      });
    });
  }

  const model = options.useThinking ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
  const result = await ai.models.generateContentStream({
    model,
    contents: [{ parts }],
    config: {
      systemInstruction: `${SYSTEM_INSTRUCTION}\n\nذاكرة الطالب المخزنة سحابياً:\n${memory}`,
      thinkingConfig: options.useThinking ? { thinkingBudget: model === 'gemini-3-pro-preview' ? 32768 : 24576 } : undefined
    },
  });

  let fullText = "";
  for await (const chunk of result) {
    fullText += (chunk as GenerateContentResponse).text || "";
    onChunk(fullText);
  }
  
  if (prompt) {
    await saveUserMemoryToCloud(uid, `نقاش: ${prompt.substring(0, 50)}`);
  }
  return { text: fullText };
};

export const startLiveCall = async (onTranscription: (text: string, isUser: boolean) => void) => {
  const ai = getAI();
  const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
  const outputCtx = getAudioCtx();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  let nextStartTime = 0;
  
  const sessionPromise = ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-12-2025',
    callbacks: {
      onopen: () => {
        const source = inputCtx.createMediaStreamSource(stream);
        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
        processor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          const int16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
          sessionPromise.then(s => s.sendRealtimeInput({ media: { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' } }));
        };
        source.connect(processor);
        processor.connect(inputCtx.destination);
      },
      onmessage: async (msg: LiveServerMessage) => {
        if (msg.serverContent?.outputTranscription) onTranscription(msg.serverContent.outputTranscription.text, false);
        const audio = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
        if (audio) {
          nextStartTime = Math.max(nextStartTime, outputCtx.currentTime);
          const buffer = await decodeAudioData(decode(audio), outputCtx, 24000, 1);
          const source = outputCtx.createBufferSource();
          source.buffer = buffer;
          source.connect(outputCtx.destination);
          source.start(nextStartTime);
          nextStartTime += buffer.duration;
        }
      },
      onerror: (e) => console.error("Live call error:", e),
      onclose: () => console.log("Live call session closed"),
    },
    config: { 
      responseModalities: [Modality.AUDIO], 
      systemInstruction: `${SYSTEM_INSTRUCTION}\n\nتنبيه إضافي: أنت الآن في مكالمة صوتية مباشرة مع الطالب. تحدث بأسلوب بشري، مصري، ودود للغاية، وبإيجاز ذكي.` 
    }
  });
  return { stop: async () => { (await sessionPromise).close(); stream.getTracks().forEach(t => t.stop()); } };
};
