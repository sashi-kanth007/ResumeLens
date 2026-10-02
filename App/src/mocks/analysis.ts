import type {
  AnalysisHistoryItem,
  AnalysisResponse,
  CreateAnalysisInput,
} from '@/types/analysis';

/** In-memory stand-in for the backend so every screen works without a server. */

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

let nextId = 4;
const records: AnalysisResponse[] = [
  {
    id: 3,
    created_at: hoursAgo(2),
    resume_filename: 'jane-doe-frontend.pdf',
    result: {
      overall_score: 82.4,
      semantic_score: 78.1,
      skill_score: 87.5,
      matched_skills: ['react', 'typescript', 'graphql', 'jest', 'css', 'git', 'ci/cd'],
      missing_skills: ['next.js'],
      recommendations: [
        'Mention hands-on experience with Next.js, or a project that used server-side rendering.',
        'Quantify the impact of your performance work (e.g. "cut bundle size by 30%").',
      ],
    },
  },
  {
    id: 2,
    created_at: hoursAgo(27),
    resume_filename: 'jane-doe-fullstack.pdf',
    result: {
      overall_score: 61.0,
      semantic_score: 64.2,
      skill_score: 57.1,
      matched_skills: ['python', 'fastapi', 'sql', 'docker'],
      missing_skills: ['kubernetes', 'aws', 'terraform'],
      recommendations: [
        'Add cloud experience: the role asks for AWS, Kubernetes and Terraform.',
        'Move your backend projects higher up so they are seen first.',
      ],
    },
  },
  {
    id: 1,
    created_at: hoursAgo(120),
    resume_filename: 'old-resume.pdf',
    result: {
      overall_score: 34.7,
      semantic_score: 41.3,
      skill_score: 25.0,
      matched_skills: ['java'],
      missing_skills: ['spring', 'microservices', 'kafka'],
      recommendations: [
        'Your resume content is quite different from this job description. Tailor your summary to the role.',
      ],
    },
  },
];

const toHistoryItem = ({ result, ...rest }: AnalysisResponse): AnalysisHistoryItem => ({
  ...rest,
  overall_score: result.overall_score,
});

export const mockAnalysisApi = {
  async create({ resume }: CreateAnalysisInput): Promise<AnalysisResponse> {
    await delay(1200);
    const semantic = 40 + Math.random() * 50;
    const skill = 30 + Math.random() * 70;
    const record: AnalysisResponse = {
      id: nextId++,
      created_at: new Date().toISOString(),
      resume_filename: resume.name,
      result: {
        overall_score: Math.round((0.6 * semantic + 0.4 * skill) * 10) / 10,
        semantic_score: Math.round(semantic * 10) / 10,
        skill_score: Math.round(skill * 10) / 10,
        matched_skills: ['python', 'sql', 'communication'],
        missing_skills: ['docker', 'aws'],
        recommendations: [
          'This is demo data. Set EXPO_PUBLIC_API_URL to analyze real resumes.',
          'Add Docker and AWS experience if you have it.',
        ],
      },
    };
    records.unshift(record);
    return record;
  },

  async history(limit: number): Promise<AnalysisHistoryItem[]> {
    await delay(400);
    return records.slice(0, limit).map(toHistoryItem);
  },

  async get(id: number): Promise<AnalysisResponse> {
    await delay(300);
    const record = records.find((r) => r.id === id);
    if (!record) throw new Error('Analysis not found.');
    return record;
  },

  async remove(id: number): Promise<void> {
    await delay(300);
    const index = records.findIndex((r) => r.id === id);
    if (index === -1) throw new Error('Analysis not found.');
    records.splice(index, 1);
  },
};
