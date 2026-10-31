import { useEffect, useState } from 'react';
import { getCreditorDirectory, subscribeCreditorDirectory, type CreditorDirectoryItem } from '../services/court/creditorAddressDirectory';

/** 공용 채권자 정보(서버) — 서버 목록이 들어오면 다시 그린다 (NF-5) */
export function useCreditorDirectory(): CreditorDirectoryItem[] {
  const [list, setList] = useState<CreditorDirectoryItem[]>(() => getCreditorDirectory());
  useEffect(() => subscribeCreditorDirectory(() => setList(getCreditorDirectory())), []);
  return list;
}
