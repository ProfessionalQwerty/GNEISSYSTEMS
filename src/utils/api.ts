import axios from 'axios';
import { DependencyGraph } from './graphBuilder';
import { getAuthToken } from './auth';

const API_BASE_URL = process.env.GNEISS_API_URL || 'https://gneiss-platform.vercel.app';
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

export interface AnalysisResult {
  decay_probability: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  metrics: {
    spectral_gap_ratio: number;
    pagerank_entropy: number;
    structural_delta: number;
    louvain_modularity_score?: number;
  };
  review: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendRequestWithRetry(
  url: string,
  data: any,
  headers: any,
  retryCount: number = 0
): Promise<any> {
  try {
    const response = await axios.post(url, data, {
      headers,
      timeout: 300000 // 5 minutes
    });
    return response.data;
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      
      // Retry on rate limit (429) or service unavailable (503)
      if ((status === 429 || status === 503) && retryCount < MAX_RETRIES) {
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
        console.warn(`Rate limited or service unavailable. Retrying in ${delay / 1000}s... (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
        await sleep(delay);
        return sendRequestWithRetry(url, data, headers, retryCount + 1);
      }
      
      // Don't retry on other errors
      throw error;
    }
    throw error;
  }
}

export async function sendAnalysisRequest(
  dependencyGraph: DependencyGraph,
  depth: number,
  onProgress?: (message: string) => void
): Promise<AnalysisResult> {
  // Validate inputs
  if (!dependencyGraph || !dependencyGraph.nodes || dependencyGraph.nodes.length === 0) {
    throw new Error('Invalid dependency graph: no nodes found. Please ensure the directory contains Java files.');
  }
  
  if (depth && (isNaN(depth) || depth < 1 || depth > 100)) {
    throw new Error('Invalid depth parameter. Must be a number between 1 and 100.');
  }

  const token = await getAuthToken();

  if (!token) {
    throw new Error('Not authenticated. Please run "gneiss auth" first.');
  }

  try {
    if (onProgress) {
      onProgress('Analyzing graph architecture...');
    }
    
    const result = await sendRequestWithRetry(
      `${API_BASE_URL}/api/v1/audit-cli`,
      {
        dependency_graph: dependencyGraph,
        depth: depth || 10
      },
      {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    );
    
    // Validate response structure
    if (!result || typeof result !== 'object') {
      throw new Error('Invalid response from server');
    }
    
    if (!result.review || typeof result.review !== 'string') {
      throw new Error('Invalid response: missing review data');
    }
    
    return result;
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('Request timed out. The analysis may be taking longer than expected. Please try again.');
      }
      if (error.response?.status === 401) {
        throw new Error('Authentication failed. Please run "gneiss auth" again.');
      }
      if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      if (error.response?.status === 503) {
        throw new Error('Service temporarily unavailable. Please try again later.');
      }
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      }
    }
    throw new Error('Failed to connect to GNEISS backend. Please check your connection.');
  }
}
