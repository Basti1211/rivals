from typing import List, Dict, Any
import numpy as np
import pandas as pd
import shap
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score


class SequencePreprocessor:
    @staticmethod
    def apply_intensity_binning(sessions: List[List[str]], actions_to_aggregate: List[str]) -> List[List[str]]:
        action_lengths = {act: [] for act in actions_to_aggregate}
        all_blocks = []

        for seq in sessions:
            if not seq:
                all_blocks.append([])
                continue

            blocks = []
            current_action = seq[0]
            count = 1

            for act in seq[1:]:
                if act == current_action:
                    count += 1
                else:
                    blocks.append((current_action, count))
                    current_action = act
                    count = 1
            blocks.append((current_action, count))
            all_blocks.append(blocks)

            for act, length in blocks:
                if act in action_lengths:
                    action_lengths[act].append(length)

        tertiles = {}
        for act, lengths in action_lengths.items():
            if lengths:
                p33 = np.percentile(lengths, 33.33)
                p66 = np.percentile(lengths, 66.67)
                tertiles[act] = (p33, p66)
            else:
                tertiles[act] = (0, 0)

        processed_sessions: List[List[str]] = []
        for blocks in all_blocks:
            new_seq: List[str] = []
            for act, count in blocks:
                if act in tertiles:
                    p33, p66 = tertiles[act]
                    if count <= p33:
                        new_count = 1
                    elif count <= p66:
                        new_count = 2
                    else:
                        new_count = 3
                    new_seq.extend([act] * new_count)
                else:
                    new_seq.extend([act] * count)
            processed_sessions.append(new_seq)

        return processed_sessions


class FeatureExtractor:
    def __init__(self, action_vocab: List[str]):
        self.vocab = sorted(list(set(action_vocab)))
        self.vocab_map = {action: i for i, action in enumerate(self.vocab)}
        self.m = len(self.vocab)

    def extract_proportions(self, sessions: List[List[str]]) -> (pd.DataFrame, Dict[str, str]):
        features = []
        feature_names = {f'A{i}_prop': f'{act} (Proportion)' for i, act in enumerate(self.vocab)}

        for seq in sessions:
            counts = np.zeros(self.m)
            for action in seq:
                if action in self.vocab_map:
                    counts[self.vocab_map[action]] += 1

            prop = counts / len(seq) if len(seq) > 0 else counts
            features.append(prop)

        df = pd.DataFrame(features, columns=list(feature_names.keys()))
        return df, feature_names

    def extract_2grams(self, sessions: List[List[str]]) -> (pd.DataFrame, Dict[str, str]):
        features = []
        feature_names: Dict[str, str] = {}
        for i, act1 in enumerate(self.vocab):
            for j, act2 in enumerate(self.vocab):
                feature_names[f'A{i}->A{j}'] = f'{act1} → {act2}'

        for seq in sessions:
            matrix = np.zeros((self.m, self.m))
            if len(seq) > 1:
                for i in range(len(seq) - 1):
                    a1, a2 = seq[i], seq[i+1]
                    if a1 in self.vocab_map and a2 in self.vocab_map:
                        matrix[self.vocab_map[a1], self.vocab_map[a2]] += 1

                row_sums = matrix.sum(axis=1, keepdims=True)
                matrix = np.divide(matrix, row_sums, out=np.zeros_like(matrix), where=row_sums!=0)

            features.append(matrix.flatten())

        df = pd.DataFrame(features, columns=list(feature_names.keys()))
        return df, feature_names


