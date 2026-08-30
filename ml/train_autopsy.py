"""
train_autopsy.py
================
Heavy NLP model: classify MANNER OF DEATH from free-text autopsy reports.

Architecture: TF-IDF (word + char n-grams) -> deep PyTorch MLP
(3 hidden layers, batch-norm, dropout). This is the heaviest genuine-ML
component of the suite — a neural network trained with early stopping.

Honest scope: trained on synthetic reports built from the app's forensic
vocabulary (see synth.py). Accuracy measures generalisation across paraphrases
of that vocabulary, not validated clinical accuracy.
"""

from __future__ import annotations

import argparse
import json
import os

import joblib
import numpy as np
import torch
import torch.nn as nn
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import accuracy_score, classification_report, f1_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder

from synth import build_autopsy_dataset

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


class AutopsyMLP(nn.Module):
    def __init__(self, in_dim: int, n_classes: int):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_dim, 512), nn.BatchNorm1d(512), nn.ReLU(), nn.Dropout(0.4),
            nn.Linear(512, 256), nn.BatchNorm1d(256), nn.ReLU(), nn.Dropout(0.3),
            nn.Linear(256, 128), nn.BatchNorm1d(128), nn.ReLU(), nn.Dropout(0.2),
            nn.Linear(128, n_classes),
        )

    def forward(self, x):
        return self.net(x)


def to_tensor(x):
    if hasattr(x, "toarray"):
        x = x.toarray()
    return torch.tensor(np.asarray(x, dtype=np.float32), device=DEVICE)


def main() -> None:
    parser = argparse.ArgumentParser(description="Train autopsy manner-of-death NLP model")
    parser.add_argument("--n", type=int, default=24000)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--epochs", type=int, default=60)
    parser.add_argument("--out-dir", type=str, default="ml/models")
    args = parser.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)
    torch.manual_seed(args.seed)

    print(f"Device: {DEVICE}")
    print("Generating synthetic autopsy corpus...")
    texts, labels = build_autopsy_dataset(args.n, args.seed)

    vectorizer = TfidfVectorizer(
        ngram_range=(1, 2), max_features=8000, sublinear_tf=True,
        analyzer="word", min_df=2,
    )
    X = vectorizer.fit_transform(texts)
    le = LabelEncoder()
    y = le.fit_transform(labels)

    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.2, random_state=args.seed, stratify=y
    )
    X_tr, X_val, y_tr, y_val = train_test_split(
        X_tr, y_tr, test_size=0.15, random_state=args.seed, stratify=y_tr
    )

    in_dim = X.shape[1]
    n_classes = len(le.classes_)
    model = AutopsyMLP(in_dim, n_classes).to(DEVICE)
    print(f"Model params: {sum(p.numel() for p in model.parameters()):,}")

    Xtr_t, ytr_t = to_tensor(X_tr), torch.tensor(y_tr, device=DEVICE)
    Xval_t, yval_t = to_tensor(X_val), torch.tensor(y_val, device=DEVICE)

    # class weights for imbalance
    counts = np.bincount(y_tr, minlength=n_classes)
    weights = torch.tensor(counts.sum() / (n_classes * np.maximum(counts, 1)),
                           dtype=torch.float32, device=DEVICE)
    criterion = nn.CrossEntropyLoss(weight=weights)
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)

    batch = 256
    n = Xtr_t.shape[0]
    best_val, best_state, patience, bad = 0.0, None, 8, 0

    print("Training...")
    for epoch in range(1, args.epochs + 1):
        model.train()
        perm = torch.randperm(n, device=DEVICE)
        for i in range(0, n, batch):
            idx = perm[i:i + batch]
            optimizer.zero_grad()
            loss = criterion(model(Xtr_t[idx]), ytr_t[idx])
            loss.backward()
            optimizer.step()

        model.eval()
        with torch.no_grad():
            val_pred = model(Xval_t).argmax(1)
            val_acc = (val_pred == yval_t).float().mean().item()
        if val_acc > best_val:
            best_val, best_state, bad = val_acc, {k: v.cpu().clone() for k, v in model.state_dict().items()}, 0
        else:
            bad += 1
        if epoch % 5 == 0 or epoch == 1:
            print(f"  epoch {epoch:3d}  val_acc={val_acc:.4f}  best={best_val:.4f}")
        if bad >= patience:
            print(f"  early stop at epoch {epoch} (best val_acc={best_val:.4f})")
            break

    if best_state is not None:
        model.load_state_dict(best_state)

    # Held-out test evaluation
    model.eval()
    with torch.no_grad():
        y_pred = model(to_tensor(X_te)).argmax(1).cpu().numpy()
    acc = accuracy_score(y_te, y_pred)
    macro_f1 = f1_score(y_te, y_pred, average="macro")

    print("\n" + "=" * 60)
    print("AUTOPSY MODEL — HELD-OUT TEST EVALUATION")
    print("=" * 60)
    print(f"Test samples : {len(y_te):,}")
    print(f"Accuracy     : {acc:.4f}  ({acc*100:.2f}%)")
    print(f"Macro F1     : {macro_f1:.4f}")
    print(classification_report(y_te, y_pred, target_names=le.classes_, digits=4))

    torch.save(model.state_dict(), os.path.join(args.out_dir, "autopsy_model.pt"))
    joblib.dump(vectorizer, os.path.join(args.out_dir, "autopsy_vectorizer.joblib"))
    joblib.dump(le, os.path.join(args.out_dir, "autopsy_label_encoder.joblib"))
    with open(os.path.join(args.out_dir, "autopsy_meta.json"), "w") as f:
        json.dump({
            "in_dim": in_dim, "n_classes": n_classes,
            "classes": le.classes_.tolist(),
            "accuracy": float(acc), "macro_f1": float(macro_f1),
            "params": int(sum(p.numel() for p in model.parameters())),
        }, f, indent=2)
    print(f"\nSaved autopsy model + vectorizer + encoder -> {args.out_dir}")


if __name__ == "__main__":
    main()
