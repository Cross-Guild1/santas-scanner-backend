import http from 'k6/http';
import { sleep, check, group } from 'k6';
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";

export const options = {
  scenarios: {
    nodejs_express: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 10 },
        { duration: '20s', target: 50 },
        { duration: '20s', target: 50 },
        { duration: '10s', target: 0 },
      ],
      gracefulRampDown: '5s',
      tags: { backend: 'nodejs' },
      env: { BACKEND_URL: 'http://localhost:4000' },
    },
    python_flask: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 10 },
        { duration: '20s', target: 50 },
        { duration: '20s', target: 50 },
        { duration: '10s', target: 0 },
      ],
      gracefulRampDown: '5s',
      tags: { backend: 'python' },
      env: { BACKEND_URL: 'http://localhost:5000' },
    },
  },
  thresholds: {
    'http_req_duration{backend:nodejs}': ['p(95)<500'],
    'http_req_duration{backend:python}': ['p(95)<500'],
    'http_req_failed{backend:nodejs}': ['rate<0.1'],
    'http_req_failed{backend:python}': ['rate<0.1'],
  },
};

// Test setup
export function setup() {
  console.log('Setting up comparative test');
  // Check if both services are available
  const nodeCheck = http.get('http://localhost:4000/questions');
  const pythonCheck = http.get('http://localhost:5000/questions');
  
  console.log(`Node.js status: ${nodeCheck.status}`);
  console.log(`Python status: ${pythonCheck.status}`);
  
  return {};
}

// Main test function
export default function() {
  // Get the backend URL from the environment variable
  const baseUrl = __ENV.BACKEND_URL;
  const backend = baseUrl.includes('4000') ? 'NodeJS/Express' : 'Python/Flask';
  
  group(`Testing ${backend} Backend`, function() {
    // Add retry logic for resilience
    let attempts = 0;
    const maxAttempts = 3;
    let success = false;
    
    while (!success && attempts < maxAttempts) {
      try {
        attempts++;
        console.log(`${backend}: Attempt ${attempts}/${maxAttempts}`);
        
        // Test the questions endpoint
        const questionsResponse = http.get(`${baseUrl}/questions`);
        check(questionsResponse, {
          [`${backend} questions status is 200`]: (r) => r.status === 200,
          [`${backend} questions response has data`]: (r) => r.json().length > 0,
        });
        
        // Test the leaderboard endpoint
        const leaderboardResponse = http.get(`${baseUrl}/leaderboard`);
        check(leaderboardResponse, {
          [`${backend} leaderboard status is 200`]: (r) => r.status === 200,
        });
        
        // Test the country endpoint
        const countryResponse = http.get(`${baseUrl}/country`);
        check(countryResponse, {
          [`${backend} country status is 200`]: (r) => r.status === 200,
          [`${backend} country response has country code`]: (r) => r.json().hasOwnProperty('countryCode'),
        });
        
        // Test the scan-results endpoint with POST
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
          [`${backend} scan-results status is 201`]: (r) => r.status === 201,
          [`${backend} scan-results response has name`]: (r) => r.json().name === 'Test User',
        });
        
        // If we get here without errors, we succeeded
        success = true;
        
      } catch (error) {
        if (attempts >= maxAttempts) {
          console.log(`${backend}: Failed after ${attempts} attempts: ${error}`);
        } else {
          console.log(`${backend}: Retrying... (${attempts}/${maxAttempts}): ${error}`);
          sleep(2);
        }
      }
    }
  });
  
  // Add a sleep to prevent overwhelming the server
  sleep(1);
}

// Generate HTML report after test
export function handleSummary(data) {
  return {
    "comparative-backend-report.html": htmlReport(data),
  };
}