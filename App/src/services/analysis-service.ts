import { USE_MOCKS } from '@/config/env';
import { mockAnalysisApi } from '@/mocks/analysis';
import { request } from '@/services/api-client';
import type {
  AnalysisHistoryItem,
  AnalysisResponse,
  CreateAnalysisInput,
  ResumeFile,
} from '@/types/analysis';

const BASE = '/api/analysis';

function resumeFormPart(resume: ResumeFile): Blob {
  // Web uploads need a real File; React Native's FormData accepts a { uri, name, type } descriptor.
  // The descriptor requires React Native's fetch: Expo's default expo/fetch rejects `uri` parts,
  // hence EXPO_PUBLIC_USE_RN_FETCH=true in .env.
  if (resume.file) return resume.file;
  return { uri: resume.uri, name: resume.name, type: resume.mimeType } as unknown as Blob;
}

const httpAnalysisApi = {
  create({ resume, jobDescription }: CreateAnalysisInput) {
    const body = new FormData();
    body.append('resume', resumeFormPart(resume), resume.name);
    body.append('job_description', jobDescription);
    // Trailing slash matters: the FastAPI route is registered as "/api/analysis/".
    // Upload + model inference can take a while, so allow longer than the default timeout.
    return request<AnalysisResponse>(`${BASE}/`, { method: 'POST', body, timeoutMs: 120_000 });
  },

  history(limit: number) {
    return request<AnalysisHistoryItem[]>(`${BASE}/history?limit=${limit}`);
  },

  get(id: number) {
    return request<AnalysisResponse>(`${BASE}/${id}`);
  },

  remove(id: number) {
    return request<void>(`${BASE}/${id}`, { method: 'DELETE' });
  },
};

const api = USE_MOCKS ? mockAnalysisApi : httpAnalysisApi;

export const analysisService = {
  createAnalysis: (input: CreateAnalysisInput) => api.create(input),
  getHistory: (limit = 50) => api.history(limit),
  getAnalysis: (id: number) => api.get(id),
  deleteAnalysis: (id: number) => api.remove(id),
};
