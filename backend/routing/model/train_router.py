"""XGBoost trainer for the routing decision. RUN THIS YOURSELF:

    python -m routing.model.train_router

Loads routing/model/training_data.csv, trains a 4-class softprob classifier, prints accuracy +
confusion matrix + feature importances, and saves routing/model/router_model.pkl.
"""
from __future__ import annotations

import sys

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, confusion_matrix
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier

from ..config import DECISIONS, MODEL_PATH, TRAINING_CSV
from .generate_training_data import FEATURE_COLUMNS, LABEL_COLUMN

# Map decision label <-> class index (stable order from config.DECISIONS).
LABEL_TO_IDX = {d: i for i, d in enumerate(DECISIONS)}


def main() -> None:
    if not TRAINING_CSV.exists():
        sys.exit(f"Training CSV not found: {TRAINING_CSV}\n"
                 f"Run first: python -m routing.model.generate_training_data")

    df = pd.read_csv(TRAINING_CSV)
    X = df[FEATURE_COLUMNS].to_numpy(dtype=float)
    y = df[LABEL_COLUMN].map(LABEL_TO_IDX).to_numpy()

    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    clf = XGBClassifier(
        objective="multi:softprob",
        num_class=len(DECISIONS),
        n_estimators=300,
        max_depth=6,
        learning_rate=0.12,
        subsample=0.9,
        colsample_bytree=0.9,
        eval_metric="mlogloss",
        random_state=42,
    )
    clf.fit(X_tr, y_tr)

    preds = clf.predict(X_te)
    acc = accuracy_score(y_te, preds)

    print("\n=== Router XGBoost — evaluation ===")
    print(f"test accuracy: {acc:.4f}")
    print("\nconfusion matrix (rows=true, cols=pred), label order:", DECISIONS)
    print(confusion_matrix(y_te, preds))

    print("\nfeature importances:")
    importances = clf.feature_importances_
    for name, imp in sorted(zip(FEATURE_COLUMNS, importances), key=lambda t: -t[1]):
        print(f"  {name:24s} {imp:.4f}")

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": clf, "features": FEATURE_COLUMNS, "decisions": DECISIONS}, MODEL_PATH)
    print(f"\nmodel saved -> {MODEL_PATH}")
    print(f"model saved, accuracy={acc:.4f}")


if __name__ == "__main__":
    main()
