// Mirrors backend/app/schemas/analysis.py. All scores are on a 0-100 scale.

export type AnalysisResult = {
  overall_score: number;
  semantic_score: number;
  skill_score: number;
  matched_skills: string[];
  missing_skills: string[];
  recommendations: string[];
};

type Timestamped = {
  id: number;
  /** ISO-8601 timestamp in UTC. */
  created_at: string;
  resume_filename: string;
};

export type AnalysisResponse = Timestamped & {
  result: AnalysisResult;
};

export type AnalysisHistoryItem = Timestamped & {
  overall_score: number;
};

/** A PDF picked on the device, ready to upload. */
export type ResumeFile = {
  uri: string;
  name: string;
  mimeType: string;
  /** Present on web, where uploads need the browser `File` object. */
  file?: File;
};

export type CreateAnalysisInput = {
  resume: ResumeFile;
  jobDescription: string;
};
