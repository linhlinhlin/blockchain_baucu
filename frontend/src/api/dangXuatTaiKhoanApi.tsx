import apiClient from './apiClient';

export const dangXuat = async (): Promise<{ message: string }> => {
  const response = await apiClient.post('/api/tai-khoan/logout');
  return response.data;
};
