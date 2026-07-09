import axios from 'axios';

// Entirely separate axios instance/token from the Cafe app's `api` client —
// a Study session must never be usable against Cafe endpoints or vice versa.
export const STUDY_TOKEN_KEY = 'study_token';

export const studyApi = axios.create({ baseURL: '/api/study' });

studyApi.interceptors.request.use((cfg) => {
  const token = localStorage.getItem(STUDY_TOKEN_KEY);
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

let onStudyUnauthorized: (() => void) | null = null;
export function setStudyUnauthorizedHandler(handler: () => void) {
  onStudyUnauthorized = handler;
}

studyApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      onStudyUnauthorized?.();
    }
    return Promise.reject(err);
  },
);
