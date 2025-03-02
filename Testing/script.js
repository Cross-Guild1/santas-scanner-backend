import http from 'k6/http';
import { sleep, check } from 'k6';
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";

const config = JSON.parse(open('./config.json'));

const env = __ENV.ENVIRONMENT || 'dev';
const baseUrl = config.environments[env].baseUrl;

export const options = {
  stages: config.stages,
  thresholds: config.thresholds,
  vus: 10
};

// Main test function
export default function() {
  // Add retry logic for resilience
  let attempts = 0;
  const maxAttempts = 3;
  let success = false;
  
  while (!success && attempts < maxAttempts) {
    try {
      attempts++;
      console.log(`Attempt ${attempts}/${maxAttempts}`);
      
      // Test the /questions endpoint
      const questionsResponse = http.get(`${baseUrl}/questions`);
      check(questionsResponse, {
        'questions status is 200': (r) => r.status === 200,
        'questions response has data': (r) => r.json().length > 0,
      });
      
      // Test the /leaderboard endpoint
      const leaderboardResponse = http.get(`${baseUrl}/leaderboard`);
      check(leaderboardResponse, {
        'leaderboard status is 200': (r) => r.status === 200,
      });
      
      // Test the /country endpoint
      const countryResponse = http.get(`${baseUrl}/country`);
      check(countryResponse, {
        'country status is 200': (r) => r.status === 200,
        'country response has country code': (r) => r.json().hasOwnProperty('countryCode'),
      });
      
      // Test the /scan-results endpoint with POST
      const payload = JSON.stringify({
        name: 'Test User',
        verdict: 'NICE',
        message: 'This is a test',
        score: Math.floor(Math.random() * 100),
        country: 'DE'
      });
      
      const params = {
        headers: {
          'Content-Type': 'application/json',
        },
      };
      
      const scanResponse = http.post(`${baseUrl}/scan-results`, payload, params);
      check(scanResponse, {
        'scan-results status is 201': (r) => r.status === 201,
        'scan-results response has name': (r) => r.json().name === 'Test User',
      });
      
      // If we get here without errors, we succeeded
      success = true;
      
    } catch (error) {
      if (attempts >= maxAttempts) {
        console.log(`Failed after ${attempts} attempts: ${error}`);
      } else {
        console.log(`Retrying... (${attempts}/${maxAttempts}): ${error}`);
        sleep(2);
      }
    }
  }
  
  // Add a sleep to prevent overwhelming the server
  sleep(1);
}

// Generate HTML report after test
export function handleSummary(data) {
  return {
    "santa-backend-report.html": htmlReport(data),
  };
}