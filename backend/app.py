from __future__ import annotations

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

@app.after_request
def after_request(response):
    response.headers["Access-Control-Allow-Origin"]  = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return response


import os
import json
from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib
import numpy as np
import pandas as pd

# -----------------------------------------------------------------------------
# Paths
# -----------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent

MODEL_PATH_CANDIDATES = [
    BASE_DIR / "Model" / "model.pkl",
    BASE_DIR / "model" / "model.pkl",
    BASE_DIR / "Model" / "best_model.pkl",
    BASE_DIR / "model" / "best_model.pkl",
]

FRONTEND_DIR_CANDIDATES = [
    BASE_DIR / "Frontend",
    BASE_DIR / "frontend",
]

FEATURES_PATH_CANDIDATES = [
    BASE_DIR / "Model" / "feature_columns.json",
    BASE_DIR / "model" / "feature_columns.json",
]

# -----------------------------------------------------------------------------
# Feature columns
# 11 base features — received from the frontend form.
# 7 engineered features — computed by engineer_features() before prediction.
# Together these form the 18-feature vector the retrained model expects.
# -----------------------------------------------------------------------------
BASE_FEATURE_COLUMNS = [
    "profile_pic",
    "nums_length_username",
    "fullname_words",
    "nums_length_fullname",
    "name==username",
    "description_length",
    "external_url",
    "private",
    "num_posts",
    "num_followers",
    "num_follows",
]

ENGINEERED_FEATURE_COLUMNS = [
    "follower_follow_ratio",
    "posts_per_follower",
    "follow_aggressiveness",
    "profile_completeness",
    "username_suspicion",
    "name_authenticity",
    "activity_score",
]

ALL_FEATURE_COLUMNS = BASE_FEATURE_COLUMNS + ENGINEERED_FEATURE_COLUMNS

# -----------------------------------------------------------------------------
# Load model
# -----------------------------------------------------------------------------
def _first_existing_path(paths: List[Path]) -> Optional[Path]:
    for p in paths:
        if p.exists():
            return p
    return None


MODEL_PATH    = _first_existing_path(MODEL_PATH_CANDIDATES)
FRONTEND_DIR  = _first_existing_path(FRONTEND_DIR_CANDIDATES)
FEATURES_PATH = _first_existing_path(FEATURES_PATH_CANDIDATES)

if MODEL_PATH is None:
    raise FileNotFoundError("Could not find model.pkl or best_model.pkl.")

model = joblib.load(MODEL_PATH)

# Determine expected feature columns from model metadata if available
EXPECTED_FEATURE_COLUMNS: List[str] = []
if hasattr(model, "feature_names_in_"):
    EXPECTED_FEATURE_COLUMNS = list(model.feature_names_in_)
elif FEATURES_PATH is not None:
    try:
        with open(FEATURES_PATH, "r") as f:
            EXPECTED_FEATURE_COLUMNS = json.load(f)
    except Exception:
        pass

if not EXPECTED_FEATURE_COLUMNS:
    EXPECTED_FEATURE_COLUMNS = ALL_FEATURE_COLUMNS

MODEL_CLASSES = list(getattr(model, "classes_", [0, 1]))


# -----------------------------------------------------------------------------
# Feature engineering
# Mirrors the JS buildPayload() computation exactly.
# Must be called AFTER column renaming and numeric coercion,
# but BEFORE reindexing to EXPECTED_FEATURE_COLUMNS.
# -----------------------------------------------------------------------------
def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    followers = df.get("num_followers", pd.Series(0, index=df.index)).fillna(0)
    following = df.get("num_follows",   pd.Series(0, index=df.index)).fillna(0)
    posts     = df.get("num_posts",     pd.Series(0, index=df.index)).fillna(0)
    has_pic   = df.get("profile_pic",   pd.Series(0, index=df.index)).fillna(0)
    bio_len   = df.get("description_length", pd.Series(0, index=df.index)).fillna(0)
    has_url   = df.get("external_url",  pd.Series(0, index=df.index)).fillna(0)
    fn_words  = df.get("fullname_words", pd.Series(0, index=df.index)).fillna(0)
    num_ratio = df.get("nums_length_username", pd.Series(0, index=df.index)).fillna(0)
    name_eq   = df.get("name==username", pd.Series(0, index=df.index)).fillna(0)

    df["follower_follow_ratio"]  = followers / (following + 1)
    df["posts_per_follower"]     = posts     / (followers + 1)
    df["follow_aggressiveness"]  = following / (followers + posts + 1)
    df["profile_completeness"]   = (
        has_pic.astype(int) +
        (bio_len > 0).astype(int) +
        has_url.astype(int) +
        (fn_words > 0).astype(int)
    )
    df["username_suspicion"]     = num_ratio * (1 - has_pic)
    df["name_authenticity"]      = fn_words  * (1 - name_eq)
    df["activity_score"]         = np.log1p(posts) + np.log1p(followers)

    return df


