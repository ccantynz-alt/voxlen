import { create } from "zustand";

export interface AudioDevice {
  id: string;
  name: string;
  isDefault: boolean;
  isExternal: boolean;
  sampleRate: number;
  channels: number;
}

interface AudioState {
  devices: AudioDevice[];
  selectedDeviceId: string | null;
  inputLevel: number;
  waveformData: number[];
  isLoadingDevices: boolean;

  setDevices: (devices: AudioDevice[]) => void;
  setSelectedDevice: (id: string | null) => void;
  setInputLevel: (level: number) => void;
  pushWaveformSample: (sample: number) => void;
  setWaveformData: (samples: number[]) => void;
  setLoadingDevices: (loading: boolean) => void;
}

export const WAVEFORM_LENGTH = 64;

export const useAudioStore = create<AudioState>((set) => ({
  devices: [],
  selectedDeviceId: null,
  inputLevel: 0,
  waveformData: new Array(WAVEFORM_LENGTH).fill(0),
  isLoadingDevices: false,

  setDevices: (devices) => set({ devices }),

  setSelectedDevice: (id) => set({ selectedDeviceId: id }),

  setInputLevel: (level) => set({ inputLevel: level }),

  pushWaveformSample: (sample) =>
    set((state) => {
      const data = [...state.waveformData.slice(1), sample];
      return { waveformData: data };
    }),

  setWaveformData: (samples) =>
    set(() => {
      // Normalize to fixed length. Truncate or pad as needed.
      if (samples.length === WAVEFORM_LENGTH) return { waveformData: samples };
      if (samples.length > WAVEFORM_LENGTH) {
        return { waveformData: samples.slice(samples.length - WAVEFORM_LENGTH) };
      }
      const padded = new Array(WAVEFORM_LENGTH).fill(0);
      for (let i = 0; i < samples.length; i++) {
        padded[WAVEFORM_LENGTH - samples.length + i] = samples[i];
      }
      return { waveformData: padded };
    }),

  setLoadingDevices: (loading) => set({ isLoadingDevices: loading }),
}));
