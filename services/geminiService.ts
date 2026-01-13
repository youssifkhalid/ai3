import { GoogleGenAI, Modality, LiveServerMessage, GenerateContentResponse, Blob } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";
import { getUserMemoryFromCloud, saveUserMemoryToCloud, getUserId } from "./firebaseService";

// Helper to create GenAI client; always uses updated environment variables
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

let currentAudioCtx: AudioContext | null = null;

export const getAudioCtx = () => {
  if (!currentAudioCtx) {
    currentAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  }
  return currentAudioCtx;
};

// Implement manual base64 decoding for handling raw PCM audio bytes
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Implement manual base64 encoding for audio processing
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decodes raw PCM audio bytes into an AudioBuffer.
 * Adheres to Live API rules: does not use AudioContext.decodeAudioData for raw streams.
 */
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
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
    // Prepare text for high-performance TTS
    const cleanedText = text.replace(/[#*`_⚠️🎯🎓$]/g, '').substring(0, 1000); 

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ 
        parts: [{ 
          text: `اقرأ النص ده بسرعة مدرس بيشرح في سنتر، وبدون أي تحيات: ${cleanedText}` 
        }] 
      }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { 
          voiceConfig: { 
            prebuiltVoiceConfig: { voiceName: 'Kore' } 
          } 
        },
      },
    });

    // Adhere to guidelines: Iterate through all parts to find the audio data
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          return await decodeAudioData(decode(part.inlineData.data), ctx, 24000, 1);
        }
      }
    }
  } catch (e) { console.error("TTS error:", e); }
  return null;
};

export const sendMessageQuantum = async (
  prompt: string, 
  options: { files?: {data: string, mime: string}[], useThinking?: boolean, userName?: string }, 
  onChunk: (text: string) => void
) => {
  const ai = getAI();
  const uid = getUserId();
  const memory = await getUserMemoryFromCloud(uid);

  const parts: any[] = [{ text: prompt }];
  if (options.files) {
    options.files.forEach(f => parts.push({ inlineData: { data: f.data.split(',')[1], mimeType: f.mime } }));
  }

  const model = options.useThinking ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
  const result = await ai.models.generateContentStream({
    model,
    contents: { parts },
    config: {
      systemInstruction: `${SYSTEM_INSTRUCTION}\n\nاسم الطالب: ${options.userName || 'بطل'}\nالذاكرة الأكاديمية للطالب:\n${memory}`,
      // Adhere to guidelines: Using thinking budget for complex tasks
      thinkingConfig: options.useThinking ? { thinkingBudget: 16000 } : undefined
    },
  });

  let fullText = "";
  for await (const chunk of result) {
    // Access response.text directly (property, not a method)
    fullText += chunk.text || "";
    onChunk(fullText);
  }
  
  // Update persistent student memory with key concepts from the response
  if (fullText.length > 50) {
    await saveUserMemoryToCloud(uid, `سأل عن: ${prompt.substring(0, 50)}... والرد كان يركز على: ${fullText.substring(0, 50)}`);
  }
  
  return { text: fullText };
};

// Encodes Float32 PCM audio data to the format expected by the Live API
function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

export const startLiveCall = async (userName: string, onTranscription: (text: string, isUser: boolean) => void) => {
  const ai = getAI();
  const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
  const outputAudioContext = getAudioCtx();
  const outputNode = outputAudioContext.createGain();
  outputNode.connect(outputAudioContext.destination);
  
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  let nextStartTime = 0;
  const sources = new Set<AudioBufferSourceNode>();
  
  const sessionPromise = ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-12-2025',
    callbacks: {
      onopen: () => {
        const source = inputAudioContext.createMediaStreamSource(stream);
        const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
          const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
          const pcmBlob = createBlob(inputData);
          // Adhere to guidelines: Always use sessionPromise.then to send data to avoid race conditions or stale closures
          sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
        };
        source.connect(scriptProcessor);
        scriptProcessor.connect(inputAudioContext.destination);
      },
      onmessage: async (message: LiveServerMessage) => {
        if (message.serverContent?.outputTranscription) {
           onTranscription(message.serverContent.outputTranscription.text, false);
        } else if (message.serverContent?.inputTranscription) {
           onTranscription(message.serverContent.inputTranscription.text, true);
        }
        
        // Adhere to guidelines: Iterate through all parts to find the audio data in modelTurn
        if (message.serverContent?.modelTurn?.parts) {
          for (const part of message.serverContent.modelTurn.parts) {
            if (part.inlineData?.data) {
              const base64EncodedAudioString = part.inlineData.data;
              nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);
              const audioBuffer = await decodeAudioData(decode(base64EncodedAudioString), outputAudioContext, 24000, 1);
              const source = outputAudioContext.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputNode);
              source.addEventListener('ended', () => { sources.delete(source); });
              source.start(nextStartTime);
              nextStartTime += audioBuffer.duration;
              sources.add(source);
            }
          }
        }

        const interrupted = message.serverContent?.interrupted;
        if (interrupted) {
          for (const source of sources.values()) { try { source.stop(); } catch(e){} sources.delete(source); }
          nextStartTime = 0;
        }
      },
      onerror: (e) => console.error('Live error:', e),
      onclose: () => console.log('Live closed'),
    },
    config: { 
      responseModalities: [Modality.AUDIO], 
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
      },
      systemInstruction: `أنت الدحيح، مدرس مصري شاطر. الطالب اسمه ${userName}. ردودك قصيرة، ذكية، وبالعامية المصرية التعليمية.` 
    }
  });
  return { 
    stop: async () => { (await sessionPromise).close(); stream.getTracks().forEach(t => t.stop()); },
    setVolume: (v: number) => { outputNode.gain.value = v; }
  };
};