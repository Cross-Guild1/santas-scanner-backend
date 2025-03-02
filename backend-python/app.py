from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient
from datetime import datetime
import os
import requests

app = Flask(__name__)
CORS(app)

# Questions data
questions = [
    {
        "id": 1,
        "text": "Have you ever stolen a cookie before dinner?",
        "options": [
            {"text": "Never! I always ask permission", "naughtyPoints": 0},
            {"text": "Only when they smell irresistible", "naughtyPoints": 5},
            {"text": "I'm a serial cookie thief!", "naughtyPoints": 10}
        ]
    },
    {
        "id": 2,
        "text": "Would you rather give or keep all the presents?",
        "options": [
            {"text": "Give them all away!", "naughtyPoints": 0},
            {"text": "Keep a few special ones", "naughtyPoints": 5},
            {"text": "Mine! All mine!", "naughtyPoints": 10}
        ]
    },
    {
        "id": 3,
        "text": "How many snowballs have you thrown at innocent victims?",
        "options": [
            {"text": "Zero - I'm an angel", "naughtyPoints": 0},
            {"text": "Just a few... they deserved it", "naughtyPoints": 5},
            {"text": "I've lost count!", "naughtyPoints": 10}
        ]
    },
    {
        "id": 4,
        "text": "What do you leave for Santa on Christmas Eve?",
        "options": [
            {"text": "Cookies, milk, and carrots for the reindeer", "naughtyPoints": 0},
            {"text": "Whatever's left in the fridge", "naughtyPoints": 5},
            {"text": "A note saying 'Better luck next house!'", "naughtyPoints": 10}
        ]
    }
]

# Mock data for when DB is not available
mock_leaderboard = [
    {
        "name": "Test User 1",
        "verdict": "NICE",
        "message": "Very kind and helpful",
        "score": 95,
        "country": "DE",
        "timestamp": datetime.now().isoformat()
    },
    {
        "name": "Test User 2",
        "verdict": "NAUGHTY",
        "message": "Needs to improve behavior",
        "score": 45,
        "country": "DE",
        "timestamp": datetime.now().isoformat()
    }
]

# Database connection


def connect_to_db():
    try:
        mongo_uri = os.environ.get(
            'MONGODB_URI', 'mongodb+srv://philippkhachik:root@dev.42htl.mongodb.net/?retryWrites=true&w=majority&appName=dev')
        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
        client.server_info()  # Will raise an exception if cannot connect
        db = client.santasscanner
        return db, True
    except Exception as e:
        print(f"MongoDB connection error: {e}")
        return None, False

# Routes


@app.route('/questions', methods=['GET'])
def get_questions():
    return jsonify(questions)


@app.route('/leaderboard', methods=['GET'])
def get_leaderboard():
    db, connected = connect_to_db()
    if connected:
        try:
            print("Fetching leaderboard from database...")
            results = list(db.scanResults.find().sort("score", -1).limit(100))
            # Convert ObjectId to string for JSON serialization
            for result in results:
                result["_id"] = str(result["_id"])
            print(f"Found {len(results)} results")
            return jsonify(results)
        except Exception as e:
            print(f"Leaderboard error: {e}")

    # Fallback to mock data
    print("Using mock leaderboard data")
    return jsonify(mock_leaderboard)


@app.route('/country', methods=['GET'])
def get_country():
    try:
        ip = request.remote_addr
        response = requests.get(
            f"http://ip-api.com/json/{ip}?fields=status,countryCode")
        data = response.json()
        return jsonify({
            "countryCode": data["countryCode"] if data["status"] == "success" else "XX"
        })
    except Exception as e:
        print(f"Country error: {e}")
        return jsonify({"countryCode": "XX"})


@app.route('/scan-results', methods=['POST'])
def post_scan_results():
    data = request.json
    db, connected = connect_to_db()

    # Validate required fields
    required_fields = ['name', 'verdict', 'message', 'score']
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"Missing {field} field"}), 400

    # Ensure score is within bounds
    data['score'] = min(100, max(0, data['score']))
    data['timestamp'] = datetime.now()

    if connected:
        try:
            result = db.scanResults.insert_one(data)
            data['_id'] = str(result.inserted_id)
            return jsonify(data), 201
        except Exception as e:
            print(f"Scan result error: {e}")

    # Mock response if DB insert fails
    return jsonify({
        **data,
        "_id": f"mock-id-{datetime.now().timestamp()}",
        "timestamp": datetime.now().isoformat()
    }), 201


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
