from flask import Flask, render_template, jsonify, request, send_file
import edge_tts
import asyncio
import io
import json
import os
import requests as http_requests
import firebase_admin
from firebase_admin import credentials, firestore
from words import EASY_WORDS, MEDIUM_WORDS, HARD_WORDS, PHRASE_WORDS, WORD_IMAGES

app = Flask(__name__)

# Initialize Firebase
firebase_creds = os.environ.get("FIREBASE_CREDENTIALS")
if firebase_creds:
    cred_dict = json.loads(firebase_creds)
    cred = credentials.Certificate(cred_dict)
else:
    # Local development: use the JSON file
    cred_path = os.path.join(os.path.dirname(__file__), "firebase-key.json")
    cred = credentials.Certificate(cred_path)

firebase_admin.initialize_app(cred)
db = firestore.client()

VOICE_NORMAL = "en-US-JennyNeural"
VOICE_SLOW = "en-US-JennyNeural"

image_cache = {}
WIKI_HEADERS = {"User-Agent": "SpellingBeeApp/1.0 (educational; contact@example.com)"}


def run_async(coro):
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                return pool.submit(asyncio.run, coro).result()
        return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)


async def generate_speech(text, voice, rate="+0%"):
    communicate = edge_tts.Communicate(text, voice, rate=rate)
    audio = io.BytesIO()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio.write(chunk["data"])
    audio.seek(0)
    return audio


def fetch_image_url(word):
    lookup = word.split()[0] if " " in word else word
    if lookup in image_cache:
        return image_cache[lookup]
    try:
        url = "https://en.wikipedia.org/api/rest_v1/page/summary/" + lookup
        resp = http_requests.get(url, headers=WIKI_HEADERS, timeout=4)
        if resp.status_code == 200:
            data = resp.json()
            thumb = data.get("thumbnail", {}).get("source")
            if thumb:
                image_cache[lookup] = thumb
                return thumb
    except Exception:
        pass
    image_cache[lookup] = None
    return None


def load_leaderboard():
    board = {"easy": [], "medium": [], "hard": []}
    try:
        for diff in board:
            docs = db.collection("leaderboard").document(diff).collection("entries") \
                .order_by("score", direction=firestore.Query.DESCENDING).limit(15).stream()
            board[diff] = [doc.to_dict() for doc in docs]
    except Exception:
        pass
    return board


def save_leaderboard_entry(difficulty, entry):
    try:
        db.collection("leaderboard").document(difficulty).collection("entries").add(entry)
    except Exception:
        pass


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/words")
def get_words():
    difficulty = request.args.get("difficulty", "easy")
    if difficulty == "hard":
        words = HARD_WORDS + PHRASE_WORDS
    elif difficulty == "medium":
        words = MEDIUM_WORDS
    else:
        words = EASY_WORDS
    return jsonify({"words": words})


@app.route("/image/<path:word>")
def get_image(word):
    w = word.lower()
    emoji = WORD_IMAGES.get(w)
    if emoji:
        return jsonify({"emoji": emoji})
    img_url = fetch_image_url(w)
    if img_url:
        return jsonify({"url": img_url})
    return jsonify({"emoji": "📝"})


@app.route("/speak/<path:word>")
def speak(word):
    audio = run_async(generate_speech(word, VOICE_NORMAL, rate="+0%"))
    return send_file(audio, mimetype="audio/mpeg")


@app.route("/speak_slow/<path:word>")
def speak_slow(word):
    audio = run_async(generate_speech(word, VOICE_SLOW, rate="-30%"))
    return send_file(audio, mimetype="audio/mpeg")


@app.route("/leaderboard", methods=["GET"])
def get_leaderboard():
    return jsonify(load_leaderboard())


@app.route("/leaderboard", methods=["POST"])
def post_leaderboard():
    data = request.get_json(force=True)
    name = str(data.get("name", "")).strip()[:20]
    score = int(data.get("score", 0))
    difficulty = str(data.get("difficulty", "easy"))
    streak = int(data.get("streak", 0))

    if not name or score < 0 or difficulty not in ("easy", "medium", "hard"):
        return jsonify({"ok": False}), 400

    entry = {"name": name, "score": score, "streak": streak}
    save_leaderboard_entry(difficulty, entry)

    # Reload the board to return updated rankings
    board = load_leaderboard()
    return jsonify({"ok": True, "board": board[difficulty]})


if __name__ == "__main__":
    app.run(debug=True)

