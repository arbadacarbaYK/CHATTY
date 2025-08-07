import axios from 'axios';
import { config } from '../config/appConfig';

export interface KnowledgeLink {
  id?: number;
  url: string;
  status: 'pending' | 'crawling' | 'crawled' | 'error';
  tags: string[];
  errorMsg?: string;
  content?: string;
  updatedAt?: string;
}

// Get backend URL with proper fallbacks
const getBackendUrl = (): string => {
  const isDev = import.meta.env.DEV;
  const envBackendUrl = import.meta.env.VITE_BACKEND_URL;
  
  if (envBackendUrl) {
    return envBackendUrl;
  }
  
  if (isDev) {
    return '/knowledge'; // Use Vite proxy in development
  } else {
    return 'http://localhost:3000/knowledge'; // Default for production
  }
};

const BASE_URL = getBackendUrl();

export async function getAllKnowledge(): Promise<KnowledgeLink[]> {
  const res = await axios.get(`${BASE_URL}/all`);
  return (res.data.knowledge || []).map((row: any) => ({
    id: row.id,
    url: row.url,
    status: row.status,
    tags: row.tags ? JSON.parse(row.tags) : [],
    errorMsg: row.errorMsg,
    content: row.content,
    updatedAt: row.updatedAt,
  }));
}

export async function addLink(url: string): Promise<void> {
  await axios.post(`${BASE_URL}/add`, { url });
}

export const crawlLink = async (url: string): Promise<any> => {
  try {
    const response = await axios.post(`${BASE_URL}/crawl`, { url });
    return response.data;
  } catch (error: any) {
    // If the response contains an error message, throw it
    if (error.response?.data?.error) {
      throw new Error(error.response.data.error);
    }
    // Otherwise throw the original error
    throw error;
  }
};

export const removeLink = async (url: string): Promise<any> => {
  const response = await axios.delete(`${BASE_URL}/remove`, { data: { url } });
  return response.data;
};

export const searchKnowledge = async (query: string): Promise<KnowledgeLink[]> => {
  const response = await axios.get(`${BASE_URL}/search?q=${encodeURIComponent(query)}`);
  return (response.data.results || []).map((row: any) => ({
    id: row.id,
    url: row.url,
    status: row.status,
    tags: row.tags ? JSON.parse(row.tags) : [],
    errorMsg: row.errorMsg,
    content: row.content,
    updatedAt: row.updatedAt,
  }));
}; 