class SimpleClassifier:
    @staticmethod
    def compute_metrics_and_shap(X_df, y_list, feature_name_map: Dict[str, str]) -> Dict[str, Any]:
        y = np.array(y_list).astype(int)
        if len(y) == 0:
            return {"error": "No labels provided"}

        try:
            X_train, X_test, y_train, y_test = train_test_split(X_df, y, test_size=0.2, random_state=42, stratify=y)
        except Exception:
            X_train, X_test, y_train, y_test = X_df, X_df, y, y

        if len(np.unique(y)) < 2:
            return {"error": "Need at least two distinct session outcome classes for classification"}

        rf = RandomForestClassifier(n_estimators=100, random_state=42)
        rf.fit(X_train, y_train)

        y_pred = rf.predict(X_test)
        y_prob = None
        if hasattr(rf, 'predict_proba'):
            prob = rf.predict_proba(X_test)
            if prob.ndim == 2 and prob.shape[1] > 1:
                y_prob = prob[:, 1]

        acc = accuracy_score(y_test, y_pred)
        f1 = f1_score(y_test, y_pred, zero_division=0)
        auc = roc_auc_score(y_test, y_prob) if y_prob is not None and len(np.unique(y_test)) > 1 else None

        feature_keys = list(feature_name_map.keys())
        importances = rf.feature_importances_.tolist()
        importance_list = [
            {"feature_key": k, "feature_name": feature_name_map.get(k, k), "importance": imp}
            for k, imp in zip(feature_keys, importances)
        ]

        explainer = shap.TreeExplainer(rf)
        shap_expl = explainer(X_df, check_additivity=False)
        shap_values = np.asarray(getattr(shap_expl, 'values', shap_expl))

        if shap_values.ndim == 3 and shap_values.shape[2] == 2:
            shap_values = shap_values[:, :, 1]

        shap_rows = shap_values.tolist()

        expected_value = getattr(explainer, 'expected_value', None)
        if isinstance(expected_value, np.ndarray):
            expected_value = expected_value.tolist()
        if hasattr(expected_value, 'tolist') and isinstance(expected_value, np.generic):
            expected_value = float(expected_value.tolist())
        if isinstance(expected_value, list):
            if len(expected_value) == 1:
                expected_value = float(expected_value[0])
            else:
                expected_value = [float(x) for x in expected_value]

        return {
            "accuracy": float(acc),
            "f1": float(f1),
            "auc": float(auc) if auc is not None else None,
            "importances": importance_list,
            "shap_values": shap_rows,
            "shap_expected_value": expected_value,
            "feature_keys": feature_keys,
            "feature_names": feature_name_map,
        }


class MotifAnalyzer:
    @staticmethod
    def analyze_differences(X_df, y_list, feature_name_map: Dict[str, str], top_k: int = 10):
        df = X_df.copy()
        df['success'] = y_list

        success_df = df[df['success'] == True].drop('success', axis=1)
        failure_df = df[df['success'] == False].drop('success', axis=1)
        if success_df.empty or failure_df.empty:
            return []

        succ_mean = success_df.mean()
        fail_mean = failure_df.mean()
        diff = succ_mean - fail_mean

        results = []
        for col in diff.index:
            results.append({
                'feature_key': col,
                'feature_name': feature_name_map.get(col, col),
                'success_mean': float(succ_mean[col]) if not np.isnan(succ_mean[col]) else None,
                'failure_mean': float(fail_mean[col]) if not np.isnan(fail_mean[col]) else None,
                'difference': float(diff[col]) if not np.isnan(diff[col]) else None,
            })

        # sort by absolute difference
        results_sorted = sorted(results, key=lambda r: abs(r['difference'] or 0), reverse=True)
        return results_sorted[: top_k * 2]


class EfficiencyAnalyzer:
    @staticmethod
    def analyze(sessions: List[List[str]], y_list: List[bool], restart_actions: List[str], refine_actions: List[str]):
        restart_set = set(restart_actions)
        refine_set = set(refine_actions)

        metrics = []
        for seq, success in zip(sessions, y_list):
            total = len(seq)
            restarts = sum(1 for act in seq if act in restart_set)
            refines = sum(1 for act in seq if act in refine_set)

            metrics.append({
                'intensity': float(refines / (restarts + 1)),
                'persistence': float(total / (restarts + 1)),
                'success': bool(success),
            })

        return metrics
