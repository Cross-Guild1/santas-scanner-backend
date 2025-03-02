export interface Question {
  id: number;
  text: string;
  options: {
    text: string;
    naughtyPoints: number;
  }[];
}

export interface ScanResult {
  name: string;
  verdict: 'NAUGHTY' | 'NICE';
  message: string;
  score: number;
}