# -----------------------------------------------------------------------------
# Preprocessing
# -----------------------------------------------------------------------------
def preprocess_input(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    # Drop private frontend-only keys (prefixed with _)
    df = df[[c for c in df.columns if not str(c).startswith('_')]]

    # Normalise column names to match training convention
    df.columns = (
        df.columns
        .str.strip()
        .str.replace(" ", "_",  regex=False)
        .str.replace("/", "_",  regex=False)
        .str.replace("#", "num_", regex=False)
        .str.lower()
    )

    # Coerce boolean-like strings to 0/1
    replace_map = {"Yes": 1, "No": 0, "True": 1, "False": 0, True: 1, False: 0}
    df = df.replace(replace_map)
    df = pd.get_dummies(df)
    df = df.apply(pd.to_numeric, errors="coerce").fillna(0)

    # Add the 7 engineered features before reindexing
    df = engineer_features(df)

    # Reindex to exactly the feature set the model was trained on
    df = df.reindex(columns=EXPECTED_FEATURE_COLUMNS, fill_value=0)

    return df


# -----------------------------------------------------------------------------
# Prediction
# -----------------------------------------------------------------------------
def predict_rows(df: pd.DataFrame, raw_data_list: List[Dict]) -> List[Dict[str, Any]]:
    processed = preprocess_input(df)
    probas    = model.predict_proba(processed)
    results   = []

    for i in range(len(processed)):
        fake_prob = float(probas[i][1])
        real_prob = float(probas[i][0])
        final_pred = 1 if fake_prob >= 0.5 else 0
        level = "High" if fake_prob >= 0.8 else "Medium" if fake_prob >= 0.6 else "Low"

        results.append({
            "prediction": final_pred,
            "label": "Fake Account" if final_pred == 1 else "Real Account",
            "confidence": {
                "score":      round(fake_prob if final_pred == 1 else real_prob, 4),
                "percentage": round((fake_prob if final_pred == 1 else real_prob) * 100, 2),
                "level":      level,
                "color":      "danger" if final_pred == 1 else "success",
            },
            "probabilities": {
                "real": round(real_prob, 4),
                "fake": round(fake_prob, 4),
            },
        })

    return results


# -----------------------------------------------------------------------------
# Routes
# -----------------------------------------------------------------------------
@app.route("/", methods=["GET"])
def home():
    if FRONTEND_DIR:
        return send_from_directory(FRONTEND_DIR, "index.html")
    return jsonify({"message": "Backend running"})


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "success":      True,
        "status":       "running",
        "model_loaded": True,
        "model_path":   str(MODEL_PATH),
        "features":     EXPECTED_FEATURE_COLUMNS,
    })


@app.route("/predict", methods=["POST"])
def predict():
    try:
        payload = request.get_json()
        raw_list = payload if isinstance(payload, list) else [payload]
        raw_df   = pd.DataFrame(raw_list)
        results  = predict_rows(raw_df, raw_list)

        if isinstance(payload, list):
            return jsonify({"success": True, "results": results})
        return jsonify({"success": True, "result": results[0]})

    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 400


@app.route("/predict-file", methods=["POST"])
def predict_file():
    try:
        if "file" not in request.files:
            return jsonify({"success": False, "error": "No file uploaded. Send the file under the key 'file'."}), 400

        file     = request.files["file"]
        filename = file.filename.lower()

        if filename.endswith(".csv"):
            raw_df = pd.read_csv(file)
        elif filename.endswith(".json"):
            raw_df = pd.read_json(file)
        else:
            return jsonify({"success": False, "error": "Unsupported file type. Please upload .csv or .json."}), 400

        if raw_df.empty:
            return jsonify({"success": False, "error": "The uploaded file is empty."}), 400

        raw_list = raw_df.to_dict(orient="records")
        results  = predict_rows(raw_df, raw_list)

        total      = len(results)
        fake_count = sum(1 for r in results if r["prediction"] == 1)
        real_count = total - fake_count
        avg_conf   = sum(r["confidence"]["score"] for r in results) / total

        predictions = [{**r, "row": i + 1, "raw_input": raw_list[i]} for i, r in enumerate(results)]

        return jsonify({
            "success": True,
            "summary": {
                "total":              total,
                "fake":               fake_count,
                "real":               real_count,
                "average_confidence": round(avg_conf, 4),
            },
            "predictions": predictions,
        })

    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 400


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
