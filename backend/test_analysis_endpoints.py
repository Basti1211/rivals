"""
Test script for analysis endpoints with visualization.
Run after docker-compose is up and demo data is loaded via the frontend.

Usage:
    python test_analysis_endpoints.py
"""

import requests
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from typing import Any, Dict, List

# Configuration
BACKEND_URL = "http://localhost:5001/api"

# Style settings
sns.set_style("whitegrid")
plt.rcParams['figure.figsize'] = (14, 8)


def fetch_users_and_tasks() -> Dict[str, Any]:
    """Fetch available users and tasks from the backend."""
    print("Fetching users and tasks...")
    response = requests.post(f"{BACKEND_URL}/data/get-user-and-tasks")
    response.raise_for_status()
    data = response.json()
    
    print(f"  Found {len(data['tasks']['tasks'])} tasks")
    print(f"  Found {len(data['users']['users'])} users")
    return data


def build_analysis_request(users_data: Dict[str, Any], tasks_data: Dict[str, Any]) -> dict:
    """
    Build an analysis request from available users and tasks.
    Uses multiple task-user pairs to produce a meaningful sample.
    """
    users = users_data.get('users', users_data)
    if isinstance(users, dict) and 'users' in users:
        users = users['users']
    if isinstance(users, dict):
        users = [users]

    tasks = tasks_data.get('tasks', tasks_data)
    if isinstance(tasks, dict) and 'tasks' in tasks:
        tasks = tasks['tasks']
    if isinstance(tasks, dict):
        tasks = [tasks]

    if not users:
        raise ValueError("No users found in database")
    if not tasks:
        raise ValueError("No tasks found in database")

    max_tasks = min(20, len(tasks))
    selected_tasks = list(tasks)[:max_tasks]

    interactions = []
    for user in users:
        if user['user'] == 'exquisitor1':
            continue
        hierarchy = user.get('hierarchy', [])
        for task in selected_tasks:
            interactions.append(
                {
                    "user": user["user"],
                    "task": task["name"],
                    "hierarchy": hierarchy,
                }
            )

    print(f"\nBuilding request for {len(interactions)} user-task combinations")
    print(f"  Users: {len(users)}, Tasks: {len(selected_tasks)}")
    print(f"  Hierarchy depth for first user: {len(users[0].get('hierarchy', []))} nodes")

    return {
        "interactions": interactions,
        "actions_to_aggregate": ["keypress", "hover", "scroll", "click"],
        "use_2grams": True,
        "restart_actions": [],
        "refine_actions": [],
    }


def call_classifier_endpoint(request: dict) -> Dict[str, Any]:
    """Call the classifier analysis endpoint."""
    print("\nCalling /analysis/classifier...")
    response = requests.post(f"{BACKEND_URL}/data/analysis/classifier", json=request)
    response.raise_for_status()
    data = response.json()
    
    print(f"  Accuracy: {data['accuracy']:.3f}")
    print(f"  F1 Score: {data['f1']:.3f}")
    print(f"  AUC: {data['auc']:.3f}" if data['auc'] else "  AUC: N/A")
    print(f"  SHAP values shape: {len(data['shap_values'])} x {len(data['shap_values'][0])} samples x features")
    
    return data


def call_motif_endpoint(request: dict) -> Dict[str, Any]:
    """Call the motif analysis endpoint."""
    print("\nCalling /analysis/motif...")
    response = requests.post(f"{BACKEND_URL}/data/analysis/motif", json=request)
    response.raise_for_status()
    data = response.json()
    
    print(f"  Found {len(data['motifs'])} discriminative motifs")
    for i, motif in enumerate(data['motifs'][:3]):
        diff = motif.get('difference')
        diff_text = f"{diff:.4f}" if isinstance(diff, (int, float)) else str(diff)
        print(f"    {i+1}. {motif.get('feature_name')} : diff={diff_text}")
    
    return data


def call_efficiency_endpoint(request: dict) -> Dict[str, Any]:
    """Call the efficiency analysis endpoint."""
    print("\nCalling /analysis/efficiency...")
    response = requests.post(f"{BACKEND_URL}/data/analysis/efficiency", json=request)
    response.raise_for_status()
    data = response.json()
    
    print(f"  Got {len(data['metrics'])} efficiency metrics")
    if data['metrics']:
        metrics_df = pd.DataFrame(data['metrics'])
        print(f"    Mean intensity: {metrics_df['intensity'].mean():.3f}")
        print(f"    Mean persistence: {metrics_df['persistence'].mean():.3f}")
    
    return data


def plot_shap_values(classifier_result: Dict[str, Any]) -> None:
    """Plot SHAP summary."""
    print("\nPlotting SHAP values...")
    
    shap_values = np.array(classifier_result['shap_values'])
    feature_names = classifier_result['feature_names']
    feature_keys = classifier_result['feature_keys']
    
    if len(shap_values) == 0 or len(feature_keys) == 0:
        print("  No SHAP values to plot")
        return
    
    # Create a summary plot using mean absolute SHAP values
    mean_abs_shap = np.mean(np.abs(shap_values), axis=0)
    sorted_indices = np.argsort(mean_abs_shap)[-15:]  # Top 15
    
    fig, ax = plt.subplots(figsize=(12, 8))
    
    sorted_mean_shap = mean_abs_shap[sorted_indices]
    sorted_names = [feature_names.get(feature_keys[i], feature_keys[i]) for i in sorted_indices]
    
    ax.barh(range(len(sorted_names)), sorted_mean_shap, color='steelblue')
    ax.set_yticks(range(len(sorted_names)))
    ax.set_yticklabels(sorted_names)
    ax.set_xlabel('Mean |SHAP value|', fontsize=12)
    ax.set_title('Feature Importance (SHAP Mean Absolute Values)', fontsize=14, fontweight='bold')
    
    plt.tight_layout()
    plt.savefig('shap_summary.png', dpi=150, bbox_inches='tight')
    print("  Saved to shap_summary.png")
    plt.show()


