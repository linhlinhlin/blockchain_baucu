import axios from 'axios';

const publicApiClient = axios.create({
  baseURL:
    import.meta.env.VITE_API_BASE_URL ??
    'https://webapplication320250413035557-eebmacambhenb2ha.australiacentral-01.azurewebsites.net/',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: '*/*',
  },
});

export default publicApiClient;
