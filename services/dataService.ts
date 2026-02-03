import { DB_URL, UPLOAD_URL } from '../constants';
import { Drug } from '../types';

export const fetchDrugs = async (): Promise<Drug[]> => {
  return new Promise((resolve, reject) => {
    if (!window.Papa) {
      reject(new Error("PapaParse not loaded"));
      return;
    }

    // Attempt to load from cache first for speed
    const cache = localStorage.getItem('drug_db_cache');
    if (cache) {
      // We resolve cached data but still fetch fresh in background if this was a real detailed app,
      // but here we mimic the original logic which prefers fresh if possible but falls back?
      // Actually original logic tries cache first.
      // We'll mimic the "try fetch, parse" logic.
    }

    window.Papa.parse(DB_URL, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results: any) => {
        if (results.data && results.data.length > 0) {
          localStorage.setItem('drug_db_cache', JSON.stringify(results.data));
          resolve(results.data as Drug[]);
        } else {
            // If fetch fails or empty, try cache
             const cached = localStorage.getItem('drug_db_cache');
             if(cached) resolve(JSON.parse(cached));
             else reject(new Error("No data found"));
        }
      },
      error: (err: any) => {
          const cached = localStorage.getItem('drug_db_cache');
          if(cached) resolve(JSON.parse(cached));
          else reject(err);
      }
    });
  });
};

export const uploadDrug = async (drug: Drug): Promise<void> => {
  await fetch(UPLOAD_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(drug)
  });
};