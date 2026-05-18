import axios from 'axios';

function resolveApiBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configured) {
    return configured;
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === '127.0.0.1' || host === 'localhost') {
      return 'http://localhost:5293';
    }
  }

  return 'https://webapplication320250413035557-eebmacambhenb2ha.australiacentral-01.azurewebsites.net/';
}

const publicApiClient = axios.create({
  baseURL: resolveApiBaseUrl(),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: '*/*',
  },
});

export default publicApiClient;
