import { getRoleStorageItem } from './roleStorage';

export const getServers = () => {
  const savedServers = getRoleStorageItem('externalServers');
  return savedServers ? JSON.parse(savedServers) : [];
};