def plot_motifs(motif_result: Dict[str, Any]) -> None:
    """Plot discriminative motifs."""
    print("\nPlotting discriminative motifs...")
    
    motifs = motif_result['motifs']
    if not motifs:
        print("  No motifs to plot")
        return
    
    df = pd.DataFrame(motifs)
    df['difference'] = pd.to_numeric(df['difference'], errors='coerce')
    df = df.dropna(subset=['difference'])
    if df.empty:
        print("  No valid discriminative differences to plot")
        return
    
    df = df.sort_values('difference')
    
    fig, ax = plt.subplots(figsize=(12, 8))
    
    colors = ['#d7191c' if x < 0 else '#2c7bb6' for x in df['difference']]
    ax.barh(df['feature_name'], df['difference'], color=colors)
    
    ax.set_xlabel('Difference (Success Mean - Failure Mean)', fontsize=12)
    ax.set_title('Top Discriminative Behavioral Motifs', fontsize=14, fontweight='bold')
    ax.axvline(0, color='black', linewidth=1, linestyle='-')
    ax.grid(axis='x', linestyle='--', alpha=0.3)
    
    plt.tight_layout()
    plt.savefig('motifs.png', dpi=150, bbox_inches='tight')
    print("  Saved to motifs.png")
    plt.show()


def plot_efficiency(efficiency_result: Dict[str, Any]) -> None:
    """Plot efficiency metrics."""
    print("\nPlotting efficiency metrics...")
    
    metrics = efficiency_result['metrics']
    if not metrics:
        print("  No metrics to plot")
        return
    
    df = pd.DataFrame(metrics)
    
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))
    
    # Intensity plot
    success_intensity = df[df['success'] == True]['intensity']
    fail_intensity = df[df['success'] == False]['intensity']
    
    ax1.hist([fail_intensity, success_intensity], label=['Failed', 'Successful'], 
             bins=8, color=['#d7191c', '#2c7bb6'], alpha=0.7)
    ax1.set_xlabel('Iteration Intensity (Refines / Restarts)', fontsize=12)
    ax1.set_ylabel('Count', fontsize=12)
    ax1.set_title('Iteration Intensity Distribution', fontsize=12, fontweight='bold')
    ax1.legend()
    ax1.grid(axis='y', linestyle='--', alpha=0.3)
    
    # Persistence plot
    success_persist = df[df['success'] == True]['persistence']
    fail_persist = df[df['success'] == False]['persistence']
    
    ax2.hist([fail_persist, success_persist], label=['Failed', 'Successful'], 
             bins=8, color=['#d7191c', '#2c7bb6'], alpha=0.7)
    ax2.set_xlabel('Persistence Depth (Actions per Restart)', fontsize=12)
    ax2.set_ylabel('Count', fontsize=12)
    ax2.set_title('Persistence Depth Distribution', fontsize=12, fontweight='bold')
    ax2.legend()
    ax2.grid(axis='y', linestyle='--', alpha=0.3)
    
    plt.tight_layout()
    plt.savefig('efficiency_metrics.png', dpi=150, bbox_inches='tight')
    print("  Saved to efficiency_metrics.png")
    plt.show()


def main():
    """Run all tests and generate plots."""
    try:
        print("=" * 60)
        print("Analysis Endpoints Test Script")
        print("=" * 60)
        
        # Fetch data from backend
        response = requests.post(f"{BACKEND_URL}/data/get-user-and-tasks")
        response.raise_for_status()
        data = response.json()
        
        users_data = data
        tasks_data = data
        
        # Build request
        request = build_analysis_request(users_data, tasks_data)
        
        # Call endpoints and collect results
        classifier_result = call_classifier_endpoint(request)
        motif_result = call_motif_endpoint(request)
        efficiency_result = call_efficiency_endpoint(request)
        
        # Generate plots
        plot_shap_values(classifier_result)
        plot_motifs(motif_result)
        plot_efficiency(efficiency_result)
        
        print("\n" + "=" * 60)
        print("✓ All tests passed!")
        print("=" * 60)
        print("\nGenerated plots:")
        print("  - shap_summary.png: Feature importance from SHAP")
        print("  - motifs.png: Discriminative behavioral patterns")
        print("  - efficiency_metrics.png: Intensity and persistence distributions")
        
    except requests.exceptions.ConnectionError:
        print("\n❌ ERROR: Could not connect to backend at http://localhost:5001")
        print("Make sure docker-compose is running and the backend is accessible.")
    except requests.exceptions.HTTPError as e:
        print(f"\n❌ ERROR: HTTP request failed")
        print(f"Status: {e.response.status_code}")
        print(f"Response: {e.response.text}")
    except ValueError as e:
        print(f"\n❌ ERROR: {e}")
        print("Make sure demo data is loaded via the frontend.")
    except Exception as e:
        print(f"\n❌ ERROR: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
