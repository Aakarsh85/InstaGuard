#C:\Users\acer\Desktop\pj\Final Year Project\backend\app.py
from __future__ import annotations

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__)

CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

@app.after_request
def after_request(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
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
    BASE_DIR / "Model" / "model.pkl",       # New model filename
    BASE_DIR / "model" / "model.pkl",
    BASE_DIR / "Model" / "best_model.pkl",  # Fallback to old name
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

# New dataset feature columns (in exact order from training)
NEW_FEATURE_COLUMNS = [
    "profile pic",
    "nums/length username",
    "fullname words",
    "nums/length fullname",
    "name==username",
    "description length",
    "external URL",
    "private",
    "#posts",
    "#followers",
    "#follows",
]

# -----------------------------------------------------------------------------
# Load model
# -----------------------------------------------------------------------------
def _first_existing_path(paths: List[Path]) -> Optional[Path]:
    for path in paths:
        if path.exists():
            return path
    return None


MODEL_PATH = _first_existing_path(MODEL_PATH_CANDIDATES)
FRONTEND_DIR = _first_existing_path(FRONTEND_DIR_CANDIDATES)
FEATURES_PATH = _first_existing_path(FEATURES_PATH_CANDIDATES)

if MODEL_PATH is None:
    raise FileNotFoundError("Could not find model.pkl or best_model.pkl.")

model = joblib.load(MODEL_PATH)

EXPECTED_FEATURE_COLUMNS: List[str] = []
if hasattr(model, "feature_names_in_"):
    EXPECTED_FEATURE_COLUMNS = list(model.feature_names_in_)
elif FEATURES_PATH is not None:
    try:
        with open(FEATURES_PATH, "r") as f:
            EXPECTED_FEATURE_COLUMNS = json.load(f)
    except:
        pass

# Fall back to new feature columns if nothing else found
if not EXPECTED_FEATURE_COLUMNS:
    EXPECTED_FEATURE_COLUMNS = NEW_FEATURE_COLUMNS

MODEL_CLASSES = list(getattr(model, "classes_", [0, 1]))


# -----------------------------------------------------------------------------
# Rule Engine
# Each rule returns a score between -1.0 (strongly real) and +1.0 (strongly fake)
# Negative = evidence of real account
# Positive = evidence of fake account
# -----------------------------------------------------------------------------
def run_rule_engine(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Evaluates hand-crafted rules on the profile data.
    Returns a combined rule score (0 to 1) and a breakdown of which rules fired.
    """

    followers    = float(data.get("#followers", 0))
    following    = float(data.get("#follows", 0))
    posts        = float(data.get("#posts", 0))
    has_pic      = float(data.get("profile pic", 0))
    bio_len      = float(data.get("description length", 0))
    num_ratio    = float(data.get("nums/length username", 0))
    has_url      = float(data.get("external URL", 0))
    is_private   = float(data.get("private", 0))

    rules_fired = []
    total_weight = 0.0
    weighted_score = 0.0

    # --- STRONG FAKE signals ---

    # No profile picture — very strong fake signal
    if has_pic == 0:
        rules_fired.append({"rule": "No profile picture", "signal": "fake", "weight": 0.6})
        weighted_score += 0.6
        total_weight += 0.6

    # Mass following with few followers (ratio > 1:10 and followers > 250)
    if followers > 250 and following > (followers * 10):
        rules_fired.append({"rule": "Following >> Followers (bot pattern)", "signal": "fake", "weight": 0.8})
        weighted_score += 0.8
        total_weight += 0.8

    # Zero posts
    if posts == 0:
        rules_fired.append({"rule": "Zero posts", "signal": "fake", "weight": 0.7})
        weighted_score += 0.7
        total_weight += 0.7

    # Very short or empty bio
    if bio_len < 5:
        rules_fired.append({"rule": "Empty/very short bio", "signal": "fake", "weight": 0.4})
        weighted_score += 0.4
        total_weight += 0.4

    # High number ratio in username (e.g. user293847)
    if num_ratio > 0.3:
        rules_fired.append({"rule": "Username has >30% numbers", "signal": "fake", "weight": 0.5})
        weighted_score += 0.5
        total_weight += 0.5

    # Following more than 5000 people (mass follow bot)
    if following > 5000:
        rules_fired.append({"rule": "Following >5000 accounts", "signal": "fake", "weight": 0.6})
        weighted_score += 0.6
        total_weight += 0.6

    # Private account with very few followers (abandoned/fake)
    if is_private == 1 and followers < 50:
        rules_fired.append({"rule": "Private + <50 followers", "signal": "fake", "weight": 0.3})
        weighted_score += 0.3
        total_weight += 0.3

    # --- STRONG REAL signals ---

    # Large follower count — very hard to fake at scale
    if followers > 50000:
        rules_fired.append({"rule": "Followers >50k", "signal": "real", "weight": 0.8})
        weighted_score -= 0.8
        total_weight += 0.8

    # Has external URL and decent following (influencer/business pattern)
    if has_url == 1 and followers > 1000:
        rules_fired.append({"rule": "Has URL + >1000 followers", "signal": "real", "weight": 0.4})
        weighted_score -= 0.4
        total_weight += 0.4

    # Healthy follower to following ratio (real people tend to follow < 2x followers)
    if followers > 100 and following < (followers * 2):
        rules_fired.append({"rule": "Healthy follower/following ratio", "signal": "real", "weight": 0.3})
        weighted_score -= 0.3
        total_weight += 0.3

    # Normalize to 0–1 range
    if total_weight == 0:
        rule_score = 0.5  # No rules fired → neutral
    else:
        # weighted_score is in range [-total_weight, +total_weight]
        # Map to [0, 1]
        rule_score = (weighted_score / total_weight + 1) / 2

    rule_score = float(np.clip(rule_score, 0.0, 1.0))

    return {
        "rule_score": round(rule_score, 4),
        "rules_fired": rules_fired,
        "total_rules_fired": len(rules_fired)
    }


# -----------------------------------------------------------------------------
# Preprocessing
# -----------------------------------------------------------------------------
def preprocess_input(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    # Normalize column names to match training data
    df.columns = (
        df.columns
        .str.strip()
    )

    replace_map = {"Yes": 1, "No": 0, "True": 1, "False": 0, True: 1, False: 0}
    df = df.replace(replace_map)

    df = pd.get_dummies(df)
    df = df.apply(pd.to_numeric, errors="coerce").fillna(0)

    if EXPECTED_FEATURE_COLUMNS:
        df = df.reindex(columns=EXPECTED_FEATURE_COLUMNS, fill_value=0)

    return df


# -----------------------------------------------------------------------------
# Hybrid prediction: ML model + Rule engine combined
# Weight split: 60% ML, 40% Rules
# -----------------------------------------------------------------------------
ML_WEIGHT   = 0.6
RULE_WEIGHT = 0.4

def predict_rows(df: pd.DataFrame, raw_data_list: List[Dict]) -> List[Dict[str, Any]]:
    processed = preprocess_input(df)

    preds  = model.predict(processed)
    probas = model.predict_proba(processed)

    results = []

    for i in range(len(processed)):
        ml_fake_prob = float(probas[i][1])
        ml_real_prob = float(probas[i][0])

        # Run rule engine on original raw data
        rule_result  = run_rule_engine(raw_data_list[i])
        rule_score   = rule_result["rule_score"]  # 0=real, 1=fake

        # Combine ML probability + rule score
        hybrid_fake_score = (ML_WEIGHT * ml_fake_prob) + (RULE_WEIGHT * rule_score)
        hybrid_fake_score = float(np.clip(hybrid_fake_score, 0.0, 1.0))
        hybrid_real_score = 1.0 - hybrid_fake_score

        # Final prediction based on hybrid score
        final_pred = 1 if hybrid_fake_score >= 0.5 else 0

        level = "High" if hybrid_fake_score >= 0.8 else "Medium" if hybrid_fake_score >= 0.6 else "Low"

        results.append({
            "prediction": final_pred,
            "label": "Fake Account" if final_pred == 1 else "Real Account",
            "confidence": {
                "score": round(hybrid_fake_score if final_pred == 1 else hybrid_real_score, 4),
                "percentage": round((hybrid_fake_score if final_pred == 1 else hybrid_real_score) * 100, 2),
                "level": level,
                "color": "danger" if final_pred == 1 else "success"
            },
            "probabilities": {
                "real": round(hybrid_real_score, 4),
                "fake": round(hybrid_fake_score, 4)
            },
            # Breakdown for transparency
            "breakdown": {
                "ml": {
                    "fake_probability": round(ml_fake_prob, 4),
                    "real_probability": round(ml_real_prob, 4),
                    "weight": ML_WEIGHT
                },
                "rules": {
                    "score": rule_result["rule_score"],
                    "weight": RULE_WEIGHT,
                    "rules_fired": rule_result["rules_fired"],
                    "total_rules_fired": rule_result["total_rules_fired"]
                }
            }
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
        "success": True,
        "status": "running",
        "model_loaded": True,
        "model_path": str(MODEL_PATH),
        "features": EXPECTED_FEATURE_COLUMNS
    })


@app.route("/predict", methods=["POST"])
def predict():
    try:
        payload = request.get_json()

        # Accept both single object and list
        if isinstance(payload, list):
            raw_list = payload
        else:
            raw_list = [payload]

        raw_df  = pd.DataFrame(raw_list)
        results = predict_rows(raw_df, raw_list)

        if isinstance(payload, list):
            return jsonify({"success": True, "results": results})
        else:
            return jsonify({"success": True, "result": results[0]})

    except Exception as exc:
        return jsonify({
            "success": False,
            "error": str(exc)
        }), 400


# -----------------------------------------------------------------------------
# MAIN
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
