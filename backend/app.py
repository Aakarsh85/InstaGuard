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

# Feature columns — must match post-transformation names from training
NEW_FEATURE_COLUMNS = [
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

# -----------------------------------------------------------------------------
# Load model
# -----------------------------------------------------------------------------
def _first_existing_path(paths: List[Path]) -> Optional[Path]:
    for path in paths:
        if path.exists():
            return path
    return None


MODEL_PATH    = _first_existing_path(MODEL_PATH_CANDIDATES)
FRONTEND_DIR  = _first_existing_path(FRONTEND_DIR_CANDIDATES)
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

if not EXPECTED_FEATURE_COLUMNS:
    EXPECTED_FEATURE_COLUMNS = NEW_FEATURE_COLUMNS

MODEL_CLASSES = list(getattr(model, "classes_", [0, 1]))


# -----------------------------------------------------------------------------
# Preprocessing
# -----------------------------------------------------------------------------
def preprocess_input(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    # Match exact column renaming used during model training
    df.columns = (
        df.columns
        .str.strip()
        .str.replace(" ", "_", regex=False)
        .str.replace("/", "_", regex=False)
        .str.replace("#", "num_", regex=False)
        .str.lower()
    )

    replace_map = {"Yes": 1, "No": 0, "True": 1, "False": 0, True: 1, False: 0}
    df = df.replace(replace_map)

    df = pd.get_dummies(df)
    df = df.apply(pd.to_numeric, errors="coerce").fillna(0)

    if EXPECTED_FEATURE_COLUMNS:
        df = df.reindex(columns=EXPECTED_FEATURE_COLUMNS, fill_value=0)

    return df


# -----------------------------------------------------------------------------
# Pure ML prediction — model output only, no rules or weightage
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
                "color":      "danger" if final_pred == 1 else "success"
            },
            "probabilities": {
                "real": round(real_prob, 4),
                "fake": round(fake_prob, 4)
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
        "success":      True,
        "status":       "running",
        "model_loaded": True,
        "model_path":   str(MODEL_PATH),
        "features":     EXPECTED_FEATURE_COLUMNS
    })


@app.route("/predict", methods=["POST"])
def predict():
    try:
        payload = request.get_json()

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
        return jsonify({"success": False, "error": str(exc)}), 400


# -----------------------------------------------------------------------------
# File upload — bulk predict from CSV or JSON file
# -----------------------------------------------------------------------------
@app.route("/predict-file", methods=["POST"])
def predict_file():
    try:
        if "file" not in request.files:
            return jsonify({"success": False, "error": "No file uploaded. Send the file under the key 'file'."}), 400

        file     = request.files["file"]
        filename = file.filename.lower()

        # Read into DataFrame depending on file type
        if filename.endswith(".csv"):
            raw_df = pd.read_csv(file)
        elif filename.endswith(".json"):
            raw_df = pd.read_json(file)
        else:
            return jsonify({"success": False, "error": "Unsupported file type. Please upload a .csv or .json file."}), 400

        if raw_df.empty:
            return jsonify({"success": False, "error": "The uploaded file is empty."}), 400

        raw_list = raw_df.to_dict(orient="records")
        results  = predict_rows(raw_df, raw_list)

        # Summary stats
        total      = len(results)
        fake_count = sum(1 for r in results if r["prediction"] == 1)
        real_count = total - fake_count
        avg_conf   = sum(r["confidence"]["score"] for r in results) / total

        # Attach row number to each result for the frontend table
        predictions = [{**r, "row": i + 1} for i, r in enumerate(results)]

        return jsonify({
            "success": True,
            "summary": {
                "total":              total,
                "fake":               fake_count,
                "real":               real_count,
                "average_confidence": round(avg_conf, 4)
            },
            "predictions": predictions
        })

    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 400


# -----------------------------------------------------------------------------
# MAIN
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)